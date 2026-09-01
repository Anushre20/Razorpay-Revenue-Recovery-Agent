import transactions from '../data/transactions.json' with { type: 'json' }

import {
  createTestOrder,
  createTestPaymentLink,
} from './razorpayService.js'

import { getRecoveryDecision } from './recoveryService.js'
import { checkGuardrails } from './guardrailService.js'

function findTransaction(txnId) {
  return transactions.find(
    (transaction) => transaction.id === txnId,
  )
}

export async function executeRecovery(txnId) {
  const transaction = findTransaction(txnId)

  if (!transaction) {
    return null
  }

  const decision = getRecoveryDecision(txnId)

  if (!decision) {
    return null
  }

  const guardrail = checkGuardrails(
    txnId,
    decision.action,
  )

  if (!guardrail.passed) {
    return {
      transactionId: txnId,
      executed: false,
      status: 'BLOCKED',
      action: decision.action,
      reason: 'Recovery action blocked by guardrails',
      guardrails: guardrail,
    }
  }

  if (decision.action === 'Payment Link') {
    const paymentLink =
      await createTestPaymentLink({
        amount: transaction.amount,
        description:
          `Revenue recovery for ${transaction.id}`,
        referenceId: transaction.id,
        customer: {},
      })

    return {
      transactionId: txnId,
      executed: true,
      status: 'CREATED',
      action: 'Payment Link',
      provider: 'Razorpay',
      mode: 'TEST',
      amount: transaction.amount,
      razorpayPaymentLinkId:
        paymentLink.id,
      shortUrl:
        paymentLink.short_url,
    }
  }

  if (decision.action === 'Smart Retry') {
    const order =
      await createTestOrder({
        amount: transaction.amount,
        currency: 'INR',
        receipt: transaction.id,
        notes: {
          transactionId: transaction.id,
          recoveryAction: 'Smart Retry',
          mode: 'TEST',
        },
      })

    return {
      transactionId: txnId,
      executed: true,
      status: 'ORDER_CREATED',
      action: 'Smart Retry',
      provider: 'Razorpay',
      mode: 'TEST',
      amount: transaction.amount,
      razorpayOrderId: order.id,
      orderStatus: order.status,
    }
  }

  return {
    transactionId: txnId,
    executed: false,
    status: 'NOT_SUPPORTED',
    action: decision.action,
    reason:
      'This recovery action does not have a Razorpay execution flow yet',
  }
}