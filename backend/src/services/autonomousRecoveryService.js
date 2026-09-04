import { findTransaction } from './transactionStore.js'
import { diagnoseTransaction } from './diagnosisService.js'
import { getRecoveryDecision } from './recoveryService.js'
import { checkGuardrails } from './guardrailService.js'
import { executeRecovery } from './executionService.js'
import {
  recordAIDecision,
  recordPolicyCheck,
  recordActionResult,
} from './auditService.js'
import {
  createRun,
  updateStage,
  updateRun,
  getRunByTxnId,
} from './agentRunStore.js'

const EXECUTABLE_ACTIONS = ['Payment Link', 'Smart Retry']

export async function runAutonomousRecovery(txnId, options = {}) {
  const { source = 'unknown', skipExisting = true } = options

  const existingRun = getRunByTxnId(txnId)
  if (skipExisting && existingRun) {
    if (
      existingRun.status === 'COMPLETED' ||
      existingRun.status === 'BLOCKED' ||
      existingRun.status === 'HUMAN_APPROVAL_REQUIRED' ||
      existingRun.status === 'REJECTED'
    ) {
      return { skipped: true, reason: 'ALREADY_EXECUTED', run: existingRun }
    }
    if (existingRun.status === 'RUNNING') {
      return { skipped: true, reason: 'ALREADY_RUNNING', run: existingRun }
    }
  }

  const transaction = findTransaction(txnId)
  if (!transaction) {
    return { skipped: true, reason: 'TRANSACTION_NOT_FOUND' }
  }

  const run = createRun(txnId, source || transaction.source || 'unknown')

  try {
    await stageDetect(run.agentRunId, transaction)
    const diagnosis = await stageDiagnose(run.agentRunId, txnId, transaction)
    const decision = await stageDecide(run.agentRunId, txnId, transaction)
    const policyResult = await stagePolicy(run.agentRunId, txnId, decision)

    if (policyResult.status === 'APPROVAL_REQUIRED') {
      updateRun(run.agentRunId, {
        status: 'HUMAN_APPROVAL_REQUIRED',
        completedAt: new Date().toISOString(),
      })
      return {
        skipped: false,
        run: getRunByTxnId(txnId),
        requiresApproval: true,
      }
    }

    if (policyResult.status === 'BLOCKED') {
      await stageAudit(run.agentRunId, txnId, decision, policyResult, null, 'BLOCKED')
      updateRun(run.agentRunId, {
        status: 'BLOCKED',
        completedAt: new Date().toISOString(),
      })
      return { skipped: false, run: getRunByTxnId(txnId) }
    }

    const finalAction = policyResult.allowedAction

    if (!EXECUTABLE_ACTIONS.includes(finalAction)) {
      updateStage(run.agentRunId, 'execute', {
        status: 'COMPLETED',
        result: { status: 'NOT_SUPPORTED', action: finalAction, reason: 'Action not supported for automatic execution' },
      })
      await stageAudit(run.agentRunId, txnId, decision, policyResult, { status: 'NOT_SUPPORTED', action: finalAction }, 'NOT_SUPPORTED')
      updateRun(run.agentRunId, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      })
      return { skipped: false, run: getRunByTxnId(txnId) }
    }

    const executionResult = await stageExecute(run.agentRunId, txnId, finalAction)

    const recoveryResult = await stageRecover(run.agentRunId, txnId, executionResult)

    await stageAudit(run.agentRunId, txnId, decision, policyResult, executionResult, recoveryResult.status)

    const overallStatus = executionResult.executed ? 'COMPLETED' : 'EXECUTION_FAILED'
    updateRun(run.agentRunId, {
      status: overallStatus,
      completedAt: new Date().toISOString(),
    })

    return { skipped: false, run: getRunByTxnId(txnId) }
  } catch (err) {
    console.error(`[Agent] Pipeline failed for ${txnId}:`, err.message)
    updateRun(run.agentRunId, {
      status: 'FAILED',
      error: err.message,
      completedAt: new Date().toISOString(),
    })
    return { skipped: false, run: getRunByTxnId(txnId), error: err.message }
  }
}

async function stageDetect(runId, transaction) {
  updateStage(runId, 'detect', {
    status: 'COMPLETED',
    result: {
      transactionId: transaction.id,
      source: transaction.source || 'unknown',
      amount: transaction.amount,
      type: transaction.type,
      failureReason: transaction.failureReason,
    },
  })
}

async function stageDiagnose(runId, txnId, transaction) {
  updateStage(runId, 'diagnose', { status: 'RUNNING' })

  try {
    const diagnosis = diagnoseTransaction(txnId)
    updateStage(runId, 'diagnose', {
      status: 'COMPLETED',
      result: {
        problem: diagnosis.problem,
        rootCause: diagnosis.rootCause,
        recoverability: diagnosis.recoverability,
        riskScore: diagnosis.riskScore,
        recommendedAction: diagnosis.recommendedAction,
        confidence: diagnosis.confidence,
        mlPrediction: diagnosis.mlPrediction,
      },
    })
    return diagnosis
  } catch (err) {
    updateStage(runId, 'diagnose', {
      status: 'FAILED',
      error: err.message,
    })
    throw err
  }
}

async function stageDecide(runId, txnId, transaction) {
  updateStage(runId, 'decide', { status: 'RUNNING' })

  try {
    const decision = getRecoveryDecision(txnId)
    updateStage(runId, 'decide', {
      status: 'COMPLETED',
      result: {
        aiRecommendation: decision.initialAction,
        finalAction: decision.action,
        reason: decision.reason,
        recoverability: decision.recoverability,
        riskScore: decision.riskScore,
        confidence: decision.mlPrediction?.action?.confidence,
        mlAction: decision.mlPrediction?.action?.prediction,
      },
    })

    recordAIDecision({
      transactionId: txnId,
      action: decision.initialAction,
      reason: decision.reason,
      recoverability: decision.recoverability,
      riskScore: decision.riskScore,
      amount: decision.amount,
      failureReason: decision.failureReason,
      requiresApproval: decision.requiresApproval,
    })

    return decision
  } catch (err) {
    updateStage(runId, 'decide', {
      status: 'FAILED',
      error: err.message,
    })
    throw err
  }
}

async function stagePolicy(runId, txnId, decision) {
  updateStage(runId, 'policy', { status: 'RUNNING' })

  try {
    const guardrailResult = checkGuardrails(txnId, decision.initialAction)

    recordPolicyCheck(txnId, guardrailResult)

    if (!guardrailResult.passed && guardrailResult.requiresApproval) {
      updateStage(runId, 'policy', {
        status: 'APPROVAL_REQUIRED',
        result: {
          passed: false,
          allowedAction: guardrailResult.allowedAction,
          requiresApproval: true,
          failedGuardrails: guardrailResult.failedGuardrails,
          message: 'Action requires human approval',
        },
      })
      return { ...guardrailResult, status: 'APPROVAL_REQUIRED' }
    }

    if (!guardrailResult.passed) {
      updateStage(runId, 'policy', {
        status: 'BLOCKED',
        result: {
          passed: false,
          allowedAction: guardrailResult.allowedAction,
          requiresApproval: false,
          failedGuardrails: guardrailResult.failedGuardrails,
          message: `Blocked: ${guardrailResult.failedGuardrails.map(g => g.reason).join('; ')}`,
        },
      })
      return { ...guardrailResult, status: 'BLOCKED' }
    }

    updateStage(runId, 'policy', {
      status: 'COMPLETED',
      result: {
        passed: true,
        allowedAction: guardrailResult.allowedAction,
        requiresApproval: guardrailResult.requiresApproval,
        message: 'Policy check passed',
      },
    })
    return { ...guardrailResult, status: 'APPROVED' }
  } catch (err) {
    updateStage(runId, 'policy', {
      status: 'FAILED',
      error: err.message,
    })
    throw err
  }
}

async function stageExecute(runId, txnId, action) {
  updateStage(runId, 'execute', { status: 'RUNNING' })

  try {
    const result = await executeRecovery(txnId)

    recordActionResult(txnId, result)

    if (result.executed) {
      updateStage(runId, 'execute', {
        status: 'COMPLETED',
        result: {
          executed: true,
          status: result.status,
          action: result.action,
          provider: result.provider,
          mode: result.mode,
          amount: result.amount,
          razorpayPaymentLinkId: result.razorpayPaymentLinkId,
          shortUrl: result.shortUrl,
          razorpayOrderId: result.razorpayOrderId,
          orderStatus: result.orderStatus,
        },
      })
    } else {
      updateStage(runId, 'execute', {
        status: 'FAILED',
        result: {
          executed: false,
          status: result.status,
          action: result.action,
          reason: result.reason,
        },
      })
    }

    return result
  } catch (err) {
    updateStage(runId, 'execute', {
      status: 'FAILED',
      error: err.message,
    })
    recordActionResult(txnId, {
      action,
      executed: false,
      status: 'EXECUTION_ERROR',
      reason: err.message,
    })
    return { executed: false, status: 'EXECUTION_ERROR', action, reason: err.message }
  }
}

async function stageRecover(runId, txnId, executionResult) {
  updateStage(runId, 'recover', { status: 'RUNNING' })

  let recoveryStatus
  if (!executionResult.executed) {
    recoveryStatus = 'NOT_STARTED'
  } else if (executionResult.status === 'CREATED' || executionResult.status === 'ORDER_CREATED') {
    recoveryStatus = 'PENDING'
  } else {
    recoveryStatus = 'NOT_RECOVERED'
  }

  const recoveryResult = {
    status: recoveryStatus,
    executed: executionResult.executed,
    action: executionResult.action,
    message: recoveryStatus === 'PENDING'
      ? 'Recovery action executed. Awaiting customer response.'
      : recoveryStatus === 'NOT_STARTED'
        ? 'Recovery action was not executed.'
        : 'Recovery outcome pending.',
  }

  updateStage(runId, 'recover', {
    status: 'COMPLETED',
    result: recoveryResult,
  })

  return recoveryResult
}

async function stageAudit(runId, txnId, decision, policyResult, executionResult, recoveryStatus) {
  updateStage(runId, 'audit', { status: 'RUNNING' })

  try {
    const auditRecord = {
      agentRunId: runId,
      transactionId: txnId,
      aiRecommendation: decision.initialAction,
      policyResult: policyResult.passed ? 'APPROVED' : 'BLOCKED',
      finalAction: policyResult.allowedAction,
      executionStatus: executionResult?.status || 'NOT_STARTED',
      recoveryStatus: recoveryStatus || 'NOT_STARTED',
    }

    updateStage(runId, 'audit', {
      status: 'COMPLETED',
      result: auditRecord,
    })

    return auditRecord
  } catch (err) {
    updateStage(runId, 'audit', {
      status: 'FAILED',
      error: err.message,
    })
  }
}
