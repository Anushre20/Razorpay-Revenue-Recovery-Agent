import {
  findTransaction,
  addDemoTransaction,
} from './transactionStore.js'

let demoCounter = Date.now()

function generateDemoId() {
  demoCounter++
  return `DEMO-${demoCounter}`
}

function normalizeDemoInput(input) {
  const methodMap = {
    card: 'Credit Card',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    upi: 'UPI',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
  }

  const normalizedMethod = methodMap[input.paymentMethod?.toLowerCase()] || input.paymentMethod || 'Credit Card'

  const amount = Number(input.amount) || 0
  const attemptCount = Number(input.attempts) || 1
  const failureReason = input.failureReason || 'Card Declined'
  const customerSegment = input.customerSegment || 'Regular'

  let type = 'Failed Payment'
  if (failureReason === 'Checkout Abandoned' || failureReason === 'Customer Drop-off') {
    type = 'Abandoned Checkout'
  } else if (failureReason === 'AutoPay Mandate Failed' || failureReason === 'Debit Mandate Failed') {
    type = 'Subscription Failure'
  }

  let riskScore = 50
  if (attemptCount >= 3) riskScore += 15
  if (amount >= 100000) riskScore += 10
  if (amount >= 50000) riskScore += 5
  if (customerSegment === 'High Value') riskScore += 5
  if (customerSegment === 'New') riskScore += 5
  riskScore = Math.min(99, Math.max(10, riskScore))

  let recoverability = 50
  if (failureReason === 'Insufficient Funds' || failureReason === 'Bank Server Timeout' || failureReason === 'Network Error') {
    recoverability = 75
  } else if (failureReason === 'Card Declined') {
    recoverability = 60
  } else if (failureReason === 'Expired Card' || failureReason === 'Payment Method Expired') {
    recoverability = 40
  } else if (failureReason === 'Checkout Abandoned' || failureReason === 'Customer Drop-off') {
    recoverability = 55
  } else if (failureReason === '3D Secure Authentication Failed') {
    recoverability = 65
  }
  if (attemptCount >= 3) recoverability -= 10
  recoverability = Math.min(95, Math.max(15, recoverability))

  return {
    id: generateDemoId(),
    merchant: input.merchant || 'Demo Merchant',
    customer: input.customer || 'Demo Customer',
    amount,
    type,
    timestamp: new Date().toISOString(),
    paymentMethod: normalizedMethod,
    failureReason,
    attemptCount,
    customerHistory: {
      previousSuccessfulPayments: input.previousSuccessfulPayments || 0,
      previousFailedPayments: input.previousFailedPayments || 0,
      previousRecoveries: input.previousRecoveries || 0,
    },
    checkoutDuration: input.checkoutDuration || null,
    cartValue: input.cartValue || null,
    subscriptionPlan: input.subscriptionPlan || null,
    daysOverdue: input.daysOverdue || 0,
    deviceType: input.deviceType || 'Unknown',
    customerSegment,
    riskScore,
    recoverability,
    groundTruthAction: 'No Action',
    groundTruthRecoverable: recoverability >= 30,
    groundTruthRecoveredAmount: 0,
    source: 'demo',
  }
}

export function ingestAndEvaluate(input) {
  const normalized = normalizeDemoInput(input)
  addDemoTransaction(normalized)
  const txn = findTransaction(normalized.id)
  return txn
}
