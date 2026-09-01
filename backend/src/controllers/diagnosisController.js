import { diagnoseTransaction } from '../services/diagnosisService.js'

export const getDiagnosis = (req, res) => {
  try {
    const diagnosis = diagnoseTransaction(
      req.params.txnId,
    )

    if (!diagnosis) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      })
    }

    res.json({
      success: true,
      txnId: req.params.txnId,
      data: diagnosis,
    })
  } catch (error) {
    console.error('Diagnosis error:', error)

    res.status(500).json({
      success: false,
      message: 'Failed to diagnose transaction',
    })
  }
}