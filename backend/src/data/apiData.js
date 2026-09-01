export const transactions = [
  {
    id: 'TXN-2847361',
    merchant: 'UrbanKart',
    customer: 'Rahul Sharma',
    amount: 89400,
    type: 'Failed Payment',
    failureReason: 'Insufficient Funds',
    riskScore: 92,
    status: 'At Risk',
  },
  {
    id: 'TXN-2847155',
    merchant: 'TechNova',
    customer: 'Priya Mehta',
    amount: 78500,
    type: 'Abandoned Checkout',
    failureReason: '3D Secure Authentication Failed',
    riskScore: 81,
    status: 'At Risk',
  },
  {
    id: 'TXN-2847289',
    merchant: 'StreamBox',
    customer: 'Arjun Kapoor',
    amount: 156000,
    type: 'Subscription Failure',
    failureReason: 'Expired Card',
    riskScore: 74,
    status: 'In Recovery',
  },
]

export const diagnoses = {
  'TXN-2847361': {
    problem: 'Card declined due to insufficient funds',
    rootCause: 'Expected salary credit delay',
    confidence: 89,
    recommendedAction: 'Schedule smart retry and offer UPI fallback',
    urgency: 'High',
    alternatePayments: ['UPI', 'Net Banking', 'EMI'],
    estimatedRecovery: 89400,
  },

  'TXN-2847155': {
    problem: '3D Secure authentication failed',
    rootCause: 'OTP delivery/authentication flow failure',
    confidence: 76,
    recommendedAction: 'Send WhatsApp payment link',
    urgency: 'High',
    alternatePayments: ['WhatsApp Pay', 'UPI', 'Saved Cards'],
    estimatedRecovery: 78500,
  },

  'TXN-2847289': {
    problem: 'Card expired and subscription renewal failed',
    rootCause: 'Saved payment credential is expired',
    confidence: 94,
    recommendedAction: 'Send card update request and offer UPI',
    urgency: 'Medium',
    alternatePayments: ['Update Card', 'UPI AutoPay', 'Net Banking'],
    estimatedRecovery: 156000,
  },
}

export const recoveryActions = [
  {
    id: 'ACT-001',
    txnId: 'TXN-2847361',
    action: 'Smart Retry',
    reason: 'Historical retry pattern indicates high recovery probability',
    status: 'Pending',
    result: null,
    channel: 'Auto',
  },
  {
    id: 'ACT-002',
    txnId: 'TXN-2847155',
    action: 'WhatsApp Payment Link',
    reason: 'High checkout intent and reliable WhatsApp reachability',
    status: 'Pending',
    result: null,
    channel: 'WhatsApp',
  },
  {
    id: 'ACT-003',
    txnId: 'TXN-2847289',
    action: 'Card Update Request',
    reason: 'Expired card identified as subscription failure cause',
    status: 'Pending Approval',
    result: null,
    channel: 'Email',
  },
]

export const agentLogs = [
  {
    id: 'LOG-001',
    timestamp: new Date().toISOString(),
    stage: 'Detect',
    message: 'Revenue leakage detected for TXN-2847361',
    status: 'completed',
  },
  {
    id: 'LOG-002',
    timestamp: new Date().toISOString(),
    stage: 'Diagnose',
    message: 'Root cause identified as insufficient funds',
    status: 'completed',
  },
]

export const guardrails = [
  {
    id: 'GR-001',
    name: 'Maximum Retry Attempts',
    description: 'Maximum number of automated payment retries',
    limit: 3,
    status: 'Active',
  },
  {
    id: 'GR-002',
    name: 'Automatic Recovery Amount',
    description: 'Automatic recovery is restricted above this amount',
    limit: 25000,
    status: 'Active',
  },
]

export const auditTrail = [
  {
    id: 'AUD-001',
    timestamp: new Date().toISOString(),
    txnId: 'TXN-2847361',
    decision: 'Smart Retry',
    reason: 'High recovery probability',
    policyCheck: 'PASS',
    action: 'Retry scheduled',
    result: 'Pending',
  },
]

export const merchants = [
  {
    id: 'M001',
    name: 'UrbanKart',
    atRisk: 1980000,
    recovered: 1100000,
    recoveryRate: 56,
    activeCases: 11,
  },
  {
    id: 'M002',
    name: 'TechNova',
    atRisk: 1750000,
    recovered: 1250000,
    recoveryRate: 71,
    activeCases: 8,
  },
]

export const analytics = {
  totalAtRisk: 1870000,
  totalRecovered: 1150000,
  recoveryRate: 61.5,
  successfulInterventions: 47,
  unnecessaryActions: 3,
}