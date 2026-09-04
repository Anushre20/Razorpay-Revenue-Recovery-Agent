import { findTransaction } from './transactionStore.js'
import { checkGuardrails } from './guardrailService.js'
import { predictAll } from './mlInferenceService.js'

function getReasonForAction(action, transaction) {
  const {
    failureReason,
    attemptCount,
  } = transaction

  if (action === 'No Action') {
    return 'Recovery potential is too low per ML analysis'
  }

  if (action === 'Human Escalation') {
    if (attemptCount >= 3) {
      return 'Multiple payment attempts require human review'
    }

    return 'ML confidence too low for automated action or guardrail blocked automatic recovery'
  }

  if (action === 'Card Update Request') {
    return 'Saved payment credential has expired'
  }

  if (action === 'Smart Retry') {
    return `${failureReason} may be resolved with a retry per ML analysis`
  }

  if (action === 'Payment Link') {
    return 'Customer shows sufficient recovery potential through an alternate payment flow'
  }

  if (action === 'UPI Fallback') {
    return 'UPI provides an alternative payment method'
  }

  if (action === 'WhatsApp Reminder') {
    return 'Customer engagement via WhatsApp to recover payment'
  }

  if (action === 'Email Reminder') {
    return 'Customer engagement via email to recover payment'
  }

  return 'Recovery action selected by ML model'
}

function getFallbackAction(transaction) {
  const {
    type,
    failureReason,
    amount,
    recoverability,
  } = transaction

  if (recoverability < 30) {
    return 'No Action'
  }

  if (transaction.attemptCount >= 3) {
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

export function getRecoveryDecision(txnId) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const ml = predictAll(transaction)

  let aiRecommendation
  let aiConfidence
  let reason

  if (ml.mlAvailable) {
    aiRecommendation = ml.action.prediction
    aiConfidence = Math.round(ml.action.confidence * 100)
    reason = getReasonForAction(aiRecommendation, transaction)
  } else {
    aiRecommendation = getFallbackAction(transaction)
    aiConfidence = 70
    reason = getReasonForAction(aiRecommendation, transaction)
  }

  const guardrailResult =
    checkGuardrails(txnId, aiRecommendation)

  const finalAction =
    guardrailResult.allowedAction

  const guardrailBlocked = !guardrailResult.passed

  const finalReason = guardrailBlocked
    ? `ML recommended "${aiRecommendation}" but guardrails changed it to "${finalAction}": ${guardrailResult.failedGuardrails.map(g => g.reason).join('; ')}`
    : reason

  const mlRiskScore = ml.mlAvailable ? ml.riskScore.prediction : transaction.riskScore
  const mlRecoverabilityPct = ml.mlAvailable
    ? Math.round(ml.recoverability.probability * 100)
    : transaction.recoverability

  return {
    transactionId: transaction.id,

    action: finalAction,

    initialAction: aiRecommendation,

    reason: finalReason,

    recoverability: mlRecoverabilityPct,

    riskScore: mlRiskScore,

    amount: transaction.amount,

    failureReason: transaction.failureReason,

    attemptCount: transaction.attemptCount,

    customerSegment: transaction.customerSegment,

    requiresApproval:
      guardrailResult.requiresApproval,

    guardrails: guardrailResult,

    mlPrediction: ml,
  }
}
