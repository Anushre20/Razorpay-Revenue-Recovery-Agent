import { runAutonomousRecovery } from '../services/autonomousRecoveryService.js'
import {
  getRunByTxnId,
  getAllRuns,
  getRun,
  approveRun,
  rejectRun,
  getRunStats,
} from '../services/agentRunStore.js'

export const runAgentRecovery = async (req, res) => {
  try {
    const { txnId } = req.params

    const result = await runAutonomousRecovery(txnId, {
      source: 'manual',
      skipExisting: false,
    })

    if (result.reason === 'TRANSACTION_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      })
    }

    return res.status(200).json({
      success: true,
      data: result.run,
      skipped: result.skipped || false,
      reason: result.reason || null,
      requiresApproval: result.requiresApproval || false,
    })
  } catch (err) {
    console.error('Agent recovery error:', err.message)
    return res.status(500).json({
      success: false,
      message: 'Agent recovery failed: ' + err.message,
    })
  }
}

export const getAgentRunForTxn = (req, res) => {
  try {
    const { txnId } = req.params
    const run = getRunByTxnId(txnId)

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'No agent run found for this transaction',
      })
    }

    return res.json({ success: true, data: run })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agent run',
    })
  }
}

export const getAgentRuns = (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const runs = getAllRuns(limit)
    return res.json({ success: true, count: runs.length, data: runs })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agent runs',
    })
  }
}

export const getAgentRun = (req, res) => {
  try {
    const { agentRunId } = req.params
    const run = getRun(agentRunId)

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Agent run not found',
      })
    }

    return res.json({ success: true, data: run })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agent run',
    })
  }
}

export const approveAgentRun = async (req, res) => {
  try {
    const { agentRunId } = req.params
    const run = approveRun(agentRunId)

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Agent run not found',
      })
    }

    if (run.status !== 'RUNNING') {
      const { runAutonomousRecovery } = await import('../services/autonomousRecoveryService.js')
      await runAutonomousRecovery(run.transactionId, {
        source: 'approval',
        skipExisting: false,
      })
    }

    return res.json({
      success: true,
      data: getRunByTxnId(run.transactionId),
      message: 'Agent run approved and resumed',
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to approve agent run: ' + err.message,
    })
  }
}

export const rejectAgentRun = (req, res) => {
  try {
    const { agentRunId } = req.params
    const run = rejectRun(agentRunId)

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Agent run not found',
      })
    }

    return res.json({
      success: true,
      data: run,
      message: 'Agent run rejected',
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reject agent run',
    })
  }
}

export const getAgentStats = (req, res) => {
  try {
    const stats = getRunStats()
    return res.json({ success: true, data: stats })
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch agent stats',
    })
  }
}
