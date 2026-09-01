import express from 'express'
import {
  getRecoveryActions,
  getAgentLogs,
} from '../controllers/recoveryController.js'

const router = express.Router()

router.get('/actions', getRecoveryActions)
router.get('/agent-logs', getAgentLogs)

export default router