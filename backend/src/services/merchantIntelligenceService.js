import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getDemoTransactions,
  getRazorpayTransactions,
  getHistoricalTransactions,
} from './transactionStore.js'
import { getAllRuns, getRunStats } from './agentRunStore.js'
import { getAllAuditLogs } from './auditService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SIM_PATH = path.join(__dirname, '..', '..', 'src', 'data', 'simulationResults.json')

function readSimResults() {
  try {
    if (fs.existsSync(SIM_PATH)) {
      return JSON.parse(fs.readFileSync(SIM_PATH, 'utf8'))
    }
  } catch {}
  return []
}

function getLiveTransactions() {
  const demo = getDemoTransactions()
  const razorpay = getRazorpayTransactions()
  return [...demo, ...razorpay]
}

function isFailedAndRecoverable(txn) {
  if (txn.source === 'razorpay_test' && txn.type === 'Successful Payment') return false
  if (txn.type === 'Successful Payment') return false
  return true
}

function isRecovered(txn) {
  return txn.groundTruthRecoveredAmount > 0
}

export function getMerchantIntelligence() {
  const liveTxns = getLiveTransactions()
  const historicalTxns = getHistoricalTransactions()
  const allRuns = getAllRuns()
  const auditLogs = getAllAuditLogs()
  const simResults = readSimResults()

  const overview = calculateOverview(liveTxns, allRuns, auditLogs, simResults)
  const failureReasons = calculateFailureReasons(liveTxns)
  const paymentMethods = calculatePaymentMethods(liveTxns)
  const customerSegments = calculateCustomerSegments(liveTxns)
  const recoveryActions = calculateRecoveryActions(allRuns, auditLogs)
  const recoveryOpportunities = calculateRecoveryOpportunities(liveTxns, allRuns)
  const agentActivity = calculateAgentActivity(allRuns)
  const whyLosingMoney = calculateWhyLosingMoney(liveTxns)

  const lastUpdated = getLastUpdated(liveTxns, allRuns)

  return {
    source: getDataSource(liveTxns),
    lastUpdated,
    dataAvailability: getDataAvailability(liveTxns, historicalTxns),
    overview,
    failureReasons,
    paymentMethods,
    customerSegments,
    recoveryActions,
    recoveryOpportunities,
    whyLosingMoney,
    agentActivity,
  }
}

function getDataSource(liveTxns) {
  const hasRazorpay = liveTxns.some(t => t.source === 'razorpay_test')
  const hasDemo = liveTxns.some(t => t.source === 'demo')
  if (hasRazorpay && hasDemo) return 'razorpay_test + demo'
  if (hasRazorpay) return 'razorpay_test'
  if (hasDemo) return 'demo'
  return 'none'
}

function getDataAvailability(liveTxns, historicalTxns) {
  return {
    liveCount: liveTxns.length,
    historicalCount: historicalTxns.length,
    hasLive: liveTxns.length > 0,
    hasHistorical: historicalTxns.length > 0,
  }
}

function getLastUpdated(liveTxns, runs) {
  const timestamps = []
  liveTxns.forEach(t => {
    if (t.timestamp) timestamps.push(new Date(t.timestamp))
  })
  runs.forEach(r => {
    if (r.startedAt) timestamps.push(new Date(r.startedAt))
    if (r.completedAt) timestamps.push(new Date(r.completedAt))
  })
  if (timestamps.length === 0) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

function calculateOverview(liveTxns, runs, auditLogs, simResults) {
  const failedLive = liveTxns.filter(t => isFailedAndRecoverable(t))

  const moneyAtRisk = failedLive
    .filter(t => !isRecovered(t))
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  const atRiskCount = failedLive.filter(t => !isRecovered(t)).length

  const recoveredAmount = simResults
    .filter(s => s.succeeded && s.recoveredAmount > 0)
    .reduce((sum, s) => sum + s.recoveredAmount, 0)

  const successfulRecoveries = simResults.filter(s => s.succeeded && s.recoveredAmount > 0).length

  const activeRecoveryCases = failedLive.filter(t => !isRecovered(t) && t.recoverability > 30).length

  const newFailures = failedLive.length

  const blockedActions = runs.filter(r => r.status === 'BLOCKED').length

  const pendingActions = runs.filter(r =>
    r.status === 'RUNNING' || r.status === 'HUMAN_APPROVAL_REQUIRED'
  ).length

  return {
    moneyAtRisk,
    atRiskCount,
    recoveredAmount,
    successfulRecoveries,
    activeRecoveryCases,
    newFailures,
    blockedActions,
    pendingActions,
    recoveryRate: moneyAtRisk > 0
      ? Math.round((recoveredAmount / moneyAtRisk) * 100)
      : 0,
  }
}

function normalizeFailureReason(reason) {
  if (!reason) return 'Unknown'
  return reason
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function calculateFailureReasons(liveTxns) {
  const failed = liveTxns.filter(t => isFailedAndRecoverable(t))
  if (failed.length === 0) return []

  const grouped = {}
  failed.forEach(t => {
    const reason = normalizeFailureReason(t.failureReason)
    if (!grouped[reason]) {
      grouped[reason] = { reason, count: 0, totalAmount: 0, recoverableAmount: 0 }
    }
    grouped[reason].count++
    grouped[reason].totalAmount += t.amount || 0
    if (t.recoverability > 30) {
      grouped[reason].recoverableAmount += t.amount || 0
    }
  })

  return Object.values(grouped)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map(g => ({
      reason: g.reason,
      count: g.count,
      totalAmount: g.totalAmount,
      recoverableAmount: g.recoverableAmount,
      percentage: Math.round((g.count / failed.length) * 100),
    }))
}

function calculatePaymentMethods(liveTxns) {
  const failed = liveTxns.filter(t => isFailedAndRecoverable(t))
  if (failed.length === 0) return []

  const grouped = {}
  failed.forEach(t => {
    const method = t.paymentMethod || 'Unknown'
    if (!grouped[method]) {
      grouped[method] = {
        method,
        count: 0,
        failedCount: 0,
        totalAmount: 0,
        atRiskAmount: 0,
        recoverableAmount: 0,
        recoverabilitySum: 0,
        recoverabilityCount: 0,
      }
    }
    grouped[method].count++
    grouped[method].failedCount++
    grouped[method].totalAmount += t.amount || 0
    if (!isRecovered(t)) {
      grouped[method].atRiskAmount += t.amount || 0
    }
    if (t.recoverability > 30) {
      grouped[method].recoverableAmount += t.amount || 0
    }
    grouped[method].recoverabilitySum += t.recoverability || 0
    grouped[method].recoverabilityCount++
  })

  return Object.values(grouped)
    .sort((a, b) => b.atRiskAmount - a.atRiskAmount)
    .map(g => ({
      method: g.method,
      count: g.count,
      failedCount: g.failedCount,
      totalAmount: g.totalAmount,
      atRiskAmount: g.atRiskAmount,
      recoverableAmount: g.recoverableAmount,
      avgRecoverability: g.recoverabilityCount > 0
        ? Math.round(g.recoverabilitySum / g.recoverabilityCount)
        : 0,
    }))
}

function calculateCustomerSegments(liveTxns) {
  const failed = liveTxns.filter(t => isFailedAndRecoverable(t))
  if (failed.length === 0) return []

  const grouped = {}
  failed.forEach(t => {
    const segment = t.customerSegment || 'Regular'
    if (!grouped[segment]) {
      grouped[segment] = {
        segment,
        count: 0,
        totalAmount: 0,
        atRiskAmount: 0,
        recoverableAmount: 0,
        recoveredAmount: 0,
        recoverabilitySum: 0,
        recoverabilityCount: 0,
      }
    }
    grouped[segment].count++
    grouped[segment].totalAmount += t.amount || 0
    if (!isRecovered(t)) {
      grouped[segment].atRiskAmount += t.amount || 0
    }
    if (t.groundTruthRecoveredAmount > 0) {
      grouped[segment].recoveredAmount += t.groundTruthRecoveredAmount
    }
    if (t.recoverability > 30) {
      grouped[segment].recoverableAmount += t.amount || 0
    }
    grouped[segment].recoverabilitySum += t.recoverability || 0
    grouped[segment].recoverabilityCount++
  })

  return Object.values(grouped)
    .sort((a, b) => b.atRiskAmount - a.atRiskAmount)
    .map(g => ({
      segment: g.segment,
      count: g.count,
      totalAmount: g.totalAmount,
      atRiskAmount: g.atRiskAmount,
      recoverableAmount: g.recoverableAmount,
      recoveredAmount: g.recoveredAmount,
      avgRecoverability: g.recoverabilityCount > 0
        ? Math.round(g.recoverabilitySum / g.recoverabilityCount)
        : 0,
    }))
}

function calculateRecoveryActions(runs, auditLogs) {
  const decisionLogs = auditLogs.filter(l => l.eventType === 'AI_DECISION')
  const policyLogs = auditLogs.filter(l => l.eventType === 'POLICY_CHECK')
  const actionLogs = auditLogs.filter(l => l.eventType === 'ACTION_RESULT')

  const actionMap = {}

  function ensureAction(action) {
    if (!actionMap[action]) {
      actionMap[action] = {
        action,
        recommended: 0,
        executed: 0,
        blocked: 0,
        unsupported: 0,
        pending: 0,
        totalAmount: 0,
        recoveredAmount: 0,
      }
    }
  }

  decisionLogs.forEach(log => {
    const action = log.action || 'Unknown'
    ensureAction(action)
    actionMap[action].recommended++
    actionMap[action].totalAmount += log.details?.amount || 0
  })

  policyLogs.forEach(log => {
    const action = log.action || 'Unknown'
    ensureAction(action)
    if (!log.details?.passed) {
      actionMap[action].blocked++
    }
  })

  actionLogs.forEach(log => {
    const action = log.action || 'Unknown'
    ensureAction(action)
    const status = log.details?.status
    if (status === 'CREATED' || status === 'ORDER_CREATED' || log.details?.executed) {
      actionMap[action].executed++
    } else if (status === 'NOT_SUPPORTED') {
      actionMap[action].unsupported++
    } else if (status === 'EXECUTION_ERROR') {
      actionMap[action].unsupported++
    }
  })

  return Object.values(actionMap)
    .sort((a, b) => b.recommended - a.recommended)
}

function calculateRecoveryOpportunities(liveTxns, runs) {
  const failed = liveTxns.filter(t => isFailedAndRecoverable(t) && !isRecovered(t))

  const opportunities = failed.map(t => {
    const run = runs.find(r => r.transactionId === t.id)
    const policyStage = run?.stages?.policy
    const executeStage = run?.stages?.execute

    let agentAction = 'Not yet diagnosed'
    let policyStatus = 'N/A'
    let agentStage = run ? run.currentStage : 'NOT_STARTED'
    let nextAction = 'Diagnose transaction'

    if (run) {
      const decideResult = run.stages?.decide?.result
      agentAction = decideResult?.aiRecommendation || decideResult?.finalAction || 'Pending'
      policyStatus = policyStage?.status || 'PENDING'

      if (policyStage?.status === 'BLOCKED') {
        nextAction = 'Review blocked action'
      } else if (policyStage?.status === 'APPROVAL_REQUIRED') {
        nextAction = 'Approve action'
      } else if (executeStage?.status === 'COMPLETED') {
        const execResult = executeStage.result
        if (execResult?.status === 'NOT_SUPPORTED') {
          nextAction = 'Manual action required'
        } else if (execResult?.executed) {
          nextAction = 'Monitor recovery'
        } else {
          nextAction = 'Review execution failure'
        }
      } else if (agentStage === 'AUDIT') {
        nextAction = 'Review outcome'
      } else {
        nextAction = 'Agent processing'
      }
    }

    return {
      transactionId: t.id,
      amount: t.amount,
      failureReason: t.failureReason,
      paymentMethod: t.paymentMethod,
      customerSegment: t.customerSegment,
      recoverability: t.recoverability,
      riskScore: t.riskScore,
      agentAction,
      policyStatus,
      agentStage,
      nextAction,
      source: t.source,
      timestamp: t.timestamp,
    }
  })

  return opportunities.sort((a, b) => b.amount - a.amount).slice(0, 20)
}

function calculateAgentActivity(runs) {
  const stats = getRunStats()

  return {
    totalRuns: stats.total,
    completed: stats.completed,
    running: stats.running,
    blocked: stats.blocked,
    awaitingApproval: stats.humanApproval,
    executionFailed: stats.executionFailed,
    failed: stats.failed,
    rejected: stats.rejected,
  }
}

function calculateWhyLosingMoney(liveTxns) {
  const failed = liveTxns.filter(t => isFailedAndRecoverable(t))
  if (failed.length === 0) return []

  const byReason = {}
  failed.forEach(t => {
    const reason = normalizeFailureReason(t.failureReason)
    if (!byReason[reason]) {
      byReason[reason] = { reason, totalAmount: 0, count: 0, recoverableAmount: 0 }
    }
    byReason[reason].count++
    byReason[reason].totalAmount += t.amount || 0
    if (t.recoverability > 30) {
      byReason[reason].recoverableAmount += t.amount || 0
    }
  })

  return Object.values(byReason)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .map((g, i) => ({
      rank: i + 1,
      reason: g.reason,
      totalAmount: g.totalAmount,
      count: g.count,
      recoverableAmount: g.recoverableAmount,
      impact: g.totalAmount > 10000 ? 'High' : g.totalAmount > 5000 ? 'Medium' : 'Low',
    }))
}
