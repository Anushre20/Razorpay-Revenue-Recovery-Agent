# Razorpay Revenue Recovery Agent

An AI-powered autonomous revenue recovery agent that detects failed payment opportunities, diagnoses revenue leakage, predicts recoverability and risk using trained ML models, recommends recovery actions, enforces merchant-configured guardrails, executes supported actions through Razorpay Test Mode, and maintains a complete audit trail — built for the **Razorpay AI Buildathon, Track 3: AI Revenue Recovery**.

---

## 🚨 Problem

Failed payments, checkout abandonment, and subscription failures cost merchants significant recurring revenue. Most recovery workflows are either fully manual (support teams triage individually) or blindly automated (retry every transaction identically). Neither approach accounts for *why* a payment failed, *how recoverable* it is, or *what the risk* of automated recovery is. Retrying a ₹100,000 failed transaction the same way as a ₹500 one wastes effort and creates operational risk.

---

## 💡 Solution

The Revenue Recovery Agent is a **decision-making system**, not a static dashboard. For every failed transaction, it runs an autonomous 7-stage pipeline:

```
Transaction → Detect → Diagnose → ML Predict → AI Decide → Policy Check → Execute → Recover → Audit
```

Autonomy is bounded by merchant-defined policies. **AI recommends the action; policy determines whether the action is allowed.** When a guardrail blocks execution or requires approval, the agent stops and escalates.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Razorpay Test Mode Integration** | Order creation, payment link generation, credential verification |
| **Transaction Ingestion** | Ingests failed/abandoned transactions via API into a unified store |
| **ML Recoverability Prediction** | Gradient Boosting classifier — is this transaction recoverable? |
| **Risk Scoring** | Random Forest regressor — risk score 1–99 |
| **Action Recommendation** | Multi-class classifier — recommends one of 8 recovery actions |
| **Autonomous 7-Stage Agent** | Detect → Diagnose → Decide → Policy → Execute → Recover → Audit |
| **Guardrail Enforcement** | Configurable limits on retry attempts, amount, and recoverability |
| **Human Approval Workflow** | Transactions exceeding policy thresholds are paused for review |
| **Razorpay Test Mode Execution** | Creates real test orders and payment links for supported actions |
| **Recovery Simulation** | Simulates outcomes without executing through Razorpay |
| **Merchant Intelligence** | Aggregated failure patterns, segments, and recovery opportunities |
| **Interactive Guardrail Config** | Edit rules at runtime with live preview of impact |
| **Audit Trail + CSV Export** | Timestamped log of every stage, exportable as structured CSV |
| **Historical Model Evaluation** | Precision, recall, F1 evaluated against 5,000 labeled transactions |
| **Idempotent Execution** | Duplicate protection — existing agent runs are not re-executed |

---

## 🧠 AI / ML

### Training Pipeline

Models are trained in Python using **scikit-learn** on 5,000 synthetic historical transactions, then exported as JSON decision trees for **pure JavaScript inference** at runtime — no Python runtime required during serving.

**Training:** `backend/src/ml/trainModel.py` | **Artifacts:** `backend/src/ml/artifacts/`

### Models

| Model | Algorithm | Task |
|---|---|---|
| Recoverability | GradientBoostingClassifier (100 trees, depth 5) | Binary — recoverable or not |
| Risk Score | RandomForestRegressor (100 trees, depth 8) | Regression — risk score 1–99 |
| Action | GradientBoostingClassifier (150 trees, depth 6) | Multi-class — which of 8 actions |

### Features (12)

**Numerical:** `amount`, `attemptCount`, `prevSuccessfulPayments`, `prevFailedPayments`, `prevRecoveries`, `checkoutDuration`, `daysOverdue`

**Categorical:** `type`, `paymentMethod`, `failureReason`, `customerSegment`, `deviceType`

Top predictive features: `failureReason` and `attemptCount`.

### Inference

`mlInferenceService.js` traverses exported JSON decision trees recursively, applies gradient boosting summation, sigmoid (binary), and softmax (multi-class) activations — all in pure JavaScript.

### Historical Model Evaluation

*Evaluated on 1,000 held-out test transactions (80/20 split from 5,000 synthetic records).*

| Metric | Recoverability | Risk Score | Action |
|---|---|---|---|
| **Accuracy** | 98.3% | — | 74.9% |
| **F1 / R²** | 0.9876 | R² = 0.9104 | Macro F1 = 0.4539 |
| **Precision** | 0.984 | — | — |
| **Recall** | 0.9912 | — | — |
| **MAE** | — | 4.07 | — |

These are **historical model evaluation metrics**, not live production performance.

---

## 🤖 Autonomous Agent Architecture

| Stage | What Happens |
|---|---|
| **1. DETECT** | Identifies the failed transaction — source, amount, type, failure reason |
| **2. DIAGNOSE** | ML-powered root cause, urgency, recoverability, risk score, recommended action |
| **3. DECIDE** | AI recommends a recovery action (Smart Retry, Payment Link, etc.) with reasoning |
| **4. POLICY** | Guardrail checks — result: PASSED, BLOCKED, or APPROVAL_REQUIRED |
| **5. EXECUTE** | Creates Razorpay test order or payment link — only for supported actions |
| **6. RECOVER** | Tracks status: PENDING (awaiting customer), NOT_STARTED, NOT_RECOVERED |
| **7. AUDIT** | Records complete audit trail — decision, policy, execution, recovery status |

The agent **stops at stage 4** when a guardrail blocks (`BLOCKED`) or approval is required (`HUMAN_APPROVAL_REQUIRED`).

**Important:** Creating a Razorpay order or payment link means the action was *initiated* — it does not mean the customer has paid. Recovery remains `PENDING` until confirmed.

---

## 🛡️ Safety & Guardrails

| Rule | Default | Description |
|---|---|---|
| **Maximum Retry Attempts** | 3 | Blocks retry if transaction has already reached this many attempts |
| **Automatic Recovery Amount** | ₹25,000 | Transactions above this require human approval |
| **Minimum Recoverability** | 30% | Actions blocked if ML recoverability score is below threshold |

```
AI Recommendation → Policy Evaluation
  → PASSED:            Action executes automatically
  → BLOCKED:           Action replaced with "Human Escalation"
  → APPROVAL_REQUIRED: Action paused, pending human review
```

Rules are configurable at runtime with live preview of impact before applying changes.

---

## 🔍 Audit & Explainability

Every agent run records the full decision lifecycle:

```
DETECTED → DIAGNOSED → AI_DECISION → POLICY_CHECK → ACTION_RESULT → RECOVERY_RESULT
```

Each record includes: AI recommendation, confidence, diagnosis, recoverability/risk scores, policy status, guardrail rules triggered, execution result, Razorpay provider reference, and final recovery status. Exportable as structured CSV.

---

## 📊 Evaluation & Proof

### Historical Model Evaluation

Based on 5,000 labeled synthetic transactions (test set: 1,000):

| Metric | Value |
|---|---|
| Recoverability Accuracy | 98.3% |
| Recoverability F1 | 0.9876 |
| Risk Score MAE | 4.07 |
| Risk Score R² | 0.9104 |
| Action Accuracy | 74.9% |

### Actual Recovery Performance

Based on current Test Mode activity from the running system:

- Confirmed vs pending recovery amounts
- Successful vs failed executions
- Unsupported actions (Email Reminder, WhatsApp Reminder — no Razorpay flow)
- Policy blocks and approval-required counts
- Agent run status distribution

**Historical model metrics are not presented as live recovery performance.** Creating a Razorpay order means the action was *executed* — it does not mean the customer paid.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 React Frontend (Vite + TS)                │
│                       Port 8443                           │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API
┌──────────────────────▼───────────────────────────────────┐
│                Node.js / Express API                      │
│                      Port 5001                            │
├──────────────────────────────────────────────────────────┤
│  Transaction Store │ ML Inference (JS) │ Diagnosis Svc   │
│         ┌──────────▼──────────────────▼─────────┐       │
│         │     Autonomous Recovery Agent          │       │
│         │  Detect→Diagnose→Decide→Policy→Execute │       │
│         └──────────────────┬────────────────────┘       │
│                            │                             │
│  Guardrails / Policy  ◄────┘    Razorpay Test Mode      │
│                            │                             │
│  Audit Trail │ Evaluation │ Merchant Intelligence       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│         Python Training Pipeline (offline)                │
│    scikit-learn → JSON export → JS inference at runtime   │
└──────────────────────────────────────────────────────────┘
```

Training and inference are deliberately separate. Training runs offline in Python; exported JSON trees are inferred in pure JavaScript at runtime.

---

## 🧰 Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS 4, Recharts |
| **Backend** | Node.js (ES Modules), Express 5, Razorpay SDK 2.9, dotenv, cors |
| **AI/ML** | Python 3, scikit-learn (GradientBoosting, RandomForest), NumPy |
| **ML Inference** | Pure JavaScript — JSON tree traversal, sigmoid, softmax |
| **Persistence** | JSON files (transactions, audit logs, guardrail config, agent runs) |

---

## 📁 Project Structure

```
Revenue-Recovery-Agent/
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # All views (single-file SPA)
│   │   ├── api/                 # API client + TypeScript interfaces
│   │   └── data/                # Chart fallback data
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── server.js            # Express app, route mounting
    │   ├── routes/              # 12 route files
    │   ├── controllers/         # 12 controllers
    │   ├── services/            # 16 services (core logic)
    │   │   ├── autonomousRecoveryService.js  # 7-stage agent
    │   │   ├── mlInferenceService.js         # JS tree inference
    │   │   ├── guardrailService.js           # Policy enforcement
    │   │   ├── executionService.js           # Razorpay execution
    │   │   └── transactionStore.js           # Unified data layer
    │   ├── ml/
    │   │   ├── trainModel.py               # Python training
    │   │   └── artifacts/                  # Exported model JSON
    │   └── data/
    │       ├── transactions.json           # 5,000 synthetic records
    │       └── guardrailConfig.json        # Runtime config
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (only for retraining ML models)
- Razorpay Test Mode API keys ([dashboard.razorpay.com](https://dashboard.razorpay.com))

### Clone

```bash
git clone https://github.com/Anushre20/Revenue-Recovery-Agent.git
cd Revenue-Recovery-Agent
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your Razorpay Test Mode credentials:

```
PORT=5001
NODE_ENV=development
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

> Razorpay credentials are backend-only — never exposed to the frontend.

### Frontend

```bash
cd frontend
npm install
```

### Run

**Backend** (Terminal 1): `cd backend && npm run dev` → **http://localhost:5001**

**Frontend** (Terminal 2): `cd frontend && npm run dev` → **http://localhost:8443**

---

## 🔌 API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| **Agent** | | |
| POST | `/api/agent/recovery/:txnId` | Trigger autonomous recovery pipeline |
| GET | `/api/agent/runs` | List all agent runs |
| POST | `/api/agent/runs/:id/approve` | Approve a blocked run |
| POST | `/api/agent/runs/:id/reject` | Reject a blocked run |
| GET | `/api/agent/stats` | Agent run statistics |
| **Transactions** | | |
| GET | `/api/transactions` | List transactions (filterable by source) |
| POST | `/api/transactions/evaluate` | Ingest + evaluate a new transaction |
| **Recovery** | | |
| POST | `/api/recovery/execute/:txnId` | Execute recovery via Razorpay |
| POST | `/api/recovery/simulate/:txnId` | Simulate recovery (no execution) |
| **Guardrails** | | |
| GET/PUT | `/api/guardrail-config` | Get / update guardrail configuration |
| **Audit** | | |
| GET | `/api/audit` | Full audit trail |
| **Evaluation** | | |
| GET | `/api/evaluation` | Historical model metrics |
| GET | `/api/evaluation/actual-performance` | Actual execution performance |
| **Integration** | | |
| POST | `/api/integration/sync` | Sync transactions from Razorpay |
| **Merchant** | | |
| GET | `/api/merchant/intelligence` | Aggregated merchant intelligence |

---

## 🧪 Demo Flow

1. **Connect Razorpay Test Mode** — Enter test API credentials in the Integration view.
2. **Ingest a failed transaction** — POST to `/api/transactions/evaluate` or sync from Razorpay.
3. **Agent detects it** — Transaction appears in the unified store.
4. **ML diagnoses** — Recoverability, risk score, and recommended action are predicted.
5. **Agent recommends** — AI selects a recovery action with reasoning.
6. **Guardrail evaluates** — Policy checks retry count, amount, and recoverability.
7. **Execution** — Supported actions (Smart Retry → order, Payment Link → link) execute via Razorpay Test Mode.
8. **Recovery tracking** — Status remains `PENDING` until the customer pays.
9. **Audit trail** — Complete lifecycle is logged and visible in the Audit view.
10. **Evaluation** — Analytics separates model evaluation from actual execution performance.

---

## 🧩 Example Safety Scenario

A **₹80,871** transaction triggers an AI **Smart Retry** recommendation. During Policy:

- `maxAutomaticRecoveryAmount = ₹25,000`
- ₹80,871 **exceeds** the limit
- Result: **APPROVAL_REQUIRED** → agent pauses

The retry is never executed automatically. A human must approve. This demonstrates **bounded autonomy** — AI recommendation constrained by merchant-configured safety policy.

---

## ⚠️ Data & Evaluation Transparency

| Data Source | Purpose | Notes |
|---|---|---|
| **5,000 historical transactions** | ML training + evaluation | Synthetic dataset with labeled ground truth |
| **Razorpay Test Mode** | Integration and execution | Test environment — no real money |
| **Demo transactions** | Ingestion demonstration | Created via API |
| **Current agent metrics** | Execution performance | Based on Test/Demo activity only |

- **Test Mode is NOT production.** No real payments are processed.
- **Demo data is NOT real merchant data.** Synthetic for demonstration.
- **Confirmed recovery is conservative.** Creating an order does not mean the customer paid.

---

## 🔮 Future Scope

1. **Production Razorpay Webhook Integration** — Detect failures and confirm outcomes via production webhooks.
2. **Closed-Loop Recovery Learning** — Feed confirmed outcomes back into ML to improve action selection.
3. **Adaptive Recovery Policies** — Learn merchant-specific thresholds while maintaining safety boundaries.
4. **Multi-Channel Recovery** — Email, WhatsApp, SMS with consent management and rate controls.
5. **Customer-Level Intelligence** — CLV and historical response features for personalized strategies.
6. **A/B Testing** — Compare strategies and measure incremental recovered revenue.
7. **Production Event Architecture** — PostgreSQL, event streaming, webhook-driven async processing.

---

## 🎯 Why This Matters

Not a payment failure dashboard. A system that **detects** → **diagnoses** → **predicts** → **decides** → **checks policy** → **executes** → **audits** — with human approval enforced at every boundary.

Detection + AI Diagnosis + ML Prediction + Autonomous Decision-Making + Bounded Execution + Merchant-Configured Safety + Human Approval + Auditability + Honest Evaluation.

---

## Author

Built for the Razorpay AI Buildathon — Track 3: AI Revenue Recovery.

**Anupama**
