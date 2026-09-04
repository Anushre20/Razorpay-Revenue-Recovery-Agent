import { findTransaction } from './transactionStore.js'
import { getGuardrailConfig } from './guardrailConfigStore.js'

function getLimits() {
  const config = getGuardrailConfig()
  if (!config || !config.rules) {
    return { maxRetryAttempts: 3, maxAutomaticRecoveryAmount: 25000, minimumRecoverability: 30 }
  }
  return {
    maxRetryAttempts: config.rules.maxRetryAttempts?.enabled ? config.rules.maxRetryAttempts.value : 3,
    maxAutomaticRecoveryAmount: config.rules.maxAutomaticRecoveryAmount?.enabled ? config.rules.maxAutomaticRecoveryAmount.value : 25000,
    minimumRecoverability: config.rules.minimumRecoverability?.enabled ? config.rules.minimumRecoverability.value : 30,
  }
}

function checkRetryLimit(transaction, action, maxRetryAttempts) {
  if (
    action === 'Smart Retry' &&
    transaction.attemptCount >= maxRetryAttempts
  ) {
    return {
      passed: false,
      guardrail: 'Maximum Retry Attempts',
      reason: `Automatic retry blocked because transaction has already reached ${maxRetryAttempts} attempts.`,
    }
  }

  return { passed: true }
}

function checkRecoveryAmount(transaction, action, maxAutomaticRecoveryAmount) {
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
    transaction.amount > maxAutomaticRecoveryAmount
  ) {
    return {
      passed: false,
      guardrail: 'Automatic Recovery Amount',
      reason: `Automatic recovery blocked because transaction amount ₹${transaction.amount} exceeds the ₹${maxAutomaticRecoveryAmount} limit.`,
    }
  }

  return { passed: true }
}

function checkRecoverability(transaction, action, minimumRecoverability) {
  if (
    action !== 'No Action' &&
    transaction.recoverability < minimumRecoverability
  ) {
    return {
      passed: false,
      guardrail: 'Minimum Recoverability',
      reason: `Automatic recovery blocked because recoverability score ${transaction.recoverability} is below the minimum threshold of ${minimumRecoverability}.`,
    }
  }

  return { passed: true }
}

export function checkGuardrails(txnId, action) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const limits = getLimits()

  const checks = [
    checkRetryLimit(transaction, action, limits.maxRetryAttempts),
    checkRecoveryAmount(transaction, action, limits.maxAutomaticRecoveryAmount),
    checkRecoverability(transaction, action, limits.minimumRecoverability),
  ]

  const failedChecks = checks.filter(check => !check.passed)
  const passed = failedChecks.length === 0

  return {
    transactionId: transaction.id,
    requestedAction: action,
    passed,
    allowedAction: passed ? action : 'Human Escalation',
    requiresApproval: !passed || transaction.amount > limits.maxAutomaticRecoveryAmount,
    failedGuardrails: failedChecks,
    checks: {
      retryLimit: checks[0].passed,
      recoveryAmount: checks[1].passed,
      recoverability: checks[2].passed,
    },
    policy: {
      maxRetryAttempts: limits.maxRetryAttempts,
      maxAutomaticRecoveryAmount: limits.maxAutomaticRecoveryAmount,
      minimumRecoverability: limits.minimumRecoverability,
    },
  }
}
