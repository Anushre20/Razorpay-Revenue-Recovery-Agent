import {
  getGuardrailConfig,
  updateGuardrailConfig,
  getAffectedTransactionsCount,
} from '../services/guardrailConfigStore.js'

export const getGuardrailConfiguration = (req, res) => {
  const config = getGuardrailConfig()
  if (!config) {
    return res.status(500).json({ success: false, message: 'Failed to read guardrail configuration' })
  }
  res.json({ success: true, data: config })
}

export const updateGuardrailConfiguration = (req, res) => {
  const { rules } = req.body

  if (!rules || typeof rules !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid request: rules object required' })
  }

  const result = updateGuardrailConfig(rules, 'merchant')
  if (!result.success) {
    return res.status(400).json({ success: false, message: result.error })
  }

  res.json({ success: true, data: result.config })
}

export const getGuardrailPreview = (req, res) => {
  const { ruleKey, value } = req.query

  if (!ruleKey || value === undefined) {
    return res.status(400).json({ success: false, message: 'ruleKey and value query parameters required' })
  }

  const numValue = Number(value)
  if (isNaN(numValue) || numValue < 0) {
    return res.status(400).json({ success: false, message: 'Value must be a non-negative number' })
  }

  const affectedCount = getAffectedTransactionsCount(ruleKey, numValue)
  res.json({ success: true, data: { ruleKey, newValue: numValue, affectedTransactions: affectedCount } })
}
