import { detectLeakage } from '../services/leakageService.js'

export const getLeakage = (req, res) => {
  try {
    const result = detectLeakage(req.query)

    res.json({
      success: true,
      summary: result.summary,
      count: result.transactions.length,
      data: result.transactions,
    })
  } catch (error) {
    console.error('Leakage detection error:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to detect revenue leakage',
    })
  }
}