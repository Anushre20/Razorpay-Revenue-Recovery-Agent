import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from "recharts";
import {
  type Transaction, type LeakageTransaction, type LeakageSummary,
  type Diagnosis, type RecoveryAction as RecoveryActionType, type AgentLog,
  type AuditLog, type AuditGuardrail, type AnalyticsSummary,
  type DashboardData, type Merchant, type RecoveryDecision, type GuardrailCheckResult, type SimulationResult,
  type EvaluationData, type IntegrationStatus, type SyncResult, type EvaluateResponse,
  type AgentRun, type AgentStats,
  fetchTransactions, fetchTransaction, fetchLeakage, fetchDiagnosis, fetchRecoveryActions,
  fetchRecoveryDecision, fetchGuardrailCheck, simulateRecovery,
  fetchAgentLogs, fetchAuditTrail, fetchAuditGuardrails, fetchAnalytics,
  fetchDashboard, fetchMerchants, executeRecovery, fetchEvaluation,
  fetchIntegrationStatus, syncRazorpayTransactions, evaluateTransaction,
  fetchMLMetrics, fetchAgentRuns, fetchAgentRunForTxn, triggerAgentRecovery,
  fetchAgentStats, approveAgentRun, rejectAgentRun,
  fetchMerchantIntelligence,
  fetchGuardrailConfig, updateGuardrailConfig, fetchGuardrailPreview,
  type GuardrailConfig, type GuardrailRuleConfig,
  fetchAuditByTxn,
  fetchActualRecoveryPerformance, type ActualRecoveryPerformance
} from "./api";


type NavItem = "dashboard" | "leakage" | "diagnosis" | "actions" | "agent" | "guardrails" | "audit" | "analytics" | "merchants" | "integration";

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function filterByDateRange<T extends { timestamp: string }>(items: T[], days: number): T[] {
  if (days === 0) {
    const today = new Date().toDateString();
    return items.filter((t) => new Date(t.timestamp).toDateString() === today);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter((t) => new Date(t.timestamp) >= cutoff);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "At Risk": "bg-red-500/15 text-red-400 border border-red-500/20",
    "In Recovery": "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    "Recovered": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    "Executed": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    "Pending": "bg-amber-500/15 text-amber-400 border border-amber-500/20",
    "Stopped": "bg-red-500/15 text-red-400 border border-red-500/20",
    "Blocked": "bg-red-500/15 text-red-400 border border-red-500/20",
    "Escalated": "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    "Pending Approval": "bg-blue-500/15 text-blue-400 border border-blue-500/20",
    "Active": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    "PASS": "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
    "ESCALATED": "bg-purple-500/15 text-purple-400 border border-purple-500/20",
    "Under Review": "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  };
  return (
    <span className={`status-badge px-2 py-0.5 rounded-md text-[10px] ${styles[status] || "bg-gray-500/15 text-gray-400"}`}>
      {status}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-[11px] text-gray-400">{score}</span>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111827] border border-[#1E2D45] rounded-xl card-glow transition-all duration-200 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, delta, accent = false }: {
  label: string; value: string; sub?: string; delta?: string; accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">{label}</p>
      <p className={`text-2xl font-bold font-display mb-1 ${accent ? "gradient-text" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
      {delta && (
        <p className={`text-xs mt-2 font-medium ${delta.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
          {delta} vs yesterday
        </p>
      )}
    </Card>
  );
}

const navItems: { id: NavItem; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⬛" },
  { id: "leakage", label: "Revenue Leakage", icon: "⚠" },
  { id: "diagnosis", label: "AI Diagnosis", icon: "🔬" },
  { id: "actions", label: "Recovery Actions", icon: "⚡" },
  { id: "agent", label: "Agent Control", icon: "🤖" },
  { id: "guardrails", label: "Guardrails", icon: "🛡" },
  { id: "audit", label: "Audit Trail", icon: "📋" },
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "merchants", label: "Merchant View", icon: "🏪" },
  { id: "integration", label: "Integration", icon: "🔗" },
];

function Sidebar({ active, onNav, searchQuery, onSearchChange, onSearchSubmit, badgeCounts }: {
  active: NavItem; onNav: (n: NavItem) => void;
  searchQuery: string; onSearchChange: (q: string) => void; onSearchSubmit: () => void;
  badgeCounts: { leakage: number; actions: number };
}) {
  return (
    <aside className="w-56 flex-shrink-0 bg-[#090E1A] border-r border-[#1E2D45] flex flex-col h-full">
      <div className="px-5 py-5 border-b border-[#1E2D45]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <span className="text-white font-bold text-xs font-display">R</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm font-display leading-tight">Razorpay</p>
            <p className="text-[10px] text-[#3B82F6] font-mono">Revenue Recovery</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-1">
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit(); }}
            className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#2563EB] transition-colors"
            placeholder="Search transactions..."
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={`nav-item w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center gap-2.5 ${active === item.id ? "active" : "text-gray-400"}`}
          >
            <span className="text-sm w-4 text-center">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
            {item.id === "leakage" && badgeCounts.leakage > 0 && (
              <span className="ml-auto bg-red-500/20 text-red-400 text-[9px] font-mono px-1.5 py-0.5 rounded">{badgeCounts.leakage}</span>
            )}
            {item.id === "actions" && badgeCounts.actions > 0 && (
              <span className="ml-auto bg-amber-500/20 text-amber-400 text-[9px] font-mono px-1.5 py-0.5 rounded">{badgeCounts.actions}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-[#1E2D45]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">Anupama</p>
            <p className="text-[10px] text-gray-500">Risk Ops Lead</p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, sub, dateRange, onDateRangeChange }: { title: string; sub: string; dateRange: string; onDateRangeChange: (v: string) => void }) {
  return (
    <div className="h-14 bg-[#090E1A]/80 backdrop-blur-sm border-b border-[#1E2D45] flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-sm font-semibold font-display text-white">{title}</h1>
        <p className="text-[10px] text-gray-500">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <select value={dateRange} onChange={(e) => onDateRangeChange(e.target.value)} className="bg-[#111827] border border-[#1E2D45] text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2563EB]">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="0">Today</option>
        </select>
        <button className="relative p-2 rounded-lg bg-[#111827] border border-[#1E2D45] text-gray-400 hover:text-white transition-colors">
          <span className="text-sm">🔔</span>
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center font-bold">3</span>
        </button>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
          <span className="text-[10px] text-emerald-400 font-mono font-medium">Agent Active</span>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A2332] border border-[#1E2D45] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-mono">Loading...</span>
      </div>
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <span className="text-red-400 text-lg">!</span>
      </div>
      <p className="text-sm text-gray-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-3 py-1.5 bg-[#2563EB] text-white text-xs rounded-lg hover:bg-blue-600 transition-colors">
          Retry
        </button>
      )}
    </div>
  );
}

function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, retry: load };
}

function DashboardView({ onNavigate, dateRange }: { onNavigate: (n: NavItem) => void; dateRange: string }) {
  const mi = useApiData(fetchMerchantIntelligence);
  const leakage = useApiData(fetchLeakage);
  const agentRunsRes = useApiData(fetchAgentRuns);
  const intelligence = mi.data?.data;
  const allLeakageTxns = (leakage.data?.data || []).filter((t: any) => t.source === 'demo' || t.source === 'razorpay_test');
  const leakageTxns = filterByDateRange(allLeakageTxns, Number(dateRange));
  const agentRuns = agentRunsRes.data?.data || [];

  if (mi.loading || leakage.loading) return <LoadingSpinner />;
  if (mi.error || leakage.error) return <ErrorMessage message={mi.error || leakage.error || ''} onRetry={() => { mi.retry(); leakage.retry(); }} />;

  const overview = intelligence?.overview;
  const failureReasons = intelligence?.failureReasons || [];
  const agentActivity = intelligence?.agentActivity;
  const recoveryOpps = intelligence?.recoveryOpportunities || [];
  const whyLosing = intelligence?.whyLosingMoney || [];
  const sourceLabel = intelligence?.source === 'razorpay_test + demo' ? 'Current Test Activity'
    : intelligence?.source === 'razorpay_test' ? 'Razorpay Test Mode'
    : intelligence?.source === 'demo' ? 'Demo Activity'
    : 'No Recent Activity';
  const lastUpdated = intelligence?.lastUpdated
    ? new Date(intelligence.lastUpdated).toLocaleTimeString()
    : '';

  const typeCounts = { failed: 0, abandoned: 0, subscription: 0 };
  const typeAmounts = { failed: 0, abandoned: 0, subscription: 0 };
  leakageTxns.forEach((t) => {
    if (t.type === 'Failed Payment') { typeCounts.failed++; typeAmounts.failed += t.amount; }
    else if (t.type === 'Abandoned Checkout') { typeCounts.abandoned++; typeAmounts.abandoned += t.amount; }
    else if (t.type === 'Subscription Failure') { typeCounts.subscription++; typeAmounts.subscription += t.amount; }
  });
  const totalLeakage = typeAmounts.failed + typeAmounts.abandoned + typeAmounts.subscription || 1;

  const dailyMap: Record<string, { atRisk: number; recovered: number }> = {};
  leakageTxns.forEach((t) => {
    const day = t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    if (!day) return;
    if (!dailyMap[day]) dailyMap[day] = { atRisk: 0, recovered: 0 };
    dailyMap[day].atRisk += t.amount;
    if (t.groundTruthRecoverable) dailyMap[day].recovered += t.groundTruthRecoveredAmount;
  });
  const recoveryChartData = Object.entries(dailyMap).map(([date, v]) => ({
    date,
    atRisk: v.atRisk,
    recovered: v.recovered,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{sourceLabel}</p>
          {lastUpdated && <p className="text-[10px] text-gray-600">Last updated: {lastUpdated}</p>}
        </div>
      </div>

      {overview ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Current Merchant At Risk" value={fmt(overview.moneyAtRisk)} sub={`${overview.atRiskCount} active cases · Live data`} />
            <StatCard label="Recovered" value={fmt(overview.recoveredAmount)} sub={`${overview.successfulRecoveries} successful recoveries`} accent />
            <StatCard label="Active Recovery Cases" value={String(overview.activeRecoveryCases)} sub="Awaiting action" />
            <StatCard label="New Failures" value={String(overview.newFailures)} sub="Detected in current period" />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Blocked Actions" value={String(overview.blockedActions)} sub="Guardrail blocked" />
            <StatCard label="Pending Actions" value={String(overview.pendingActions)} sub="Running or awaiting approval" />
            <StatCard label="Recovery Rate" value={`${overview.recoveryRate}%`} sub="Recovered / At Risk · Live data" />
            <StatCard label="Data Points" value={String(intelligence?.dataAvailability?.liveCount || 0)} sub="Live/test transactions" />
          </div>
        </>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-400">No recent merchant activity</p>
          <p className="text-xs text-gray-600 mt-1">Create a demo transaction or sync Razorpay to see metrics</p>
        </Card>
      )}

      {agentActivity && agentActivity.totalRuns > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">AI Agent Activity</p>
              <p className="text-xs text-gray-500">Autonomous recovery pipeline</p>
            </div>
            <span onClick={() => onNavigate("agent")} className="text-[10px] text-[#3B82F6] cursor-pointer hover:text-blue-300">View all →</span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
              <p className="text-lg font-bold text-white">{agentActivity.totalRuns}</p>
              <p className="text-[10px] text-gray-500">Total Decisions</p>
            </div>
            <div className="text-center p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
              <p className="text-lg font-bold text-emerald-400">{agentActivity.completed}</p>
              <p className="text-[10px] text-gray-500">Completed</p>
            </div>
            <div className="text-center p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
              <p className="text-lg font-bold text-amber-400">{agentActivity.blocked + agentActivity.awaitingApproval}</p>
              <p className="text-[10px] text-gray-500">Blocked / Awaiting</p>
            </div>
            <div className="text-center p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
              <p className="text-lg font-bold text-[#3B82F6]">{agentActivity.running}</p>
              <p className="text-[10px] text-gray-500">Running</p>
            </div>
            <div className="text-center p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
              <p className="text-lg font-bold text-red-400">{agentActivity.executionFailed + agentActivity.failed}</p>
              <p className="text-[10px] text-gray-500">Failed</p>
            </div>
          </div>
        </Card>
      )}

      {whyLosing.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Why You're Losing Money</p>
              <p className="text-xs text-gray-500">Ranked by financial impact</p>
            </div>
          </div>
          <div className="space-y-3">
            {whyLosing.slice(0, 5).map((item) => (
              <div key={item.reason} className="flex items-center gap-3 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                <span className="text-xs font-bold text-gray-600 w-5">#{item.rank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{item.reason}</p>
                  <p className="text-[10px] text-gray-500">{item.count} transactions</p>
                </div>
                <span className="text-xs font-mono text-white">{fmt(item.totalAmount)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.impact === 'High' ? 'text-red-400 bg-red-500/10' :
                  item.impact === 'Medium' ? 'text-amber-400 bg-amber-500/10' :
                  'text-gray-400 bg-gray-500/10'
                }`}>{item.impact}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {recoveryOpps.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Recovery Opportunities</p>
              <p className="text-xs text-gray-500">Cases waiting for action</p>
            </div>
            <span onClick={() => onNavigate("diagnosis")} className="text-[10px] text-[#3B82F6] cursor-pointer hover:text-blue-300">View all →</span>
          </div>
          <div className="space-y-2">
            {recoveryOpps.slice(0, 5).map((opp) => (
              <div key={opp.transactionId} onClick={() => onNavigate("diagnosis")} className="flex items-center gap-3 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] cursor-pointer table-row-hover">
                <span className="text-[11px] text-[#3B82F6] font-mono flex-shrink-0">{opp.transactionId}</span>
                <span className="text-xs font-mono text-white flex-shrink-0">{fmt(opp.amount)}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{opp.failureReason}</span>
                <span className="text-[10px] text-[#A78BFA] flex-shrink-0">{opp.agentAction}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                  opp.policyStatus === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/10' :
                  opp.policyStatus === 'BLOCKED' ? 'text-amber-400 bg-amber-500/10' :
                  'text-gray-400 bg-gray-500/10'
                }`}>{opp.policyStatus}</span>
                <span className="text-[10px] text-gray-500 ml-auto">{opp.nextAction}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Recovery Performance</p>
              <p className="text-xs text-gray-500">At-risk vs recovered · Live data</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500/40" />
                <span className="text-[10px] text-gray-400">At Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" />
                <span className="text-[10px] text-gray-400">Recovered</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={recoveryChartData}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="recovGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="atRisk" name="At Risk" stroke="#EF4444" strokeWidth={1.5} fill="url(#riskGrad)" dot={false} />
              <Area type="monotone" dataKey="recovered" name="Recovered" stroke="#2563EB" strokeWidth={2} fill="url(#recovGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-1">Leakage by Type</p>
          <p className="text-xs text-gray-500 mb-4">Distribution · Live data</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={[
                { name: "Failed Payments", value: typeAmounts.failed, fill: "#2563EB" },
                { name: "Abandoned Checkouts", value: typeAmounts.abandoned, fill: "#7C3AED" },
                { name: "Subscription Failures", value: typeAmounts.subscription, fill: "#0EA5E9" },
              ]} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {[
                  { fill: "#2563EB" },
                  { fill: "#7C3AED" },
                  { fill: "#0EA5E9" },
                ].map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "#1A2332", border: "1px solid #1E2D45", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {[
              { name: "Failed Payments", value: typeAmounts.failed, fill: "#2563EB" },
              { name: "Abandoned Checkouts", value: typeAmounts.abandoned, fill: "#7C3AED" },
              { name: "Subscription Failures", value: typeAmounts.subscription, fill: "#0EA5E9" },
            ].map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  <span className="text-[10px] text-gray-400">{d.name}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-300">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold font-display text-white">Recent Failures</p>
          <span onClick={() => onNavigate("leakage")} className="text-[10px] text-[#3B82F6] cursor-pointer hover:text-blue-300">View all →</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
              <th className="text-left pb-2">TXN ID</th>
              <th className="text-left pb-2">Merchant</th>
              <th className="text-left pb-2">Amount</th>
              <th className="text-left pb-2">Reason</th>
              <th className="text-left pb-2">Risk</th>
              <th className="text-left pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {leakageTxns.slice(0, 5).map((t) => (
              <tr key={t.id} onClick={() => onNavigate("diagnosis")} className="table-row-hover border-b border-[#1E2D45]/50 cursor-pointer">
                <td className="py-2.5 font-mono text-[11px] text-[#3B82F6]">{t.id}</td>
                <td className="py-2.5 text-xs text-gray-200">{t.merchant}</td>
                <td className="py-2.5 font-mono text-xs text-white">{fmt(t.amount)}</td>
                <td className="py-2.5 text-[11px] text-gray-400">{t.failureReason}</td>
                <td className="py-2.5"><RiskBar score={t.riskScore} /></td>
                <td className="py-2.5"><StatusBadge status={t.leakageLevel || 'Low'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {agentRuns.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold font-display text-white">Recent Agent Activity</p>
            <span onClick={() => onNavigate("agent")} className="text-[10px] text-[#3B82F6] cursor-pointer hover:text-blue-300">View all →</span>
          </div>
          <div className="space-y-2">
            {agentRuns.slice(0, 5).map((run) => {
              const execResult = run.stages?.execute?.result;
              const policyResult = run.stages?.policy?.result;
              return (
                <div key={run.agentRunId} className="flex items-center gap-3 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                  <span className="text-[10px] text-gray-600 font-mono w-16">{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : ''}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    run.status === 'COMPLETED' ? 'bg-emerald-400' :
                    run.status === 'RUNNING' ? 'bg-[#3B82F6] animate-pulse' :
                    run.status === 'BLOCKED' ? 'bg-amber-400' :
                    'bg-red-400'
                  }`} />
                  <span className="text-[11px] text-gray-300 font-mono flex-shrink-0">{run.transactionId}</span>
                  <span className="text-[10px] text-[#A78BFA] flex-shrink-0">{(run.stages?.decide?.result as any)?.aiRecommendation || '-'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                    policyResult?.passed ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                  }`}>
                    {policyResult?.passed ? 'APPROVED' : 'BLOCKED'}
                  </span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{execResult?.status || '-'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ml-auto ${
                    run.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                    run.status === 'RUNNING' ? 'text-[#3B82F6] bg-[#2563EB]/10 border-[#2563EB]/30' :
                    'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  }`}>
                    {run.status.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function LeakageView({ onNavigate, dateRange }: { onNavigate: (n: NavItem) => void; dateRange: string }) {
  const [filter, setFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");
  const categories = ["All", "Failed Payment", "Abandoned Checkout", "Subscription Failure"];
  const sourceOptions = ["all", "historical", "razorpay_test", "demo"];

  const [allTxns, setAllTxns] = useState<LeakageTransaction[]>([]);
  const [summary, setSummary] = useState<LeakageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeakageData = useCallback(async (type?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (type && type !== "All") params.type = type;
      if (sourceFilter !== "all") params.source = sourceFilter;
      const res = await fetchLeakage(Object.keys(params).length > 0 ? params : undefined);
      setAllTxns(res.data || []);
      setSummary(res.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => {
    fetchLeakageData(filter);
  }, [filter, fetchLeakageData]);

  const filtered = filterByDateRange(allTxns, Number(dateRange)).filter((t) => {
    const matchCat = filter === "All" || t.type === filter || (filter === "Subscription" && t.type === "Subscription Failure");
    const matchSearch = t.merchant.toLowerCase().includes(search.toLowerCase()) ||
      t.customer.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const highRisk = allTxns.filter((t) => t.riskScore >= 80);
  const highRiskAmount = highRisk.reduce((sum, t) => sum + t.amount, 0);
  const avgRisk = allTxns.length ? Math.round(allTxns.reduce((sum, t) => sum + t.riskScore, 0) / allTxns.length) : 0;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={() => fetchLeakageData(filter)} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total At Risk" value={fmt(summary?.totalAtRisk || 0)} sub={`${summary?.totalCases || allTxns.length} transactions · ${sourceFilter === 'all' ? 'All Sources' : sourceFilter === 'historical' ? 'Historical' : sourceFilter === 'razorpay_test' ? 'Razorpay Test' : 'Demo'}`} />
        <StatCard label="High Risk (80+)" value={fmt(highRiskAmount)} sub={`${highRisk.length} transactions`} />
        <StatCard label="In Recovery" value={fmt(allTxns.filter(t => t.leakageLevel === 'High' || t.leakageLevel === 'Critical').reduce((s, t) => s + t.amount, 0))} sub={`${allTxns.filter(t => t.leakageLevel === 'High' || t.leakageLevel === 'Critical').length} transactions`} />
        <StatCard label="Avg Risk Score" value={String(avgRisk)} sub="Across all open cases" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === c ? "bg-[#2563EB] text-white" : "bg-[#1A2332] text-gray-400 hover:text-white border border-[#1E2D45]"}`}
              >
                {c}
              </button>
            ))}
            <div className="w-px h-5 bg-[#1E2D45] mx-1" />
            {sourceOptions.map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sourceFilter === s ? "bg-[#7C3AED] text-white" : "bg-[#1A2332] text-gray-400 hover:text-white border border-[#1E2D45]"}`}
              >
                {s === "all" ? "All Sources" : s === "historical" ? "Historical" : s === "razorpay_test" ? "Razorpay Test" : "Demo"}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[#1A2332] border border-[#1E2D45] rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#2563EB] w-52"
            placeholder="Search merchant, customer..."
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                <th className="text-left pb-2.5">TXN ID</th>
                <th className="text-left pb-2.5">Source</th>
                <th className="text-left pb-2.5">Merchant</th>
                <th className="text-left pb-2.5">Customer</th>
                <th className="text-left pb-2.5">Amount</th>
                <th className="text-left pb-2.5">Category</th>
                <th className="text-left pb-2.5">Failure Reason</th>
                <th className="text-left pb-2.5">Risk Score</th>
                <th className="text-left pb-2.5">Status</th>
                <th className="text-left pb-2.5">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => onNavigate("diagnosis")} className="table-row-hover border-b border-[#1E2D45]/40 cursor-pointer group">
                  <td className="py-3 font-mono text-[11px] text-[#3B82F6] group-hover:text-blue-300">{t.id}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                      t.source === 'razorpay_test'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : t.source === 'demo'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}>
                      {t.source === 'razorpay_test' ? 'RAZORPAY TEST' : t.source === 'demo' ? 'DEMO' : 'HISTORICAL'}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-gray-200">{t.merchant}</td>
                  <td className="py-3 text-xs text-gray-400">{t.customer}</td>
                  <td className="py-3 font-mono text-xs text-white font-medium">{fmtFull(t.amount)}</td>
                  <td className="py-3">
                    <span className="status-badge px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {t.type}
                    </span>
                  </td>
                  <td className="py-3 text-[11px] text-gray-400">{t.failureReason}</td>
                  <td className="py-3"><RiskBar score={t.riskScore} /></td>
                  <td className="py-3"><StatusBadge status={t.leakageLevel || 'Low'} /></td>
                  <td className="py-3 text-[10px] text-gray-500 font-mono">{t.timestamp ? new Date(t.timestamp).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-600 mt-3">{filtered.length} transactions · Sorted by risk score</p>
      </Card>
    </div>
  );
}

interface PipelineStage {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "blocked" | "failed";
  result?: unknown;
  error?: string;
}

function RecoveryPipeline({ txnId, recoverable, onComplete }: { txnId: string; recoverable: boolean; onComplete?: () => void }) {
  const [stages, setStages] = useState<PipelineStage[]>([
    { id: "diagnose", label: "Diagnose", status: "pending" },
    { id: "decide", label: "Decide", status: "pending" },
    { id: "policy", label: "Policy Check", status: "pending" },
    { id: "execute", label: "Execute", status: "pending" },
    { id: "recover", label: "Recover", status: "pending" },
  ]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);

  useEffect(() => {
    setStages([
      { id: "diagnose", label: "Diagnose", status: "pending" },
      { id: "decide", label: "Decide", status: "pending" },
      { id: "policy", label: "Policy Check", status: "pending" },
      { id: "execute", label: "Execute", status: "pending" },
      { id: "recover", label: "Recover", status: "pending" },
    ]);
    setRunning(false);
    setDone(false);
    setAgentRun(null);
  }, [txnId]);

  const updateStage = (id: string, patch: Partial<PipelineStage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runPipeline = async () => {
    const currentTxnId = txnId;
    setRunning(true);
    setDone(false);
    setAgentRun(null);
    setStages([
      { id: "diagnose", label: "Diagnose", status: "pending" },
      { id: "decide", label: "Decide", status: "pending" },
      { id: "policy", label: "Policy Check", status: "pending" },
      { id: "execute", label: "Execute", status: "pending" },
      { id: "recover", label: "Recover", status: "pending" },
    ]);

    try {
      const result = await triggerAgentRecovery(currentTxnId);
      const run = result.data;
      setAgentRun(run);

      const stageMap: Record<string, string> = {
        detect: 'diagnose',
        diagnose: 'diagnose',
        decide: 'decide',
        policy: 'policy',
        execute: 'execute',
        recover: 'recover',
        audit: 'recover',
      };

      if (run.stages?.diagnose?.status === 'COMPLETED') updateStage('diagnose', { status: 'completed', result: run.stages.diagnose.result });
      if (run.stages?.decide?.status === 'COMPLETED') updateStage('decide', { status: 'completed', result: run.stages.decide.result });
      if (run.stages?.policy?.status === 'COMPLETED') updateStage('policy', { status: 'completed', result: run.stages.policy.result });
      else if (run.stages?.policy?.status === 'BLOCKED') updateStage('policy', { status: 'blocked', result: run.stages.policy.result, error: 'Blocked by guardrails' });
      else if (run.stages?.policy?.status === 'APPROVAL_REQUIRED') updateStage('policy', { status: 'blocked', result: run.stages.policy.result, error: 'Requires approval' });
      if (run.stages?.execute?.status === 'COMPLETED') updateStage('execute', { status: 'completed', result: run.stages.execute.result });
      else if (run.stages?.execute?.status === 'FAILED') updateStage('execute', { status: 'failed', result: run.stages.execute.result, error: 'Execution failed' });
      if (run.stages?.recover?.status === 'COMPLETED') updateStage('recover', { status: 'completed', result: run.stages.recover.result });

      setDone(true);
      onComplete?.();
    } catch (err) {
      const activeStage = stages.find((s) => s.status === "running");
      if (activeStage) {
        updateStage(activeStage.id, { status: "failed", error: err instanceof Error ? err.message : "Unknown error" });
      }
    } finally {
      setRunning(false);
    }
  };

  const stageIcon = (s: PipelineStage) => {
    if (s.status === "completed") return <span className="text-emerald-400">&#10003;</span>;
    if (s.status === "blocked") return <span className="text-amber-400">&#9888;</span>;
    if (s.status === "failed") return <span className="text-red-400">&#10007;</span>;
    if (s.status === "running") return <span className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin inline-block" />;
    return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
  };

  const stageColor = (s: PipelineStage) => {
    if (s.status === "completed") return "border-emerald-500/40 bg-emerald-500/10";
    if (s.status === "blocked") return "border-amber-500/40 bg-amber-500/10";
    if (s.status === "failed") return "border-red-500/40 bg-red-500/10";
    if (s.status === "running") return "border-[#3B82F6]/40 bg-[#2563EB]/10";
    return "border-[#1E2D45] bg-[#1A2332]";
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold font-display text-white">Live Recovery Pipeline</p>
          <p className="text-[10px] text-gray-500 font-mono">{txnId}</p>
        </div>
        {!recoverable ? (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <span className="text-emerald-400">&#10003;</span>
            <span className="text-[10px] text-emerald-400 font-mono font-medium">Already Recovered</span>
          </div>
        ) : (
          <button
            onClick={runPipeline}
            disabled={running}
            className="px-4 py-1.5 bg-[#2563EB] text-white text-[11px] font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {running && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {running ? "Running..." : done ? "Run Again" : "Run Recovery"}
          </button>
        )}
      </div>

      {recoverable ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            {stages.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <div className={`flex-1 border rounded-lg px-3 py-2.5 text-center transition-all ${stageColor(s)}`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {stageIcon(s)}
                    <span className={`text-[11px] font-semibold font-display ${s.status === "completed" ? "text-emerald-400" : s.status === "blocked" ? "text-amber-400" : s.status === "failed" ? "text-red-400" : s.status === "running" ? "text-[#3B82F6]" : "text-gray-500"}`}>
                      {s.label}
                    </span>
                  </div>
                  {s.error && <p className="text-[9px] text-amber-400 mt-1 truncate" title={s.error}>{s.error.slice(0, 40)}...</p>}
                </div>
                {i < stages.length - 1 && (
                  <div className="w-3 flex-shrink-0 flex items-center justify-center">
                    <div className={`w-full h-px ${i < stages.findIndex((x) => x.status === "pending") ? "bg-emerald-500/50" : "bg-[#1E2D45]"}`} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {stages.some((s) => s.result) && (
            <div className="space-y-2">
              {stages.filter((s) => s.result).map((s) => (
                <details key={s.id} className="group">
                  <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    {s.label} result
                    <span className={`text-[9px] font-mono ${s.status === "completed" ? "text-emerald-400" : s.status === "blocked" ? "text-amber-400" : "text-red-400"}`}>
                      {s.status}
                    </span>
                  </summary>
                  <pre className="mt-2 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] text-[10px] text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
                    {JSON.stringify(s.result, null, 2)}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
          <p className="text-xs text-emerald-400 font-mono">This transaction has already been recovered. No further recovery action is required.</p>
        </div>
      )}
    </Card>
  );
}

function DiagnosisView({ searchQuery }: { searchQuery: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: txnData, loading: txnLoading, error: txnError, retry: txnRetry } = useApiData(fetchTransactions);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [searchResult, setSearchResult] = useState<Transaction | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const allTxns = txnData?.data || [];
  const displayTxns = allTxns.slice(0, 20);

  useEffect(() => {
    if (searchQuery && allTxns.length > 0) {
      const match = allTxns.find((t) =>
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customer.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (match) setSelected(match.id);
    }
  }, [searchQuery, allTxns]);

  useEffect(() => {
    if (!selected) { setDiag(null); return; }
    let cancelled = false;
    setDiagLoading(true);
    setDiagError(null);
    fetchDiagnosis(selected)
      .then((res) => { if (!cancelled) { setDiag(res.data); setDiagLoading(false); } })
      .catch((err) => { if (!cancelled) { setDiagError(err.message); setDiagLoading(false); } });
    return () => { cancelled = true; };
  }, [selected]);

  const txn = selected ? allTxns.find((t) => t.id === selected) || searchResult : null;

  const handleSearch = async () => {
    if (!localSearch.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const res = await fetchTransaction(localSearch.trim());
      if (res.success && res.data) {
        setSearchResult(res.data);
        setSelected(res.data.id);
        setSearchError(null);
      } else {
        setSearchError('Transaction not found');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Transaction not found');
    } finally {
      setSearching(false);
    }
  };

  if (txnLoading) return <LoadingSpinner />;
  if (txnError) return <ErrorMessage message={txnError} onRetry={txnRetry} />;

  return (
    <div className="grid grid-cols-5 gap-4 h-full animate-fade-in">
      <div className="col-span-2 space-y-2">
        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Search Transaction</p>
          <div className="flex gap-2 mb-3">
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              className="flex-1 bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#2563EB]"
              placeholder="Enter Transaction ID (e.g. TXN-2847037, DEMO-123)"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !localSearch.trim()}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-[#2563EB] text-white hover:bg-blue-600 disabled:bg-[#1A2332] disabled:text-gray-600 disabled:cursor-not-allowed transition-all"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>
          {searchError && (
            <p className="text-[11px] text-red-400 mb-2">{searchError}</p>
          )}
          {searchResult && (
            <div className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg mb-3">
              <p className="text-[10px] text-emerald-400">Found: {searchResult.id}</p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Transactions</p>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {displayTxns.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${selected === t.id ? "bg-[#2563EB]/10 border-[#2563EB]/40" : "bg-[#1A2332] border-[#1E2D45] hover:border-[#2563EB]/30"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] text-[#3B82F6]">{t.id}</span>
                  <StatusBadge status={t.groundTruthRecoverable ? 'At Risk' : 'Recovered'} />
                </div>
                <p className="text-xs text-gray-200 font-medium">{t.merchant}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-500">{t.customer}</span>
                  <span className="font-mono text-[11px] text-white">{fmtFull(t.amount)}</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">{t.failureReason}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="col-span-3 space-y-4">
        {diagLoading ? (
          <Card className="p-8"><LoadingSpinner /></Card>
        ) : diagError ? (
          <Card className="p-8"><ErrorMessage message={diagError} /></Card>
        ) : diag && txn ? (
          <>
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
                  <span className="text-sm">🔬</span>
                </div>
                <div>
                  <p className="text-sm font-semibold font-display text-white">AI Diagnosis</p>
                  <p className="text-[10px] text-gray-500 font-mono">{txn.id} · {txn.merchant}</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-mono">{diag.confidence}% confidence</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-red-500/8 border border-red-500/20 rounded-lg">
                  <p className="text-[10px] text-red-400 font-mono uppercase tracking-wider mb-1.5">Problem Identified</p>
                  <p className="text-sm text-white">{diag.problem}</p>
                </div>

                <div className="p-3.5 bg-[#1A2332] border border-[#1E2D45] rounded-lg">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">Root Cause Analysis</p>
                  <p className="text-sm text-gray-200">{diag.rootCause}</p>
                </div>

                <div className="p-3.5 bg-[#1A2332] border border-[#1E2D45] rounded-lg">
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-1.5">Agent Reasoning</p>
                  <p className="text-xs text-gray-400 font-mono leading-relaxed">Payment method: {diag.analysis.paymentMethod} · Segment: {diag.analysis.customerSegment} · Prior successes: {diag.analysis.previousSuccessfulPayments} · Prior failures: {diag.analysis.previousFailedPayments}</p>
                </div>

                <div className="p-3.5 bg-[#2563EB]/10 border border-[#2563EB]/30 rounded-lg">
                  <p className="text-[10px] text-[#60A5FA] font-mono uppercase tracking-wider mb-1.5">Recommended Action</p>
                  <p className="text-sm text-white">{diag.recommendedAction}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-mono">Alternate Payments</p>
                <div className="space-y-2">
                  {diag.alternatePayments.map((p: string) => (
                    <div key={p} className="flex items-center justify-between p-2 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
                      <span className="text-xs text-gray-200">{p}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Available</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-mono">Recovery Estimate</p>
                <p className="text-2xl font-bold font-display text-white mb-1">{fmtFull(diag.estimatedRecovery)}</p>
                <p className="text-[10px] text-gray-500 mb-3">Expected recovery amount</p>
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-[10px] text-emerald-400 font-mono">Urgency: {diag.urgency}</p>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Confidence</span>
                    <span className="font-mono">{diag.confidence}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1E2D45] rounded-full">
                    <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${diag.confidence}%` }} />
                  </div>
                </div>
              </Card>
            </div>

            {selected && <RecoveryPipeline txnId={selected} recoverable={txn?.groundTruthRecoverable ?? true} />}
          </>
        ) : (
          <Card className="p-8 flex items-center justify-center">
            <p className="text-gray-500 text-sm">Select a transaction to view AI diagnosis</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ActionsView() {
  const { data, loading, error, retry } = useApiData(fetchRecoveryActions);
  const actions = data?.data || [];
  const [statusFilter, setStatusFilter] = useState("All");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const filtered = statusFilter === "All" ? actions : actions.filter((a) => {
    if (statusFilter === "Executed") return a.status === "Executed";
    if (statusFilter === "Pending") return a.status === "Pending" || a.status === "Pending Approval";
    if (statusFilter === "Stopped") return a.status === "Stopped" || a.status === "Blocked";
    return true;
  });

  const executed = actions.filter(a => a.status === 'Executed').length;
  const pending = actions.filter(a => a.status === 'Pending' || a.status === 'Pending Approval').length;
  const stopped = actions.filter(a => a.status === 'Stopped' || a.status === 'Blocked').length;

  const handleExecute = async (txnId: string, actionId: string) => {
    setExecutingId(actionId);
    setExecError(null);
    try {
      await executeRecovery(txnId);
      retry();
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Actions" value={String(actions.length)} sub="Today" />
        <StatCard label="Executed" value={String(executed)} sub="Successfully dispatched" accent />
        <StatCard label="Pending" value={String(pending)} sub="Awaiting response" />
        <StatCard label="Stopped" value={String(stopped)} sub="Blocked or escalated" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold font-display text-white">Recovery Actions</p>
          <div className="flex gap-2">
            {["All", "Executed", "Pending", "Stopped"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${statusFilter === s ? "bg-[#2563EB] text-white" : "bg-[#1A2332] text-gray-400 border border-[#1E2D45] hover:text-white"}`}>{s}</button>
            ))}
          </div>
        </div>

        {execError && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">{execError}</div>
        )}

        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="p-4 bg-[#1A2332] rounded-xl border border-[#1E2D45] hover:border-[#2563EB]/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] text-[#3B82F6]">{a.id}</span>
                    <span className="text-[10px] text-gray-500">·</span>
                    <span className="font-mono text-[10px] text-gray-500">{a.txnId}</span>
                    <span className={`status-badge px-1.5 py-0.5 rounded text-[9px] ${a.channel === "Auto" ? "bg-blue-500/10 text-blue-400" : a.channel === "WhatsApp" ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-500/10 text-gray-400"} border border-current/20`}>
                      {a.channel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-white">{a.action}</p>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{a.reason}</p>
                </div>
                <div className="text-right ml-4 flex flex-col items-end gap-2">
                  <p className={`text-[11px] mt-1 font-medium ${a.result?.includes("RECOVERED") ? "text-emerald-400" : a.status === "Stopped" ? "text-red-400" : "text-gray-400"}`}>{a.result || 'Awaiting response'}</p>
                  {(a.status === "Pending" || a.status === "Pending Approval") && (
                    <button
                      onClick={() => handleExecute(a.txnId, a.id)}
                      disabled={executingId === a.id}
                      className="px-3 py-1 bg-[#2563EB] text-white text-[10px] rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {executingId === a.id && <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />}
                      Execute
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AgentView() {
  const { data: runsData, loading: runsLoading, error: runsError, retry: runsRetry } = useApiData(fetchAgentRuns);
  const { data: statsData } = useApiData(fetchAgentStats);
  const runs = runsData?.data || [];
  const stats = statsData?.data;

  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);

  const stageConfig = [
    { key: 'detect', label: 'Detect', icon: '🔍' },
    { key: 'diagnose', label: 'Diagnose', icon: '🧠' },
    { key: 'decide', label: 'Decide', icon: '⚡' },
    { key: 'policy', label: 'Policy', icon: '🛡️' },
    { key: 'execute', label: 'Execute', icon: '🚀' },
    { key: 'recover', label: 'Recover', icon: '💰' },
    { key: 'audit', label: 'Audit', icon: '📋' },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'RUNNING': return 'text-[#3B82F6] bg-[#2563EB]/10 border-[#2563EB]/30';
      case 'BLOCKED': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'HUMAN_APPROVAL_REQUIRED': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'EXECUTION_FAILED': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'FAILED': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'REJECTED': return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const stageStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <span className="text-emerald-400">&#10003;</span>;
      case 'RUNNING': return <span className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin inline-block" />;
      case 'BLOCKED': case 'APPROVAL_REQUIRED': return <span className="text-amber-400">&#9888;</span>;
      case 'FAILED': return <span className="text-red-400">&#10007;</span>;
      case 'NOT_SUPPORTED': case 'SKIPPED': return <span className="text-gray-500">-</span>;
      case 'PENDING': return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
      default: return <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />;
    }
  };

  if (runsLoading) return <LoadingSpinner />;
  if (runsError) return <ErrorMessage message={runsError} onRetry={runsRetry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold font-display text-white">Autonomous Recovery Agent</p>
            <p className="text-xs text-gray-500">Detect → Diagnose → Decide → Policy → Execute → Recover → Audit</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
            <span className="text-xs text-emerald-400 font-mono font-medium">Active</span>
          </div>
        </div>
        <div className="flex items-start gap-0">
          {stageConfig.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-full border rounded-xl px-3 py-3 text-center bg-[#1A2332] border-[#1E2D45]">
                  <p className="text-lg mb-0.5">{step.icon}</p>
                  <p className="text-[11px] font-bold font-display text-gray-300">{step.label}</p>
                </div>
              </div>
              {i < stageConfig.length - 1 && (
                <div className="w-3 flex-shrink-0 flex items-center justify-center">
                  <div className="w-full h-px bg-[#1E2D45]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Runs" value={String(stats.total)} sub="All agent runs" />
          <StatCard label="Completed" value={String(stats.completed)} sub="Successfully finished" accent />
          <StatCard label="Awaiting Approval" value={String(stats.humanApproval)} sub="Needs human review" />
          <StatCard label="Failed / Blocked" value={String(stats.failed + stats.blocked + stats.executionFailed)} sub="Requires attention" />
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold font-display text-white">Recent Agent Runs</p>
            <p className="text-xs text-gray-500">{runs.length} runs recorded</p>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No agent runs yet.</p>
            <p className="text-xs text-gray-600 mt-1">Submit a new transaction to trigger autonomous recovery.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                  <th className="text-left pb-2.5">Run ID</th>
                  <th className="text-left pb-2.5">Transaction</th>
                  <th className="text-left pb-2.5">Source</th>
                  <th className="text-left pb-2.5">Stage</th>
                  <th className="text-left pb-2.5">AI Action</th>
                  <th className="text-left pb-2.5">Policy</th>
                  <th className="text-left pb-2.5">Execution</th>
                  <th className="text-left pb-2.5">Status</th>
                  <th className="text-left pb-2.5">Time</th>
                  <th className="text-left pb-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const policyResult = run.stages?.policy?.result;
                  const execResult = run.stages?.execute?.result;
                  const decideResult = run.stages?.decide?.result;
                  return (
                    <tr key={run.agentRunId} className="table-row-hover border-b border-[#1E2D45]/40 cursor-pointer" onClick={() => setSelectedRun(selectedRun?.agentRunId === run.agentRunId ? null : run)}>
                      <td className="py-3 text-[11px] font-mono text-gray-400">{run.agentRunId.slice(0, 20)}...</td>
                      <td className="py-3 text-[11px] font-mono text-gray-300">{run.transactionId}</td>
                      <td className="py-3 text-[10px] text-gray-400">{run.source}</td>
                      <td className="py-3 text-[10px] text-gray-400">{run.currentStage}</td>
                      <td className="py-3 text-[10px] text-[#A78BFA]">{(decideResult as any)?.aiRecommendation || '-'}</td>
                      <td className="py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${policyResult?.passed === true ? 'text-emerald-400 bg-emerald-500/10' : policyResult?.passed === false ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500'}`}>
                          {policyResult?.passed === true ? 'APPROVED' : policyResult?.passed === false ? 'BLOCKED' : '-'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${execResult?.executed ? 'text-emerald-400 bg-emerald-500/10' : execResult?.status === 'NOT_SUPPORTED' ? 'text-gray-500 bg-gray-500/10' : execResult?.status ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500'}`}>
                          {execResult?.status || '-'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${statusColor(run.status)}`}>
                          {run.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-[10px] text-gray-500">{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : ''}</td>
                      <td className="py-3 text-[10px] text-gray-500">{selectedRun?.agentRunId === run.agentRunId ? '▲' : '▼'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedRun && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Pipeline Detail</p>
              <p className="text-[10px] text-gray-500 font-mono">{selectedRun.agentRunId} — {selectedRun.transactionId}</p>
            </div>
            {selectedRun.status === 'HUMAN_APPROVAL_REQUIRED' && (
              <div className="flex gap-2">
                <button
                  onClick={async () => { await approveAgentRun(selectedRun.agentRunId); runsRetry?.(); }}
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30"
                >
                  Approve
                </button>
                <button
                  onClick={async () => { await rejectAgentRun(selectedRun.agentRunId); runsRetry?.(); }}
                  className="px-3 py-1.5 bg-red-500/20 text-red-400 text-[11px] font-medium rounded-lg border border-red-500/30 hover:bg-red-500/30"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mb-4">
            {stageConfig.map((step, i) => {
              const stage = selectedRun.stages?.[step.key as keyof typeof selectedRun.stages];
              const stageStatus = stage?.status || 'PENDING';
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className={`flex-1 border rounded-lg px-2 py-2 text-center ${
                    stageStatus === 'COMPLETED' ? 'border-emerald-500/40 bg-emerald-500/10' :
                    stageStatus === 'RUNNING' ? 'border-[#3B82F6]/40 bg-[#2563EB]/10' :
                    stageStatus === 'BLOCKED' || stageStatus === 'APPROVAL_REQUIRED' ? 'border-amber-500/40 bg-amber-500/10' :
                    stageStatus === 'FAILED' ? 'border-red-500/40 bg-red-500/10' :
                    'border-[#1E2D45] bg-[#1A2332]'
                  }`}>
                    <div className="flex items-center justify-center gap-1">
                      {stageStatusIcon(stageStatus)}
                      <span className={`text-[10px] font-semibold ${stageStatus === 'COMPLETED' ? 'text-emerald-400' : stageStatus === 'RUNNING' ? 'text-[#3B82F6]' : stageStatus === 'BLOCKED' || stageStatus === 'APPROVAL_REQUIRED' ? 'text-amber-400' : stageStatus === 'FAILED' ? 'text-red-400' : 'text-gray-500'}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                  {i < stageConfig.length - 1 && (
                    <div className="w-2 flex-shrink-0 flex items-center justify-center">
                      <div className="w-full h-px bg-[#1E2D45]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {stageConfig.map(step => {
              const stage = selectedRun.stages?.[step.key as keyof typeof selectedRun.stages];
              if (!stage || (!stage.result && !stage.error)) return null;
              const result = stage.result as any;
              const isBlocked = stage.status === 'BLOCKED' || stage.status === 'APPROVAL_REQUIRED';
              const isCompleted = stage.status === 'COMPLETED';

              return (
                <details key={step.key} className="group">
                  <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    {step.icon} {step.label}
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                      isCompleted ? 'text-emerald-400 bg-emerald-500/10' :
                      isBlocked ? 'text-amber-400 bg-amber-500/10' :
                      stage.status === 'FAILED' ? 'text-red-400 bg-red-500/10' :
                      stage.status === 'RUNNING' ? 'text-[#3B82F6] bg-[#2563EB]/10' :
                      'text-gray-500'
                    }`}>
                      {stage.status}
                    </span>
                    {step.key === 'policy' && result?.policyStatus && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        result.policyStatus === 'PASSED' ? 'text-emerald-400 bg-emerald-500/10' :
                        result.policyStatus === 'BLOCKED' ? 'text-red-400 bg-red-500/10' :
                        'text-amber-400 bg-amber-500/10'
                      }`}>
                        {result.policyStatus === 'PASSED' ? 'POLICY PASSED' :
                         result.policyStatus === 'BLOCKED' ? 'AI STOPPED' :
                         'AI PAUSED'}
                      </span>
                    )}
                  </summary>

                  {stage.error && <p className="text-[10px] text-red-400 mt-1 ml-4">{stage.error}</p>}

                  {step.key === 'detect' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">Transaction Detected</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-[9px] text-gray-600">Amount: </span><span className="text-[10px] text-white font-mono">₹{result.amount}</span></div>
                        <div><span className="text-[9px] text-gray-600">Source: </span><span className="text-[10px] text-gray-300">{result.source}</span></div>
                        <div><span className="text-[9px] text-gray-600">Type: </span><span className="text-[10px] text-gray-300">{result.type}</span></div>
                        <div><span className="text-[9px] text-gray-600">Failure: </span><span className="text-[10px] text-gray-300">{result.failureReason}</span></div>
                      </div>
                    </div>
                  )}

                  {step.key === 'diagnose' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">Diagnosis</p>
                      <div><span className="text-[9px] text-gray-600">Problem: </span><span className="text-[10px] text-gray-300">{result.problem}</span></div>
                      <div><span className="text-[9px] text-gray-600">Root Cause: </span><span className="text-[10px] text-gray-300">{result.rootCause}</span></div>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div><span className="text-[9px] text-gray-600">Recoverability: </span><span className="text-[10px] text-white font-mono">{result.recoverability}%</span></div>
                        <div><span className="text-[9px] text-gray-600">Risk Score: </span><span className="text-[10px] text-white font-mono">{result.riskScore}</span></div>
                        <div><span className="text-[9px] text-gray-600">Confidence: </span><span className="text-[10px] text-white font-mono">{result.confidence}%</span></div>
                      </div>
                      {result.mlPrediction?.mlAvailable && (
                        <div className="mt-1"><span className="text-[9px] text-[#A78BFA]">ML Prediction: </span><span className="text-[10px] text-[#A78BFA]">{result.mlPrediction.action?.prediction} ({(result.mlPrediction.action?.confidence * 100).toFixed(0)}%)</span></div>
                      )}
                    </div>
                  )}

                  {step.key === 'decide' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">AI Decision</p>
                      <div><span className="text-[9px] text-gray-600">Recommendation: </span><span className="text-[10px] text-[#A78BFA] font-medium">{result.aiRecommendation}</span></div>
                      <div><span className="text-[9px] text-gray-600">Why: </span><span className="text-[10px] text-gray-300">{result.reason}</span></div>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div><span className="text-[9px] text-gray-600">Confidence: </span><span className="text-[10px] text-white font-mono">{result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : 'N/A'}</span></div>
                        <div><span className="text-[9px] text-gray-600">Recoverability: </span><span className="text-[10px] text-white font-mono">{result.recoverability}%</span></div>
                        <div><span className="text-[9px] text-gray-600">Risk: </span><span className="text-[10px] text-white font-mono">{result.riskScore}</span></div>
                      </div>
                    </div>
                  )}

                  {step.key === 'policy' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                          result.policyStatus === 'PASSED' ? 'text-emerald-400 bg-emerald-500/10' :
                          result.policyStatus === 'BLOCKED' ? 'text-red-400 bg-red-500/10' :
                          'text-amber-400 bg-amber-500/10'
                        }`}>
                          {result.policyStatus === 'PASSED' ? 'POLICY PASSED — EXECUTION ALLOWED' :
                           result.policyStatus === 'BLOCKED' ? 'AI STOPPED — POLICY BLOCKED' :
                           'AI PAUSED — HUMAN APPROVAL REQUIRED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-[9px] text-gray-600">Requested: </span><span className="text-[10px] text-gray-300">{result.requestedAction}</span></div>
                        <div><span className="text-[9px] text-gray-600">Allowed: </span><span className="text-[10px] text-white font-medium">{result.finalAction || result.allowedAction}</span></div>
                        <div><span className="text-[9px] text-gray-600">Approval Required: </span><span className={`text-[10px] ${result.requiresApproval ? 'text-amber-400' : 'text-emerald-400'}`}>{result.requiresApproval ? 'Yes' : 'No'}</span></div>
                      </div>
                      {result.explanation && (
                        <div className="mt-1 p-2 bg-[#1A2332] rounded border border-[#1E2D45]">
                          <span className="text-[9px] text-gray-600">Explanation: </span>
                          <span className="text-[10px] text-gray-300">{result.explanation}</span>
                        </div>
                      )}
                      {result.rulesTriggered && result.rulesTriggered.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[9px] text-gray-600">Rules Triggered:</span>
                          {result.rulesTriggered.map((r: any, i: number) => (
                            <div key={i} className="ml-2 mt-1 p-2 bg-red-500/5 rounded border border-red-500/10">
                              <span className="text-[10px] text-red-400 font-medium">{r.rule}: </span>
                              <span className="text-[10px] text-gray-400">{r.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {step.key === 'execute' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">Execution</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-[9px] text-gray-600">Action: </span><span className="text-[10px] text-white">{result.action}</span></div>
                        <div><span className="text-[9px] text-gray-600">Status: </span><span className={`text-[10px] font-medium ${result.executed ? 'text-emerald-400' : result.status === 'NOT_SUPPORTED' ? 'text-gray-400' : 'text-amber-400'}`}>{result.status}</span></div>
                        {result.provider && <div><span className="text-[9px] text-gray-600">Provider: </span><span className="text-[10px] text-gray-300">{result.provider} ({result.mode})</span></div>}
                        {result.razorpayPaymentLinkId && <div><span className="text-[9px] text-gray-600">Payment Link ID: </span><span className="text-[10px] text-[#3B82F6] font-mono">{result.razorpayPaymentLinkId}</span></div>}
                        {result.shortUrl && <div className="col-span-2"><span className="text-[9px] text-gray-600">URL: </span><span className="text-[10px] text-[#3B82F6] break-all">{result.shortUrl}</span></div>}
                        {result.razorpayOrderId && <div><span className="text-[9px] text-gray-600">Order ID: </span><span className="text-[10px] text-[#3B82F6] font-mono">{result.razorpayOrderId}</span></div>}
                        {result.orderStatus && <div><span className="text-[9px] text-gray-600">Order Status: </span><span className="text-[10px] text-gray-300">{result.orderStatus}</span></div>}
                        {result.reason && <div className="col-span-2"><span className="text-[9px] text-gray-600">Reason: </span><span className="text-[10px] text-gray-400">{result.reason}</span></div>}
                      </div>
                    </div>
                  )}

                  {step.key === 'recover' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">Recovery Result</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-[9px] text-gray-600">Status: </span><span className={`text-[10px] font-medium ${
                          result.status === 'PENDING' ? 'text-amber-400' :
                          result.status === 'NOT_STARTED' ? 'text-gray-400' :
                          'text-gray-300'
                        }`}>{result.status}</span></div>
                        <div><span className="text-[9px] text-gray-600">Action: </span><span className="text-[10px] text-gray-300">{result.action}</span></div>
                      </div>
                      <div className="mt-1 p-2 bg-[#1A2332] rounded border border-[#1E2D45]">
                        <span className="text-[10px] text-gray-400">{result.message}</span>
                      </div>
                    </div>
                  )}

                  {step.key === 'audit' && result && (
                    <div className="mt-2 ml-4 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] space-y-1">
                      <p className="text-[10px] text-gray-500">Audit Summary</p>
                      {result.explanation && (
                        <div className="p-2 bg-[#1A2332] rounded border border-[#1E2D45]">
                          <span className="text-[10px] text-gray-300">{result.explanation}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div><span className="text-[9px] text-gray-600">Policy: </span><span className={`text-[10px] font-medium ${result.policyStatus === 'PASSED' ? 'text-emerald-400' : 'text-amber-400'}`}>{result.policyStatus || result.policyResult}</span></div>
                        <div><span className="text-[9px] text-gray-600">Execution: </span><span className="text-[10px] text-gray-300">{result.executionStatus}</span></div>
                        <div><span className="text-[9px] text-gray-600">Recovery: </span><span className="text-[10px] text-gray-300">{result.recoveryStatus}</span></div>
                      </div>
                      {result.rulesTriggered && result.rulesTriggered.length > 0 && (
                        <div className="mt-1">
                          <span className="text-[9px] text-gray-600">Rules Triggered: </span>
                          <span className="text-[10px] text-amber-400">{result.rulesTriggered.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!stage.result && !stage.error && (
                    <p className="mt-1 ml-4 text-[10px] text-gray-600">No data for this stage</p>
                  )}
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function GuardrailsView({ onNavigate }: { onNavigate: (n: NavItem) => void }) {
  const { data: guardrailsData, loading: gLoading, error: gError, retry: gRetry } = useApiData(fetchAuditGuardrails);
  const { data: configData, loading: cLoading, error: cError, retry: cRetry } = useApiData(fetchGuardrailConfig);
  const { data: auditData } = useApiData(fetchAuditTrail);

  const guardrailRules = guardrailsData?.data || [];
  const auditLogs = auditData?.data || [];
  const blockedLogs = auditLogs.filter(l => l.eventType === 'POLICY_CHECK' && (l.status === 'BLOCKED' || l.status === 'APPROVAL_REQUIRED'));
  const config = configData?.data;

  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedBlocked, setExpandedBlocked] = useState<string | null>(null);
  const [blockedDetails, setBlockedDetails] = useState<Record<string, any>>({});

  const startEdit = (ruleKey: string, currentValue: number) => {
    setEditingRule(ruleKey);
    setEditValue(String(currentValue));
    setSaveSuccess(null);
    setSaveError(null);
    setPreviewCount(null);
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setEditValue('');
    setPreviewCount(null);
  };

  const handleValueChange = async (ruleKey: string, value: string) => {
    setEditValue(value);
    const numVal = Number(value);
    if (!isNaN(numVal) && numVal >= 0) {
      setPreviewLoading(true);
      try {
        const res = await fetchGuardrailPreview(ruleKey, numVal);
        setPreviewCount(res.data.affectedTransactions);
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setPreviewCount(null);
    }
  };

  const saveRule = async (ruleKey: string) => {
    const numVal = Number(editValue);
    if (isNaN(numVal) || numVal < 0) {
      setSaveError('Value must be a non-negative number');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateGuardrailConfig({ [ruleKey]: { value: numVal } });
      setSaveSuccess(ruleKey);
      setEditingRule(null);
      gRetry();
      cRetry();
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (ruleKey: string, currentEnabled: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateGuardrailConfig({ [ruleKey]: { enabled: !currentEnabled } });
      setSaveSuccess(ruleKey);
      gRetry();
      cRetry();
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setSaving(false);
    }
  };

  const loadBlockedDetails = async (auditLog: any) => {
    const txnId = auditLog.transactionId;
    if (blockedDetails[txnId]) {
      setExpandedDetails(expandedBlocked === txnId ? null : txnId);
      return;
    }
    try {
      const res = await fetchAuditByTxn(txnId);
      setBlockedDetails(prev => ({ ...prev, [txnId]: res.data }));
      setExpandedBlocked(txnId);
    } catch {
      setExpandedBlocked(txnId);
    }
  };

  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);

  if (gLoading || cLoading) return <LoadingSpinner />;
  if (gError || cError) return <ErrorMessage message={gError || cError || ''} onRetry={() => { gRetry(); cRetry(); }} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Rules" value={String(guardrailRules.filter(r => r.status === 'Active').length)} sub="Guardrails armed" />
        <StatCard label="Triggered Today" value={String(auditLogs.filter(l => l.eventType === 'POLICY_CHECK').length)} sub="Rule enforcement events" />
        <StatCard label="Blocked Actions" value={String(blockedLogs.length)} sub="Prevented by policy" />
        <StatCard label="Escalations" value={String(auditLogs.filter(l => l.eventType === 'AI_DECISION' && l.action === 'Human Escalation').length)} sub="Sent to human review" />
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
          <span className="text-emerald-400">&#10003;</span>
          <span className="text-xs text-emerald-400 font-medium">Policy updated successfully. Changes are now active.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
          <span className="text-red-400">!</span>
          <span className="text-xs text-red-400">{saveError}</span>
        </div>
      )}

      {config?.lastUpdated && (
        <p className="text-[10px] text-gray-600">Last updated: {new Date(config.lastUpdated).toLocaleString()} by {config.updatedBy || 'system'}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {guardrailRules.map((g) => {
          const ruleKey = g.id;
          const isEditing = editingRule === ruleKey;
          const ruleConfig = config?.rules?.[ruleKey];
          const isEnabled = ruleConfig?.enabled ?? (g.status === 'Active');
          const unit = ruleConfig?.unit || '';

          return (
            <Card key={g.id} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-gray-300 font-display">{g.name}</p>
                  {saveSuccess === ruleKey && <span className="text-[9px] text-emerald-400 font-mono">SAVED</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(ruleKey, isEnabled)}
                    disabled={saving}
                    className={`relative w-10 h-5 rounded-full transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className={`text-[10px] font-medium ${isEnabled ? 'text-emerald-400' : 'text-gray-500'}`}>
                    {isEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-200 leading-relaxed mb-3">{g.description}</p>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Current limit:</span>
                    <span className="text-[10px] text-amber-400 font-mono">{unit === 'INR' ? '₹' : ''}{g.limit.toLocaleString()}{unit === 'attempts' ? ' attempts' : unit === '%' ? '%' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">New limit:</span>
                    <div className="flex items-center gap-1">
                      {unit === 'INR' && <span className="text-[10px] text-gray-400">₹</span>}
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => handleValueChange(ruleKey, e.target.value)}
                        className="w-28 bg-[#111827] border border-[#2563EB] rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                        min="0"
                      />
                      {unit === 'attempts' && <span className="text-[10px] text-gray-400">attempts</span>}
                      {unit === '%' && <span className="text-[10px] text-gray-400">%</span>}
                    </div>
                  </div>

                  {previewLoading ? (
                    <p className="text-[10px] text-gray-500">Calculating affected transactions...</p>
                  ) : previewCount !== null ? (
                    <div className="p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                      <p className="text-[10px] text-amber-400">
                        Changing this limit may affect currently restricted recovery opportunities.
                      </p>
                      <p className="text-[10px] text-gray-300 mt-1">
                        {previewCount} transaction{previewCount !== 1 ? 's' : ''} currently exceed{previewCount === 1 ? 's' : ''} this limit.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500">
                      Changing this limit may affect currently restricted recovery opportunities.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveRule(ruleKey)}
                      disabled={saving || !editValue}
                      className="px-3 py-1.5 bg-[#2563EB] text-white text-[10px] font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {saving && <span className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />}
                      {saving ? 'Saving...' : 'Save Policy'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-3 py-1.5 bg-[#1A2332] text-gray-400 text-[10px] font-medium rounded-lg border border-[#1E2D45] hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-500">{g.id}</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {unit === 'INR' ? '₹' : ''}{g.limit.toLocaleString()}{unit === 'attempts' ? '' : unit === '%' ? '%' : ''}
                    </span>
                    <span className="text-[10px] text-gray-500">{unit === 'INR' ? 'limit' : unit === 'attempts' ? 'max' : 'min'}</span>
                  </div>
                  <button
                    onClick={() => startEdit(ruleKey, g.limit)}
                    disabled={!isEnabled}
                    className="px-3 py-1.5 bg-[#1A2332] border border-[#1E2D45] rounded-lg text-[10px] text-gray-400 hover:text-white hover:border-[#2563EB] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold font-display text-white mb-4">Blocked Actions Today</p>
        {blockedLogs.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No blocked actions recorded yet. Trigger guardrail checks to see blocked actions here.</p>
        ) : (
          <div className="space-y-2">
            {blockedLogs.map((b) => {
              const isExpanded = expandedDetails === b.transactionId;
              const details = blockedDetails[b.transactionId];
              return (
                <div key={b.auditId} className="bg-[#1A2332] rounded-lg border border-[#1E2D45] overflow-hidden">
                  <div
                    onClick={() => loadBlockedDetails(b)}
                    className="flex items-center gap-3 p-3 cursor-pointer table-row-hover"
                  >
                    <span className="text-[10px] text-gray-600 font-mono w-4">{isExpanded ? '▼' : '▶'}</span>
                    <span className="font-mono text-[11px] text-gray-400 flex-shrink-0">{b.transactionId}</span>
                    <span className="text-xs text-gray-200 flex-shrink-0">{b.action}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${b.status === 'BLOCKED' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
                      {b.status}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono ml-auto flex-shrink-0">
                      {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : ''}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('audit');
                      }}
                      className="px-2 py-0.5 bg-[#2563EB]/10 text-[#3B82F6] text-[9px] font-medium rounded border border-[#2563EB]/20 hover:bg-[#2563EB]/20 transition-colors flex-shrink-0"
                    >
                      View Audit
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-[#1E2D45]">
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <span className="text-[9px] text-gray-600">Transaction ID: </span>
                          <span className="text-[10px] text-gray-300 font-mono">{b.transactionId}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-600">Blocked Action: </span>
                          <span className="text-[10px] text-gray-300">{b.action}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-600">Policy Status: </span>
                          <span className={`text-[10px] font-medium ${b.status === 'BLOCKED' ? 'text-red-400' : 'text-amber-400'}`}>{b.status}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-600">Timestamp: </span>
                          <span className="text-[10px] text-gray-300 font-mono">{b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</span>
                        </div>
                      </div>

                      {(b.details as any)?.requestedAction && (
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[9px] text-gray-600">Requested Action: </span>
                            <span className="text-[10px] text-gray-300">{(b.details as any).requestedAction}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-600">Final Action: </span>
                            <span className="text-[10px] text-white font-medium">{(b.details as any).finalAction}</span>
                          </div>
                        </div>
                      )}

                      {(b.details as any)?.rulesTriggered && (b.details as any).rulesTriggered.length > 0 && (
                        <div className="mt-2">
                          <span className="text-[9px] text-gray-600">Rules Triggered:</span>
                          {(b.details as any).rulesTriggered.map((r: any, i: number) => (
                            <div key={i} className="ml-2 mt-1 p-2 bg-red-500/5 rounded border border-red-500/10">
                              <span className="text-[10px] text-red-400 font-medium">{r.rule}: </span>
                              <span className="text-[10px] text-gray-400">{r.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {(b.details as any)?.explanation && (
                        <div className="mt-2 p-2 bg-[#090E1A] rounded border border-[#1E2D45]">
                          <span className="text-[9px] text-gray-600">Why It Was Blocked: </span>
                          <span className="text-[10px] text-gray-300">{(b.details as any).explanation}</span>
                        </div>
                      )}

                      {details && details.length > 0 && (
                        <div className="mt-3">
                          <span className="text-[9px] text-gray-600">Full Transaction Audit ({details.length} events):</span>
                          <div className="mt-1 space-y-1">
                            {details.slice(0, 10).map((event: any) => (
                              <div key={event.auditId} className="flex items-center gap-2 text-[10px] font-mono">
                                <span className="text-gray-600 w-16">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}</span>
                                <span className={`w-24 ${event.eventType === 'POLICY_CHECK' ? 'text-amber-400' : event.eventType === 'AI_DECISION' ? 'text-[#A78BFA]' : 'text-gray-400'}`}>{event.eventType}</span>
                                <span className="text-gray-500">{event.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditView() {
  const { data, loading, error, retry } = useApiData(fetchAuditTrail);
  const logs = data?.data || [];
  const [search, setSearch] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [txnLogs, setTxnLogs] = useState<AuditLog[] | null>(null);
  const [loadingTxn, setLoadingTxn] = useState(false);

  const aiDecisions = logs.filter(l => l.eventType === 'AI_DECISION').length;
  const policyPasses = logs.filter(l => l.eventType === 'POLICY_CHECK' && l.status === 'PASSED').length;
  const escalations = logs.filter(l => l.eventType === 'AI_DECISION' && l.action === 'Human Escalation').length;

  useEffect(() => {
    if (selectedTxn) {
      setLoadingTxn(true);
      fetchAuditByTxn(selectedTxn).then(res => {
        setTxnLogs(res.data);
        setLoadingTxn(false);
      }).catch(() => {
        setTxnLogs([]);
        setLoadingTxn(false);
      });
    }
  }, [selectedTxn]);

  const displayLogs = selectedTxn && txnLogs ? txnLogs : logs;

  const sortedLogs = [...displayLogs].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const filtered = search
    ? sortedLogs.filter((l) =>
        l.transactionId.toLowerCase().includes(search.toLowerCase()) ||
        l.auditId.toLowerCase().includes(search.toLowerCase())
      )
    : sortedLogs;

  const handleSearch = () => {
    if (search.trim()) {
      setSelectedTxn(search.trim());
    } else {
      setSelectedTxn(null);
      setTxnLogs(null);
    }
  };

  const handleExportCsv = () => {
    const exportLogs = selectedTxn && txnLogs ? txnLogs : filtered;
    if (exportLogs.length === 0) return;
    const headers = ["Audit ID", "Timestamp", "TXN ID", "Event Type", "Action", "Status", "Details"];
    const rows = exportLogs.map((l) => {
      let details = '';
      if (l.eventType === 'AI_DECISION' && (l.details as Record<string, unknown>)?.reason) details = String((l.details as Record<string, unknown>).reason);
      else if (l.eventType === 'POLICY_CHECK' && (l.details as Record<string, unknown>)?.passed !== undefined) details = (l.details as Record<string, unknown>).passed ? 'Passed' : 'Blocked';
      else if (l.eventType === 'ACTION_RESULT' && (l.details as Record<string, unknown>)?.executed !== undefined) details = (l.details as Record<string, unknown>).executed ? 'Executed' : 'Failed';
      else if (l.eventType === 'SIMULATION_RESULT' && (l.details as Record<string, unknown>)?.succeeded !== undefined) details = (l.details as Record<string, unknown>).succeeded ? 'Success' : 'Failed';
      return [l.auditId, l.timestamp ? new Date(l.timestamp).toLocaleString() : '', l.transactionId, l.eventType, l.action, l.status, details].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-trail.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
    DETECTED: { label: 'DETECTED', color: 'text-[#3B82F6]', bg: 'bg-[#2563EB]/10' },
    DIAGNOSED: { label: 'DIAGNOSED', color: 'text-[#A78BFA]', bg: 'bg-[#7C3AED]/10' },
    AI_DECISION: { label: 'AI_DECISION', color: 'text-[#F59E0B]', bg: 'bg-amber-500/10' },
    POLICY_CHECK: { label: 'POLICY_CHECK', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ACTION_RESULT: { label: 'ACTION_RESULT', color: 'text-[#3B82F6]', bg: 'bg-[#2563EB]/10' },
    RECOVERY_RESULT: { label: 'RECOVERY_RESULT', color: 'text-gray-300', bg: 'bg-gray-500/10' },
    SIMULATION_RESULT: { label: 'SIMULATION', color: 'text-gray-400', bg: 'bg-gray-500/10' },
  };

  const renderEventDetails = (log: AuditLog) => {
    const d = log.details as Record<string, any>
    if (!d) return null

    const keyPairs: { key: string; value: string; color?: string }[] = []

    if (log.eventType === 'DETECTED') {
      if (d.amount !== undefined) keyPairs.push({ key: 'amount', value: `₹${d.amount}` })
      if (d.source) keyPairs.push({ key: 'source', value: d.source })
      if (d.type) keyPairs.push({ key: 'type', value: d.type })
      if (d.failureReason) keyPairs.push({ key: 'failure', value: d.failureReason })
    } else if (log.eventType === 'DIAGNOSED') {
      if (d.recoverability !== undefined) keyPairs.push({ key: 'recoverability', value: `${d.recoverability}%` })
      if (d.riskScore !== undefined) keyPairs.push({ key: 'riskScore', value: String(d.riskScore) })
      if (d.confidence !== undefined) keyPairs.push({ key: 'confidence', value: `${d.confidence}%` })
      if (d.problem) keyPairs.push({ key: 'problem', value: d.problem })
      if (d.rootCause) keyPairs.push({ key: 'rootCause', value: d.rootCause })
    } else if (log.eventType === 'AI_DECISION') {
      keyPairs.push({ key: 'action', value: log.action, color: 'text-[#A78BFA]' })
      if (d.confidence !== undefined) keyPairs.push({ key: 'confidence', value: `${typeof d.confidence === 'number' ? (d.confidence * 100).toFixed(0) : d.confidence}%` })
      if (d.recoverability !== undefined) keyPairs.push({ key: 'recoverability', value: `${d.recoverability}%` })
      if (d.riskScore !== undefined) keyPairs.push({ key: 'riskScore', value: String(d.riskScore) })
      if (d.amount !== undefined) keyPairs.push({ key: 'amount', value: `₹${d.amount}` })
    } else if (log.eventType === 'POLICY_CHECK') {
      const statusColor = d.policyStatus === 'PASSED' ? 'text-emerald-400' : d.policyStatus === 'BLOCKED' ? 'text-red-400' : 'text-amber-400'
      keyPairs.push({ key: 'status', value: d.policyStatus || log.status, color: statusColor })
      keyPairs.push({ key: 'execution', value: d.policyStatus === 'PASSED' ? 'ALLOWED' : d.policyStatus === 'BLOCKED' ? 'STOPPED' : 'PAUSED' })
      if (d.requestedAction) keyPairs.push({ key: 'requested', value: d.requestedAction })
      if (d.finalAction || d.allowedAction) keyPairs.push({ key: 'final', value: d.finalAction || d.allowedAction })
      if (d.rulesTriggered && d.rulesTriggered.length > 0) {
        d.rulesTriggered.forEach((r: any) => {
          keyPairs.push({ key: 'rule', value: `${r.rule}: ${r.reason}`, color: 'text-red-400' })
        })
      }
    } else if (log.eventType === 'ACTION_RESULT') {
      if (d.provider) keyPairs.push({ key: 'provider', value: d.provider })
      if (d.executed !== undefined) keyPairs.push({ key: 'executed', value: String(d.executed) })
      keyPairs.push({ key: 'status', value: log.status })
      if (d.razorpayPaymentLinkId) keyPairs.push({ key: 'paymentLinkId', value: d.razorpayPaymentLinkId })
      if (d.razorpayOrderId) keyPairs.push({ key: 'orderId', value: d.razorpayOrderId })
      if (d.shortUrl) keyPairs.push({ key: 'url', value: d.shortUrl })
    } else if (log.eventType === 'RECOVERY_RESULT') {
      keyPairs.push({ key: 'status', value: d.status || log.status })
      if (d.message) keyPairs.push({ key: 'message', value: d.message })
    }

    return keyPairs.map(({ key, value, color }) => (
      <span key={key} className="ml-6">
        <span className="text-gray-600">{key}=</span>
        <span className={color || 'text-gray-300'}>{value}</span>
      </span>
    ))
  }

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Decisions" value={String(aiDecisions || logs.length)} sub="AI-driven today" />
        <StatCard label="Policy Passes" value={String(policyPasses)} sub={logs.length ? `${Math.round((policyPasses / Math.max(logs.filter(l => l.eventType === 'POLICY_CHECK').length, 1)) * 100)}% compliance` : 'No data'} accent />
        <StatCard label="Escalations" value={String(escalations)} sub="Sent to humans" />
        <StatCard label="Avg Decision Time" value="1.3s" sub="End-to-end" />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="w-full bg-[#1A2332] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#2563EB] font-mono"
            placeholder="Enter Transaction ID (e.g. DEMO-1788534554944)..."
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-[#2563EB] text-white text-xs rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          Trace
        </button>
        {selectedTxn && (
          <button
            onClick={() => { setSelectedTxn(null); setTxnLogs(null); setSearch(''); }}
            className="px-4 py-2 bg-[#1A2332] border border-[#1E2D45] text-gray-400 text-xs rounded-lg hover:text-white transition-colors"
          >
            Show All
          </button>
        )}
        <button onClick={handleExportCsv} className="px-4 py-2 bg-[#1A2332] border border-[#1E2D45] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
          Export CSV
        </button>
      </div>

      {selectedTxn && (
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse-dot" />
          <span>Showing trace for</span>
          <span className="font-mono text-[#3B82F6]">{selectedTxn}</span>
          <span>({sortedLogs.length} events)</span>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="bg-[#090E1A] border-b border-[#1E2D45] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">AGENT AUDIT STREAM</span>
            <span className="text-[9px] text-gray-600 font-mono">Live execution trace</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
            <span className="text-[9px] text-gray-500 font-mono">{sortedLogs.length} events</span>
          </div>
        </div>

        <div className="max-h-[700px] overflow-y-auto bg-[#0B1120] p-4 font-mono text-[11px]">
          {sortedLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-xs">No audit events found.</p>
              <p className="text-gray-600 text-[10px] mt-1">Trigger recovery decisions to generate audit logs.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {sortedLogs.map((log, idx) => {
                const config = eventTypeConfig[log.eventType] || { label: log.eventType, color: 'text-gray-400', bg: 'bg-gray-500/10' }
                const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'
                const isPolicyPassed = log.eventType === 'POLICY_CHECK' && log.status === 'PASSED'
                const isPolicyBlocked = log.eventType === 'POLICY_CHECK' && log.status === 'BLOCKED'
                const isPolicyApproval = log.eventType === 'POLICY_CHECK' && log.status === 'APPROVAL_REQUIRED'

                return (
                  <div key={log.auditId} className="flex flex-col py-1.5 group">
                    <div className="flex items-start gap-0">
                      <span className="text-gray-600 w-16 flex-shrink-0">{time}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${config.color} ${config.bg} w-28 flex-shrink-0 text-center`}>
                        {config.label}
                      </span>
                      <span className="text-gray-500 w-44 flex-shrink-0 truncate">{log.transactionId}</span>
                      {isPolicyPassed && <span className="text-emerald-400 text-[9px] font-bold ml-1">PASSED</span>}
                      {isPolicyBlocked && <span className="text-red-400 text-[9px] font-bold ml-1">BLOCKED</span>}
                      {isPolicyApproval && <span className="text-amber-400 text-[9px] font-bold ml-1">APPROVAL_REQUIRED</span>}
                    </div>
                    <div className="ml-16 mt-0.5 space-y-0.5">
                      {renderEventDetails(log)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function AnalyticsView({ dateRange }: { dateRange: string }) {
  const { data, loading, error, retry } = useApiData(fetchAnalytics);
  const analytics = data?.data;
  const { data: txnData, loading: txnLoading } = useApiData(fetchTransactions);
  const txns = filterByDateRange((txnData?.data || []).filter((t: any) => t.source === 'historical'), Number(dateRange));
  const { data: evalData, loading: evalLoading } = useApiData(fetchEvaluation);
  const evaluation = evalData?.data;
  const { data: mlData, loading: mlLoading } = useApiData(fetchMLMetrics);
  const mlMetrics = mlData?.data;
  const { data: actualData, loading: actualLoading } = useApiData(fetchActualRecoveryPerformance);
  const actual = actualData?.data;

  const [showHistorical, setShowHistorical] = useState(false);
  const [showActual, setShowActual] = useState(false);

  const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weeklyData = (() => {
    const dayMap: Record<string, { atRisk: number; recovered: number }> = {};
    txns.forEach((t) => {
      const d = new Date(t.timestamp);
      const day = dayOrder[d.getDay()];
      if (!dayMap[day]) dayMap[day] = { atRisk: 0, recovered: 0 };
      dayMap[day].atRisk += t.amount;
      if (t.groundTruthRecoverable) dayMap[day].recovered += t.groundTruthRecoveredAmount;
    });
    return dayOrder.filter((d) => dayMap[d]).map((d) => ({ day: d, ...dayMap[d] }));
  })();

  const interventionsData = (() => {
    const actionMap: Record<string, { count: number; success: number }> = {};
    txns.forEach((t) => {
      const action = t.groundTruthAction;
      if (!action) return;
      if (!actionMap[action]) actionMap[action] = { count: 0, success: 0 };
      actionMap[action].count++;
      if (t.groundTruthRecoverable) actionMap[action].success++;
    });
    return Object.entries(actionMap).map(([type, v]) => ({
      type,
      count: v.count,
      success: v.success,
      rate: v.count ? Math.round((v.success / v.count) * 100) : 0,
    }));
  })();

  const recoveryTrendData = (() => {
    const dateMap: Record<string, { atRisk: number; recovered: number }> = {};
    txns.forEach((t) => {
      const date = t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      if (!date) return;
      if (!dateMap[date]) dateMap[date] = { atRisk: 0, recovered: 0 };
      dateMap[date].atRisk += t.amount;
      if (t.groundTruthRecoverable) dateMap[date].recovered += t.groundTruthRecoveredAmount;
    });
    return Object.entries(dateMap).map(([date, v]) => ({
      date,
      atRisk: v.atRisk,
      recovered: v.recovered,
      rate: v.atRisk ? Math.round((v.recovered / v.atRisk) * 1000) / 10 : 0,
    }));
  })();

  if (loading || txnLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ============================================================ */}
      {/* COLLAPSIBLE: HISTORICAL MODEL EVALUATION                      */}
      {/* ============================================================ */}
      <div
        onClick={() => setShowHistorical(!showHistorical)}
        className="flex items-center justify-between px-5 py-3 bg-[#090E1A] border border-[#1E2D45] rounded-xl cursor-pointer hover:border-[#2563EB]/30 transition-colors"
      >
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">HISTORICAL MODEL EVALUATION</p>
          <p className="text-[10px] text-gray-600 mt-0.5">ML model precision, recall, F1, confusion matrix on 5,000 historical transactions</p>
        </div>
        <span className={`text-[10px] text-gray-500 transition-transform ${showHistorical ? 'rotate-90' : ''}`}>&#9654;</span>
      </div>

      {showHistorical && (
        <div className="border border-[#1E2D45] rounded-xl overflow-hidden">
          <div className="bg-[#090E1A] border-b border-[#1E2D45] px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">HISTORICAL MODEL EVALUATION</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Evaluated on historical transaction data. These metrics measure prediction quality, not live merchant recovery.</p>
              </div>
              <span className="text-[9px] text-gray-600 font-mono px-2 py-0.5 bg-[#111827] rounded border border-[#1E2D45]">Source: Historical evaluation dataset</span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {evalLoading ? (
              <Card className="p-5"><LoadingSpinner /></Card>
            ) : evaluation ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">&#128202;</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold font-display text-white">{evaluation.totalTransactions} Historical Transactions Evaluated</p>
                    <p className="text-[10px] text-gray-500 font-mono">{evaluation.totalDecisions} AI decisions compared against ground truth</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">AI Decision Quality</p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Precision</p>
                    <p className="text-lg font-bold font-mono text-white">{evaluation.precision}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">Of transactions predicted as recoverable, how many were actually recoverable?</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Recall</p>
                    <p className="text-lg font-bold font-mono text-[#3B82F6]">{evaluation.recall}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">Of recoverable transactions, how many did the model identify?</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">F1 Score</p>
                    <p className="text-lg font-bold font-mono text-white">{evaluation.f1Score}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">Balance between precision and recall.</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Action Accuracy</p>
                    <p className="text-lg font-bold font-mono text-white">{evaluation.actionAccuracy}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">How often did the AI choose the same recovery action as the historical ground truth?</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Confusion Matrix</p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <p className="text-[9px] text-emerald-400 uppercase tracking-wider mb-1">True Positives</p>
                    <p className="text-lg font-bold font-mono text-emerald-400">{evaluation.truePositives}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Action predicted + actually recoverable</p>
                  </div>
                  <div className="p-3 bg-[#2563EB]/5 rounded-lg border border-[#2563EB]/20">
                    <p className="text-[9px] text-[#60A5FA] uppercase tracking-wider mb-1">True Negatives</p>
                    <p className="text-lg font-bold font-mono text-[#60A5FA]">{evaluation.trueNegatives}</p>
                    <p className="text-[9px] text-gray-500 mt-1">No action predicted + not recoverable</p>
                  </div>
                  <div className="p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                    <p className="text-[9px] text-amber-400 uppercase tracking-wider mb-1">False Positives</p>
                    <p className="text-lg font-bold font-mono text-amber-400">{evaluation.falsePositives}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Action predicted but not actually recoverable</p>
                  </div>
                  <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <p className="text-[9px] text-red-400 uppercase tracking-wider mb-1">False Negatives</p>
                    <p className="text-lg font-bold font-mono text-red-400">{evaluation.falseNegatives}</p>
                    <p className="text-[9px] text-gray-500 mt-1">No action predicted but was recoverable</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Historical Business Outcome</p>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="Total At Risk" value={fmt(evaluation.totalAtRisk)} sub="Recoverable transactions in dataset" />
                  <StatCard label="Total Recovered (Ground Truth)" value={fmt(evaluation.totalRecovered)} sub="Confirmed recovered in historical data" accent />
                  <StatCard label="Historical Recovery Rate" value={`${evaluation.recoveryRate}%`} sub="Recovered / At Risk (historical)" />
                  <StatCard label="False Positive Rate" value={`${evaluation.falsePositiveRate}%`} sub="FP / (FP + TN)" />
                </div>

                <Card className="p-5">
                  <p className="text-sm font-semibold font-display text-white mb-4">Action-Level Historical Evaluation</p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                          <th className="text-left pb-2.5">Action</th>
                          <th className="text-right pb-2.5">Count</th>
                          <th className="text-right pb-2.5">Correct</th>
                          <th className="text-right pb-2.5">Incorrect</th>
                          <th className="text-right pb-2.5">TP</th>
                          <th className="text-right pb-2.5">TN</th>
                          <th className="text-right pb-2.5">FP</th>
                          <th className="text-right pb-2.5">FN</th>
                          <th className="text-right pb-2.5">Recovered</th>
                          <th className="text-right pb-2.5">Blocked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluation.actionMetrics.map((am) => (
                          <tr key={am.action} className="table-row-hover border-b border-[#1E2D45]/40">
                            <td className="py-3 text-xs text-gray-200 font-medium">{am.action}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{am.count}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-emerald-400">{am.correct}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-red-400">{am.incorrect}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{am.truePositives}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{am.trueNegatives}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-amber-400">{am.falsePositives}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-amber-400">{am.falseNegatives}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-emerald-400">{fmt(am.recoveredAmount)}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{am.blockedByGuardrails}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-sm text-gray-400">No historical evaluation data available</p>
              </Card>
            )}

            {mlMetrics?.loaded && (
              <>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">ML Model Performance (Trained on Historical Data)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Recoverability Classifier</p>
                    <p className="text-lg font-bold font-mono text-white">{mlMetrics.recoverability?.accuracy ? (mlMetrics.recoverability.accuracy * 100).toFixed(1) : 0}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">Accuracy · F1: {mlMetrics.recoverability?.f1Score ? (mlMetrics.recoverability.f1Score * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Risk Score Model</p>
                    <p className="text-lg font-bold font-mono text-white">MAE: {mlMetrics.riskScore?.mae?.toFixed(2) || '0'}</p>
                    <p className="text-[9px] text-gray-500 mt-1">R²: {mlMetrics.riskScore?.r2Score?.toFixed(3) || '0'}</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Action Classifier</p>
                    <p className="text-lg font-bold font-mono text-white">{mlMetrics.action?.accuracy ? (mlMetrics.action.accuracy * 100).toFixed(1) : 0}%</p>
                    <p className="text-[9px] text-gray-500 mt-1">Macro F1: {mlMetrics.action?.macroF1 ? (mlMetrics.action.macroF1 * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>

                <Card className="p-5">
                  <p className="text-sm font-semibold font-display text-white mb-4">ML Action Classification (Per-Class)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                          <th className="text-left pb-2.5">Action</th>
                          <th className="text-right pb-2.5">Precision</th>
                          <th className="text-right pb-2.5">Recall</th>
                          <th className="text-right pb-2.5">F1 Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mlMetrics.action?.perClass && Object.entries(mlMetrics.action.perClass).map(([action, metrics]) => (
                          <tr key={action} className="table-row-hover border-b border-[#1E2D45]/40">
                            <td className="py-3 text-xs text-gray-200 font-medium">{action}</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{(metrics.precision * 100).toFixed(1)}%</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{(metrics.recall * 100).toFixed(1)}%</td>
                            <td className="py-3 text-right font-mono text-[11px] text-gray-400">{(metrics.f1Score * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-5">
                  <p className="text-sm font-semibold font-display text-white mb-4">Feature Importance (Recoverability Model)</p>
                  <div className="space-y-2">
                    {mlMetrics.recoverability?.featureImportances && Object.entries(mlMetrics.recoverability.featureImportances)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([feature, importance]) => (
                        <div key={feature}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-300">{feature}</span>
                            <span className="font-mono text-[11px] text-gray-400">{(importance * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1E2D45] rounded-full">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${importance * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* COLLAPSIBLE: ACTUAL RECOVERY PERFORMANCE                      */}
      {/* ============================================================ */}
      <div
        onClick={() => setShowActual(!showActual)}
        className="flex items-center justify-between px-5 py-3 bg-[#090E1A] border border-emerald-500/20 rounded-xl cursor-pointer hover:border-emerald-500/30 transition-colors"
      >
        <div>
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono font-semibold">ACTUAL RECOVERY PERFORMANCE</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Live agent execution results — successful orders, failures, guardrail blocks, pending recoveries</p>
        </div>
        <span className={`text-[10px] text-gray-500 transition-transform ${showActual ? 'rotate-90' : ''}`}>&#9654;</span>
      </div>

      {showActual && (
        <div className="border border-emerald-500/20 rounded-xl overflow-hidden">
          <div className="bg-[#090E1A] border-b border-emerald-500/20 px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono font-semibold">ACTUAL RECOVERY PERFORMANCE</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Measured from recovery actions executed by the agent. This is operational performance, not model accuracy.</p>
              </div>
              <span className="text-[9px] text-gray-600 font-mono px-2 py-0.5 bg-[#111827] rounded border border-[#1E2D45]">
                Source: {actual?.sources?.join(' + ') || 'Agent executions + audit/recovery results'}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {actualLoading ? (
              <Card className="p-5"><LoadingSpinner /></Card>
            ) : actual ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Confirmed Recovered</p>
                    <p className="text-lg font-bold font-mono text-white">
                      {actual.recovery.confirmedRecoveredAmount > 0 ? fmt(actual.recovery.confirmedRecoveredAmount) : '—'}
                    </p>
                    <p className="text-[9px] text-gray-500 mt-1">Only confirmed recovery payments</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Recovery Rate</p>
                    <p className="text-lg font-bold font-mono text-white">
                      {actual.recovery.recoveryRate !== null ? `${actual.recovery.recoveryRate}%` : 'Insufficient data'}
                    </p>
                    <p className="text-[9px] text-gray-500 mt-1">Confirmed recovered / Executed amount</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Total Executed Amount</p>
                    <p className="text-lg font-bold font-mono text-white">{fmt(actual.recovery.totalExecutedAmount)}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Amount sent to successful execution</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Pending Recoveries</p>
                    <p className="text-lg font-bold font-mono text-amber-400">{actual.recovery.pendingRecoveries}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Awaiting customer payment response</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Execution Status Breakdown</p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                    <p className="text-[9px] text-emerald-400 uppercase tracking-wider mb-1">Successful Executions</p>
                    <p className="text-lg font-bold font-mono text-emerald-400">{actual.executions.successful}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Orders/payment links created</p>
                  </div>
                  <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                    <p className="text-[9px] text-red-400 uppercase tracking-wider mb-1">Failed Executions</p>
                    <p className="text-lg font-bold font-mono text-red-400">{actual.executions.failed}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Execution attempted but failed</p>
                  </div>
                  <div className="p-3 bg-gray-500/5 rounded-lg border border-gray-500/20">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Not Supported</p>
                    <p className="text-lg font-bold font-mono text-gray-400">{actual.executions.notSupported}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Action type without execution flow</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Total Agent Runs</p>
                    <p className="text-lg font-bold font-mono text-white">{actual.summary.totalAgentRuns}</p>
                    <p className="text-[9px] text-gray-500 mt-1">All autonomous pipeline runs</p>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Policy Outcomes (Separate from Execution)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Guardrail Blocked</p>
                    <p className="text-lg font-bold font-mono text-amber-400">{actual.policy.guardrailBlocked}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Recovery actions prevented by policy before execution</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Awaiting Approval</p>
                    <p className="text-lg font-bold font-mono text-amber-400">{actual.policy.approvalRequired}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Requires human review before execution</p>
                  </div>
                  <div className="p-3 bg-[#111827] rounded-lg border border-[#1E2D45]">
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Policy Passed</p>
                    <p className="text-lg font-bold font-mono text-emerald-400">{actual.policy.policyPassed}</p>
                    <p className="text-[9px] text-gray-500 mt-1">Execution allowed by policy</p>
                  </div>
                </div>

                <Card className="p-5">
                  <p className="text-sm font-semibold font-display text-white mb-2">Important Notes</p>
                  <div className="space-y-2 text-[11px] text-gray-400">
                    <p>• <span className="text-white font-medium">ORDER_CREATED</span> means a Razorpay order was created, not that payment was received. Recovery status is <span className="text-amber-400 font-medium">PENDING</span> until confirmed.</p>
                    <p>• <span className="text-white font-medium">Guardrail blocks</span> are separate from execution failures. A blocked action was never attempted.</p>
                    <p>• <span className="text-white font-medium">NOT_SUPPORTED</span> actions have no execution flow yet and should not be counted as failures.</p>
                    {actual.recovery.simulatedRecoveredAmount > 0 && (
                      <p>• <span className="text-white font-medium">Simulated recovery</span> amount: {fmt(actual.recovery.simulatedRecoveredAmount)} (simulation only, not actual recovery).</p>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-sm text-gray-400">No actual recovery data available</p>
                <p className="text-[10px] text-gray-600 mt-1">Execute recovery actions to generate operational performance data</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* NORMAL ANALYTICS (DEFAULT VISIBLE)                             */}
      {/* ============================================================ */}
      <div className="border border-[#1E2D45] rounded-xl overflow-hidden">
        <div className="bg-[#090E1A] border-b border-[#1E2D45] px-5 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">RECOVERY TRENDS</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Historical recovery patterns from the evaluation dataset</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Historical At Risk" value={fmt(analytics?.totalAtRisk || 0)} sub="Recoverable amount · 5,000 historical txns" />
            <StatCard label="Historical Recovered" value={fmt(analytics?.totalRecovered || 0)} sub="Confirmed recovered (ground truth)" accent />
            <StatCard label="Historical Recovery Rate" value={`${analytics?.recoveryRate || 0}%`} sub="Recovered / At Risk · Historical" />
            <StatCard label="Successful Interventions" value={String(analytics?.successfulInterventions || 0)} sub="Correct AI decisions" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <p className="text-sm font-semibold font-display text-white mb-1">Weekly At-Risk vs Recovered</p>
              <p className="text-xs text-gray-500 mb-4">Daily comparison this week (historical)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData} barCategoryGap="30%">
                  <XAxis dataKey="day" tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="atRisk" name="At Risk" fill="#EF444440" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recovered" name="Recovered" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <p className="text-sm font-semibold font-display text-white mb-1">Intervention Performance</p>
              <p className="text-xs text-gray-500 mb-4">Success rate by recovery type (historical)</p>
              <div className="space-y-3">
                {interventionsData.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">{item.type}</span>
                      <span className="font-mono text-[11px] text-gray-400">{item.success}/{item.count} · <span className="text-white">{item.rate}%</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1E2D45] rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${item.rate}%`, background: item.rate >= 70 ? "#2563EB" : item.rate >= 60 ? "#7C3AED" : "#4B5563" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <p className="text-sm font-semibold font-display text-white mb-1">Recovery Trend</p>
            <p className="text-xs text-gray-500 mb-4">Recovery rate over time (historical)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={recoveryTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
                <XAxis dataKey="date" tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} domain={[55, 70]} />
                <Tooltip formatter={(v: any) => [`${v}%`, "Recovery Rate"]} contentStyle={{ background: "#1A2332", border: "1px solid #1E2D45", borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} dot={{ fill: "#2563EB", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

function IntegrationView() {
  const { data: statusData, loading: statusLoading, error: statusError, retry: retryStatus } = useApiData(fetchIntegrationStatus);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [showSimulate, setShowSimulate] = useState(false);
  const [simAmount, setSimAmount] = useState('2199');
  const [simMethod, setSimMethod] = useState('Credit Card');
  const [simReason, setSimReason] = useState('Card Declined');
  const [simAttempts, setSimAttempts] = useState('2');
  const [simSegment, setSimSegment] = useState('High Value');
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [agentRun, setAgentRun] = useState<AgentRun | null>(null);
  const [agentPolling, setAgentPolling] = useState(false);

  const status = statusData as IntegrationStatus | null;

  const pollAgentRun = async (txnId: string) => {
    setAgentPolling(true);
    let attempts = 0;
    const maxAttempts = 20;
    const interval = 500;

    while (attempts < maxAttempts) {
      try {
        const result = await fetchAgentRunForTxn(txnId);
        if (result.data) {
          setAgentRun(result.data);
          if (['COMPLETED', 'BLOCKED', 'HUMAN_APPROVAL_REQUIRED', 'EXECUTION_FAILED', 'FAILED', 'REJECTED'].includes(result.data.status)) {
            setAgentPolling(false);
            return;
          }
        }
      } catch {
        // Agent run not ready yet
      }
      await new Promise(r => setTimeout(r, interval));
      attempts++;
    }
    setAgentPolling(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await syncRazorpayTransactions();
      setSyncResult(result);
      retryStatus();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvalError(null);
    setEvalResult(null);
    setAgentRun(null);
    try {
      const result = await evaluateTransaction({
        amount: Number(simAmount) || 2199,
        paymentMethod: simMethod,
        failureReason: simReason,
        attempts: Number(simAttempts) || 1,
        customerSegment: simSegment,
      });
      setEvalResult(result);
      if (result.transaction?.id) {
        pollAgentRun(result.transaction.id);
      }
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  if (statusLoading) return <LoadingSpinner />;
  if (statusError) return <ErrorMessage message={statusError} onRetry={retryStatus} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Integration Status"
          value={status?.connected ? 'Connected' : 'Not Connected'}
          sub={status?.connected ? 'Razorpay Test Mode' : 'Credentials not verified'}
        />
        <StatCard
          label="Synced Transactions"
          value={String(status?.syncedTransactions || 0)}
          sub="From Razorpay Test Mode"
        />
        <StatCard
          label="Last Sync"
          value={status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleDateString() : 'Never'}
          sub={status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString() : 'No sync performed yet'}
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-white font-display">Razorpay Integration</p>
            <p className="text-xs text-gray-500 mt-0.5">Test Mode</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            status?.connected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${status?.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {status?.connected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {status?.merchant && (
          <div className="bg-[#1A2332] rounded-xl border border-[#1E2D45] p-4 mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Merchant Information</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-gray-500">Name</p>
                <p className="text-xs text-white font-medium">{status.merchant.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Email</p>
                <p className="text-xs text-white font-medium">{status.merchant.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Account ID</p>
                <p className="text-xs text-white font-mono">{status.merchant.id}</p>
              </div>
            </div>
          </div>
        )}

        {status?.error && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4">
            <p className="text-xs text-red-400">{status.error}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => retryStatus()}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1A2332] text-gray-300 border border-[#1E2D45] hover:border-[#2563EB] hover:text-white transition-all"
          >
            Test Connection
          </button>
          <button
            onClick={handleSync}
            disabled={!status?.connected || syncing}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              status?.connected && !syncing
                ? 'bg-[#2563EB] text-white hover:bg-blue-600'
                : 'bg-[#1A2332] text-gray-600 cursor-not-allowed border border-[#1E2D45]'
            }`}
          >
            {syncing ? 'Syncing...' : 'Sync Transactions'}
          </button>
        </div>
      </Card>

      {syncResult && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-white font-display mb-3">Sync Result</p>
          <div className="grid grid-cols-5 gap-4">
            <div className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Fetched</p>
              <p className="text-lg font-bold font-mono text-white">{syncResult.fetched}</p>
            </div>
            <div className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Inserted</p>
              <p className="text-lg font-bold font-mono text-emerald-400">{syncResult.inserted}</p>
            </div>
            <div className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Updated</p>
              <p className="text-lg font-bold font-mono text-blue-400">{syncResult.updated}</p>
            </div>
            <div className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Skipped</p>
              <p className="text-lg font-bold font-mono text-gray-400">{syncResult.skipped}</p>
            </div>
            <div className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Total Synced</p>
              <p className="text-lg font-bold font-mono text-white">{syncResult.totalSynced}</p>
            </div>
          </div>
        </Card>
      )}

      {syncError && (
        <Card className="p-5">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400">{syncError}</p>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm font-semibold text-white font-display mb-3">How It Works</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] text-[#3B82F6] font-bold">1</span>
            </div>
            <div>
              <p className="text-xs text-white font-medium">Verify Connection</p>
              <p className="text-[11px] text-gray-500">Backend verifies Razorpay Test Mode credentials</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] text-[#3B82F6] font-bold">2</span>
            </div>
            <div>
              <p className="text-xs text-white font-medium">Sync Payments</p>
              <p className="text-[11px] text-gray-500">Fetch available payments from Razorpay Test Mode</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#2563EB]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] text-[#3B82F6] font-bold">3</span>
            </div>
            <div>
              <p className="text-xs text-white font-medium">View in Revenue Leakage</p>
              <p className="text-[11px] text-gray-500">Synced transactions appear with a [RAZORPAY TEST] badge</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white font-display">Simulate New Payment</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Create a demo transaction and run AI evaluation</p>
          </div>
          <button
            onClick={() => setShowSimulate(!showSimulate)}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#2563EB] text-white hover:bg-blue-600 transition-all"
          >
            {showSimulate ? 'Close' : 'Simulate New Payment'}
          </button>
        </div>

        {showSimulate && (
          <div className="bg-[#1A2332] rounded-xl border border-[#1E2D45] p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Amount (₹)</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Payment Method</label>
                <select
                  value={simMethod}
                  onChange={(e) => setSimMethod(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option>Credit Card</option>
                  <option>Debit Card</option>
                  <option>UPI</option>
                  <option>Net Banking</option>
                  <option>Wallet</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Failure Reason</label>
                <select
                  value={simReason}
                  onChange={(e) => setSimReason(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option>Card Declined</option>
                  <option>Insufficient Funds</option>
                  <option>Expired Card</option>
                  <option>Bank Server Timeout</option>
                  <option>Network Error</option>
                  <option>3D Secure Authentication Failed</option>
                  <option>Checkout Abandoned</option>
                  <option>Payment Method Expired</option>
                  <option>Daily Limit Exceeded</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Attempts</label>
                <input
                  type="number"
                  value={simAttempts}
                  onChange={(e) => setSimAttempts(e.target.value)}
                  min="1"
                  max="10"
                  className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Customer Segment</label>
                <select
                  value={simSegment}
                  onChange={(e) => setSimSegment(e.target.value)}
                  className="w-full bg-[#111827] border border-[#1E2D45] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option>New</option>
                  <option>Regular</option>
                  <option>Loyal</option>
                  <option>High Value</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className={`w-full py-2.5 rounded-lg text-xs font-medium transition-all ${
                evaluating
                  ? 'bg-[#1A2332] text-gray-600 cursor-not-allowed border border-[#1E2D45]'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {evaluating ? 'Evaluating...' : 'Evaluate Transaction'}
            </button>
          </div>
        )}
      </Card>

      {evalError && (
        <Card className="p-5">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-400">{evalError}</p>
          </div>
        </Card>
      )}

      {evalResult && evalResult.transaction && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-white font-display mb-4">Evaluation Result</p>

          <div className="bg-[#1A2332] rounded-xl border border-[#1E2D45] p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DEMO
              </div>
              <span className="font-mono text-xs text-[#3B82F6]">{evalResult.transaction.id}</span>
              <span className="text-[10px] text-gray-500">Source: Demo</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-gray-500">Amount</p>
                <p className="text-sm font-bold font-mono text-white">{fmtFull(evalResult.transaction.amount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Payment Method</p>
                <p className="text-xs text-white">{evalResult.transaction.paymentMethod}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Failure Reason</p>
                <p className="text-xs text-white">{evalResult.transaction.failureReason}</p>
              </div>
            </div>
          </div>

          {evalResult.diagnosis && (
            <div className="bg-[#1A2332] rounded-xl border border-[#1E2D45] p-4 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">AI Diagnosis</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Risk Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#1E2D45] rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${evalResult.diagnosis.riskScore}%`,
                          background: evalResult.diagnosis.riskScore >= 70 ? '#EF4444' : evalResult.diagnosis.riskScore >= 40 ? '#F59E0B' : '#10B981'
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white">{evalResult.diagnosis.riskScore}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Recoverability</p>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#1E2D45] rounded-full">
                      <div
                        className="h-full rounded-full bg-[#2563EB]"
                        style={{ width: `${evalResult.diagnosis.recoverability}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white">{evalResult.diagnosis.recoverability}%</span>
                  </div>
                </div>
              </div>
              <div className="mb-2">
                <p className="text-[10px] text-gray-500">Problem</p>
                <p className="text-xs text-red-400">{evalResult.diagnosis.problem}</p>
              </div>
              <div className="mb-2">
                <p className="text-[10px] text-gray-500">Root Cause</p>
                <p className="text-xs text-white">{evalResult.diagnosis.rootCause}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Confidence</p>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {evalResult.diagnosis.confidence}%
                </span>
              </div>
            </div>
          )}

          {evalResult.decision && (
            <div className="bg-[#1A2332] rounded-xl border border-[#1E2D45] p-4 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">AI Recovery Decision</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Recommended Action</p>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#2563EB]/10 text-[#3B82F6] border border-[#2563EB]/20">
                    {evalResult.decision.action}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Initial Action</p>
                  <span className="text-xs text-gray-400">{evalResult.decision.initialAction}</span>
                </div>
              </div>
              <div className="mb-2">
                <p className="text-[10px] text-gray-500">Reason</p>
                <p className="text-xs text-white">{evalResult.decision.reason}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Requires Approval</p>
                <span className={`text-xs ${evalResult.decision.requiresApproval ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {evalResult.decision.requiresApproval ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          )}

          {evalResult.diagnosis?.mlPrediction?.mlAvailable && (
            <div className="bg-[#1A2332] rounded-xl border border-[#7C3AED]/30 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded bg-[#7C3AED]/20 flex items-center justify-center">
                  <span className="text-[10px] text-[#A78BFA]">ML</span>
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">ML Model Prediction</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-[10px] text-gray-500">Recoverability</p>
                  <p className={`text-xs font-medium ${evalResult.diagnosis.mlPrediction.recoverability?.prediction === 'recoverable' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {evalResult.diagnosis.mlPrediction.recoverability?.prediction === 'recoverable' ? 'Recoverable' : 'Not Recoverable'}
                  </p>
                  <p className="text-[10px] text-gray-400">{evalResult.diagnosis.mlPrediction.recoverability?.probability ? (evalResult.diagnosis.mlPrediction.recoverability.probability * 100).toFixed(1) : 0}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Risk Score (ML)</p>
                  <p className="text-xs font-medium text-white">{evalResult.diagnosis.mlPrediction.riskScore?.prediction}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">ML Action</p>
                  <p className="text-xs font-medium text-[#A78BFA]">{evalResult.diagnosis.mlPrediction.action?.prediction}</p>
                  <p className="text-[10px] text-gray-400">{evalResult.diagnosis.mlPrediction.action?.confidence ? (evalResult.diagnosis.mlPrediction.action.confidence * 100).toFixed(1) : 0}% conf</p>
                </div>
              </div>
              {evalResult.diagnosis.mlPrediction.reasoning && evalResult.diagnosis.mlPrediction.reasoning.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Reasoning</p>
                  <div className="space-y-1">
                    {evalResult.diagnosis.mlPrediction.reasoning.map((r, i) => (
                      <p key={i} className="text-[10px] text-gray-400">• {r}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-400 text-sm">✓</span>
              <span className="text-xs text-emerald-400 font-medium">Transaction stored</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-400 text-sm">✓</span>
              <span className="text-xs text-emerald-400 font-medium">AI diagnosis completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm">✓</span>
              <span className="text-xs text-emerald-400 font-medium">Recovery decision completed</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Status: Autonomous agent triggered</p>
          </div>
        </Card>
      )}

      {agentRun && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Autonomous Agent Pipeline</p>
              <p className="text-[10px] text-gray-500 font-mono">{agentRun.agentRunId}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
              agentRun.status === 'COMPLETED' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
              agentRun.status === 'RUNNING' ? 'text-[#3B82F6] bg-[#2563EB]/10 border-[#2563EB]/30' :
              agentRun.status === 'BLOCKED' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
              agentRun.status === 'HUMAN_APPROVAL_REQUIRED' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
              'text-red-400 bg-red-500/10 border-red-500/30'
            }`}>
              {agentRun.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4">
            {(['detect', 'diagnose', 'decide', 'policy', 'execute', 'recover', 'audit'] as const).map((stage, i) => {
              const stageData = agentRun.stages?.[stage];
              const stageStatus = stageData?.status || 'PENDING';
              return (
                <div key={stage} className="flex items-center flex-1">
                  <div className={`flex-1 border rounded-lg px-2 py-2 text-center ${
                    stageStatus === 'COMPLETED' ? 'border-emerald-500/40 bg-emerald-500/10' :
                    stageStatus === 'RUNNING' ? 'border-[#3B82F6]/40 bg-[#2563EB]/10' :
                    stageStatus === 'BLOCKED' || stageStatus === 'APPROVAL_REQUIRED' ? 'border-amber-500/40 bg-amber-500/10' :
                    stageStatus === 'FAILED' ? 'border-red-500/40 bg-red-500/10' :
                    'border-[#1E2D45] bg-[#1A2332]'
                  }`}>
                    <div className="flex items-center justify-center gap-1">
                      {stageStatus === 'COMPLETED' ? <span className="text-emerald-400">&#10003;</span> :
                       stageStatus === 'RUNNING' ? <span className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin inline-block" /> :
                       stageStatus === 'BLOCKED' || stageStatus === 'APPROVAL_REQUIRED' ? <span className="text-amber-400">&#9888;</span> :
                       stageStatus === 'FAILED' ? <span className="text-red-400">&#10007;</span> :
                       <span className="w-2 h-2 rounded-full bg-gray-600 inline-block" />}
                      <span className={`text-[10px] font-semibold capitalize ${stageStatus === 'COMPLETED' ? 'text-emerald-400' : stageStatus === 'RUNNING' ? 'text-[#3B82F6]' : stageStatus === 'FAILED' ? 'text-red-400' : 'text-gray-500'}`}>
                        {stage}
                      </span>
                    </div>
                  </div>
                  {i < 6 && <div className="w-2 flex-shrink-0"><div className="w-full h-px bg-[#1E2D45]" /></div>}
                </div>
              );
            })}
          </div>

          {agentPolling && (
            <div className="flex items-center gap-2 mb-3 text-[11px] text-[#3B82F6]">
              <span className="w-3 h-3 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
              Agent pipeline running...
            </div>
          )}

          {agentRun.stages?.execute?.result && (
            <div className="bg-[#1A2332] rounded-lg border border-[#1E2D45] p-3 mb-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Execution Result</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">Action</p>
                  <p className="text-xs text-white">{(agentRun.stages.execute.result as any)?.action || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Status</p>
                  <p className={`text-xs ${(agentRun.stages.execute.result as any)?.executed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {(agentRun.stages.execute.result as any)?.status || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Provider</p>
                  <p className="text-xs text-gray-400">{(agentRun.stages.execute.result as any)?.provider || '-'}</p>
                </div>
              </div>
              {(agentRun.stages.execute.result as any)?.shortUrl && (
                <div className="mt-2">
                  <p className="text-[10px] text-gray-500">Payment Link</p>
                  <a href={(agentRun.stages.execute.result as any).shortUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#3B82F6] hover:underline break-all">
                    {(agentRun.stages.execute.result as any).shortUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {agentRun.stages?.policy?.result && (
            <div className="bg-[#1A2332] rounded-lg border border-[#1E2D45] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Policy Check</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">Result</p>
                  <p className={`text-xs ${(agentRun.stages.policy.result as any)?.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {(agentRun.stages.policy.result as any)?.passed ? 'APPROVED' : 'BLOCKED'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Allowed Action</p>
                  <p className="text-xs text-white">{(agentRun.stages.policy.result as any)?.allowedAction || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function MerchantsView() {
  const mi = useApiData(fetchMerchantIntelligence);
  const intelligence = mi.data?.data;

  if (mi.loading) return <LoadingSpinner />;
  if (mi.error) return <ErrorMessage message={mi.error} onRetry={mi.retry} />;

  const overview = intelligence?.overview;
  const failureReasons = intelligence?.failureReasons || [];
  const paymentMethods = intelligence?.paymentMethods || [];
  const customerSegments = intelligence?.customerSegments || [];
  const recoveryActions = intelligence?.recoveryActions || [];
  const sourceLabel = intelligence?.source === 'razorpay_test + demo' ? 'Current Test Activity'
    : intelligence?.source === 'razorpay_test' ? 'Razorpay Test Mode'
    : intelligence?.source === 'demo' ? 'Demo Activity'
    : 'No Recent Activity';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{sourceLabel}</p>
      </div>

      {overview ? (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Money at Risk" value={fmt(overview.moneyAtRisk)} sub={`${overview.atRiskCount} active cases`} />
          <StatCard label="Recovered" value={fmt(overview.recoveredAmount)} sub={`${overview.successfulRecoveries} successful`} accent />
          <StatCard label="Active Recovery" value={String(overview.activeRecoveryCases)} sub="Awaiting action" />
          <StatCard label="Recovery Rate" value={`${overview.recoveryRate}%`} sub="Recovered / At Risk" />
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-gray-400">No recent merchant activity</p>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-4">Failure Reasons</p>
          <div className="space-y-3">
            {failureReasons.slice(0, 5).map((fr) => (
              <div key={fr.reason} className="p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-white">{fr.reason}</p>
                  <span className="text-[10px] font-mono text-gray-400">{fr.percentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{fr.count} cases</span>
                  <span className="text-xs font-mono text-white">{fmt(fr.totalAmount)}</span>
                </div>
                <div className="w-full h-1 bg-[#1E2D45] rounded-full mt-2">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${fr.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-4">Payment Methods</p>
          <div className="space-y-3">
            {paymentMethods.slice(0, 5).map((pm) => (
              <div key={pm.method} className="p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-white">{pm.method}</p>
                  <span className="text-[10px] font-mono text-gray-400">{pm.avgRecoverability}% recov.</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{pm.failedCount} failures</span>
                  <span className="text-xs font-mono text-white">{fmt(pm.atRiskAmount)}</span>
                </div>
                <div className="w-full h-1 bg-[#1E2D45] rounded-full mt-2">
                  <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${pm.avgRecoverability}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-4">Customer Segments</p>
          <div className="space-y-3">
            {customerSegments.slice(0, 5).map((cs) => (
              <div key={cs.segment} className="p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-white">{cs.segment}</p>
                  <span className="text-[10px] font-mono text-gray-400">{cs.avgRecoverability}% recov.</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{cs.count} cases</span>
                  <span className="text-xs font-mono text-white">{fmt(cs.atRiskAmount)}</span>
                </div>
                <div className="w-full h-1 bg-[#1E2D45] rounded-full mt-2">
                  <div className="h-full bg-[#A78BFA] rounded-full" style={{ width: `${cs.avgRecoverability}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {recoveryActions.length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-4">Recovery Action Performance</p>
          <div className="grid grid-cols-4 gap-3">
            {recoveryActions.map((ra) => (
              <div key={ra.action} className="p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45]">
                <p className="text-xs font-medium text-white mb-2">{ra.action}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Recommended</span>
                    <span className="text-white font-mono">{ra.recommended}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Executed</span>
                    <span className="text-emerald-400 font-mono">{ra.executed}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Blocked</span>
                    <span className="text-amber-400 font-mono">{ra.blocked}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Unsupported</span>
                    <span className="text-gray-400 font-mono">{ra.unsupported}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

const viewTitles: Record<NavItem, { title: string; sub: string }> = {
  dashboard: { title: "Revenue Recovery Dashboard", sub: "Overview of payment failures, recoveries, and AI agent activity" },
  leakage: { title: "Revenue Leakage Monitor", sub: "All failed transactions with risk scoring and filters" },
  diagnosis: { title: "AI Diagnosis", sub: "Root cause analysis and recommended recovery actions per transaction" },
  actions: { title: "Recovery Actions", sub: "Dispatched and pending recovery interventions" },
  agent: { title: "Agent Control Center", sub: "Live workflow monitoring and real-time decision logs" },
  guardrails: { title: "Guardrails & Policy Engine", sub: "Retry limits, escalation rules, and blocked actions" },
  audit: { title: "Audit Trail", sub: "Complete log of AI decisions, policy checks, and outcomes" },
  analytics: { title: "Analytics & Insights", sub: "Performance metrics, recovery trends, and intervention stats" },
  merchants: { title: "Merchant View", sub: "Per-merchant recovery metrics and active case counts" },
  integration: { title: "Razorpay Integration", sub: "Connect and sync transactions from Razorpay Test Mode" },
};

export default function App() {
  const [view, setView] = useState<NavItem>("dashboard");
  const [dateRange, setDateRange] = useState("7");
  const [searchQuery, setSearchQuery] = useState("");
  const [leakageCount, setLeakageCount] = useState(0);
  const [actionsCount, setActionsCount] = useState(0);
  const meta = viewTitles[view];

  useEffect(() => {
    fetchLeakage().then((res) => setLeakageCount(res.count || 0)).catch(() => {});
    fetchRecoveryActions().then((res) => setActionsCount(res.count || 0)).catch(() => {});
  }, []);

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView onNavigate={setView} dateRange={dateRange} />;
      case "leakage": return <LeakageView onNavigate={setView} dateRange={dateRange} />;
      case "diagnosis": return <DiagnosisView searchQuery={searchQuery} />;
      case "actions": return <ActionsView />;
      case "agent": return <AgentView />;
      case "guardrails": return <GuardrailsView onNavigate={setView} />;
      case "audit": return <AuditView />;
      case "analytics": return <AnalyticsView dateRange={dateRange} />;
      case "merchants": return <MerchantsView />;
      case "integration": return <IntegrationView />;
    }
  };

  return (
    <div className="flex h-full bg-[#0B1120] overflow-hidden">
      <Sidebar
        active={view}
        onNav={setView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => { setView("diagnosis"); }}
        badgeCounts={{ leakage: leakageCount, actions: actionsCount }}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={meta.title} sub={meta.sub} dateRange={dateRange} onDateRangeChange={setDateRange} />
        <main className="flex-1 overflow-y-auto p-5">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
