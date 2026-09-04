import express from 'express'
import { getEvaluation, getMLMetrics, getActualRecoveryPerformance } from '../controllers/evaluationController.js'

const router = express.Router()

router.get('/', getEvaluation)
router.get('/ml-metrics', getMLMetrics)
router.get('/actual-performance', getActualRecoveryPerformance)

export default router
