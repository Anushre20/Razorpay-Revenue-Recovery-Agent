import express from 'express'
import { getLeakage } from '../controllers/leakageController.js'

const router = express.Router()

router.get('/', getLeakage)

export default router