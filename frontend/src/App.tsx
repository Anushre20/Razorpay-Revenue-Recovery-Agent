import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from "recharts";
import {
  type Transaction, type LeakageTransaction, type LeakageSummary,
  type Diagnosis, type RecoveryAction as RecoveryActionType, type AgentLog,
  type AuditLog, type AuditGuardrail, type AnalyticsSummary,
  type DashboardData, type Merchant,
  fetchTransactions, fetchLeakage, fetchDiagnosis, fetchRecoveryActions,
  fetchAgentLogs, fetchAuditTrail, fetchAuditGuardrails, fetchAnalytics,
  fetchDashboard, fetchMerchants
} from "./api";


type NavItem = "dashboard" | "leakage" | "diagnosis" | "actions" | "agent" | "guardrails" | "audit" | "analytics" | "merchants";

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
};

const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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
];

function Sidebar({ active, onNav }: { active: NavItem; onNav: (n: NavItem) => void }) {
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
            {item.id === "leakage" && (
              <span className="ml-auto bg-red-500/20 text-red-400 text-[9px] font-mono px-1.5 py-0.5 rounded">12</span>
            )}
            {item.id === "actions" && (
              <span className="ml-auto bg-amber-500/20 text-amber-400 text-[9px] font-mono px-1.5 py-0.5 rounded">4</span>
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

function TopBar({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="h-14 bg-[#090E1A]/80 backdrop-blur-sm border-b border-[#1E2D45] flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h1 className="text-sm font-semibold font-display text-white">{title}</h1>
        <p className="text-[10px] text-gray-500">{sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <select className="bg-[#111827] border border-[#1E2D45] text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#2563EB]">
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>Today</option>
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

function DashboardView() {
  const dashboard = useApiData(fetchDashboard);
  const leakage = useApiData(fetchLeakage);
  const dashboardData = dashboard.data?.data;
  const leakageTxns = leakage.data?.data || [];
  const leakageSummary = leakage.data?.summary;

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
          <span className="text-[10px] text-[#3B82F6] cursor-pointer hover:text-blue-300">View all →</span>
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
              <tr key={t.id} className="table-row-hover border-b border-[#1E2D45]/50 cursor-pointer">
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
    </div>
  );
}

function LeakageView() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const categories = ["All", "Failed Payment", "Abandoned Checkout", "Subscription Failure"];

  const { data, loading, error, retry } = useApiData(fetchLeakage);
  const allTxns = data?.data || [];
  const summary = data?.summary;

  const filtered = allTxns.filter((t) => {
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
  if (error) return <ErrorMessage message={error} onRetry={retry} />;

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
                <tr key={t.id} className="table-row-hover border-b border-[#1E2D45]/40 cursor-pointer group">
                  <td className="py-3 font-mono text-[11px] text-[#3B82F6] group-hover:text-blue-300">{t.id}</td>
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

function DiagnosisView() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data: txnData, loading: txnLoading, error: txnError, retry: txnRetry } = useApiData(fetchTransactions);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const allTxns = txnData?.data || [];
  const displayTxns = allTxns.slice(0, 20);

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

  const txn = selected ? allTxns.find((t) => t.id === selected) : null;

  if (txnLoading) return <LoadingSpinner />;
  if (txnError) return <ErrorMessage message={txnError} onRetry={txnRetry} />;

  return (
    <div className="grid grid-cols-5 gap-4 h-full animate-fade-in">
      <div className="col-span-2 space-y-2">
        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Transaction</p>
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

  const executed = actions.filter(a => a.status === 'Executed').length;
  const pending = actions.filter(a => a.status === 'Pending' || a.status === 'Pending Approval').length;
  const stopped = actions.filter(a => a.status === 'Stopped' || a.status === 'Blocked').length;

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
              <button key={s} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[#1A2332] text-gray-400 border border-[#1E2D45] hover:text-white transition-colors">{s}</button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {actions.map((a) => (
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
                <div className="text-right ml-4">
                  <p className={`text-[11px] mt-1 font-medium ${a.result?.includes("RECOVERED") ? "text-emerald-400" : a.status === "Stopped" ? "text-red-400" : "text-gray-400"}`}>{a.result || 'Awaiting response'}</p>
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
  const { data: logsData, loading: logsLoading, error: logsError, retry: logsRetry } = useApiData(fetchAgentLogs);
  const { data: analyticsDataRes } = useApiData(fetchAnalytics);
  const logs = logsData?.data || [];
  const analytics = analyticsDataRes?.data;

  const [logCount, setLogCount] = useState(logs.length);

  useEffect(() => {
    const t = setInterval(() => {
      setLogCount((c) => Math.min(c + 1, logs.length + 3));
    }, 2000);
    return () => clearInterval(t);
  }, [logs.length]);

  const steps = [
    { id: "detect", label: "Detect", desc: "Signal ingestion", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
    { id: "diagnose", label: "Diagnose", desc: "Root cause AI", color: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/30" },
    { id: "decide", label: "Decide", desc: "Strategy select", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
    { id: "policy", label: "Policy Check", desc: "Guardrail verify", color: "text-cyan-400", bg: "bg-cyan-500/20 border-cyan-500/30" },
    { id: "execute", label: "Execute", desc: "Action dispatch", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
    { id: "recover", label: "Recover", desc: "Payment capture", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
    { id: "verify", label: "Verify", desc: "Outcome confirm", color: "text-teal-400", bg: "bg-teal-500/20 border-teal-500/30" },
  ];

  const stageColors: Record<string, string> = {
    Detect: "text-blue-400", Diagnose: "text-purple-400", Decide: "text-amber-400",
    Policy: "text-cyan-400", Execute: "text-emerald-400", Verify: "text-teal-400",
  };

  if (logsLoading) return <LoadingSpinner />;
  if (logsError) return <ErrorMessage message={logsError} onRetry={logsRetry} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold font-display text-white">Agent Workflow</p>
            <p className="text-xs text-gray-500">Automated recovery pipeline · 7 stages</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
            <span className="text-xs text-emerald-400 font-mono font-medium">Running</span>
          </div>
        </div>
        <div className="flex items-start gap-0">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-full border rounded-xl px-3 py-3 text-center ${step.bg} border-current/30 relative`}>
                  <p className={`text-xs font-bold font-display ${step.color}`}>{step.label}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{step.desc}</p>
                  {i < 3 && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse-dot border-2 border-[#111827]" />
                  )}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="w-4 flex-shrink-0 flex items-center justify-center mt-[-8px]">
                  <div className="w-full h-px bg-[#1E2D45]" />
                  <span className="absolute text-[#1E2D45] text-xs">›</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Processed Today" value={String(analytics?.successfulInterventions || logs.length)} sub="Transactions analyzed" />
        <StatCard label="Actions Dispatched" value={String(analytics?.successfulInterventions || 0)} sub="Across all channels" accent />
        <StatCard label="Avg Decision Time" value="1.3s" sub="Per transaction" />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold font-display text-white">Live Agent Logs</p>
            <p className="text-xs text-gray-500">Real-time decision stream</p>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-dot" />
            <span className="text-[10px] text-blue-400 font-mono">LIVE</span>
          </div>
        </div>
        <div className="bg-[#090E1A] rounded-xl border border-[#1E2D45] p-4 space-y-2 max-h-72 overflow-y-auto font-mono">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-[11px] animate-slide-in">
              <span className="text-gray-600 flex-shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
              <span className={`flex-shrink-0 font-bold w-16 ${stageColors[log.stage] || "text-gray-400"}`}>[{log.stage?.toUpperCase()}]</span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          {logCount > logs.length && (
            <div className="flex items-start gap-3 text-[11px]">
              <span className="text-gray-600">{new Date().toLocaleTimeString()}</span>
              <span className="text-blue-400 font-bold w-16">[DETECT]</span>
              <span className="text-gray-300">Processing batch: high-risk transactions queued...</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="w-2 h-4 bg-[#2563EB] animate-pulse-dot inline-block rounded-sm" />
          </div>
        </div>
      </Card>
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

  const aiDecisions = logs.filter(l => l.eventType === 'AI_DECISION').length;
  const policyPasses = logs.filter(l => l.eventType === 'POLICY_CHECK' && l.status === 'PASSED').length;
  const escalations = logs.filter(l => l.eventType === 'AI_DECISION' && l.action === 'Human Escalation').length;

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
          <button className="px-3 py-1.5 bg-[#1A2332] border border-[#1E2D45] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            Export CSV
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-gray-500 py-8 text-center">No audit records yet. Trigger recovery decisions to generate audit logs.</p>
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
                {logs.map((log) => (
                  <tr key={log.auditId} className="table-row-hover border-b border-[#1E2D45]/40">
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

function AnalyticsView() {
  const { data, loading, error, retry } = useApiData(fetchAnalytics);
  const analytics = data?.data;
  const { data: txnData, loading: txnLoading } = useApiData(fetchTransactions);
  const txns = txnData?.data || [];

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
          <Card key={m.id} className="p-5 cursor-pointer">
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
};

export default function App() {
  const [view, setView] = useState<NavItem>("dashboard");
  const meta = viewTitles[view];

  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "leakage": return <LeakageView />;
      case "diagnosis": return <DiagnosisView />;
      case "actions": return <ActionsView />;
      case "agent": return <AgentView />;
      case "guardrails": return <GuardrailsView />;
      case "audit": return <AuditView />;
      case "analytics": return <AnalyticsView />;
      case "merchants": return <MerchantsView />;
    }
  };

  return (
    <div className="flex h-full bg-[#0B1120] overflow-hidden">
      <Sidebar active={view} onNav={setView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={meta.title} sub={meta.sub} />
        <main className="flex-1 overflow-y-auto p-5">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
