import { getStatus, syncPayments } from '../services/integrationService.js'

export const getIntegrationStatus = async (req, res) => {
  try {
    const result = await getStatus()
    res.json(result)
  } catch (error) {
    console.error('Integration status error:', error)
    res.status(500).json({
      success: false,
      connected: false,
      error: 'Failed to check integration status',
    })
  }
}

export const syncTransactions = async (req, res) => {
  try {
    const result = await syncPayments()
    res.json(result)
  } catch (error) {
    console.error('Sync error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync transactions',
    })
  }
}
