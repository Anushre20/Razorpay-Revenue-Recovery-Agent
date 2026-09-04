import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '..', 'data', 'auditLogs.json')

function readAuditLogs() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8')
      return []
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.error('auditLogs.json is not an array, returning []')
      return []
    }
    return parsed
  } catch (error) {
    console.error('Failed to read auditLogs.json:', error.message)
    return []
  }
}

function writeAuditLogs(logs) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(logs, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write auditLogs.json:', error.message)
    return false
  }
}

function generateAuditId() {
  return `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

function addAuditRecord(record) {
  const logs = readAuditLogs()
  logs.push(record)
  const written = writeAuditLogs(logs)
  if (!written) {
    console.error(`Warning: audit record ${record.auditId} not persisted to disk`)
  }
  return written
}

export function recordDetected(txnId, transaction) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'DETECTED',
    action: 'Detection',
    status: 'DETECTED',
    details: {
      transactionId: txnId,
      source: transaction.source || 'unknown',
      amount: transaction.amount,
      type: transaction.type,
      failureReason: transaction.failureReason,
      merchant: transaction.merchant,
      customer: transaction.customer,
    },
  }
  addAuditRecord(record)
  return record
}

export function recordDiagnosed(txnId, diagnosis) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'DIAGNOSED',
    action: 'Diagnosis',
    status: 'DIAGNOSED',
    details: {
      problem: diagnosis.problem,
      rootCause: diagnosis.rootCause,
      recoverability: diagnosis.recoverability,
      riskScore: diagnosis.riskScore,
      recommendedAction: diagnosis.recommendedAction,
      confidence: diagnosis.confidence,
      mlPrediction: diagnosis.mlPrediction,
    },
  }
  addAuditRecord(record)
  return record
}

export function recordAIDecision(decision) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: decision.transactionId,
    eventType: 'AI_DECISION',
    action: decision.action,
    status: 'DECIDED',
    details: {
      reason: decision.reason,
      recoverability: decision.recoverability,
      riskScore: decision.riskScore,
      amount: decision.amount,
      failureReason: decision.failureReason,
      requiresApproval: decision.requiresApproval,
      confidence: decision.mlPrediction?.action?.confidence,
      mlAction: decision.mlPrediction?.action?.prediction,
      mlAvailable: decision.mlPrediction?.mlAvailable,
    },
  }
  addAuditRecord(record)
  return record
}

export function recordPolicyCheck(txnId, guardrailResult) {
  const rulesTriggered = (guardrailResult.failedGuardrails || []).map(g => ({
    rule: g.guardrail,
    reason: g.reason,
  }))

  const policyStatus = guardrailResult.passed ? 'PASSED'
    : guardrailResult.requiresApproval ? 'APPROVAL_REQUIRED'
    : 'BLOCKED'

  const explanation = guardrailResult.passed
    ? `Policy check passed. Action "${guardrailResult.requestedAction}" is allowed.`
    : guardrailResult.requiresApproval
      ? `Action "${guardrailResult.requestedAction}" requires human approval. ${rulesTriggered.map(r => r.reason).join(' ')}`
      : `Action "${guardrailResult.requestedAction}" blocked by policy. ${rulesTriggered.map(r => r.reason).join(' ')}`

  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'POLICY_CHECK',
    action: guardrailResult.requestedAction,
    status: policyStatus,
    details: {
      policyStatus,
      requestedAction: guardrailResult.requestedAction,
      finalAction: guardrailResult.allowedAction,
      requiresApproval: guardrailResult.requiresApproval,
      passed: guardrailResult.passed,
      rulesTriggered,
      explanation,
      failedGuardrails: guardrailResult.failedGuardrails,
      checks: guardrailResult.checks,
      policy: guardrailResult.policy,
    },
  }
  addAuditRecord(record)
  return record
}

export function recordActionResult(txnId, executionResult) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'ACTION_RESULT',
    action: executionResult.action,
    status: executionResult.status,
    details: {
      executed: executionResult.executed,
      ...(executionResult.provider && { provider: executionResult.provider }),
      ...(executionResult.mode && { mode: executionResult.mode }),
      ...(executionResult.amount && { amount: executionResult.amount }),
      ...(executionResult.razorpayPaymentLinkId && { razorpayPaymentLinkId: executionResult.razorpayPaymentLinkId }),
      ...(executionResult.shortUrl && { shortUrl: executionResult.shortUrl }),
      ...(executionResult.razorpayOrderId && { razorpayOrderId: executionResult.razorpayOrderId }),
      ...(executionResult.orderStatus && { orderStatus: executionResult.orderStatus }),
      ...(executionResult.reason && { reason: executionResult.reason }),
    },
  }
  addAuditRecord(record)
  return record
}

export function recordSimulationResult(txnId, simulationResult) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'SIMULATION_RESULT',
    action: simulationResult.action,
    status: simulationResult.status,
    details: {
      succeeded: simulationResult.succeeded,
      originalAmount: simulationResult.originalAmount,
      recoveredAmount: simulationResult.recoveredAmount,
      recoverability: simulationResult.recoverability,
      riskScore: simulationResult.riskScore,
      failureReason: simulationResult.failureReason,
      finalAction: simulationResult.finalAction,
    },
  }
  addAuditRecord(record)
  return record
}

export function getAllAuditLogs() {
  return readAuditLogs()
}

export function getAuditLogsByTxnId(txnId) {
  const logs = readAuditLogs()
  return logs.filter(log => log.transactionId === txnId)
}

export function recordRecoveryResult(txnId, recoveryResult) {
  const record = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    transactionId: txnId,
    eventType: 'RECOVERY_RESULT',
    action: recoveryResult.action || 'Unknown',
    status: recoveryResult.status,
    details: {
      status: recoveryResult.status,
      executed: recoveryResult.executed,
      message: recoveryResult.message,
      recoveredAmount: recoveryResult.recoveredAmount || 0,
    },
  }
  addAuditRecord(record)
  return record
}
