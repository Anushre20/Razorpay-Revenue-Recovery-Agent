import { findTransaction } from './transactionStore.js'

const MAX_RETRY_ATTEMPTS = 3
const MAX_AUTOMATIC_RECOVERY_AMOUNT = 25000
const MIN_RECOVERABILITY = 30

function checkRetryLimit(transaction, action) {
  if (
    action === 'Smart Retry' &&
    transaction.attemptCount >= MAX_RETRY_ATTEMPTS
  ) {
    return {
      passed: false,
      guardrail: 'Maximum Retry Attempts',
      reason: `Automatic retry blocked because transaction has already reached ${MAX_RETRY_ATTEMPTS} attempts.`,
    }
  }

  return {
    passed: true,
  }
}

function checkRecoveryAmount(transaction, action) {
  const automaticActions = [
    'Smart Retry',
    'UPI Fallback',
    'Payment Link',
    'Card Update Request',
    'WhatsApp Reminder',
    'Email Reminder',
  ]

  if (
    automaticActions.includes(action) &&
    transaction.amount > MAX_AUTOMATIC_RECOVERY_AMOUNT
  ) {
    return {
      passed: false,
      guardrail: 'Automatic Recovery Amount',
      reason: `Automatic recovery blocked because transaction amount ₹${transaction.amount} exceeds the ₹${MAX_AUTOMATIC_RECOVERY_AMOUNT} limit.`,
    }
  }

  return {
    passed: true,
  }
}

function checkRecoverability(transaction, action) {
  if (
    action !== 'No Action' &&
    transaction.recoverability < MIN_RECOVERABILITY
  ) {
    return {
      passed: false,
      guardrail: 'Minimum Recoverability',
      reason: `Automatic recovery blocked because recoverability score ${transaction.recoverability} is below the minimum threshold of ${MIN_RECOVERABILITY}.`,
    }
  }

  return {
    passed: true,
  }
}

export function checkGuardrails(txnId, action) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const checks = [
    checkRetryLimit(transaction, action),
    checkRecoveryAmount(transaction, action),
    checkRecoverability(transaction, action),
  ]

  const failedChecks = checks.filter(
    (check) => !check.passed,
  )

  const passed = failedChecks.length === 0

  return {
    transactionId: transaction.id,

    requestedAction: action,

    passed,

    allowedAction: passed
      ? action
      : 'Human Escalation',

    requiresApproval:
      !passed ||
      transaction.amount > MAX_AUTOMATIC_RECOVERY_AMOUNT,

    failedGuardrails: failedChecks,

    checks: {
      retryLimit: checks[0].passed,
      recoveryAmount: checks[1].passed,
      recoverability: checks[2].passed,
    },

    policy: {
      maxRetryAttempts: MAX_RETRY_ATTEMPTS,
      maxAutomaticRecoveryAmount:
        MAX_AUTOMATIC_RECOVERY_AMOUNT,
      minimumRecoverability: MIN_RECOVERABILITY,
    },
  }
}