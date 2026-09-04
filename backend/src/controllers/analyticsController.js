import { merchants } from '../data/apiData.js'
import { computeEvaluation } from '../services/evaluationService.js'

export const getAnalytics = (req, res) => {
  const evaluation = computeEvaluation()
  res.json({
    success: true,
    data: {
      totalAtRisk: evaluation.totalAtRisk,
      totalRecovered: evaluation.totalRecovered,
      recoveryRate: evaluation.recoveryRate,
      successfulInterventions: evaluation.truePositives + evaluation.trueNegatives,
      unnecessaryActions: evaluation.falsePositives,
    },
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
  const evaluation = computeEvaluation()
  res.json({
    success: true,
    data: {
      totalAtRisk: evaluation.totalAtRisk,
      totalRecovered: evaluation.totalRecovered,
      recoveryRate: evaluation.recoveryRate,
      activeCases: transactionsCount(),
    },
  })
}

function transactionsCount() {
  return 3
}
