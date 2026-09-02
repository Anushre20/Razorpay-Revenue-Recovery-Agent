import { getAllAuditLogs, getAuditLogsByTxnId } from '../services/auditService.js'
import { guardrails } from '../data/apiData.js'

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
  res.json({
    success: true,
    count: guardrails.length,
    data: guardrails,
  })
}
