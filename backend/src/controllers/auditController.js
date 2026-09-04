import { getAllAuditLogs, getAuditLogsByTxnId } from '../services/auditService.js'
import { getGuardrailConfig } from '../services/guardrailConfigStore.js'

export const getAuditTrail = (req, res) => {
  const logs = getAllAuditLogs()
  res.json({
    success: true,
    count: logs.length,
    data: logs,
  })
}

export const getAuditByTxnId = (req, res) => {
  const logs = getAuditLogsByTxnId(req.params.txnId)
  res.json({
    success: true,
    count: logs.length,
    data: logs,
  })
}

export const getGuardrails = (req, res) => {
  const config = getGuardrailConfig()
  if (!config || !config.rules) {
    return res.json({ success: true, count: 0, data: [] })
  }

  const rules = Object.entries(config.rules).map(([key, rule]) => ({
    id: key,
    name: rule.name,
    description: rule.description,
    limit: rule.value,
    status: rule.enabled ? 'Active' : 'Inactive',
    unit: rule.unit,
  }))

  res.json({
    success: true,
    count: rules.length,
    data: rules,
  })
}
