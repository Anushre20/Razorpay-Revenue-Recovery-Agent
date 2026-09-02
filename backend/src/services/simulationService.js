import transactions from '../data/transactions.json' with { type: 'json' }
import { getRecoveryDecision } from './recoveryService.js'
import { checkGuardrails } from './guardrailService.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '..', 'data', 'simulationResults.json')

const SUPPORTED_ACTIONS = ['Payment Link', 'Smart Retry']

function readSimulationResults() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8')
      return []
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.error('simulationResults.json is not an array, resetting to []')
      return []
    }
    return parsed
  } catch (error) {
    console.error('Failed to read simulationResults.json:', error.message)
    return []
  }
}

function writeSimulationResults(results) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(results, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write simulationResults.json:', error.message)
    return false
  }
}

function findTransaction(txnId) {
  return transactions.find(
    (transaction) => transaction.id === txnId,
  )
}

export function simulateRecovery(txnId) {
  const existing = getSimulationResult(txnId)
  if (existing) {
    return existing
  }

  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const decision = getRecoveryDecision(txnId)

  if (!decision) {
    return null
  }

  const guardrail = checkGuardrails(
    txnId,
    decision.initialAction,
  )

  let result

  if (!guardrail.passed) {
    result = {
      transactionId: txnId,
      action: decision.initialAction,
      finalAction: 'Human Escalation',
      status: 'BLOCKED',
      succeeded: false,
      originalAmount: transaction.amount,
      recoveredAmount: 0,
      recoverability: transaction.recoverability,
      riskScore: transaction.riskScore,
      failureReason: transaction.failureReason,
      timestamp: new Date().toISOString(),
      guardrails: guardrail,
    }
  } else if (!SUPPORTED_ACTIONS.includes(decision.action)) {
    result = {
      transactionId: txnId,
      action: decision.action,
      finalAction: decision.action,
      status: 'NOT_SUPPORTED',
      succeeded: false,
      originalAmount: transaction.amount,
      recoveredAmount: 0,
      recoverability: transaction.recoverability,
      riskScore: transaction.riskScore,
      failureReason: transaction.failureReason,
      timestamp: new Date().toISOString(),
    }
  } else if (transaction.groundTruthRecoverable) {
    result = {
      transactionId: txnId,
      action: decision.action,
      finalAction: decision.action,
      status: 'SIMULATED_RECOVERY',
      succeeded: true,
      originalAmount: transaction.amount,
      recoveredAmount: transaction.groundTruthRecoveredAmount,
      recoverability: transaction.recoverability,
      riskScore: transaction.riskScore,
      failureReason: transaction.failureReason,
      timestamp: new Date().toISOString(),
    }
  } else {
    result = {
      transactionId: txnId,
      action: decision.action,
      finalAction: decision.action,
      status: 'SIMULATED_FAILURE',
      succeeded: false,
      originalAmount: transaction.amount,
      recoveredAmount: 0,
      recoverability: transaction.recoverability,
      riskScore: transaction.riskScore,
      failureReason: transaction.failureReason,
      timestamp: new Date().toISOString(),
    }
  }

  const results = readSimulationResults()
  results.push(result)
  const written = writeSimulationResults(results)

  if (!written) {
    console.error('Warning: simulation result calculated but not persisted to disk')
  }

  return result
}

export function getSimulationResult(txnId) {
  const results = readSimulationResults()
  return results.find(r => r.transactionId === txnId) || null
}

export function getAllSimulationResults() {
  return readSimulationResults()
}

export function getSimulationSummary() {
  const results = readSimulationResults()

  const totalSimulations = results.length
  const successfulSimulations = results.filter(r => r.succeeded === true).length
  const blockedSimulations = results.filter(r => r.status === 'BLOCKED').length
  const failedSimulations = results.filter(r => r.succeeded === false && r.status !== 'BLOCKED').length
  const totalAmountAtRisk = results.reduce((sum, r) => sum + (r.originalAmount || 0), 0)
  const totalRecoveredAmount = results.reduce((sum, r) => sum + (r.recoveredAmount || 0), 0)
  const recoveryRate = totalAmountAtRisk === 0 ? 0 : Math.round((totalRecoveredAmount / totalAmountAtRisk) * 10000) / 100

  return {
    totalSimulations,
    successfulSimulations,
    failedSimulations,
    blockedSimulations,
    totalAmountAtRisk,
    totalRecoveredAmount,
    recoveryRate,
  }
}
