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
  fetchAgentStats, approveAgentRun, rejectAgentRun
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
            <p className="text-xs font-medium text-white truncate">Aryan Kapoor</p>
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
  const dashboard = useApiData(fetchDashboard);
  const leakage = useApiData(fetchLeakage);
  const agentStatsRes = useApiData(fetchAgentStats);
  const agentRunsRes = useApiData(fetchAgentRuns);
  const dashboardData = dashboard.data?.data;
  const allLeakageTxns = leakage.data?.data || [];
  const leakageTxns = filterByDateRange(allLeakageTxns, Number(dateRange));
  const leakageSummary = leakage.data?.summary;
  const agentStats = agentStatsRes.data?.data;
  const agentRuns = agentRunsRes.data?.data || [];

  if (dashboard.loading || leakage.loading) return <LoadingSpinner />;
  if (dashboard.error || leakage.error) return <ErrorMessage message={dashboard.error || leakage.error || ''} onRetry={() => { dashboard.retry(); leakage.retry(); }} />;

  const typeCounts = { failed: 0, abandoned: 0, subscription: 0 };
  const typeAmounts = { failed: 0, abandoned: 0, subscription: 0 };
  leakageTxns.forEach((t) => {
    if (t.type === 'Failed Payment') { typeCounts.failed++; typeAmounts.failed += t.amount; }
    else if (t.type === 'Abandoned Checkout') { typeCounts.abandoned++; typeAmounts.abandoned += t.amount; }
    else if (t.type === 'Subscription Failure') { typeCounts.subscription++; typeAmounts.subscription += t.amount; }
  });
  const totalLeakage = typeAmounts.failed + typeAmounts.abandoned + typeAmounts.subscription || 1;

  const failedPct = Math.round((typeAmounts.failed / totalLeakage) * 100);
  const abandonedPct = Math.round((typeAmounts.abandoned / totalLeakage) * 100);
  const subscriptionPct = Math.round((typeAmounts.subscription / totalLeakage) * 100);

  const leakageTypeData = [
    { name: "Failed Payments", value: typeAmounts.failed, fill: "#2563EB" },
    { name: "Abandoned Checkouts", value: typeAmounts.abandoned, fill: "#7C3AED" },
    { name: "Subscription Failures", value: typeAmounts.subscription, fill: "#0EA5E9" },
  ];

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
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="At Risk Today" value={fmt(dashboardData?.totalAtRisk || 0)} sub={`${leakageSummary?.totalCases || 0} transactions`} delta="+4.2%" />
        <StatCard label="Recovered Today" value={fmt(dashboardData?.totalRecovered || 0)} sub={`${dashboardData?.activeCases || 0} active`} accent delta="+7.8%" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Failed Payments</p>
            <StatusBadge status="At Risk" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">{fmt(typeAmounts.failed)}</p>
          <p className="text-xs text-gray-500 mb-3">{typeCounts.failed} transactions · Avg {fmt(typeCounts.failed ? Math.round(typeAmounts.failed / typeCounts.failed) : 0)}</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${failedPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">{failedPct}% of today's leakage</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Abandoned Checkouts</p>
            <StatusBadge status="In Recovery" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">{fmt(typeAmounts.abandoned)}</p>
          <p className="text-xs text-gray-500 mb-3">{typeCounts.abandoned} sessions · Avg {fmt(typeCounts.abandoned ? Math.round(typeAmounts.abandoned / typeCounts.abandoned) : 0)}</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${abandonedPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">{abandonedPct}% of today's leakage</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Subscription Failures</p>
            <StatusBadge status="At Risk" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">{fmt(typeAmounts.subscription)}</p>
          <p className="text-xs text-gray-500 mb-3">{typeCounts.subscription} renewals · Avg {fmt(typeCounts.subscription ? Math.round(typeAmounts.subscription / typeCounts.subscription) : 0)}</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${subscriptionPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">{subscriptionPct}% of today's leakage</p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold font-display text-white">Recovery Performance</p>
              <p className="text-xs text-gray-500">7-day at-risk vs recovered</p>
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
          <p className="text-xs text-gray-500 mb-4">Distribution this week</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={leakageTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {leakageTypeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "#1A2332", border: "1px solid #1E2D45", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {leakageTypeData.map((d) => (
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

      {agentStats && agentStats.total > 0 && (
        <>
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Agent Runs" value={String(agentStats.total)} sub="Total autonomous runs" />
            <StatCard label="Completed" value={String(agentStats.completed)} sub="Successfully finished" accent />
            <StatCard label="Running" value={String(agentStats.running)} sub="In progress" />
            <StatCard label="Awaiting Approval" value={String(agentStats.humanApproval)} sub="Needs review" />
            <StatCard label="Failed/Blocked" value={String(agentStats.failed + agentStats.blocked + agentStats.executionFailed)} sub="Requires attention" />
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold font-display text-white">Recent Agent Activity</p>
                <p className="text-xs text-gray-500">Autonomous recovery pipeline runs</p>
              </div>
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
        </>
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
        <StatCard label="Total At Risk" value={fmt(summary?.totalAtRisk || 0)} sub={`${summary?.totalCases || allTxns.length} transactions`} />
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

          <div className="space-y-2">
            {stageConfig.map(step => {
              const stage = selectedRun.stages?.[step.key as keyof typeof selectedRun.stages];
              if (!stage || (!stage.result && !stage.error)) return null;
              return (
                <details key={step.key} className="group">
                  <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-2">
                    <span className="group-open:rotate-90 transition-transform text-[10px]">&#9654;</span>
                    {step.label}
                    <span className={`text-[9px] font-mono ${stage.status === 'COMPLETED' ? 'text-emerald-400' : stage.status === 'BLOCKED' || stage.status === 'APPROVAL_REQUIRED' ? 'text-amber-400' : stage.status === 'FAILED' ? 'text-red-400' : 'text-gray-500'}`}>
                      {stage.status}
                    </span>
                  </summary>
                  {stage.error && <p className="text-[10px] text-red-400 mt-1">{stage.error}</p>}
                  {stage.result && (
                    <pre className="mt-2 p-3 bg-[#090E1A] rounded-lg border border-[#1E2D45] text-[10px] text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(stage.result, null, 2)}
                    </pre>
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

function GuardrailsView() {
  const { data: guardrailsData, loading: gLoading, error: gError, retry: gRetry } = useApiData(fetchAuditGuardrails);
  const { data: auditData } = useApiData(fetchAuditTrail);

  const guardrailRules = guardrailsData?.data || [];
  const auditLogs = auditData?.data || [];
  const blockedLogs = auditLogs.filter(l => l.eventType === 'POLICY_CHECK' && l.status === 'BLOCKED');

  const categories = [...new Set(guardrailRules.map((g) => g.name.split(' ')[0]))];

  if (gLoading) return <LoadingSpinner />;
  if (gError) return <ErrorMessage message={gError} onRetry={gRetry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Rules" value={String(guardrailRules.length)} sub="All guardrails armed" />
        <StatCard label="Triggered Today" value={String(auditLogs.filter(l => l.eventType === 'POLICY_CHECK').length)} sub="Rule enforcement events" />
        <StatCard label="Blocked Actions" value={String(blockedLogs.length)} sub="Prevented by policy" />
        <StatCard label="Escalations" value={String(auditLogs.filter(l => l.eventType === 'AI_DECISION' && l.action === 'Human Escalation').length)} sub="Sent to human review" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {guardrailRules.map((g) => (
          <Card key={g.id} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-300 font-display">{g.name}</p>
              <StatusBadge status={g.status} />
            </div>
            <p className="text-[11px] text-gray-200 leading-relaxed mb-2">{g.description}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-gray-500">{g.id}</span>
              <span className="text-[10px] text-amber-400 font-mono">Limit: {g.limit.toLocaleString()}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold font-display text-white mb-4">Blocked Actions Today</p>
        {blockedLogs.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">No blocked actions recorded yet. Trigger guardrail checks to see blocked actions here.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                <th className="text-left pb-2.5">Audit ID</th>
                <th className="text-left pb-2.5">Timestamp</th>
                <th className="text-left pb-2.5">TXN ID</th>
                <th className="text-left pb-2.5">Blocked Action</th>
                <th className="text-left pb-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {blockedLogs.map((b) => (
                <tr key={b.auditId} className="table-row-hover border-b border-[#1E2D45]/40">
                  <td className="py-3 font-mono text-[11px] text-[#3B82F6]">{b.auditId}</td>
                  <td className="py-3 font-mono text-[10px] text-gray-500">{b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</td>
                  <td className="py-3 font-mono text-[11px] text-gray-400">{b.transactionId}</td>
                  <td className="py-3 text-xs text-gray-200">{b.action}</td>
                  <td className="py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function AuditView() {
  const { data, loading, error, retry } = useApiData(fetchAuditTrail);
  const logs = data?.data || [];
  const [search, setSearch] = useState("");

  const filtered = search
    ? logs.filter((l) => l.transactionId.toLowerCase().includes(search.toLowerCase()) || l.auditId.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const aiDecisions = logs.filter(l => l.eventType === 'AI_DECISION').length;
  const policyPasses = logs.filter(l => l.eventType === 'POLICY_CHECK' && l.status === 'PASSED').length;
  const escalations = logs.filter(l => l.eventType === 'AI_DECISION' && l.action === 'Human Escalation').length;

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Audit ID", "Timestamp", "TXN ID", "Event Type", "Action", "Status", "Details"];
    const rows = filtered.map((l) => {
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold font-display text-white">Audit Trail</p>
            <p className="text-xs text-gray-500">Complete AI decision log with policy checks</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#1A2332] border border-[#1E2D45] rounded-lg px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#2563EB] w-52"
              placeholder="Search by TXN or Audit ID..."
            />
            <button onClick={handleExportCsv} className="px-3 py-1.5 bg-[#1A2332] border border-[#1E2D45] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
              Export CSV
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 py-8 text-center">No audit records yet. Trigger recovery decisions to generate audit logs.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500 py-8 text-center">No records match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                  <th className="text-left pb-2.5">Audit ID</th>
                  <th className="text-left pb-2.5">Timestamp</th>
                  <th className="text-left pb-2.5">TXN ID</th>
                  <th className="text-left pb-2.5">Event Type</th>
                  <th className="text-left pb-2.5">Action</th>
                  <th className="text-left pb-2.5">Status</th>
                  <th className="text-left pb-2.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.auditId} onClick={() => setSearch(log.transactionId)} className="table-row-hover border-b border-[#1E2D45]/40 cursor-pointer">
                    <td className="py-3 font-mono text-[11px] text-[#3B82F6]">{log.auditId}</td>
                    <td className="py-3 font-mono text-[10px] text-gray-500">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</td>
                    <td className="py-3 font-mono text-[11px] text-gray-400">{log.transactionId}</td>
                    <td className="py-3 text-[11px] text-gray-200">{log.eventType}</td>
                    <td className="py-3 text-[11px] text-gray-200">{log.action}</td>
                    <td className="py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-3 text-[10px] text-gray-400 max-w-[200px] truncate">
                      {log.eventType === 'AI_DECISION' && (log.details as Record<string, unknown>)?.reason ? String((log.details as Record<string, unknown>).reason) :
                       log.eventType === 'POLICY_CHECK' && (log.details as Record<string, unknown>)?.passed !== undefined ? ((log.details as Record<string, unknown>).passed ? 'Passed' : 'Blocked') :
                       log.eventType === 'ACTION_RESULT' && (log.details as Record<string, unknown>)?.executed !== undefined ? ((log.details as Record<string, unknown>).executed ? 'Executed' : 'Failed') :
                       log.eventType === 'SIMULATION_RESULT' && (log.details as Record<string, unknown>)?.succeeded !== undefined ? ((log.details as Record<string, unknown>).succeeded ? 'Success' : 'Failed') :
                       '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AnalyticsView({ dateRange }: { dateRange: string }) {
  const { data, loading, error, retry } = useApiData(fetchAnalytics);
  const analytics = data?.data;
  const { data: txnData, loading: txnLoading } = useApiData(fetchTransactions);
  const txns = filterByDateRange(txnData?.data || [], Number(dateRange));
  const { data: evalData, loading: evalLoading } = useApiData(fetchEvaluation);
  const evaluation = evalData?.data;
  const { data: mlData, loading: mlLoading } = useApiData(fetchMLMetrics);
  const mlMetrics = mlData?.data;

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
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Money At Risk" value={fmt(analytics?.totalAtRisk || 0)} sub="This week" delta="+4.2%" />
        <StatCard label="Money Recovered" value={fmt(analytics?.totalRecovered || 0)} sub="This week" delta="+7.8%" accent />
        <StatCard label="Recovery Rate" value={`${analytics?.recoveryRate || 0}%`} sub="Industry avg: 45%" delta="+3.3%" />
        <StatCard label="Unnecessary Actions" value={analytics?.unnecessaryActions ? `${analytics.unnecessaryActions}` : '0'} sub="False positive actions" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-1">Weekly At-Risk vs Recovered</p>
          <p className="text-xs text-gray-500 mb-4">Daily comparison this week</p>
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
          <p className="text-xs text-gray-500 mb-4">Success rate by recovery type</p>
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
        <p className="text-sm font-semibold font-display text-white mb-1">Successful Interventions</p>
        <p className="text-xs text-gray-500 mb-4">{analytics?.successfulInterventions || 0} total interventions this week</p>
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

      {evalLoading ? (
        <Card className="p-5"><LoadingSpinner /></Card>
      ) : evaluation ? (
        <>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#2563EB]/20 flex items-center justify-center">
                <span className="text-sm">&#128202;</span>
              </div>
              <div>
                <p className="text-sm font-semibold font-display text-white">AI Evaluation</p>
                <p className="text-[10px] text-gray-500 font-mono">{evaluation.totalDecisions} decisions evaluated across {evaluation.totalTransactions} transactions</p>
              </div>
            </div>
          </Card>

          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Business Outcome</p>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total At Risk" value={fmt(evaluation.totalAtRisk)} sub="Recoverable transactions" />
            <StatCard label="Total Recovered" value={fmt(evaluation.totalRecovered)} sub="Ground truth recovered" accent />
            <StatCard label="Recovery Rate" value={`${evaluation.recoveryRate}%`} sub="Recovered / At Risk" />
            <StatCard label="Transactions" value={String(evaluation.totalTransactions)} sub="Total evaluated" />
          </div>

          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">AI Decision Quality</p>
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Precision" value={`${evaluation.precision}%`} sub="TP / (TP + FP)" />
            <StatCard label="Recall" value={`${evaluation.recall}%`} sub="TP / (TP + FN)" accent />
            <StatCard label="F1 Score" value={`${evaluation.f1Score}%`} sub="Harmonic mean" />
            <StatCard label="False Positive Rate" value={`${evaluation.falsePositiveRate}%`} sub="FP / (FP + TN)" />
          </div>

          <div className="grid grid-cols-4 gap-4">
            <StatCard label="True Positives" value={String(evaluation.truePositives)} sub="Action + Recoverable" />
            <StatCard label="True Negatives" value={String(evaluation.trueNegatives)} sub="No Action + Not Recoverable" />
            <StatCard label="False Positives" value={String(evaluation.falsePositives)} sub="Action but Not Recoverable" />
            <StatCard label="False Negatives" value={String(evaluation.falseNegatives)} sub="No Action but Recoverable" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Correct Decisions" value={String(evaluation.correctDecisions)} sub="TP + TN" accent />
            <StatCard label="Action Accuracy" value={`${evaluation.actionAccuracy}%`} sub="AI action vs ground truth" />
            <StatCard label="Total Decisions" value={String(evaluation.totalDecisions)} sub="With comparable AI decisions" />
          </div>

          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">Operational Execution</p>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Blocked by Guardrails" value={String(evaluation.blockedByGuardrails)} sub="Policy prevented execution" />
            <StatCard label="Requires Approval" value={String(evaluation.requiresApprovalCount)} sub="High-value / policy flag" />
            <StatCard label="Action Breakdown" value={String(evaluation.actionMetrics.length)} sub="Unique AI actions used" />
          </div>

          <Card className="p-5">
            <p className="text-sm font-semibold font-display text-white mb-4">Action-Level Evaluation</p>
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
      ) : null}

      {mlMetrics?.loaded && (
        <>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono font-semibold">ML Model Performance</p>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Recoverability Accuracy" value={`${mlMetrics.recoverability?.accuracy ? (mlMetrics.recoverability.accuracy * 100).toFixed(1) : 0}%`} sub={`F1: ${mlMetrics.recoverability?.f1Score ? (mlMetrics.recoverability.f1Score * 100).toFixed(1) : 0}%`} />
            <StatCard label="Risk Score MAE" value={mlMetrics.riskScore?.mae?.toFixed(2) || '0'} sub={`R²: ${mlMetrics.riskScore?.r2Score?.toFixed(3) || '0'}`} accent />
            <StatCard label="Action Accuracy" value={`${mlMetrics.action?.accuracy ? (mlMetrics.action.accuracy * 100).toFixed(1) : 0}%`} sub={`Macro F1: ${mlMetrics.action?.macroF1 ? (mlMetrics.action.macroF1 * 100).toFixed(1) : 0}%`} />
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
  const { data, loading, error, retry } = useApiData(fetchMerchants);
  const merchantsList = data?.data || [];

  const merchantVisuals: Record<string, { logo: string; color: string; trend: string }> = {
    UrbanKart: { logo: "U", color: "#EF4444", trend: "+12%" },
    TechNova: { logo: "T", color: "#F59E0B", trend: "+8%" },
    StreamBox: { logo: "S", color: "#10B981", trend: "+15%" },
    "Zomato Foods Pvt Ltd": { logo: "Z", color: "#EF4444", trend: "+12%" },
    "Flipkart Internet": { logo: "F", color: "#F59E0B", trend: "+8%" },
    "Swiggy India": { logo: "S", color: "#10B981", trend: "+15%" },
    "Groww Invest": { logo: "G", color: "#6366F1", trend: "-3%" },
    "Byju's Learning": { logo: "B", color: "#EC4899", trend: "+22%" },
    "Nykaa Fashion": { logo: "N", color: "#F97316", trend: "+5%" },
  };

  const enriched = merchantsList.map(m => ({
    ...m,
    logo: merchantVisuals[m.name]?.logo || m.name[0],
    color: merchantVisuals[m.name]?.color || "#6366F1",
    trend: merchantVisuals[m.name]?.trend || "+0%",
  }));

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Merchants" value={String(enriched.length)} sub="With open cases" />
        <StatCard label="Total At Risk" value={fmt(enriched.reduce((s, m) => s + m.atRisk, 0))} sub="Across all merchants" />
        <StatCard label="Total Recovered" value={fmt(enriched.reduce((s, m) => s + m.recovered, 0))} sub="This week" accent />
        <StatCard label="Best Recovery" value={`${Math.max(...enriched.map(m => m.recoveryRate))}%`} sub={enriched.reduce((best, m) => m.recoveryRate > best.recoveryRate ? m : best, enriched[0])?.name || '—'} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {enriched.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm" style={{ background: m.color }}>
                {m.logo}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{m.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{m.activeCases} active cases</p>
              </div>
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${m.trend.startsWith("+") ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                {m.trend}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2.5 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">At Risk</p>
                <p className="text-sm font-bold font-mono text-red-400">{fmt(m.atRisk)}</p>
              </div>
              <div className="p-2.5 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Recovered</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{fmt(m.recovered)}</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-gray-500">Recovery Rate</span>
                <span className="text-white font-mono font-medium">{m.recoveryRate}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1E2D45] rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${m.recoveryRate}%`, background: m.color }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold font-display text-white mb-4">Merchant Performance Comparison</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={enriched} barCategoryGap="35%">
            <XAxis dataKey="name" tick={{ fill: "#4B5563", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.split(" ")[0]} />
            <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: any) => fmtFull(v)} contentStyle={{ background: "#1A2332", border: "1px solid #1E2D45", borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="atRisk" name="At Risk" fill="#EF444450" radius={[3, 3, 0, 0]} />
            <Bar dataKey="recovered" name="Recovered" fill="#2563EB" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
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
      case "guardrails": return <GuardrailsView />;
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
