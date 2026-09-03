import express from 'express'
import { getEvaluation } from '../controllers/evaluationController.js'

const router = express.Router()

router.get('/', getEvaluation)

export default router
