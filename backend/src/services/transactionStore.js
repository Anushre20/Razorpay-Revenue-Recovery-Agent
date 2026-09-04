import historicalTransactions from '../data/transactions.json' with { type: 'json' }
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllSyncedTransactions } from './integrationService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEMO_DATA_PATH = path.join(__dirname, '..', '..', 'data', 'demoTransactions.json')

function loadDemoTransactions() {
  try {
    if (fs.existsSync(DEMO_DATA_PATH)) {
      const raw = fs.readFileSync(DEMO_DATA_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error('Failed to load demo transactions:', err.message)
  }
  return []
}

function saveDemoTransactions(data) {
  const dir = path.dirname(DEMO_DATA_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DEMO_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export function getAllTransactions() {
  const historical = historicalTransactions.map((t) => ({ ...t, source: t.source || 'historical' }))
  const razorpay = getAllSyncedTransactions()
  const demo = loadDemoTransactions()
  return [...historical, ...razorpay, ...demo]
}

export function getTransactionsBySource(source) {
  if (source === 'historical') {
    return historicalTransactions.map((t) => ({ ...t, source: t.source || 'historical' }))
  }
  if (source === 'razorpay_test') {
    return getAllSyncedTransactions()
  }
  if (source === 'demo') {
    return loadDemoTransactions()
  }
  return getAllTransactions()
}

export function findTransaction(txnId) {
  const historical = historicalTransactions.find((t) => t.id === txnId)
  if (historical) return { ...historical, source: historical.source || 'historical' }

  const razorpay = getAllSyncedTransactions().find((t) => t.id === txnId)
  if (razorpay) return razorpay

  const demo = loadDemoTransactions().find((t) => t.id === txnId)
  if (demo) return demo

  return null
}

export function addDemoTransaction(transaction) {
  const existing = loadDemoTransactions()
  existing.push(transaction)
  saveDemoTransactions(existing)
  return transaction
}

export function getDemoTransactions() {
  return loadDemoTransactions()
}

export function getHistoricalTransactions() {
  return historicalTransactions
}

export function getRazorpayTransactions() {
  return getAllSyncedTransactions()
}

export { saveDemoTransactions, loadDemoTransactions }
