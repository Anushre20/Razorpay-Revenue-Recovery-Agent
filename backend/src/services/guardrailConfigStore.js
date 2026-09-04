import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'guardrailConfig.json')

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig = {
        rules: {
          maxRetryAttempts: { value: 3, enabled: true, name: 'Maximum Retry Attempts', description: 'Maximum number of automated payment retries allowed per transaction', unit: 'attempts' },
          maxAutomaticRecoveryAmount: { value: 25000, enabled: true, name: 'Automatic Recovery Amount', description: 'Automatic recovery is restricted for transactions above this amount', unit: 'INR' },
          minimumRecoverability: { value: 30, enabled: true, name: 'Minimum Recoverability', description: 'Minimum recoverability score required for automatic recovery actions', unit: '%' },
        },
        lastUpdated: null,
        updatedBy: null,
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8')
      return defaultConfig
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.error('Failed to read guardrailConfig.json:', error.message)
    return null
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Failed to write guardrailConfig.json:', error.message)
    return false
  }
}

export function getGuardrailConfig() {
  return readConfig()
}

export function getGuardrailValue(ruleKey) {
  const config = readConfig()
  if (!config || !config.rules[ruleKey]) return null
  const rule = config.rules[ruleKey]
  return { value: rule.value, enabled: rule.enabled }
}

export function getActiveValue(ruleKey) {
  const config = readConfig()
  if (!config || !config.rules[ruleKey]) return null
  const rule = config.rules[ruleKey]
  if (!rule.enabled) return null
  return rule.value
}

export function updateGuardrailConfig(updates, updatedBy = 'merchant') {
  const config = readConfig()
  if (!config) return { success: false, error: 'Failed to read config' }

  for (const [key, update] of Object.entries(updates)) {
    if (config.rules[key]) {
      if (update.value !== undefined) {
        if (typeof update.value !== 'number' || update.value < 0) {
          return { success: false, error: `Invalid value for ${key}: must be a non-negative number` }
        }
        config.rules[key].value = update.value
      }
      if (update.enabled !== undefined) {
        config.rules[key].enabled = Boolean(update.enabled)
      }
    }
  }

  config.lastUpdated = new Date().toISOString()
  config.updatedBy = updatedBy

  const written = writeConfig(config)
  if (!written) return { success: false, error: 'Failed to write config' }

  return { success: true, config }
}

export function getAffectedTransactionsCount(ruleKey, newValue) {
  const transactions = getLiveTransactionsForGuardrailCheck()
  if (!transactions) return 0

  let count = 0
  if (ruleKey === 'maxAutomaticRecoveryAmount') {
    count = transactions.filter(t => t.amount > newValue).length
  } else if (ruleKey === 'maxRetryAttempts') {
    count = transactions.filter(t => t.attemptCount >= newValue).length
  } else if (ruleKey === 'minimumRecoverability') {
    count = transactions.filter(t => t.recoverability < newValue).length
  }

  return count
}

function getLiveTransactionsForGuardrailCheck() {
  try {
    const demoPath = path.join(__dirname, '..', 'data', 'demoTransactions.json')
    const razorpayPath = path.join(__dirname, '..', 'data', 'razorpayTransactions.json')

    let txns = []

    if (fs.existsSync(demoPath)) {
      const raw = fs.readFileSync(demoPath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) txns = txns.concat(parsed)
    }

    if (fs.existsSync(razorpayPath)) {
      const raw = fs.readFileSync(razorpayPath, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) txns = txns.concat(parsed)
    }

    return txns
  } catch {
    return []
  }
}
