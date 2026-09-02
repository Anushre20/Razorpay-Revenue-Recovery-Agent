import { getRecoveryDecision } from '../services/recoveryService.js'
import { executeRecovery } from '../services/executionService.js'
import { recoveryActions, agentLogs } from '../data/apiData.js'
import { checkGuardrails } from '../services/guardrailService.js'
import { simulateRecovery, getSimulationResult, getAllSimulationResults, getSimulationSummary } from '../services/simulationService.js'
import { recordAIDecision, recordPolicyCheck, recordActionResult, recordSimulationResult } from '../services/auditService.js'

export const getRecoveryDecisionById = (req, res) => {
  const decision = getRecoveryDecision(req.params.txnId)

  if (!decision) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    })
  }

  try {
    recordAIDecision(decision)
  } catch (err) {
    console.error('Audit recording failed for AI_DECISION:', err.message)
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

  try {
    recordPolicyCheck(txnId, result)
  } catch (err) {
    console.error('Audit recording failed for POLICY_CHECK:', err.message)
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

    try {
      recordActionResult(req.params.txnId, result)
    } catch (err) {
      console.error('Audit recording failed for ACTION_RESULT:', err.message)
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

    try {
      recordActionResult(req.params.txnId, {
        action: 'Unknown',
        status: 'FAILED',
        executed: false,
        reason: error.message,
      })
    } catch (err) {
      console.error('Audit recording failed for ACTION_RESULT (error case):', err.message)
    }

res.status(500).json({
  success: false,
  message: 'Recovery execution failed',
  error: error.message,
  details: error.error || null,
})
  }
}

export const simulateRecoveryAction = (req, res) => {
  const result = simulateRecovery(req.params.txnId)

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Transaction not found',
    })
  }

  try {
    recordSimulationResult(req.params.txnId, result)
  } catch (err) {
    console.error('Audit recording failed for SIMULATION_RESULT:', err.message)
  }

  res.json({
    success: true,
    data: result,
  })
}

export const getSimulation = (req, res) => {
  const result = getSimulationResult(req.params.txnId)

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'No simulation result found for this transaction',
    })
  }

  res.json({
    success: true,
    data: result,
  })
}

export const getAllSimulations = (req, res) => {
  const results = getAllSimulationResults()

  res.json({
    success: true,
    count: results.length,
    data: results,
  })
}

export const getSimulationSummaryData = (req, res) => {
  const summary = getSimulationSummary()

  res.json({
    success: true,
    data: summary,
  })
}
