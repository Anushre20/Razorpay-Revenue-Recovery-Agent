import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from "recharts";
import {
  failedTransactions, merchants, recoveryChartData, aiDiagnoses,
  recoveryActions, agentLogs, auditTrail, guardrails, blockedActions,
  analyticsData, recoveryTypeData
} from "./data/mockData";

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

function DashboardView() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="At Risk Today" value="₹18.7L" sub="186 transactions" delta="+4.2%" />
        <StatCard label="Recovered Today" value="₹11.5L" sub="114 transactions" delta="+7.8%" accent />
        <StatCard label="Recovery Rate" value="61.5%" sub="vs 58.2% benchmark" delta="+3.3%" />
        <StatCard label="Avg Recovery Time" value="47 min" sub="Median: 32 min" delta="-12%" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Failed Payments</p>
            <StatusBadge status="At Risk" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">₹7.8L</p>
          <p className="text-xs text-gray-500 mb-3">78 transactions · Avg ₹10K</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-red-500 rounded-full" style={{ width: "42%" }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">42% of today's leakage</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Abandoned Checkouts</p>
            <StatusBadge status="In Recovery" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">₹6.4L</p>
          <p className="text-xs text-gray-500 mb-3">53 sessions · Avg ₹12K</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: "34%" }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">34% of today's leakage</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Subscription Failures</p>
            <StatusBadge status="At Risk" />
          </div>
          <p className="text-xl font-bold font-display text-white mt-2">₹4.5L</p>
          <p className="text-xs text-gray-500 mb-3">55 renewals · Avg ₹8.2K</p>
          <div className="w-full h-1 bg-[#1E2D45] rounded-full">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: "24%" }} />
          </div>
          <p className="text-[10px] text-gray-600 mt-1">24% of today's leakage</p>
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
              <Pie data={recoveryTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {recoveryTypeData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: "#1A2332", border: "1px solid #1E2D45", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {recoveryTypeData.map((d) => (
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
            {failedTransactions.slice(0, 5).map((t) => (
              <tr key={t.id} className="table-row-hover border-b border-[#1E2D45]/50 cursor-pointer">
                <td className="py-2.5 font-mono text-[11px] text-[#3B82F6]">{t.id}</td>
                <td className="py-2.5 text-xs text-gray-200">{t.merchant}</td>
                <td className="py-2.5 font-mono text-xs text-white">{fmt(t.amount)}</td>
                <td className="py-2.5 text-[11px] text-gray-400">{t.failureReason}</td>
                <td className="py-2.5"><RiskBar score={t.riskScore} /></td>
                <td className="py-2.5"><StatusBadge status={t.status} /></td>
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
  const categories = ["All", "Failed Payment", "Abandoned Checkout", "Subscription"];

  const filtered = failedTransactions.filter((t) => {
    const matchCat = filter === "All" || t.category === filter;
    const matchSearch = t.merchant.toLowerCase().includes(search.toLowerCase()) ||
      t.customer.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total At Risk" value="₹18.7L" sub="186 transactions" />
        <StatCard label="High Risk (80+)" value="₹8.4L" sub="42 transactions" />
        <StatCard label="In Recovery" value="₹5.2L" sub="58 transactions" />
        <StatCard label="Avg Risk Score" value="68.4" sub="Across all open cases" />
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
                      {t.category}
                    </span>
                  </td>
                  <td className="py-3 text-[11px] text-gray-400">{t.failureReason}</td>
                  <td className="py-3"><RiskBar score={t.riskScore} /></td>
                  <td className="py-3"><StatusBadge status={t.status} /></td>
                  <td className="py-3 text-[10px] text-gray-500 font-mono">{t.time}</td>
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
  const [selected, setSelected] = useState<string | null>("TXN-2847361");
  const diagnosableTxns = failedTransactions.filter((t) => aiDiagnoses[t.id]);
  const diag = selected ? aiDiagnoses[selected] : null;
  const txn = selected ? failedTransactions.find((t) => t.id === selected) : null;

  return (
    <div className="grid grid-cols-5 gap-4 h-full animate-fade-in">
      <div className="col-span-2 space-y-2">
        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Transaction</p>
          <div className="space-y-2">
            {diagnosableTxns.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${selected === t.id ? "bg-[#2563EB]/10 border-[#2563EB]/40" : "bg-[#1A2332] border-[#1E2D45] hover:border-[#2563EB]/30"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] text-[#3B82F6]">{t.id}</span>
                  <StatusBadge status={t.status} />
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
        {diag && txn ? (
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
                  <p className="text-xs text-gray-400 font-mono leading-relaxed">{diag.agentReasoning}</p>
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
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Actions" value="7" sub="Today" />
        <StatCard label="Executed" value="4" sub="Successfully dispatched" accent />
        <StatCard label="Pending" value="2" sub="Awaiting response" />
        <StatCard label="Stopped" value="1" sub="Blocked or escalated" />
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
          {recoveryActions.map((a) => (
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
                  <p className="text-[10px] text-gray-500 font-mono">{a.time}</p>
                  <p className={`text-[11px] mt-1 font-medium ${a.result.includes("RECOVERED") ? "text-emerald-400" : a.status === "Stopped" ? "text-red-400" : "text-gray-400"}`}>{a.result}</p>
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
  const [logCount, setLogCount] = useState(agentLogs.length);

  useEffect(() => {
    const t = setInterval(() => {
      setLogCount((c) => Math.min(c + 1, agentLogs.length + 3));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { id: "detect", label: "Detect", desc: "Signal ingestion", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
    { id: "diagnose", label: "Diagnose", desc: "Root cause AI", color: "text-purple-400", bg: "bg-purple-500/20 border-purple-500/30" },
    { id: "decide", label: "Decide", desc: "Strategy select", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
    { id: "policy", label: "Policy Check", desc: "Guardrail verify", color: "text-cyan-400", bg: "bg-cyan-500/20 border-cyan-500/30" },
    { id: "execute", label: "Execute", desc: "Action dispatch", color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
    { id: "recover", label: "Recover", desc: "Payment capture", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
    { id: "verify", label: "Verify", desc: "Outcome confirm", color: "text-teal-400", bg: "bg-teal-500/20 border-teal-500/30" },
  ];

  const typeColors: Record<string, string> = {
    DETECT: "text-blue-400", DIAGNOSE: "text-purple-400", DECIDE: "text-amber-400",
    POLICY: "text-cyan-400", EXECUTE: "text-emerald-400", VERIFY: "text-teal-400",
  };

  const levelColors: Record<string, string> = {
    info: "text-gray-300", success: "text-emerald-300", warn: "text-amber-300", error: "text-red-300",
  };

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
        <StatCard label="Processed Today" value="186" sub="Transactions analyzed" />
        <StatCard label="Actions Dispatched" value="47" sub="Across all channels" accent />
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
          {agentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-[11px] animate-slide-in">
              <span className="text-gray-600 flex-shrink-0">{log.time}</span>
              <span className={`flex-shrink-0 font-bold w-16 ${typeColors[log.type] || "text-gray-400"}`}>[{log.type}]</span>
              <span className={levelColors[log.level]}>{log.message}</span>
            </div>
          ))}
          {logCount > agentLogs.length && (
            <div className="flex items-start gap-3 text-[11px]">
              <span className="text-gray-600">14:35:12</span>
              <span className="text-blue-400 font-bold w-16">[DETECT]</span>
              <span className="text-gray-300">Processing batch: 3 high-risk transactions queued...</span>
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
  const categories = [...new Set(guardrails.map((g) => g.category))];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Rules" value="10" sub="All guardrails armed" />
        <StatCard label="Triggered Today" value="9" sub="Rule enforcement events" />
        <StatCard label="Blocked Actions" value="3" sub="Prevented by policy" />
        <StatCard label="Escalations" value="1" sub="Sent to human review" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat} className="p-5">
            <p className="text-xs font-semibold text-gray-300 font-display mb-3">{cat}</p>
            <div className="space-y-2.5">
              {guardrails.filter((g) => g.category === cat).map((g) => (
                <div key={g.id} className="p-3 bg-[#1A2332] rounded-lg border border-[#1E2D45]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] text-gray-500">{g.id}</span>
                    <StatusBadge status={g.status} />
                  </div>
                  <p className="text-[11px] text-gray-200 leading-relaxed">{g.rule}</p>
                  {g.triggeredToday > 0 && (
                    <p className="text-[10px] text-amber-400 mt-1.5 font-mono">↑ {g.triggeredToday}× triggered today</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold font-display text-white mb-4">Blocked Actions Today</p>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
              <th className="text-left pb-2.5">ID</th>
              <th className="text-left pb-2.5">Timestamp</th>
              <th className="text-left pb-2.5">TXN ID</th>
              <th className="text-left pb-2.5">Blocked Action</th>
              <th className="text-left pb-2.5">Block Reason</th>
              <th className="text-left pb-2.5">Guardrail</th>
              <th className="text-left pb-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {blockedActions.map((b) => (
              <tr key={b.id} className="table-row-hover border-b border-[#1E2D45]/40">
                <td className="py-3 font-mono text-[11px] text-[#3B82F6]">{b.id}</td>
                <td className="py-3 font-mono text-[10px] text-gray-500">{b.timestamp}</td>
                <td className="py-3 font-mono text-[11px] text-gray-400">{b.txnId}</td>
                <td className="py-3 text-xs text-gray-200">{b.blockedAction}</td>
                <td className="py-3 text-[11px] text-gray-400">{b.blockReason}</td>
                <td className="py-3 font-mono text-[11px] text-purple-400">{b.guardrail}</td>
                <td className="py-3"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AuditView() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Decisions" value="342" sub="AI-driven today" />
        <StatCard label="Policy Passes" value="338" sub="98.8% compliance" accent />
        <StatCard label="Escalations" value="3" sub="Sent to humans" />
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

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1E2D45]">
                <th className="text-left pb-2.5">Audit ID</th>
                <th className="text-left pb-2.5">Timestamp</th>
                <th className="text-left pb-2.5">TXN ID</th>
                <th className="text-left pb-2.5">AI Decision</th>
                <th className="text-left pb-2.5">Reason</th>
                <th className="text-left pb-2.5">Policy</th>
                <th className="text-left pb-2.5">Action Taken</th>
                <th className="text-left pb-2.5">Result</th>
                <th className="text-left pb-2.5">Actor</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.map((a) => (
                <tr key={a.id} className="table-row-hover border-b border-[#1E2D45]/40">
                  <td className="py-3 font-mono text-[11px] text-[#3B82F6]">{a.id}</td>
                  <td className="py-3 font-mono text-[10px] text-gray-500">{a.timestamp}</td>
                  <td className="py-3 font-mono text-[11px] text-gray-400">{a.txnId}</td>
                  <td className="py-3 text-[11px] text-gray-200 max-w-[140px] truncate">{a.aiDecision}</td>
                  <td className="py-3 text-[10px] text-gray-400 max-w-[120px] truncate">{a.reason}</td>
                  <td className="py-3"><StatusBadge status={a.policyCheck} /></td>
                  <td className="py-3 text-[11px] text-gray-200">{a.action}</td>
                  <td className="py-3">
                    <span className={`text-[11px] font-medium ${a.result.includes("RECOVERED") ? "text-emerald-400" : "text-gray-400"}`}>{a.result}</span>
                  </td>
                  <td className="py-3">
                    <span className={`font-mono text-[10px] ${a.actor === "AI Agent" ? "text-[#3B82F6]" : "text-amber-400"}`}>{a.actor}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Money At Risk" value="₹18.7L" sub="This week" delta="+4.2%" />
        <StatCard label="Money Recovered" value="₹11.5L" sub="This week" delta="+7.8%" accent />
        <StatCard label="Recovery Rate" value="61.5%" sub="Industry avg: 45%" delta="+3.3%" />
        <StatCard label="Unnecessary Actions" value="4.2%" sub="False positive rate" delta="-0.8%" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold font-display text-white mb-1">Weekly At-Risk vs Recovered</p>
          <p className="text-xs text-gray-500 mb-4">Daily comparison this week</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analyticsData.weekly} barCategoryGap="30%">
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
            {analyticsData.interventions.map((item) => (
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
        <p className="text-xs text-gray-500 mb-4">1,084 total interventions this week</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={recoveryChartData}>
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
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Merchants" value="6" sub="With open cases" />
        <StatCard label="Total At Risk" value="₹1.56Cr" sub="Across all merchants" />
        <StatCard label="Total Recovered" value="₹1.01Cr" sub="This week" accent />
        <StatCard label="Best Recovery" value="71%" sub="Byju's Learning" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {merchants.map((m) => (
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
          <BarChart data={merchants} barCategoryGap="35%">
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
