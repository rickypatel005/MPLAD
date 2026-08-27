import React from 'react';
import { DashboardSummary, RiskLevel } from '../types.ts';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Building,
  DollarSign,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  MapPin,
  ExternalLink,
  Activity,
  Terminal,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

interface DashboardTabProps {
  summary: DashboardSummary | null;
  onSelectProject: (projectId: string) => void;
  onSelectState: (stateId: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ summary, onSelectProject, onSelectState }) => {
  if (!summary) {
    return (
      <div className="flex items-center justify-center p-12 text-[#A1A1AA] font-mono text-xs">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent mr-3"></div>
        INITIALIZING_AUDIT_TELEMETRY_ENGINE...
      </div>
    );
  }

  const riskPieData = [
    { name: 'Low Risk', value: summary.risk_level_breakdown.LOW || 0, color: '#10b981' },
    { name: 'Medium Risk', value: summary.risk_level_breakdown.MEDIUM || 0, color: '#eab308' },
    { name: 'High Risk', value: summary.risk_level_breakdown.HIGH || 0, color: '#f97316' },
    { name: 'Critical Risk', value: summary.risk_level_breakdown.CRITICAL || 0, color: '#ef4444' },
  ];

  const categoryChartData = summary.category_breakdown.map((c) => ({
    name: c.category.length > 18 ? c.category.slice(0, 16) + '...' : c.category,
    fullName: c.category,
    count: c.count,
    budgetCr: parseFloat((c.total_amount / 10000000).toFixed(1)),
    avgRisk: c.avg_risk,
  }));

  const topStates = [...summary.state_aggregates]
    .sort((a, b) => b.critical_count + b.risk_count - (a.critical_count + a.risk_count))
    .slice(0, 10);

  return (
    <div id="dashboard-tab" className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Budget */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
              SANCTIONED_LIMIT
            </span>
            <span className="p-1 bg-[#1A1A1C] rounded border border-[#262626] text-blue-400">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold text-white tracking-tight">
              ₹{(summary.total_allocated_budget / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-[#A1A1AA]">
              <span className="text-[#666]">RELEASED:</span>
              <span className="font-bold text-emerald-400">
                ₹{(summary.total_utilized_budget / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
              </span>
              <span className="text-[#555]">({summary.overall_financial_avg}%)</span>
            </div>
          </div>
        </div>

        {/* Total Projects */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
              TOTAL_INDEXED_WORKS
            </span>
            <span className="p-1 bg-[#1A1A1C] rounded border border-[#262626] text-sky-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold text-white tracking-tight">
              {summary.total_projects.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
              <span className="text-emerald-400">{summary.status_breakdown.COMPLETED} COMPLETED</span>
              <span className="text-[#444]">|</span>
              <span className="text-amber-400">{summary.status_breakdown.IN_PROGRESS} ACTIVE</span>
            </div>
          </div>
        </div>

        {/* High & Critical Risk Count */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
              FLAGGED_ANOMALIES
            </span>
            <span className="p-1 bg-rose-500/10 rounded border border-rose-500/30 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold text-rose-400 tracking-tight">
              {(summary.high_risk_count + summary.critical_risk_count).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono">
              <span className="text-red-400 font-bold">{summary.critical_risk_count} CRITICAL</span>
              <span className="text-[#444]">|</span>
              <span className="text-orange-400 font-bold">{summary.high_risk_count} HIGH</span>
            </div>
          </div>
        </div>

        {/* Human Audit & Governance */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
              GOVERNANCE_REVIEW
            </span>
            <span className="p-1 bg-emerald-500/10 rounded border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-mono font-bold text-white tracking-tight">
              {summary.reviewed_count} VERIFIED
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#A1A1AA]">
              <span className="text-amber-400">{summary.pending_investigation_count} PENDING</span>
              <span className="text-[#444]">|</span>
              <span className="text-emerald-400">AUDITOR_ON_DUTY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row: Risk Distribution & Category Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Risk Distribution Pie */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                ENSEMBLE_RISK_DISTRIBUTION
              </span>
              <div className="text-xs font-bold text-white">Risk Tier Classification</div>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A1C] text-[#A1A1AA] border border-[#262626]">
              ISO-FOREST
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {riskPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0E0E0F" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val.toLocaleString()} projects`, 'Count']}
                  contentStyle={{ backgroundColor: '#111112', borderColor: '#262626', borderRadius: '4px', color: '#fff', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#262626] text-[11px] font-mono">
            {riskPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between px-2 py-1 bg-[#141416] rounded border border-[#262626]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-[#A1A1AA]">{item.name}</span>
                </div>
                <span className="text-white font-bold">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Budget & Volume Breakdown */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                SECTOR_ALLOCATION_MATRIX
              </span>
              <div className="text-xs font-bold text-white">11 MoSPI Civic Infrastructure Categories</div>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A1C] text-emerald-400 border border-[#262626]">
              INR_CRORES
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="#1A1A1C" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} interval={0} angle={-25} textAnchor="end" />
                <YAxis stroke="#666" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    name === 'budgetCr' ? `₹${val} Cr` : val,
                    name === 'budgetCr' ? 'Budget' : 'Count',
                  ]}
                  contentStyle={{ backgroundColor: '#111112', borderColor: '#262626', borderRadius: '4px', color: '#fff', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                />
                <Bar dataKey="budgetCr" fill="#3b82f6" radius={[2, 2, 0, 0]} name="budgetCr" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-[#666] text-right pt-1 border-t border-[#1A1A1C]">
            SOURCE: LOK SABHA ALLOCATED CSV & MOSPI NORMS
          </div>
        </div>
      </div>

      {/* State Risk Matrix & Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Top Flagged States Table */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                VULNERABILITY_RANKING
              </span>
              <div className="text-xs font-bold text-white">State & UT Vigilance Index</div>
            </div>
            <span className="text-[9px] font-mono text-amber-400">SORTED BY ANOMALY DENSITY</span>
          </div>
          <div className="overflow-x-auto border border-[#262626] rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111112] text-[#A1A1AA] uppercase tracking-wider font-mono text-[10px] border-b border-[#262626]">
                <tr>
                  <th className="py-2 px-3">State / UT</th>
                  <th className="py-2 px-3">Projects</th>
                  <th className="py-2 px-3">Sanctioned</th>
                  <th className="py-2 px-3">Phys / Fin Avg</th>
                  <th className="py-2 px-3">Crit / High</th>
                  <th className="py-2 px-3 text-right">Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1C] bg-[#0A0A0B]">
                {topStates.map((st) => (
                  <tr key={st.state_id} className="hover:bg-[#141416] transition font-mono text-[11px]">
                    <td className="py-2 px-3 font-semibold text-white flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      {st.state_name}
                    </td>
                    <td className="py-2 px-3 text-[#A1A1AA]">{st.project_count}</td>
                    <td className="py-2 px-3 text-white font-medium">
                      ₹{(st.allocated_sum / 10000000).toFixed(1)} Cr
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-white">{st.avg_physical_progress}%</span>
                      <span className="text-[#555] mx-1">/</span>
                      <span className="text-blue-400">{st.avg_financial_progress}%</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                          {st.critical_count}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
                          {st.risk_count}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => onSelectState(st.state_id)}
                        className="px-2 py-0.5 bg-[#1A1A1C] hover:bg-[#262626] text-blue-400 hover:text-white border border-[#262626] rounded text-[10px] uppercase font-bold tracking-tighter inline-flex items-center gap-1"
                      >
                        EXPLORE
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Risk Alert Feed */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"></span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                  LIVE_ANOMALY_TELEMETRY
                </span>
              </div>
              <span className="text-[9px] font-mono text-rose-400 font-bold">REALTIME</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
              {summary.recent_alerts.map((alert, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectProject(alert.project_id)}
                  className="p-2.5 rounded bg-[#0A0A0B] border border-[#262626] hover:border-[#3F3F46] transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="text-[11px] font-bold text-blue-400 group-hover:text-emerald-400">
                        {alert.project_id}
                      </span>
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                          alert.risk_level === 'CRITICAL'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {alert.risk_level}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#666] font-mono">{alert.date}</span>
                  </div>

                  <div className="mt-1 text-xs font-semibold text-[#E0E0E0] line-clamp-1 group-hover:text-white">
                    {alert.project_name}
                  </div>

                  <p className="mt-1 text-[11px] text-[#A1A1AA] line-clamp-2 leading-relaxed">
                    {alert.message}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-[#1A1A1C]">
                    <span className="text-[#666]">{alert.state_name}</span>
                    <span className="text-blue-400 group-hover:text-emerald-400 flex items-center gap-0.5 font-bold uppercase tracking-tighter">
                      OPEN_DOSSIER <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
