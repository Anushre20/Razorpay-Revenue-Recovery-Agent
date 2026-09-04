import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { verifyCredentials, listPayments } from './razorpayService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SYNCED_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'razorpayTransactions.json')

function loadSyncedTransactions() {
  try {
    if (fs.existsSync(SYNCED_DATA_PATH)) {
      const raw = fs.readFileSync(SYNCED_DATA_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error('Failed to load synced transactions:', err.message)
  }
  return []
}

function saveSyncedTransactions(data) {
  fs.writeFileSync(SYNCED_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

function getConnectionStatus() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  return {
    hasCredentials: Boolean(keyId && keySecret),
    keyIdProvided: Boolean(keyId),
  }
}

function normalizeRazorpayPayment(payment) {
  const amountInPaise = payment.amount || 0
  const status = payment.status || 'unknown'

  const methodMap = {
    card: 'Credit Card',
    upi: 'UPI',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
    emi: 'Credit Card',
  }

  const normalizedMethod = methodMap[payment.method] || 'Other'

  let type = 'Failed Payment'
  if (status === 'captured') {
    type = 'Successful Payment'
  } else if (status === 'created') {
    type = 'Abandoned Checkout'
  }

  let failureReason = 'Payment failed'
  if (payment.error_code) {
    failureReason = payment.error_description || payment.error_code
  } else if (status === 'authorized') {
    failureReason = 'Payment authorized but not captured'
  } else if (status === 'pending') {
    failureReason = 'Payment pending'
  } else if (status === 'captured') {
    failureReason = ''
  }

  const createdDate = payment.created_at
    ? new Date(payment.created_at * 1000).toISOString()
    : new Date().toISOString()

  return {
    id: `RZP-${payment.id}`,
    externalId: payment.id,
    merchant: 'Razorpay Test Merchant',
    customer: payment.email || payment.contact || 'Unknown Customer',
    customerEmail: payment.email || null,
    customerContact: payment.contact || null,
    amount: amountInPaise,
    type,
    timestamp: createdDate,
    paymentMethod: normalizedMethod,
    failureReason,
    attemptCount: 1,
    customerHistory: {
      previousSuccessfulPayments: 0,
      previousFailedPayments: 0,
      previousRecoveries: 0,
    },
    checkoutDuration: null,
    cartValue: null,
    subscriptionPlan: null,
    daysOverdue: 0,
    deviceType: 'Unknown',
    customerSegment: 'New',
    riskScore: status === 'captured' ? 10 : status === 'failed' ? 70 : 50,
    recoverability: status === 'captured' ? 95 : status === 'failed' ? 40 : 60,
    groundTruthAction: 'No Action',
    groundTruthRecoverable: status !== 'captured',
    groundTruthRecoveredAmount: status === 'captured' ? amountInPaise : 0,
    source: 'razorpay_test',
    provider: 'razorpay',
    environment: 'test',
    orderId: payment.order_id || null,
    razorpayStatus: status,
    razorpayMethod: payment.method || null,
    syncedAt: new Date().toISOString(),
  }
}

export async function getStatus() {
  const { hasCredentials, keyIdProvided } = getConnectionStatus()

  if (!hasCredentials) {
    return {
      success: true,
      connected: false,
      provider: 'razorpay',
      environment: 'test',
      error: 'Razorpay credentials not configured',
      syncedTransactions: loadSyncedTransactions().length,
      lastSyncedAt: getLastSyncTime(),
    }
  }

  try {
    const verification = await verifyCredentials()
    const synced = loadSyncedTransactions()

    return {
      success: true,
      connected: true,
      provider: 'razorpay',
      environment: 'test',
      merchant: {
        id: process.env.RAZORPAY_KEY_ID?.substring(0, 12) + '...',
        name: 'Razorpay Test Account',
        email: '',
      },
      syncedTransactions: synced.length,
      lastSyncedAt: getLastSyncTime(),
    }
  } catch (err) {
    return {
      success: true,
      connected: false,
      provider: 'razorpay',
      environment: 'test',
      error: err.message || 'Failed to verify Razorpay credentials',
      syncedTransactions: loadSyncedTransactions().length,
      lastSyncedAt: getLastSyncTime(),
    }
  }
}

function getLastSyncTime() {
  const synced = loadSyncedTransactions()
  if (synced.length === 0) return null
  const latest = synced.reduce((max, t) => {
    const d = t.syncedAt || t.timestamp
    return d > max ? d : max
  }, '')
  return latest || null
}

export async function syncPayments() {
  const { hasCredentials } = getConnectionStatus()
  if (!hasCredentials) {
    throw new Error('Razorpay credentials not configured')
  }

  const existing = loadSyncedTransactions()
  const existingIds = new Set(existing.map((t) => t.externalId))

  let allPayments = []
  let skip = 0
  const batchSize = 100
  let hasMore = true

  while (hasMore) {
    const result = await listPayments({ count: batchSize, skip })
    const payments = result.items || result || []
    allPayments = allPayments.concat(payments)

    if (payments.length < batchSize) {
      hasMore = false
    } else {
      skip += batchSize
    }

    if (skip >= 1000) {
      hasMore = false
    }
  }

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const payment of allPayments) {
    if (!payment.id) {
      skipped++
      continue
    }

    const normalized = normalizeRazorpayPayment(payment)

    if (existingIds.has(payment.id)) {
      const idx = existing.findIndex((t) => t.externalId === payment.id)
      if (idx >= 0) {
        existing[idx] = {
          ...existing[idx],
          razorpayStatus: payment.status,
          syncedAt: new Date().toISOString(),
        }
        updated++
      } else {
        skipped++
      }
    } else {
      existing.push(normalized)
      inserted++
    }
  }

  saveSyncedTransactions(existing)

  return {
    success: true,
    source: 'razorpay_test',
    fetched: allPayments.length,
    inserted,
    updated,
    skipped,
    totalSynced: existing.length,
    lastSyncedAt: new Date().toISOString(),
  }
}

export function getAllSyncedTransactions() {
  return loadSyncedTransactions()
}
