import transactions from '../data/transactions.json' with { type: 'json' }

function calculateLeakageScore(transaction) {
  let score = transaction.riskScore

  if (transaction.amount >= 100000) {
    score += 8
  } else if (transaction.amount >= 50000) {
    score += 5
  }

  if (transaction.attemptCount >= 3) {
    score += 8
  }

  if (
    transaction.failureReason === 'Insufficient Funds' ||
    transaction.failureReason === 'Checkout Abandoned' ||
    transaction.failureReason === 'Expired Card' ||
    transaction.failureReason === 'Payment Method Expired'
  ) {
    score += 5
  }

  if (
    transaction.customerHistory.previousFailedPayments >= 6
  ) {
    score += 5
  }

  if (
    transaction.customerHistory.previousSuccessfulPayments >= 10
  ) {
    score -= 5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function getLeakageLevel(score) {
  if (score >= 80) {
    return 'Critical'
  }

  if (score >= 60) {
    return 'High'
  }

  if (score >= 40) {
    return 'Medium'
  }

  return 'Low'
}

export function detectLeakage(filters = {}) {
  let results = transactions.map((transaction) => {
    const leakageScore =
      calculateLeakageScore(transaction)

    const leakageLevel =
      getLeakageLevel(leakageScore)

    return {
      ...transaction,
      leakageScore,
      leakageLevel,
      revenueAtRisk:
        transaction.groundTruthRecoverable
          ? transaction.amount
          : 0,
    }
  })

  if (filters.type) {
    results = results.filter(
      (transaction) =>
        transaction.type === filters.type,
    )
  }

  if (filters.level) {
    results = results.filter(
      (transaction) =>
        transaction.leakageLevel === filters.level,
    )
  }

  if (filters.merchant) {
    results = results.filter(
      (transaction) =>
        transaction.merchant === filters.merchant,
    )
  }

  if (filters.minAmount) {
    results = results.filter(
      (transaction) =>
        transaction.amount >=
        Number(filters.minAmount),
    )
  }

  if (filters.maxAmount) {
    results = results.filter(
      (transaction) =>
        transaction.amount <=
        Number(filters.maxAmount),
    )
  }

  if (filters.recoverable !== undefined) {
    const recoverable =
      filters.recoverable === 'true'

    results = results.filter(
      (transaction) =>
        transaction.groundTruthRecoverable ===
        recoverable,
    )
  }

  const totalAtRisk = results.reduce(
    (total, transaction) =>
      total + transaction.revenueAtRisk,
    0,
  )

  const summary = {
    totalCases: results.length,

    totalAtRisk,

    criticalCases: results.filter(
      (transaction) =>
        transaction.leakageLevel === 'Critical',
    ).length,

    highRiskCases: results.filter(
      (transaction) =>
        transaction.leakageLevel === 'High',
    ).length,

    mediumRiskCases: results.filter(
      (transaction) =>
        transaction.leakageLevel === 'Medium',
    ).length,

    lowRiskCases: results.filter(
      (transaction) =>
        transaction.leakageLevel === 'Low',
    ).length,
  }

  return {
    summary,
    transactions: results,
  }
}