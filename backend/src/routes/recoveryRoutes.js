import express from 'express'
import {
  getRecoveryActions,
  getAgentLogs,
  getRecoveryDecisionById,
  getGuardrailCheck,
  executeRecoveryAction,
} from '../controllers/recoveryController.js'

const router = express.Router()

router.get('/actions', getRecoveryActions)
router.get('/decision/:txnId', getRecoveryDecisionById)
router.get('/guardrails/:txnId', getGuardrailCheck)
router.post('/execute/:txnId', executeRecoveryAction)
router.get('/agent-logs', getAgentLogs)

export default router