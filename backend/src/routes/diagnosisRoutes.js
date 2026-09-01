import express from 'express'
import { getDiagnosis } from '../controllers/diagnosisController.js'

const router = express.Router()

router.get('/:txnId', getDiagnosis)

export default router