import express from 'express'
import {
  getIntegrationStatus,
  syncTransactions,
} from '../controllers/integrationController.js'

const router = express.Router()

router.get('/status', getIntegrationStatus)
router.post('/sync', syncTransactions)

export default router
