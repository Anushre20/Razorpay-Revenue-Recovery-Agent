import express from 'express'
import {
  getAuditTrail,
  getAuditByTxnId,
  getGuardrails,
} from '../controllers/auditController.js'

const router = express.Router()

router.get('/guardrails', getGuardrails)
router.get('/', getAuditTrail)
router.get('/:txnId', getAuditByTxnId)

export default router
