import { findTransaction } from './transactionStore.js'
import { predictAll } from './mlInferenceService.js'

function getProblem(transaction) {
  const { type, failureReason } = transaction

  if (type === 'Failed Payment') {
    return `Payment failed due to ${failureReason.toLowerCase()}`
  }

  if (type === 'Abandoned Checkout') {
    return `Checkout was abandoned due to ${failureReason.toLowerCase()}`
  }

  if (type === 'Subscription Failure') {
    return `Subscription renewal failed due to ${failureReason.toLowerCase()}`
  }

  return 'Payment recovery issue detected'
}

function getRootCause(transaction) {
  const {
    failureReason,
    attemptCount,
    customerHistory,
  } = transaction

  switch (failureReason) {
    case 'Insufficient Funds':
      return 'Insufficient available balance at payment time'

    case 'Card Declined':
      return 'Issuing bank declined the card transaction'

    case 'Bank Server Timeout':
      return 'Temporary bank-side processing failure'

    case '3D Secure Authentication Failed':
      return 'Authentication or OTP verification failure'

    case 'Daily Limit Exceeded':
      return 'Customer exceeded the payment method transaction limit'

    case 'Network Error':
      return 'Temporary network or payment gateway connectivity issue'

    case 'Checkout Abandoned':
      return 'Customer dropped off before completing payment'

    case 'Payment Page Timeout':
      return 'Payment session expired before completion'

    case 'Payment Method Unavailable':
      return 'Selected payment method was unavailable'

    case 'Price Changed':
      return 'Checkout amount changed before payment completion'

    case 'Customer Drop-off':
      return 'Customer exited the checkout flow before payment'

    case 'Expired Card':
    case 'Payment Method Expired':
      return 'Saved payment credential has expired'

    case 'AutoPay Mandate Failed':
      return 'Recurring payment mandate failed during renewal'

    case 'Bank Account Unavailable':
      return 'Linked bank account was unavailable'

    case 'Debit Mandate Failed':
      return 'Debit mandate could not be processed'

    default:
      if (attemptCount >= 3) {
        return 'Repeated payment attempts indicate persistent recovery friction'
      }

      if (customerHistory.previousFailedPayments >= 6) {
        return 'Repeated historical payment failures indicate elevated recovery risk'
      }

      return 'Payment failure requires further investigation'
  }
}

function getUrgency(riskScore, amount) {
  if (amount >= 100000 || riskScore >= 80) {
    return 'Critical'
  }

  if (amount >= 50000 || riskScore >= 60) {
    return 'High'
  }

  if (riskScore >= 40) {
    return 'Medium'
  }

  return 'Low'
}

function getAlternatePayments(transaction) {
  const { paymentMethod, type } = transaction

  const alternatives = [
    'UPI',
    'Net Banking',
    'Credit Card',
    'Debit Card',
    'Wallet',
  ]

  const filtered = alternatives.filter(
    (method) => method !== paymentMethod,
  )

  if (type === 'Subscription Failure') {
    return ['UPI', 'Net Banking', 'Update Card']
  }

  if (type === 'Abandoned Checkout') {
    return ['UPI', 'Payment Link', 'WhatsApp Payment']
  }

  return filtered.slice(0, 3)
}

function calculateEstimatedRecovery(amount, recoverabilityProbability, isRecoverable) {
  if (!isRecoverable) {
    return 0
  }

  return Math.round(amount * recoverabilityProbability)
}

export function diagnoseTransaction(txnId) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const ml = predictAll(transaction)

  if (ml.mlAvailable) {
    const mlRiskScore = ml.riskScore.prediction
    const mlRecoverabilityProbability = ml.recoverability.probability
    const mlIsRecoverable = ml.recoverability.prediction === 'recoverable'
    const mlRecoverabilityPct = Math.round(mlRecoverabilityProbability * 100)
    const mlAction = ml.action.prediction
    const mlConfidence = Math.round(ml.action.confidence * 100)

    return {
      transactionId: transaction.id,

      problem: getProblem(transaction),

      rootCause: getRootCause(transaction),

      confidence: mlConfidence,

      urgency: getUrgency(mlRiskScore, transaction.amount),

      recommendedAction: mlAction,

      alternatePayments:
        getAlternatePayments(transaction),

      estimatedRecovery:
        calculateEstimatedRecovery(transaction.amount, mlRecoverabilityProbability, mlIsRecoverable),

      riskScore: mlRiskScore,

      recoverability: mlRecoverabilityPct,

      failureReason: transaction.failureReason,

      attemptCount: transaction.attemptCount,

      analysis: {
        paymentMethod: transaction.paymentMethod,

        customerSegment: transaction.customerSegment,

        previousSuccessfulPayments:
          transaction.customerHistory
            .previousSuccessfulPayments,

        previousFailedPayments:
          transaction.customerHistory
            .previousFailedPayments,

        previousRecoveries:
          transaction.customerHistory
            .previousRecoveries,
      },

      mlPrediction: ml,

      historicalRiskScore: transaction.source === 'historical' ? transaction.riskScore : undefined,
      historicalRecoverability: transaction.source === 'historical' ? transaction.recoverability : undefined,
    }
  }

  const fallbackAction = getFallbackAction(transaction)

  return {
    transactionId: transaction.id,

    problem: getProblem(transaction),

    rootCause: getRootCause(transaction),

    confidence: 70,

    urgency: getUrgency(transaction.riskScore, transaction.amount),

    recommendedAction: fallbackAction,

    alternatePayments:
      getAlternatePayments(transaction),

    estimatedRecovery:
      transaction.groundTruthRecoverable
        ? Math.round(transaction.amount * (transaction.recoverability / 100))
        : 0,

    riskScore: transaction.riskScore,

    recoverability: transaction.recoverability,

    failureReason: transaction.failureReason,

    attemptCount: transaction.attemptCount,

    analysis: {
      paymentMethod: transaction.paymentMethod,

      customerSegment: transaction.customerSegment,

      previousSuccessfulPayments:
        transaction.customerHistory
          .previousSuccessfulPayments,

      previousFailedPayments:
        transaction.customerHistory
          .previousFailedPayments,

      previousRecoveries:
        transaction.customerHistory
          .previousRecoveries,
    },

    mlPrediction: ml,
  }
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
