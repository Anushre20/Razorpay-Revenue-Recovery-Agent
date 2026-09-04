import { ingestAndEvaluate } from '../services/ingestionService.js'
import { diagnoseTransaction } from '../services/diagnosisService.js'
import { getRecoveryDecision } from '../services/recoveryService.js'
import { runAutonomousRecovery } from '../services/autonomousRecoveryService.js'

export const evaluateTransaction = (req, res) => {
  try {
    const {
      amount,
      paymentMethod,
      failureReason,
      attempts,
      customerSegment,
      merchant,
      customer,
    } = req.body

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required',
      })
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required',
      })
    }

    if (!failureReason) {
      return res.status(400).json({
        success: false,
        message: 'Failure reason is required',
      })
    }

    const transaction = ingestAndEvaluate(req.body)

    if (!transaction) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create transaction',
      })
    }

    const diagnosis = diagnoseTransaction(transaction.id)
    const decision = getRecoveryDecision(transaction.id)

    runAutonomousRecovery(transaction.id, {
      source: transaction.source || 'demo',
      skipExisting: true,
    }).catch(err => {
      console.error(`[Agent] Auto-recovery failed for ${transaction.id}:`, err.message)
    })

    return res.status(201).json({
      success: true,
      transaction,
      diagnosis,
      decision,
    })
  } catch (error) {
    console.error('Evaluate transaction error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to evaluate transaction',
    })
  }
}
