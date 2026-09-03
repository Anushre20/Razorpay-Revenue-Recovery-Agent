import transactions from '../data/transactions.json' with { type: 'json' }
import { checkGuardrails } from './guardrailService.js'

const AUTOMATIC_ACTIONS = [
  'Smart Retry',
  'UPI Fallback',
  'Payment Link',
  'Card Update Request',
  'WhatsApp Reminder',
  'Email Reminder',
]

function decideRecoveryAction(transaction) {
  const {
    type,
    failureReason,
    amount,
    attemptCount,
    recoverability,
  } = transaction

  if (recoverability < 30) {
    return 'No Action'
  }

  if (attemptCount >= 3) {
    return 'Human Escalation'
  }

  if (amount > 25000 && recoverability >= 70) {
    return 'Human Escalation'
  }

  if (
    failureReason === 'Expired Card' ||
    failureReason === 'Payment Method Expired'
  ) {
    return 'Card Update Request'
  }

  if (
    failureReason === 'Insufficient Funds' ||
    failureReason === 'Bank Server Timeout' ||
    failureReason === 'Network Error'
  ) {
    return 'Smart Retry'
  }

  if (
    type === 'Abandoned Checkout' &&
    recoverability >= 60
  ) {
    return 'Payment Link'
  }

  if (
    type === 'Subscription Failure' &&
    recoverability >= 60
  ) {
    return 'UPI Fallback'
  }

  if (failureReason === 'Card Declined') {
    return 'UPI Fallback'
  }

  if (amount <= 25000 && recoverability >= 50) {
    return 'Payment Link'
  }

  return 'Human Escalation'
}

export function computeEvaluation() {
  let truePositives = 0
  let trueNegatives = 0
  let falsePositives = 0
  let falseNegatives = 0

  let totalAtRisk = 0
  let totalRecovered = 0

  let correctActionCount = 0
  let incorrectActionCount = 0

  let blockedByGuardrails = 0
  let requiresApprovalCount = 0

  const actionMetrics = {}

  for (const txn of transactions) {
    const initialAction = decideRecoveryAction(txn)
    const guardrailResult = checkGuardrails(txn.id, initialAction)
    const finalAction = guardrailResult.allowedAction
    const guardPassed = guardrailResult.passed
    const approval = guardrailResult.requiresApproval

    const aiPredictsRecovery = initialAction !== 'No Action'
    const groundTruthRecoverable = txn.groundTruthRecoverable

    if (aiPredictsRecovery && groundTruthRecoverable) {
      truePositives++
    } else if (!aiPredictsRecovery && !groundTruthRecoverable) {
      trueNegatives++
    } else if (aiPredictsRecovery && !groundTruthRecoverable) {
      falsePositives++
    } else {
      falseNegatives++
    }

    if (groundTruthRecoverable) {
      totalAtRisk += txn.amount
      totalRecovered += txn.groundTruthRecoveredAmount
    }

    if (initialAction === txn.groundTruthAction) {
      correctActionCount++
    } else {
      incorrectActionCount++
    }

    if (!guardPassed) {
      blockedByGuardrails++
    }
    if (approval) {
      requiresApprovalCount++
    }

    const action = initialAction
    if (!actionMetrics[action]) {
      actionMetrics[action] = {
        action,
        count: 0,
        correct: 0,
        incorrect: 0,
        truePositives: 0,
        trueNegatives: 0,
        falsePositives: 0,
        falseNegatives: 0,
        totalAmount: 0,
        recoveredAmount: 0,
        blockedByGuardrails: 0,
      }
    }

    const am = actionMetrics[action]
    am.count++
    am.totalAmount += txn.amount

    if (initialAction === txn.groundTruthAction) {
      am.correct++
    } else {
      am.incorrect++
    }

    if (aiPredictsRecovery && groundTruthRecoverable) {
      am.truePositives++
    } else if (!aiPredictsRecovery && !groundTruthRecoverable) {
      am.trueNegatives++
    } else if (aiPredictsRecovery && !groundTruthRecoverable) {
      am.falsePositives++
    } else {
      am.falseNegatives++
    }

    if (groundTruthRecoverable) {
      am.recoveredAmount += txn.groundTruthRecoveredAmount
    }

    if (!guardPassed) {
      am.blockedByGuardrails++
    }
  }

  const totalDecisions = truePositives + trueNegatives + falsePositives + falseNegatives
  const precision = truePositives + falsePositives > 0
    ? truePositives / (truePositives + falsePositives)
    : 0
  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0
  const f1Score = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0
  const falsePositiveRate = falsePositives + trueNegatives > 0
    ? falsePositives / (falsePositives + trueNegatives)
    : 0
  const recoveryRate = totalAtRisk > 0
    ? Math.round((totalRecovered / totalAtRisk) * 10000) / 100
    : 0
  const correctDecisions = truePositives + trueNegatives
  const actionAccuracy = totalDecisions > 0
    ? Math.round((correctActionCount / totalDecisions) * 10000) / 100
    : 0

  return {
    totalTransactions: transactions.length,
    totalDecisions,
    totalAtRisk,
    totalRecovered,
    recoveryRate,

    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    precision: Math.round(precision * 10000) / 100,
    recall: Math.round(recall * 10000) / 100,
    f1Score: Math.round(f1Score * 10000) / 100,
    falsePositiveRate: Math.round(falsePositiveRate * 10000) / 100,

    correctDecisions,
    correctActionCount,
    incorrectActionCount,
    actionAccuracy,

    blockedByGuardrails,
    requiresApprovalCount,

    actionMetrics: Object.values(actionMetrics).sort((a, b) => b.count - a.count),
  }
}
