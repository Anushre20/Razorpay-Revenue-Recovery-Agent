import express from 'express'
import {
  getAnalytics,
  getMerchants,
  getDashboard,
} from '../controllers/analyticsController.js'

const router = express.Router()

router.get('/', getAnalytics)
router.get('/dashboard', getDashboard)
router.get('/merchants', getMerchants)

export default router