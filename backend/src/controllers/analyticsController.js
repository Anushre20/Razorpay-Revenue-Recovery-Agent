import { analytics, merchants } from '../data/apiData.js'

export const getAnalytics = (req, res) => {
  res.json({
    success: true,
    data: analytics,
  })
}

export const getMerchants = (req, res) => {
  res.json({
    success: true,
    count: merchants.length,
    data: merchants,
  })
}

export const getDashboard = (req, res) => {
  res.json({
    success: true,
    data: {
      totalAtRisk: analytics.totalAtRisk,
      totalRecovered: analytics.totalRecovered,
      recoveryRate: analytics.recoveryRate,
      failedPayments: 4850000,
      abandonedCheckouts: 3200000,
      subscriptionFailures: 2650000,
      activeCases: transactionsCount(),
    },
  })
}

function transactionsCount() {
  return 3
}