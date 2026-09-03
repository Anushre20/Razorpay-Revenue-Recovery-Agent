import { computeEvaluation } from '../services/evaluationService.js'

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
