import { diagnoses } from '../data/apiData.js'

export const getDiagnosis = (req, res) => {
  const diagnosis = diagnoses[req.params.txnId]

  if (!diagnosis) {
    return res.status(404).json({
      success: false,
      message: 'Diagnosis not found',
    })
  }

  res.json({
    success: true,
    txnId: req.params.txnId,
    data: diagnosis,
  })
}