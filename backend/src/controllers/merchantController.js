import { getMerchantIntelligence } from '../services/merchantIntelligenceService.js'

export const getMerchantIntelligenceController = (req, res) => {
  try {
    const data = getMerchantIntelligence()
    return res.json({
      success: true,
      data,
    })
  } catch (err) {
    console.error('Merchant intelligence error:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant intelligence',
    })
  }
}
