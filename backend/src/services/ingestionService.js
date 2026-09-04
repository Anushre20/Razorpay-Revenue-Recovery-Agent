import {
  findTransaction,
  addDemoTransaction,
} from './transactionStore.js'
import { predictAll } from './mlInferenceService.js'

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
    riskScore: 50,
    recoverability: 50,
    groundTruthAction: 'No Action',
    groundTruthRecoverable: false,
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
