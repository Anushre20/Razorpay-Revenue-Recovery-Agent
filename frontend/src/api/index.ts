import { apiGet, apiPost } from './api';

// --- Transaction Types ---
export interface Transaction {
  id: string;
  merchant: string;
  customer: string;
  amount: number;
  type: string;
  timestamp: string;
  paymentMethod: string;
  failureReason: string;
  attemptCount: number;
  customerHistory: {
    previousSuccessfulPayments: number;
    previousFailedPayments: number;
    previousRecoveries: number;
  };
  checkoutDuration: number | null;
  cartValue: number | null;
  subscriptionPlan: string | null;
  daysOverdue: number;
  deviceType: string;
  customerSegment: string;
  riskScore: number;
  recoverability: number;
  groundTruthAction: string;
  groundTruthRecoverable: boolean;
  groundTruthRecoveredAmount: number;
  source?: 'historical' | 'razorpay_test' | 'demo';
}

export interface LeakageTransaction extends Transaction {
  leakageScore: number;
  leakageLevel: string;
  revenueAtRisk: number;
  source?: 'historical' | 'razorpay_test' | 'demo';
}

export interface LeakageSummary {
  totalCases: number;
  totalAtRisk: number;
  criticalCases: number;
  highRiskCases: number;
  mediumRiskCases: number;
  lowRiskCases: number;
}

export interface LeakageResponse {
  success: boolean;
  summary: LeakageSummary;
  count: number;
  data: LeakageTransaction[];
}

export interface TransactionResponse {
  success: boolean;
  count: number;
  data: Transaction[];
}

// --- Diagnosis Types ---
export interface Diagnosis {
  transactionId: string;
  problem: string;
  rootCause: string;
  confidence: number;
  urgency: string;
  recommendedAction: string;
  alternatePayments: string[];
  estimatedRecovery: number;
  riskScore: number;
  recoverability: number;
  failureReason: string;
  attemptCount: number;
  analysis: {
    paymentMethod: string;
    customerSegment: string;
    previousSuccessfulPayments: number;
    previousFailedPayments: number;
    previousRecoveries: number;
  };
  mlPrediction?: MLPrediction;
}

export interface DiagnosisResponse {
  success: boolean;
  txnId: string;
  data: Diagnosis;
}

// --- Recovery Types ---
export interface RecoveryAction {
  id: string;
  txnId: string;
  action: string;
  reason: string;
  status: string;
  result: string | null;
  channel: string;
}

export interface RecoveryDecision {
  transactionId: string;
  action: string;
  initialAction: string;
  reason: string;
  recoverability: number;
  riskScore: number;
  amount: number;
  failureReason: string;
  attemptCount: number;
  customerSegment: string;
  requiresApproval: boolean;
  guardrails: {
    transactionId: string;
    requestedAction: string;
    passed: boolean;
    allowedAction: string;
    requiresApproval: boolean;
    failedGuardrails: Array<{
      passed: boolean;
      guardrail: string;
      reason: string;
    }>;
    checks: Record<string, boolean>;
    policy: Record<string, number>;
  };
  mlPrediction?: MLPrediction;
}

export interface GuardrailCheckResult {
  transactionId: string;
  requestedAction: string;
  passed: boolean;
  allowedAction: string;
  requiresApproval: boolean;
  failedGuardrails: Array<{
    passed: boolean;
    guardrail: string;
    reason: string;
  }>;
  checks: Record<string, boolean>;
  policy: Record<string, number>;
}

export interface AgentLog {
  id: string;
  timestamp: string;
  stage: string;
  message: string;
  status: string;
}

export interface ExecutionResult {
  transactionId: string;
  executed: boolean;
  status: string;
  action: string;
  provider?: string;
  mode?: string;
  amount?: number;
  razorpayPaymentLinkId?: string;
  shortUrl?: string;
  razorpayOrderId?: string;
  orderStatus?: string;
  reason?: string;
  guardrails?: GuardrailCheckResult;
}

export interface SimulationResult {
  transactionId: string;
  action: string;
  finalAction: string;
  status: string;
  succeeded: boolean;
  originalAmount: number;
  recoveredAmount: number;
  recoverability: number;
  riskScore: number;
  failureReason: string;
  timestamp: string;
}

export interface SimulationSummary {
  totalSimulations: number;
  successfulSimulations: number;
  failedSimulations: number;
  blockedSimulations: number;
  totalAmountAtRisk: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
}

// --- Audit Types ---
export interface AuditLog {
  auditId: string;
  timestamp: string;
  transactionId: string;
  eventType: string;
  action: string;
  status: string;
  details: Record<string, unknown>;
}

export interface AuditGuardrail {
  id: string;
  name: string;
  description: string;
  limit: number;
  status: string;
}

// --- Analytics Types ---
export interface AnalyticsSummary {
  totalAtRisk: number;
  totalRecovered: number;
  recoveryRate: number;
  successfulInterventions: number;
  unnecessaryActions: number;
}

export interface DashboardData {
  totalAtRisk: number;
  totalRecovered: number;
  recoveryRate: number;
  failedPayments: number;
  abandonedCheckouts: number;
  subscriptionFailures: number;
  activeCases: number;
}

export interface Merchant {
  id: string;
  name: string;
  atRisk: number;
  recovered: number;
  recoveryRate: number;
  activeCases: number;
}

// --- API Functions ---

// Transactions
export const fetchTransactions = () => apiGet<TransactionResponse>('/api/transactions');
export const fetchTransaction = (id: string) => apiGet<{ success: boolean; data: Transaction }>(`/api/transactions/${id}`);

// Leakage
export const fetchLeakage = (params?: Record<string, string>) => {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiGet<LeakageResponse>(`/api/leakage${query}`);
};

// Diagnosis
export const fetchDiagnosis = (txnId: string) => apiGet<DiagnosisResponse>(`/api/diagnosis/${txnId}`);

// Recovery
export const fetchRecoveryActions = () => apiGet<{ success: boolean; count: number; data: RecoveryAction[] }>('/api/recovery/actions');
export const fetchRecoveryDecision = (txnId: string) => apiGet<{ success: boolean; data: RecoveryDecision }>(`/api/recovery/decision/${txnId}`);
export const fetchGuardrailCheck = (txnId: string, action: string) => apiGet<{ success: boolean; data: GuardrailCheckResult }>(`/api/recovery/guardrails/${txnId}?action=${encodeURIComponent(action)}`);
export const executeRecovery = (txnId: string) => apiPost<{ success: boolean; data: ExecutionResult }>(`/api/recovery/execute/${txnId}`);
export const simulateRecovery = (txnId: string) => apiPost<{ success: boolean; data: SimulationResult }>(`/api/recovery/simulate/${txnId}`);
export const fetchSimulation = (txnId: string) => apiGet<{ success: boolean; data: SimulationResult }>(`/api/recovery/simulation/${txnId}`);
export const fetchSimulations = () => apiGet<{ success: boolean; count: number; data: SimulationResult[] }>('/api/recovery/simulations');
export const fetchSimulationSummary = () => apiGet<{ success: boolean; data: SimulationSummary }>('/api/recovery/simulation-summary');
export const fetchAgentLogs = () => apiGet<{ success: boolean; count: number; data: AgentLog[] }>('/api/recovery/agent-logs');

// Audit
export const fetchAuditTrail = () => apiGet<{ success: boolean; count: number; data: AuditLog[] }>('/api/audit');
export const fetchAuditByTxn = (txnId: string) => apiGet<{ success: boolean; count: number; data: AuditLog[] }>(`/api/audit/${txnId}`);
export const fetchAuditGuardrails = () => apiGet<{ success: boolean; count: number; data: AuditGuardrail[] }>('/api/audit/guardrails');

// Analytics
export const fetchAnalytics = () => apiGet<{ success: boolean; data: AnalyticsSummary }>('/api/analytics');
export const fetchDashboard = () => apiGet<{ success: boolean; data: DashboardData }>('/api/analytics/dashboard');
export const fetchMerchants = () => apiGet<{ success: boolean; count: number; data: Merchant[] }>('/api/analytics/merchants');

// Evaluation
export interface ActionMetric {
  action: string;
  count: number;
  correct: number;
  incorrect: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  totalAmount: number;
  recoveredAmount: number;
  blockedByGuardrails: number;
}

export interface EvaluationData {
  totalTransactions: number;
  totalDecisions: number;
  totalAtRisk: number;
  totalRecovered: number;
  recoveryRate: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  correctDecisions: number;
  correctActionCount: number;
  incorrectActionCount: number;
  actionAccuracy: number;
  blockedByGuardrails: number;
  requiresApprovalCount: number;
  actionMetrics: ActionMetric[];
}

export const fetchEvaluation = () => apiGet<{ success: boolean; data: EvaluationData }>('/api/evaluation');

// --- ML Types ---
export interface MLPrediction {
  mlAvailable: boolean;
  recoverability?: {
    prediction: string;
    probability: number;
  };
  riskScore?: {
    prediction: number;
  };
  action?: {
    prediction: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  reasoning?: string[];
  error?: string;
}

export interface MLModelMetrics {
  loaded: boolean;
  totalTransactions?: number;
  trainSize?: number;
  testSize?: number;
  featureCount?: number;
  features?: string[];
  recoverability?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    featureImportances: Record<string, number>;
  };
  riskScore?: {
    mae: number;
    rmse: number;
    r2Score: number;
    featureImportances: Record<string, number>;
  };
  action?: {
    accuracy: number;
    macroPrecision: number;
    macroRecall: number;
    macroF1: number;
    perClass: Record<string, { precision: number; recall: number; f1Score: number }>;
    featureImportances: Record<string, number>;
  };
}

export const fetchMLMetrics = () => apiGet<{ success: boolean; data: MLModelMetrics }>('/api/evaluation/ml-metrics');

// --- Integration Types ---
export interface IntegrationStatus {
  success: boolean;
  connected: boolean;
  provider: string;
  environment: string;
  merchant?: {
    id: string;
    name: string;
    email: string;
  };
  syncedTransactions: number;
  lastSyncedAt: string | null;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  source: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  totalSynced: number;
  lastSyncedAt: string;
  error?: string;
}

// Integration
export const fetchIntegrationStatus = () => apiGet<IntegrationStatus>('/api/integration/status');
export const syncRazorpayTransactions = () => apiPost<SyncResult>('/api/integration/sync');

// --- Evaluate Transaction ---
export interface EvaluateRequest {
  amount: number;
  paymentMethod: string;
  failureReason: string;
  attempts?: number;
  customerSegment?: string;
  merchant?: string;
  customer?: string;
}

export interface EvaluateResponse {
  success: boolean;
  transaction: Transaction;
  diagnosis: Diagnosis;
  decision: RecoveryDecision;
}

export const evaluateTransaction = (data: EvaluateRequest) =>
  apiPost<EvaluateResponse>('/api/transactions/evaluate', data);

// --- Agent Types ---
export interface AgentStage {
  status: string;
  timestamp?: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface AgentRun {
  agentRunId: string;
  transactionId: string;
  source: string;
  status: string;
  currentStage: string;
  stages: {
    detect: AgentStage;
    diagnose: AgentStage;
    decide: AgentStage;
    policy: AgentStage;
    execute: AgentStage;
    recover: AgentStage;
    audit: AgentStage;
  };
  startedAt: string;
  completedAt: string | null;
  error?: string;
  approvalDecision?: string;
}

export interface AgentStats {
  total: number;
  running: number;
  completed: number;
  blocked: number;
  humanApproval: number;
  executionFailed: number;
  failed: number;
  rejected: number;
}

export const fetchAgentRuns = () => apiGet<{ success: boolean; count: number; data: AgentRun[] }>('/api/agent/runs');
export const fetchAgentRun = (agentRunId: string) => apiGet<{ success: boolean; data: AgentRun }>(`/api/agent/runs/${agentRunId}`);
export const fetchAgentRunForTxn = (txnId: string) => apiGet<{ success: boolean; data: AgentRun }>(`/api/agent/recovery/${txnId}`);
export const triggerAgentRecovery = (txnId: string) => apiPost<{ success: boolean; data: AgentRun; skipped?: boolean; reason?: string }>(`/api/agent/recovery/${txnId}`);
export const approveAgentRun = (agentRunId: string) => apiPost<{ success: boolean; data: AgentRun }>(`/api/agent/runs/${agentRunId}/approve`);
export const rejectAgentRun = (agentRunId: string) => apiPost<{ success: boolean; data: AgentRun }>(`/api/agent/runs/${agentRunId}/reject`);
export const fetchAgentStats = () => apiGet<{ success: boolean; data: AgentStats }>('/api/agent/stats');

export interface MerchantOverview {
  moneyAtRisk: number;
  atRiskCount: number;
  recoveredAmount: number;
  successfulRecoveries: number;
  activeRecoveryCases: number;
  newFailures: number;
  blockedActions: number;
  pendingActions: number;
  recoveryRate: number;
}

export interface FailureReasonInsight {
  reason: string;
  count: number;
  totalAmount: number;
  recoverableAmount: number;
  percentage: number;
}

export interface PaymentMethodInsight {
  method: string;
  count: number;
  failedCount: number;
  totalAmount: number;
  atRiskAmount: number;
  recoverableAmount: number;
  avgRecoverability: number;
}

export interface SegmentInsight {
  segment: string;
  count: number;
  totalAmount: number;
  atRiskAmount: number;
  recoverableAmount: number;
  recoveredAmount: number;
  avgRecoverability: number;
}

export interface RecoveryActionInsight {
  action: string;
  recommended: number;
  executed: number;
  blocked: number;
  unsupported: number;
  pending: number;
  totalAmount: number;
  recoveredAmount: number;
}

export interface RecoveryOpportunity {
  transactionId: string;
  amount: number;
  failureReason: string;
  paymentMethod: string;
  customerSegment: string;
  recoverability: number;
  riskScore: number;
  agentAction: string;
  policyStatus: string;
  agentStage: string;
  nextAction: string;
  source: string;
  timestamp: string;
}

export interface WhyLosingMoney {
  rank: number;
  reason: string;
  totalAmount: number;
  count: number;
  recoverableAmount: number;
  impact: string;
}

export interface MerchantAgentActivity {
  totalRuns: number;
  completed: number;
  running: number;
  blocked: number;
  awaitingApproval: number;
  executionFailed: number;
  failed: number;
  rejected: number;
}

export interface MerchantIntelligence {
  source: string;
  lastUpdated: string | null;
  dataAvailability: {
    liveCount: number;
    historicalCount: number;
    hasLive: boolean;
    hasHistorical: boolean;
  };
  overview: MerchantOverview;
  failureReasons: FailureReasonInsight[];
  paymentMethods: PaymentMethodInsight[];
  customerSegments: SegmentInsight[];
  recoveryActions: RecoveryActionInsight[];
  recoveryOpportunities: RecoveryOpportunity[];
  whyLosingMoney: WhyLosingMoney[];
  agentActivity: MerchantAgentActivity;
}

export const fetchMerchantIntelligence = () => apiGet<{ success: boolean; data: MerchantIntelligence }>('/api/merchant/intelligence');
