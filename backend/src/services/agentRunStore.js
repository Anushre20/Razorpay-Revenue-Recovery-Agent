import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'autonomousRuns.json')

let _runsCache = null
let _lastReadTime = 0
const CACHE_TTL_MS = 100

function readRuns() {
  try {
    const now = Date.now()
    if (_runsCache && (now - _lastReadTime) < CACHE_TTL_MS) {
      return [..._runsCache]
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8')
      _runsCache = []
      _lastReadTime = now
      return []
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const runs = Array.isArray(parsed) ? parsed : []
    _runsCache = runs
    _lastReadTime = now
    return [...runs]
  } catch {
    return _runsCache ? [..._runsCache] : []
  }
}

function writeRuns(runs) {
  try {
    const dir = path.dirname(DATA_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(runs, null, 2), 'utf8')
    _runsCache = [...runs]
    _lastReadTime = Date.now()
    return true
  } catch (err) {
    console.error('Failed to write autonomousRuns.json:', err.message)
    return false
  }
}

function generateRunId() {
  return `AGENT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

export function createRun(txnId, source) {
  const runs = readRuns()

  const existing = runs.find(
    r => r.transactionId === txnId &&
      (r.status === 'RUNNING' || r.status === 'QUEUED' || r.status === 'COMPLETED' || r.status === 'HUMAN_APPROVAL_REQUIRED')
  )
  if (existing) {
    return existing
  }

  const run = {
    agentRunId: generateRunId(),
    transactionId: txnId,
    source: source || 'unknown',
    status: 'RUNNING',
    currentStage: 'DETECT',
    stages: {
      detect: { status: 'COMPLETED', timestamp: new Date().toISOString() },
      diagnose: { status: 'PENDING' },
      decide: { status: 'PENDING' },
      policy: { status: 'PENDING' },
      execute: { status: 'PENDING' },
      recover: { status: 'PENDING' },
      audit: { status: 'PENDING' },
    },
    startedAt: new Date().toISOString(),
    completedAt: null,
  }

  runs.push(run)
  writeRuns(runs)
  return run
}

export function updateRun(agentRunId, updates) {
  const runs = readRuns()
  const idx = runs.findIndex(r => r.agentRunId === agentRunId)
  if (idx === -1) return null

  runs[idx] = { ...runs[idx], ...updates }
  writeRuns(runs)
  return runs[idx]
}

export function updateStage(agentRunId, stageName, stageData) {
  const runs = readRuns()
  const idx = runs.findIndex(r => r.agentRunId === agentRunId)
  if (idx === -1) return null

  runs[idx].stages[stageName] = {
    ...runs[idx].stages[stageName],
    ...stageData,
    timestamp: new Date().toISOString(),
  }
  runs[idx].currentStage = stageName.toUpperCase()
  writeRuns(runs)
  return runs[idx]
}

export function getRunByTxnId(txnId) {
  const runs = readRuns()
  const matching = runs.filter(r => r.transactionId === txnId)
  return matching.length > 0 ? matching[matching.length - 1] : null
}

export function getRun(agentRunId) {
  const runs = readRuns()
  return runs.find(r => r.agentRunId === agentRunId) || null
}

export function getAllRuns(limit = 50) {
  const runs = readRuns()
  return runs.slice(-limit).reverse()
}

export function getRunStats() {
  const runs = readRuns()
  return {
    total: runs.length,
    running: runs.filter(r => r.status === 'RUNNING').length,
    completed: runs.filter(r => r.status === 'COMPLETED').length,
    blocked: runs.filter(r => r.status === 'BLOCKED').length,
    humanApproval: runs.filter(r => r.status === 'HUMAN_APPROVAL_REQUIRED').length,
    executionFailed: runs.filter(r => r.status === 'EXECUTION_FAILED').length,
    failed: runs.filter(r => r.status === 'FAILED').length,
    rejected: runs.filter(r => r.status === 'REJECTED').length,
  }
}

export function approveRun(agentRunId) {
  const runs = readRuns()
  const idx = runs.findIndex(r => r.agentRunId === agentRunId)
  if (idx === -1) return null
  if (runs[idx].status !== 'HUMAN_APPROVAL_REQUIRED') return runs[idx]

  runs[idx].status = 'RUNNING'
  runs[idx].approvalDecision = 'APPROVED'
  runs[idx].approvedAt = new Date().toISOString()
  writeRuns(runs)
  return runs[idx]
}

export function rejectRun(agentRunId) {
  const runs = readRuns()
  const idx = runs.findIndex(r => r.agentRunId === agentRunId)
  if (idx === -1) return null

  runs[idx].status = 'REJECTED'
  runs[idx].approvalDecision = 'REJECTED'
  runs[idx].rejectedAt = new Date().toISOString()
  runs[idx].completedAt = new Date().toISOString()
  writeRuns(runs)
  return runs[idx]
}
