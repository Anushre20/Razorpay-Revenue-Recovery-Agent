import { computeEvaluation } from '../services/evaluationService.js'
import { getModelMetrics, isLoaded } from '../services/mlInferenceService.js'
import { computeActualRecoveryPerformance } from '../services/actualRecoveryService.js'

export const getEvaluation = (req, res) => {
  try {
    const evaluation = computeEvaluation()

    res.json({
      success: true,
      data: evaluation,
    })
  } catch (err) {
    console.error('Evaluation computation failed:', err.message)
    res.status(500).json({
      success: false,
      message: 'Failed to compute evaluation metrics',
    })
  }
}

export const getMLMetrics = (req, res) => {
  try {
    if (!isLoaded()) {
      return res.json({
        success: true,
        data: { loaded: false, message: 'ML models not loaded' },
      })
    }

    const metrics = getModelMetrics()
    res.json({
      success: true,
      data: { loaded: true, ...metrics },
    })
  } catch (err) {
    console.error('ML metrics retrieval failed:', err.message)
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ML metrics',
    })
  }
}

export const getActualRecoveryPerformance = (req, res) => {
  try {
    const performance = computeActualRecoveryPerformance()
    res.json({
      success: true,
      data: performance,
    })
  } catch (err) {
    console.error('Actual recovery performance computation failed:', err.message)
    res.status(500).json({
      success: false,
      message: 'Failed to compute actual recovery performance',
    })
  }
}
