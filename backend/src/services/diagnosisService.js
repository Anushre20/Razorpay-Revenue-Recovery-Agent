import transactions from '../data/transactions.json' with { type: 'json' }

function findTransaction(txnId) {
  return transactions.find(
    (transaction) => transaction.id === txnId,
  )
}

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

function calculateConfidence(transaction) {
  let confidence = 70

  if (transaction.failureReason) {
    confidence += 10
  }

  if (transaction.attemptCount >= 2) {
    confidence += 5
  }

  if (
    transaction.customerHistory.previousSuccessfulPayments >= 5
  ) {
    confidence += 5
  }

  if (
    transaction.customerHistory.previousFailedPayments >= 6
  ) {
    confidence += 5
  }

  return Math.min(98, confidence)
}

function getUrgency(transaction) {
  if (
    transaction.amount >= 100000 ||
    transaction.riskScore >= 80
  ) {
    return 'Critical'
  }

  if (
    transaction.amount >= 50000 ||
    transaction.riskScore >= 60
  ) {
    return 'High'
  }

  if (transaction.riskScore >= 40) {
    return 'Medium'
  }

  return 'Low'
}

function getRecommendedAction(transaction) {
  const {
    type,
    failureReason,
    amount,
    recoverability,
  } = transaction

  // Not enough recovery potential
  if (recoverability < 30) {
    return 'No Action'
  }

  // Known payment credential problem
  if (
    failureReason === 'Expired Card' ||
    failureReason === 'Payment Method Expired'
  ) {
    return 'Card Update Request'
  }

  // Temporary payment failures
  if (
    failureReason === 'Insufficient Funds' ||
    failureReason === 'Bank Server Timeout' ||
    failureReason === 'Network Error'
  ) {
    return 'Smart Retry'
  }

  // Abandoned checkout
  if (
    type === 'Abandoned Checkout' &&
    recoverability >= 60
  ) {
    return 'Payment Link'
  }

  // Subscription recovery
  if (
    type === 'Subscription Failure' &&
    recoverability >= 60
  ) {
    return 'UPI Fallback'
  }

  // Card declines need an alternate payment method
  if (failureReason === 'Card Declined') {
    return 'UPI Fallback'
  }

  // Low-value cases can be handled automatically
  if (amount <= 25000 && recoverability >= 50) {
    return 'Payment Link'
  }

  // Unknown/high-risk cases are escalated
  return 'Human Escalation'
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

function calculateEstimatedRecovery(transaction) {
  if (!transaction.groundTruthRecoverable) {
    return 0
  }

  return Math.round(
    transaction.amount *
      (transaction.recoverability / 100),
  )
}

export function diagnoseTransaction(txnId) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const recommendedAction =
    getRecommendedAction(transaction)

  return {
    transactionId: transaction.id,

    problem: getProblem(transaction),

    rootCause: getRootCause(transaction),

    confidence: calculateConfidence(transaction),

    urgency: getUrgency(transaction),

    recommendedAction,

    alternatePayments:
      getAlternatePayments(transaction),

    estimatedRecovery:
      calculateEstimatedRecovery(transaction),

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
  }
}