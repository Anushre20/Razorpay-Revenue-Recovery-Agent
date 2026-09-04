import { findTransaction } from './transactionStore.js'
import { checkGuardrails } from './guardrailService.js'

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

function getReason(transaction, action) {
  const {
    failureReason,
    recoverability,
    attemptCount,
  } = transaction

  if (action === 'No Action') {
    return 'Recovery potential is too low'
  }

  if (action === 'Human Escalation') {
    if (attemptCount >= 3) {
      return 'Multiple payment attempts require human review'
    }

    if (transaction.amount > 25000 && recoverability >= 70) {
      return 'High-value recovery requires human approval'
    }

    return 'Automated recovery rule did not provide a safe action'
  }

  if (action === 'Card Update Request') {
    return 'Saved payment credential has expired'
  }

  if (action === 'Smart Retry') {
    return `${failureReason} may be resolved with a retry`
  }

  if (action === 'Payment Link') {
    return 'Customer shows sufficient recovery potential through an alternate payment flow'
  }

  if (action === 'UPI Fallback') {
    return 'UPI provides an alternative payment method'
  }

  return 'Recovery action selected based on transaction attributes'
}

export function getRecoveryDecision(txnId) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const initialAction =
    decideRecoveryAction(transaction)

  const guardrailResult =
    checkGuardrails(txnId, initialAction)

  const finalAction =
    guardrailResult.allowedAction

  const reason =
    getReason(transaction, finalAction)

  return {
    transactionId: transaction.id,

    action: finalAction,

    initialAction,

    reason,

    recoverability: transaction.recoverability,

    riskScore: transaction.riskScore,

    amount: transaction.amount,

    failureReason: transaction.failureReason,

    attemptCount: transaction.attemptCount,

    customerSegment: transaction.customerSegment,

    requiresApproval:
      guardrailResult.requiresApproval,

    guardrails: guardrailResult,
  }
}