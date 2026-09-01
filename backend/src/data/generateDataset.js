import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_FILE = path.join(__dirname, 'transactions.json')

const TOTAL_RECORDS = 5000

// --------------------------------------------------
// Seeded random generator
// --------------------------------------------------

let seed = 20260901

function random() {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min
}

function randomChoice(array) {
  return array[randomInt(0, array.length - 1)]
}

// --------------------------------------------------
// Reference data
// --------------------------------------------------

const merchants = [
  'UrbanKart',
  'TechNova',
  'StreamBox',
  'QuickMart',
  'FoodFleet',
  'TravelEase',
  'StyleHub',
  'EduSphere',
  'HealthPlus',
  'GameZone',
]

const customerNames = [
  'Rahul Sharma',
  'Priya Mehta',
  'Arjun Kapoor',
  'Sneha Verma',
  'Rohan Gupta',
  'Ananya Singh',
  'Aditya Jain',
  'Kavya Iyer',
  'Vivek Nair',
  'Neha Agarwal',
  'Aarav Malhotra',
  'Ishita Rao',
  'Karan Bansal',
  'Meera Joshi',
  'Dev Khanna',
]

const paymentMethods = [
  'Credit Card',
  'Debit Card',
  'UPI',
  'Net Banking',
  'Wallet',
]

const deviceTypes = [
  'Mobile',
  'Desktop',
  'Tablet',
]

const customerSegments = [
  'New',
  'Regular',
  'Loyal',
  'High Value',
]

const failureReasons = {
  'Failed Payment': [
    'Insufficient Funds',
    'Card Declined',
    'Bank Server Timeout',
    '3D Secure Authentication Failed',
    'Daily Limit Exceeded',
    'Network Error',
  ],

  'Abandoned Checkout': [
    'Checkout Abandoned',
    'Payment Page Timeout',
    '3D Secure Authentication Failed',
    'Payment Method Unavailable',
    'Price Changed',
    'Customer Drop-off',
  ],

  'Subscription Failure': [
    'Expired Card',
    'Insufficient Funds',
    'AutoPay Mandate Failed',
    'Bank Account Unavailable',
    'Payment Method Expired',
    'Debit Mandate Failed',
  ],
}

const recoveryActions = [
  'Smart Retry',
  'UPI Fallback',
  'Payment Link',
  'Card Update Request',
  'WhatsApp Reminder',
  'Email Reminder',
  'Human Escalation',
  'No Action',
]

// --------------------------------------------------
// Helper functions
// --------------------------------------------------

function generateTransactionId(index) {
  return `TXN-${2847000 + index}`
}

function generateTimestamp() {
  const start = new Date('2026-01-01T00:00:00Z').getTime()
  const end = new Date('2026-08-31T23:59:59Z').getTime()

  return new Date(
    start + random() * (end - start),
  ).toISOString()
}

function generateAmount(type, customerSegment) {
  let min
  let max

  if (type === 'Failed Payment') {
    min = 500
    max = 150000
  } else if (type === 'Abandoned Checkout') {
    min = 800
    max = 100000
  } else {
    min = 1000
    max = 120000
  }

  let amount = randomInt(min, max)

  if (customerSegment === 'High Value') {
    amount = Math.min(
      200000,
      Math.round(amount * 1.5),
    )
  }

  return amount
}

function generateCustomerHistory() {
  return {
    previousSuccessfulPayments: randomInt(0, 25),
    previousFailedPayments: randomInt(0, 8),
    previousRecoveries: randomInt(0, 10),
  }
}

function calculateRecoverability({
  type,
  failureReason,
  attemptCount,
  customerHistory,
  customerSegment,
}) {
  let score = 50

  if (
    failureReason === 'Insufficient Funds' ||
    failureReason === 'Bank Server Timeout' ||
    failureReason === 'Network Error'
  ) {
    score += 20
  }

  if (
    failureReason === 'Expired Card' ||
    failureReason === 'Payment Method Expired'
  ) {
    score += 12
  }

  if (failureReason === 'Checkout Abandoned') {
    score += 10
  }

  if (failureReason === 'Card Declined') {
    score -= 10
  }

  if (failureReason === 'Daily Limit Exceeded') {
    score -= 8
  }

  if (failureReason === 'Debit Mandate Failed') {
    score -= 5
  }

  if (customerHistory.previousSuccessfulPayments >= 10) {
    score += 12
  }

  if (customerHistory.previousRecoveries >= 3) {
    score += 8
  }

  if (customerHistory.previousFailedPayments >= 6) {
    score -= 12
  }

  if (customerSegment === 'Loyal') {
    score += 8
  }

  if (customerSegment === 'High Value') {
    score += 5
  }

  score -= Math.max(0, attemptCount - 1) * 8

  if (type === 'Abandoned Checkout') {
    score += 5
  }

  return Math.max(5, Math.min(98, score))
}

function determineGroundTruthAction({
  type,
  failureReason,
  amount,
  attemptCount,
  recoverability,
}) {
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
    failureReason === 'Insufficient Funds' &&
    attemptCount <= 2
  ) {
    return 'Smart Retry'
  }

  if (
    failureReason === 'Bank Server Timeout' ||
    failureReason === 'Network Error'
  ) {
    return 'Smart Retry'
  }

  if (
    type === 'Abandoned Checkout' &&
    recoverability >= 60
  ) {
    return random() > 0.5
      ? 'Payment Link'
      : 'WhatsApp Reminder'
  }

  if (
    type === 'Subscription Failure' &&
    recoverability >= 60
  ) {
    return 'UPI Fallback'
  }

  return randomChoice(recoveryActions)
}

function calculateRecoveredAmount({
  amount,
  recoverable,
  action,
}) {
  if (!recoverable) {
    return 0
  }

  if (
    action === 'No Action' ||
    action === 'Human Escalation'
  ) {
    return 0
  }

  const recoveryRate = 0.55 + random() * 0.35

  return Math.round(amount * recoveryRate)
}

// --------------------------------------------------
// Generate dataset
// --------------------------------------------------

const transactions = []

for (let i = 1; i <= TOTAL_RECORDS; i++) {
  const typeRandom = random()

  let type

  if (typeRandom < 0.5) {
    type = 'Failed Payment'
  } else if (typeRandom < 0.8) {
    type = 'Abandoned Checkout'
  } else {
    type = 'Subscription Failure'
  }

  const merchant = randomChoice(merchants)
  const customer = randomChoice(customerNames)
  const paymentMethod = randomChoice(paymentMethods)
  const deviceType = randomChoice(deviceTypes)
  const customerSegment = randomChoice(customerSegments)

  const failureReason = randomChoice(
    failureReasons[type],
  )

  const attemptCount = randomInt(1, 4)

  const customerHistory =
    generateCustomerHistory()

  const amount = generateAmount(
    type,
    customerSegment,
  )

  const recoverability = calculateRecoverability({
    type,
    failureReason,
    attemptCount,
    customerHistory,
    customerSegment,
  })

  const riskScore = Math.round(
    100 - recoverability + randomInt(-5, 5),
  )

  const boundedRiskScore = Math.max(
    1,
    Math.min(99, riskScore),
  )

  const groundTruthRecoverable =
    recoverability >= 50

  const groundTruthAction =
    determineGroundTruthAction({
      type,
      failureReason,
      amount,
      attemptCount,
      recoverability,
    })

  const groundTruthRecoveredAmount =
    calculateRecoveredAmount({
      amount,
      recoverable: groundTruthRecoverable,
      action: groundTruthAction,
    })

  const transaction = {
    id: generateTransactionId(i),

    merchant,
    customer,
    amount,

    type,
    timestamp: generateTimestamp(),

    paymentMethod,
    failureReason,
    attemptCount,

    customerHistory,

    checkoutDuration:
      type === 'Abandoned Checkout'
        ? randomInt(15, 600)
        : null,

    cartValue:
      type === 'Abandoned Checkout'
        ? amount
        : null,

    subscriptionPlan:
      type === 'Subscription Failure'
        ? randomChoice([
            'Basic',
            'Pro',
            'Business',
            'Enterprise',
          ])
        : null,

    daysOverdue:
      type === 'Subscription Failure'
        ? randomInt(1, 30)
        : 0,

    deviceType,
    customerSegment,

    riskScore: boundedRiskScore,

    recoverability,

    groundTruthAction,

    groundTruthRecoverable,

    groundTruthRecoveredAmount,
  }

  transactions.push(transaction)
}

// --------------------------------------------------
// Write JSON file
// --------------------------------------------------

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(transactions, null, 2),
)

console.log('----------------------------------------')
console.log('Synthetic dataset generated successfully')
console.log('----------------------------------------')
console.log(`Total records: ${transactions.length}`)
console.log(`Output: ${OUTPUT_FILE}`)
console.log('----------------------------------------')