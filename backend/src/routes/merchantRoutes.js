import express from 'express'
import { getMerchantIntelligenceController } from '../controllers/merchantController.js'

const router = express.Router()

router.get('/intelligence', getMerchantIntelligenceController)

export default router
