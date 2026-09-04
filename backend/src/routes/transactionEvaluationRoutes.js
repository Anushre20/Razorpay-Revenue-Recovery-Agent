import express from 'express'
import { evaluateTransaction } from '../controllers/transactionEvaluationController.js'

const router = express.Router()

router.post('/evaluate', evaluateTransaction)

export default router
