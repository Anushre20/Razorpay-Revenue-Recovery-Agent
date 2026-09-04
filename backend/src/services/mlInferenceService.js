import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ARTIFACTS_DIR = path.join(__dirname, '..', 'ml', 'artifacts')

// --------------------------------------------------
// Load artifacts
// --------------------------------------------------

let config = null
let labelEncoders = null
let recoverabilityModel = null
let riskModel = null
let actionModel = null
let modelMetrics = null
let loaded = false

export function loadModels() {
  if (loaded) return true

  try {
    config = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'config.json'), 'utf-8'))
    labelEncoders = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'labelEncoders.json'), 'utf-8'))
    recoverabilityModel = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'recoverabilityModel.json'), 'utf-8'))
    riskModel = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'riskModel.json'), 'utf-8'))
    actionModel = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'actionModel.json'), 'utf-8'))
    modelMetrics = JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, 'modelMetrics.json'), 'utf-8'))
    loaded = true
    console.log('[ML] Models loaded successfully')
    return true
  } catch (err) {
    console.error('[ML] Failed to load models:', err.message)
    return false
  }
}

export function getModelMetrics() {
  return modelMetrics
}

export function isLoaded() {
  return loaded
}

// --------------------------------------------------
// Preprocessing
// --------------------------------------------------

function extractFeatures(transaction) {
  const ch = transaction.customerHistory || {}
  return {
    amount: Number(transaction.amount) || 0,
    attemptCount: Number(transaction.attemptCount) || 1,
    prevSuccessfulPayments: Number(ch.previousSuccessfulPayments) || 0,
    prevFailedPayments: Number(ch.previousFailedPayments) || 0,
    prevRecoveries: Number(ch.previousRecoveries) || 0,
    checkoutDuration: Number(transaction.checkoutDuration) || 0,
    daysOverdue: Number(transaction.daysOverdue) || 0,
    type: transaction.type || 'Failed Payment',
    paymentMethod: transaction.paymentMethod || 'Credit Card',
    failureReason: transaction.failureReason || 'Card Declined',
    customerSegment: transaction.customerSegment || 'Regular',
    deviceType: transaction.deviceType || 'Desktop',
  }
}

function encodeFeatures(raw) {
  const numerical = config.numericalFeatures.map(f => Number(raw[f]) || 0)
  const categorical = config.categoricalFeatures.map(f => {
    const val = raw[f]
    const classes = labelEncoders[f]
    if (!classes) return 0
    const idx = classes.indexOf(val)
    return idx >= 0 ? idx : 0
  })
  return [...numerical, ...categorical]
}

// --------------------------------------------------
// Decision tree inference
// --------------------------------------------------

function predictTree(tree, features) {
  let node = tree
  while (!node.leaf) {
    const featureIdx = config.featureNames.indexOf(node.feature)
    const value = featureIdx >= 0 ? features[featureIdx] : 0
    node = value <= node.threshold ? node.left : node.right
  }
  return node.predicted
}

// --------------------------------------------------
// Gradient boosting inference
// --------------------------------------------------

function predictGradientBoosting(model, features) {
  // Sum of tree predictions (raw margins)
  let margin = model.initPrediction || 0
  for (const tree of model.trees) {
    margin += model.learningRate * predictTree(tree, features)
  }
  return margin
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x))
}

function softmax(values) {
  const maxVal = Math.max(...values)
  const exps = values.map(v => Math.exp(v - maxVal))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

// --------------------------------------------------
// Random forest inference
// --------------------------------------------------

function predictRandomForest(model, features) {
  let sum = 0
  for (const tree of model.trees) {
    sum += predictTree(tree, features)
  }
  return sum / model.trees.length
}

// --------------------------------------------------
// Public prediction API
// --------------------------------------------------

export function predictAll(transaction) {
  if (!loaded) {
    loadModels()
  }

  if (!loaded) {
    return {
      mlAvailable: false,
      error: 'ML models not loaded',
    }
  }

  const raw = extractFeatures(transaction)
  const features = encodeFeatures(raw)

  // Recoverability prediction (binary classification via gradient boosting)
  const recMargin = predictGradientBoosting(recoverabilityModel, features)
  const recoverabilityProbability = sigmoid(recMargin)
  const isRecoverable = recoverabilityProbability >= 0.5

  // Risk score prediction (random forest regression)
  const riskScore = Math.max(1, Math.min(99, Math.round(predictRandomForest(riskModel, features))))

  // Action prediction (multi-class gradient boosting)
  const actionMargins = []
  for (let c = 0; c < actionModel.classes.length; c++) {
    let margin = 0
    if (actionModel.initPrediction && Array.isArray(actionModel.initPrediction)) {
      margin = actionModel.initPrediction[c] || 0
    }
    // Each tree in gradient boosting outputs a single value per class
    // Trees are interleaved: tree[0] for class 0, tree[1] for class 1, etc.
    // Actually for multi-class GBM, estimators_ shape is (n_estimators, n_classes)
    // After flattening, trees are ordered: [est0_cls0, est0_cls1, ..., est1_cls0, ...]
    const nClasses = actionModel.classes.length
    for (let t = c; t < actionModel.trees.length; t += nClasses) {
      margin += actionModel.learningRate * predictTree(actionModel.trees[t], features)
    }
    actionMargins.push(margin)
  }

  const actionProbs = softmax(actionMargins)
  const bestActionIdx = actionProbs.indexOf(Math.max(...actionProbs))
  const predictedAction = actionModel.classes[bestActionIdx]
  const actionConfidence = Math.round(actionProbs[bestActionIdx] * 100) / 100

  // Build per-action probabilities
  const actionProbabilities = {}
  for (let i = 0; i < actionModel.classes.length; i++) {
    actionProbabilities[actionModel.classes[i]] = Math.round(actionProbs[i] * 10000) / 10000
  }

  // Generate reasoning
  const reasoning = generateReasoning(transaction, raw, {
    isRecoverable,
    recoverabilityProbability,
    riskScore,
    predictedAction,
    actionConfidence,
  })

  return {
    mlAvailable: true,
    recoverability: {
      prediction: isRecoverable ? 'recoverable' : 'not_recoverable',
      probability: Math.round(recoverabilityProbability * 10000) / 10000,
    },
    riskScore: {
      prediction: riskScore,
    },
    action: {
      prediction: predictedAction,
      confidence: actionConfidence,
      probabilities: actionProbabilities,
    },
    reasoning,
  }
}

// --------------------------------------------------
// Reasoning generation
// --------------------------------------------------

function generateReasoning(transaction, raw, predictions) {
  const reasons = []

  if (predictions.isRecoverable) {
    reasons.push(`High recovery potential (${Math.round(predictions.recoverabilityProbability * 100)}% probability)`)
  } else {
    reasons.push(`Low recovery potential (${Math.round(predictions.recoverabilityProbability * 100)}% probability)`)
  }

  if (predictions.riskScore >= 70) {
    reasons.push('High risk score indicates significant recovery challenge')
  } else if (predictions.riskScore >= 40) {
    reasons.push('Moderate risk score')
  } else {
    reasons.push('Low risk score favors recovery')
  }

  if (raw.attemptCount >= 3) {
    reasons.push(`${raw.attemptCount} prior attempts suggest persistent issue`)
  }

  if (raw.prevSuccessfulPayments >= 10) {
    reasons.push('Strong payment history increases recovery likelihood')
  }

  if (raw.prevFailedPayments >= 6) {
    reasons.push('Elevated historical failures reduce confidence')
  }

  const failureNotes = {
    'Insufficient Funds': 'Temporary issue likely resolvable with retry',
    'Card Declined': 'May benefit from alternative payment method',
    'Bank Server Timeout': 'Transient failure, good retry candidate',
    'Network Error': 'Temporary connectivity issue',
    'Expired Card': 'Requires card update before retry',
    'Payment Method Expired': 'Requires payment method refresh',
    'Checkout Abandoned': 'Customer intent exists, re-engagement possible',
    '3D Secure Authentication Failed': 'Authentication issue may resolve on retry',
  }
  if (failureNotes[raw.failureReason]) {
    reasons.push(failureNotes[raw.failureReason])
  }

  reasons.push(`ML confidence in action: ${Math.round(predictions.actionConfidence * 100)}%`)

  return reasons
}
