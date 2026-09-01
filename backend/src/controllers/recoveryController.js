import { getRecoveryDecision } from '../services/recoveryService.js'
import { executeRecovery } from '../services/executionService.js'
import { recoveryActions, agentLogs } from '../data/apiData.js'
import { checkGuardrails } from '../services/guardrailService.js'

export const getRecoveryDecisionById = (req, res) => {
  const decision = getRecoveryDecision(req.params.txnId)

  if (!decision) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    })
  }

  res.json({
    success: true,
    data: decision,
  })
}

export const getRecoveryActions = (req, res) => {
  res.json({
    success: true,
    count: recoveryActions.length,
    data: recoveryActions,
  })
}

export const getAgentLogs = (req, res) => {
  res.json({
    success: true,
    count: agentLogs.length,
    data: agentLogs,
  })
}

export const getGuardrailCheck = (req, res) => {

  const { txnId } = req.params
  const { action } = req.query

  if (!action) {
    return res.status(400).json({
      success: false,
      message: 'Action query parameter is required',
    })
  }

  const result =
    checkGuardrails(txnId, action)

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    })
  }

  res.json({
    success: true,
    data: result,
  })
}

export const executeRecoveryAction = async (req, res) => {
  try {
    const result =
      await executeRecovery(req.params.txnId)

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      })
    }

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error(
  'Recovery execution failed:',
  error,
)

res.status(500).json({
  success: false,
  message: 'Recovery execution failed',
  error: error.message,
  details: error.error || null,
})
  }
}