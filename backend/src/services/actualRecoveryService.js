import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const SRC_DATA_DIR = path.join(__dirname, '..', 'data')

function readJsonFile(filename, preferSrc = false) {
  try {
    let filePath = path.join(DATA_DIR, filename)
    if (!fs.existsSync(filePath) && preferSrc) {
      filePath = path.join(SRC_DATA_DIR, filename)
    }
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function computeActualRecoveryPerformance() {
  const agentRuns = readJsonFile('autonomousRuns.json', false)
  const auditLogs = readJsonFile('auditLogs.json', true)
  const demoTransactions = readJsonFile('demoTransactions.json', true)
  const razorpayTransactions = readJsonFile('razorpayTransactions.json', true)
  const simulations = readJsonFile('simulationResults.json', true)

  const totalAgentRuns = agentRuns.length

  const statusCounts = {
    COMPLETED: 0,
    RUNNING: 0,
    BLOCKED: 0,
    HUMAN_APPROVAL_REQUIRED: 0,
    EXECUTION_FAILED: 0,
    FAILED: 0,
    REJECTED: 0,
  }
  agentRuns.forEach(r => {
    if (statusCounts[r.status] !== undefined) statusCounts[r.status]++
  })

  let successfulExecutions = 0
  let failedExecutions = 0
  let pendingRecoveries = 0
  let notSupportedActions = 0
  let totalExecutedAmount = 0
  let confirmedRecoveredAmount = 0

  const actionResults = auditLogs.filter(l => l.eventType === 'ACTION_RESULT')
  actionResults.forEach(ar => {
    const details = ar.details || {}
    if (ar.status === 'NOT_SUPPORTED') {
      notSupportedActions++
    } else if (ar.status === 'ORDER_CREATED' || ar.status === 'CREATED') {
      successfulExecutions++
      if (details.amount) totalExecutedAmount += details.amount
    } else if (ar.status === 'FAILED' || ar.status === 'EXECUTION_ERROR') {
      failedExecutions++
    }
  })

  const recoveryResults = auditLogs.filter(l => l.eventType === 'RECOVERY_RESULT')
  recoveryResults.forEach(rr => {
    const details = rr.details || {}
    if (details.status === 'PENDING') {
      pendingRecoveries++
    } else if (details.status === 'RECOVERED') {
      confirmedRecoveredAmount += details.recoveredAmount || 0
    }
  })

  const policyChecks = auditLogs.filter(l => l.eventType === 'POLICY_CHECK')
  let guardrailBlocked = 0
  let approvalRequired = 0
  let policyPassed = 0
  policyChecks.forEach(pc => {
    if (pc.status === 'BLOCKED') guardrailBlocked++
    else if (pc.status === 'APPROVAL_REQUIRED') approvalRequired++
    else if (pc.status === 'PASSED') policyPassed++
  })

  let simulatedRecovered = 0
  simulations.forEach(s => {
    if (s.succeeded && s.recoveredAmount) simulatedRecovered += s.recoveredAmount
  })

  const demoCount = demoTransactions.length
  const razorpayCount = razorpayTransactions.length
  const liveCount = demoCount + razorpayCount

  const recoveryRate = totalExecutedAmount > 0
    ? Math.round((confirmedRecoveredAmount / totalExecutedAmount) * 10000) / 100
    : null

  return {
    summary: {
      totalAgentRuns,
      completed: statusCounts.COMPLETED,
      running: statusCounts.RUNNING,
      blocked: statusCounts.BLOCKED,
      humanApproval: statusCounts.HUMAN_APPROVAL_REQUIRED,
      executionFailed: statusCounts.EXECUTION_FAILED,
      failed: statusCounts.FAILED,
      rejected: statusCounts.REJECTED,
    },
    executions: {
      successful: successfulExecutions,
      failed: failedExecutions,
      notSupported: notSupportedActions,
      total: successfulExecutions + failedExecutions + notSupportedActions,
    },
    recovery: {
      confirmedRecoveredAmount,
      pendingRecoveries,
      recoveryRate,
      totalExecutedAmount,
      simulatedRecoveredAmount: simulatedRecovered,
    },
    policy: {
      guardrailBlocked,
      approvalRequired,
      policyPassed,
      totalPolicyChecks: policyChecks.length,
    },
    dataAvailability: {
      liveCount,
      demoCount,
      razorpayCount,
      historicalCount: 5000,
      hasLive: liveCount > 0,
    },
    sources: [
      liveCount > 0 ? 'Razorpay Test Mode + Demo' : null,
      'Agent execution data',
      'Audit trail records',
    ].filter(Boolean),
  }
}
