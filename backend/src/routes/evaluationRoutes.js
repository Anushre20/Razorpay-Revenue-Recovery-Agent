import express from 'express'
import { getEvaluation, getMLMetrics } from '../controllers/evaluationController.js'

const router = express.Router()

router.get('/', getEvaluation)
router.get('/ml-metrics', getMLMetrics)

export default router
