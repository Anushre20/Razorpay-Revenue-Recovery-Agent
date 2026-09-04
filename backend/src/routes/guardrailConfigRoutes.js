import express from 'express'
import {
  getGuardrailConfiguration,
  updateGuardrailConfiguration,
  getGuardrailPreview,
} from '../controllers/guardrailConfigController.js'

const router = express.Router()

router.get('/', getGuardrailConfiguration)
router.put('/', updateGuardrailConfiguration)
router.get('/preview', getGuardrailPreview)

export default router
