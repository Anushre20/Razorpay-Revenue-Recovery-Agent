import {
  runAgentRecovery,
  getAgentRunForTxn,
  getAgentRuns,
  getAgentRun,
  approveAgentRun,
  rejectAgentRun,
  getAgentStats,
} from '../controllers/agentController.js'

import express from 'express'

const router = express.Router()

router.post('/recovery/:txnId', runAgentRecovery)
router.get('/recovery/:txnId', getAgentRunForTxn)
router.get('/runs', getAgentRuns)
router.get('/runs/:agentRunId', getAgentRun)
router.post('/runs/:agentRunId/approve', approveAgentRun)
router.post('/runs/:agentRunId/reject', rejectAgentRun)
router.get('/stats', getAgentStats)

export default router
