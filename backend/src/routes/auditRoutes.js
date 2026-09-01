import express from 'express'
import {
  getAuditTrail,
  getGuardrails,
} from '../controllers/auditController.js'

const router = express.Router()

router.get('/', getAuditTrail)
router.get('/guardrails', getGuardrails)

export default router