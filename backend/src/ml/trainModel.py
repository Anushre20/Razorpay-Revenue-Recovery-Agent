#!/usr/bin/env python3
"""
Phase 3 ML Training Script
Trains recovery intelligence models on historical transaction data.
Exports trained models as JSON for Node.js inference.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_absolute_error, mean_squared_error, r2_score,
)

# --------------------------------------------------
# Configuration
# --------------------------------------------------

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_DIR = Path(__file__).parent / "artifacts"
TRANSACTIONS_FILE = DATA_DIR / "transactions.json"
RANDOM_STATE = 42
TEST_SIZE = 0.2

CATEGORICAL_FEATURES = [
    "type", "paymentMethod", "failureReason",
    "customerSegment", "deviceType",
]

NUMERICAL_FEATURES = [
    "amount", "attemptCount",
    "prevSuccessfulPayments", "prevFailedPayments", "prevRecoveries",
    "checkoutDuration", "daysOverdue",
]

# --------------------------------------------------
# Data loading
# --------------------------------------------------

def load_data():
    with open(TRANSACTIONS_FILE, "r") as f:
        transactions = json.load(f)

    features, labels = [], []
    for txn in transactions:
        row = {
            "amount": txn.get("amount", 0),
            "attemptCount": txn.get("attemptCount", 1),
            "prevSuccessfulPayments": txn.get("customerHistory", {}).get("previousSuccessfulPayments", 0),
            "prevFailedPayments": txn.get("customerHistory", {}).get("previousFailedPayments", 0),
            "prevRecoveries": txn.get("customerHistory", {}).get("previousRecoveries", 0),
            "checkoutDuration": txn.get("checkoutDuration") or 0,
            "daysOverdue": txn.get("daysOverdue", 0),
            "type": txn.get("type", "Failed Payment"),
            "paymentMethod": txn.get("paymentMethod", "Credit Card"),
            "failureReason": txn.get("failureReason", "Card Declined"),
            "customerSegment": txn.get("customerSegment", "Regular"),
            "deviceType": txn.get("deviceType", "Desktop"),
        }
        label = {
            "recoverability": txn.get("recoverability", 50),
            "riskScore": txn.get("riskScore", 50),
            "groundTruthRecoverable": txn.get("groundTruthRecoverable", False),
            "groundTruthAction": txn.get("groundTruthAction", "No Action"),
        }
        features.append(row)
        labels.append(label)
    return features, labels


def encode_features(features, label_encoders=None, fit=True):
    X_numerical = [[row[f] for f in NUMERICAL_FEATURES] for row in features]
    X_categorical = [[row[f] for f in CATEGORICAL_FEATURES] for row in features]
    X_numerical = np.array(X_numerical, dtype=np.float64)

    if label_encoders is None:
        label_encoders = {}
        for i, feat in enumerate(CATEGORICAL_FEATURES):
            le = LabelEncoder()
            le.fit([row[i] for row in X_categorical])
            label_encoders[feat] = le

    X_encoded = []
    for row in X_categorical:
        encoded_row = []
        for i, feat in enumerate(CATEGORICAL_FEATURES):
            le = label_encoders[feat]
            val = row[i]
            encoded_row.append(le.transform([val])[0] if val in le.classes_ else 0)
        X_encoded.append(encoded_row)

    X_encoded = np.array(X_encoded, dtype=np.float64)
    return np.hstack([X_numerical, X_encoded]), label_encoders


# --------------------------------------------------
# Tree export
# --------------------------------------------------

def tree_to_dict(tree, feature_names, is_regressor=False):
    """Convert a single sklearn DecisionTree to a JSON dict."""
    tree_ = tree.tree_
    feature_name = [feature_names[i] if i >= 0 else "undefined!" for i in tree_.feature]

    def recurse(node):
        if tree_.feature[node] == -2:  # Leaf
            val = float(tree_.value[node].flatten()[0])
            return {
                "leaf": True,
                "predicted": round(val, 4),
                "samples": int(tree_.n_node_samples[node]),
            }
        return {
            "leaf": False,
            "feature": feature_name[node],
            "threshold": round(float(tree_.threshold[node]), 4),
            "samples": int(tree_.n_node_samples[node]),
            "left": recurse(tree_.children_left[node]),
            "right": recurse(tree_.children_right[node]),
        }
    return recurse(0)


def extract_trees(model):
    """Flatten all individual DecisionTree estimators from an ensemble."""
    trees = []
    for item in model.estimators_:
        if isinstance(item, np.ndarray):
            for sub in item.flatten():
                if hasattr(sub, 'tree_'):
                    trees.append(sub)
        elif hasattr(item, 'tree_'):
            trees.append(item)
        elif hasattr(item, 'estimators_'):
            for sub in item.estimators_:
                if hasattr(sub, 'tree_'):
                    trees.append(sub)
    return trees


# --------------------------------------------------
# Train models
# --------------------------------------------------

def train_recoverability(X_train, y_rec_train, X_test, y_rec_test, feature_names):
    print("\n--- Training Recoverability Classifier ---")
    y_train_bin = (np.array(y_rec_train) >= 50).astype(int)
    y_test_bin = (np.array(y_rec_test) >= 50).astype(int)

    model = GradientBoostingClassifier(
        n_estimators=100, max_depth=5, learning_rate=0.1, random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train_bin)
    y_pred = model.predict(X_test)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test_bin, y_pred)), 4),
        "precision": round(float(precision_score(y_test_bin, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test_bin, y_pred, zero_division=0)), 4),
        "f1Score": round(float(f1_score(y_test_bin, y_pred, zero_division=0)), 4),
        "featureImportances": dict(zip(feature_names, [round(float(x), 4) for x in model.feature_importances_])),
    }
    print(f"  Accuracy: {metrics['accuracy']}, F1: {metrics['f1Score']}")

    trees = extract_trees(model)
    model_json = {
        "type": "gradient_boosting",
        "learningRate": model.learning_rate,
        "initPrediction": round(float(model.init_.predict(np.zeros((1, X_train.shape[1])))[0]), 4),
        "trees": [tree_to_dict(t, feature_names) for t in trees],
        "featureNames": feature_names,
    }
    return model, metrics, model_json


def train_risk(X_train, y_risk_train, X_test, y_risk_test, feature_names):
    print("\n--- Training Risk Score Regressor ---")
    model = RandomForestRegressor(
        n_estimators=100, max_depth=8, random_state=RANDOM_STATE, n_jobs=-1,
    )
    model.fit(X_train, y_risk_train)
    y_pred = model.predict(X_test)

    metrics = {
        "mae": round(float(mean_absolute_error(y_risk_test, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_risk_test, y_pred))), 4),
        "r2Score": round(float(r2_score(y_risk_test, y_pred)), 4),
        "featureImportances": dict(zip(feature_names, [round(float(x), 4) for x in model.feature_importances_])),
    }
    print(f"  MAE: {metrics['mae']}, R²: {metrics['r2Score']}")

    trees = extract_trees(model)
    model_json = {
        "type": "random_forest",
        "trees": [tree_to_dict(t, feature_names, is_regressor=True) for t in trees],
        "featureNames": feature_names,
    }
    return model, metrics, model_json


def train_action(X_train, y_action_train, X_test, y_action_test, feature_names, classes):
    print("\n--- Training Recovery Action Classifier ---")
    le = LabelEncoder()
    le.fit(classes)
    y_train_enc = le.transform(y_action_train)
    y_test_enc = le.transform(y_action_test)

    model = GradientBoostingClassifier(
        n_estimators=150, max_depth=6, learning_rate=0.1, random_state=RANDOM_STATE,
    )
    model.fit(X_train, y_train_enc)
    y_pred_enc = model.predict(X_test)

    class_names = list(le.classes_)
    per_class = {}
    prec_arr = precision_score(y_test_enc, y_pred_enc, average=None, zero_division=0)
    rec_arr = recall_score(y_test_enc, y_pred_enc, average=None, zero_division=0)
    f1_arr = f1_score(y_test_enc, y_pred_enc, average=None, zero_division=0)
    for i, cls in enumerate(class_names):
        per_class[cls] = {
            "precision": round(float(prec_arr[i]), 4),
            "recall": round(float(rec_arr[i]), 4),
            "f1Score": round(float(f1_arr[i]), 4),
        }

    metrics = {
        "accuracy": round(float(accuracy_score(y_test_enc, y_pred_enc)), 4),
        "macroPrecision": round(float(precision_score(y_test_enc, y_pred_enc, average='macro', zero_division=0)), 4),
        "macroRecall": round(float(recall_score(y_test_enc, y_pred_enc, average='macro', zero_division=0)), 4),
        "macroF1": round(float(f1_score(y_test_enc, y_pred_enc, average='macro', zero_division=0)), 4),
        "perClass": per_class,
        "featureImportances": dict(zip(feature_names, [round(float(x), 4) for x in model.feature_importances_])),
    }
    print(f"  Accuracy: {metrics['accuracy']}, Macro F1: {metrics['macroF1']}")

    trees = extract_trees(model)
    model_json = {
        "type": "gradient_boosting",
        "learningRate": model.learning_rate,
        "classes": class_names,
        "initPrediction": [round(float(v), 4) for v in model.init_.predict(np.zeros((1, X_train.shape[1])))],
        "trees": [tree_to_dict(t, feature_names) for t in trees],
        "featureNames": feature_names,
    }
    return model, metrics, model_json


# --------------------------------------------------
# Main
# --------------------------------------------------

def main():
    print("=" * 60)
    print("Revenue Recovery Agent - ML Training Pipeline")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nLoading data from {TRANSACTIONS_FILE}...")
    features, labels = load_data()
    print(f"Loaded {len(features)} transactions")

    y_rec = np.array([l["recoverability"] for l in labels])
    y_risk = np.array([l["riskScore"] for l in labels])
    y_action = np.array([l["groundTruthAction"] for l in labels])

    print("Encoding features...")
    X, label_encoders = encode_features(features, fit=True)
    print(f"Feature matrix: {X.shape}")

    encoders_json = {feat: list(le.classes_) for feat, le in label_encoders.items()}
    with open(OUTPUT_DIR / "labelEncoders.json", "w") as f:
        json.dump(encoders_json, f, indent=2)

    idx = np.arange(len(X))
    X_train, X_test, idx_train, idx_test = train_test_split(X, idx, test_size=TEST_SIZE, random_state=RANDOM_STATE)
    print(f"Train: {len(X_train)}, Test: {len(X_test)}")

    feature_names = NUMERICAL_FEATURES + CATEGORICAL_FEATURES

    _, rec_metrics, rec_json = train_recoverability(X_train, y_rec[idx_train], X_test, y_rec[idx_test], feature_names)
    _, risk_metrics, risk_json = train_risk(X_train, y_risk[idx_train], X_test, y_risk[idx_test], feature_names)
    _, action_metrics, action_json = train_action(X_train, y_action[idx_train], X_test, y_action[idx_test], feature_names, sorted(set(y_action)))

    # Save artifacts
    for name, data in [
        ("recoverabilityModel.json", rec_json),
        ("riskModel.json", risk_json),
        ("actionModel.json", action_json),
    ]:
        with open(OUTPUT_DIR / name, "w") as f:
            json.dump(data, f)

    config = {
        "numericalFeatures": NUMERICAL_FEATURES,
        "categoricalFeatures": CATEGORICAL_FEATURES,
        "featureNames": feature_names,
    }
    with open(OUTPUT_DIR / "config.json", "w") as f:
        json.dump(config, f, indent=2)

    model_metrics = {
        "totalTransactions": len(features),
        "trainSize": len(X_train),
        "testSize": len(X_test),
        "featureCount": X.shape[1],
        "features": feature_names,
        "recoverability": rec_metrics,
        "riskScore": risk_metrics,
        "action": action_metrics,
    }
    with open(OUTPUT_DIR / "modelMetrics.json", "w") as f:
        json.dump(model_metrics, f, indent=2)

    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
    print(f"Artifacts saved to: {OUTPUT_DIR}")
    for name in ["recoverabilityModel.json", "riskModel.json", "actionModel.json", "modelMetrics.json", "labelEncoders.json", "config.json"]:
        size = os.path.getsize(OUTPUT_DIR / name) / 1024
        print(f"  {name} ({size:.1f} KB)")

    print("\nSummary:")
    print(f"  Recoverability - Accuracy: {rec_metrics['accuracy']}, F1: {rec_metrics['f1Score']}")
    print(f"  Risk Score     - MAE: {risk_metrics['mae']}, R²: {risk_metrics['r2Score']}")
    print(f"  Action         - Accuracy: {action_metrics['accuracy']}, Macro F1: {action_metrics['macroF1']}")


if __name__ == "__main__":
    main()
