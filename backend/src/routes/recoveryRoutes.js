import express from 'express'
import {
  getRecoveryActions,
  getAgentLogs,
  getRecoveryDecisionById,
  getGuardrailCheck,
  executeRecoveryAction,
  simulateRecoveryAction,
  getSimulation,
  getAllSimulations,
  getSimulationSummaryData,
} from '../controllers/recoveryController.js'

const router = express.Router()

router.get('/actions', getRecoveryActions)
router.get('/decision/:txnId', getRecoveryDecisionById)
router.get('/guardrails/:txnId', getGuardrailCheck)
router.post('/execute/:txnId', executeRecoveryAction)
router.post('/simulate/:txnId', simulateRecoveryAction)
router.get('/simulation-summary', getSimulationSummaryData)
router.get('/simulation/:txnId', getSimulation)
router.get('/simulations', getAllSimulations)
router.get('/agent-logs', getAgentLogs)

export default router