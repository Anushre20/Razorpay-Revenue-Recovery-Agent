import { auditTrail, guardrails } from '../data/apiData.js'

export const getAuditTrail = (req, res) => {
  res.json({
    success: true,
    count: auditTrail.length,
    data: auditTrail,
  })
}

export const getGuardrails = (req, res) => {
  res.json({
    success: true,
    count: guardrails.length,
    data: guardrails,
  })
}