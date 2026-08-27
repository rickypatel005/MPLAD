import React, { useState, useEffect } from 'react';
import { AnomalyScenario, ProjectEntity, RiskLevel, StateEntity } from '../types.ts';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';

interface ProjectsTabProps {
  states: StateEntity[];
  onSelectProject: (projectId: string) => void;
  selectedStateFilter?: string;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({
  states,
  onSelectProject,
  selectedStateFilter = '',
}) => {
  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [stateId, setStateId] = useState(selectedStateFilter);
  const [riskLevel, setRiskLevel] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [scenario, setScenario] = useState<string>('');
  const [sortBy, setSortBy] = useState<'risk' | 'amount' | 'progress' | 'date'>('risk');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 25,
    total_items: 0,
    total_pages: 1,
  });

  useEffect(() => {
    setStateId(selectedStateFilter);
  }, [selectedStateFilter]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (search) params.set('search', search);
      if (stateId) params.set('state_id', stateId);
      if (riskLevel) params.set('risk_level', riskLevel);
      if (status) params.set('status', status);
      if (scenario) params.set('scenario', scenario);
      if (sortBy) params.set('sort_by', sortBy);
      if (sortOrder) params.set('sort_order', sortOrder);

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      if (data.items) {
        setProjects(data.items);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [page, pageSize, stateId, riskLevel, status, scenario, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProjects();
  };

  const handleClearFilters = () => {
    setSearch('');
    setStateId('');
    setRiskLevel('');
    setStatus('');
    setScenario('');
    setSortBy('risk');
    setSortOrder('desc');
    setPage(1);
  };

  const getRiskBadge = (level?: RiskLevel, score?: number) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            CRITICAL ({score?.toFixed(2)})
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            HIGH ({score?.toFixed(2)})
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-mono">
            MEDIUM ({score?.toFixed(2)})
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
            LOW ({score?.toFixed(2)})
          </span>
        );
    }
  };

  const getScenarioBadge = (sc: AnomalyScenario) => {
    switch (sc) {
      case 'PAYMENT_PROGRESS_MISMATCH':
        return <span className="px-1.5 py-0.2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[9px] font-mono font-bold">PAY_GAP</span>;
      case 'HIGH_COST_ANOMALY':
        return <span className="px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold">COST_SOR</span>;
      case 'TIMELINE_DELAY_ANOMALY':
        return <span className="px-1.5 py-0.2 rounded bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[9px] font-mono font-bold">OVERDUE</span>;
      case 'IA_CONCENTRATION_ANOMALY':
        return <span className="px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[9px] font-mono font-bold">IA_MONOPOLY</span>;
      case 'DUPLICATE_PROJECT_PAIR':
        return <span className="px-1.5 py-0.2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-[9px] font-mono font-bold">DUPLICATE</span>;
      case 'COMPLIANCE_ANOMALY':
        return <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[9px] font-mono font-bold">NO_TECH_SANC</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded bg-[#1A1A1C] text-[#666] border border-[#262626] text-[9px] font-mono">BENCHMARK</span>;
    }
  };

  return (
    <div id="projects-tab" className="space-y-3">
      {/* Search & Filter Bar */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3 space-y-2.5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#666] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH PROJECT_ID (e.g. P10342), NAME, MP, STATE, IA..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#050505] border border-[#262626] rounded text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded text-xs font-mono font-bold uppercase tracking-tighter transition shrink-0"
          >
            EXECUTE_QUERY
          </button>
        </form>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          {/* State Filter */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-[#666] mb-0.5">STATE / UT</label>
            <select
              value={stateId}
              onChange={(e) => {
                setStateId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#050505] border border-[#262626] rounded px-2 py-1 text-[11px] text-[#E0E0E0] focus:outline-none focus:border-emerald-500"
            >
              <option value="">ALL STATES (36)</option>
              {states.map((st) => (
                <option key={st.state_id} value={st.state_id}>
                  {st.normalized_name}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-[#666] mb-0.5">RISK TIER</label>
            <select
              value={riskLevel}
              onChange={(e) => {
                setRiskLevel(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#050505] border border-[#262626] rounded px-2 py-1 text-[11px] text-[#E0E0E0] focus:outline-none focus:border-emerald-500"
            >
              <option value="">ALL RISK TIERS</option>
              <option value="CRITICAL">CRITICAL RISK</option>
              <option value="HIGH">HIGH RISK</option>
              <option value="MEDIUM">MEDIUM RISK</option>
              <option value="LOW">LOW RISK</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-[#666] mb-0.5">STATUS</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#050505] border border-[#262626] rounded px-2 py-1 text-[11px] text-[#E0E0E0] focus:outline-none focus:border-emerald-500"
            >
              <option value="">ALL STATUSES</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="STALLED">STALLED</option>
              <option value="NOT_STARTED">NOT STARTED</option>
            </select>
          </div>

          {/* Scenario Filter */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-[#666] mb-0.5">ANOMALY TYPE</label>
            <select
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#050505] border border-[#262626] rounded px-2 py-1 text-[11px] text-[#E0E0E0] focus:outline-none focus:border-emerald-500"
            >
              <option value="">ALL PROBES</option>
              <option value="PAYMENT_PROGRESS_MISMATCH">PAYMENT GAP</option>
              <option value="HIGH_COST_ANOMALY">COST SOR</option>
              <option value="TIMELINE_DELAY_ANOMALY">TIMELINE DELAY</option>
              <option value="IA_CONCENTRATION_ANOMALY">IA MONOPOLY</option>
              <option value="DUPLICATE_PROJECT_PAIR">DUPLICATE PAIR</option>
              <option value="COMPLIANCE_ANOMALY">COMPLIANCE FLAG</option>
              <option value="NORMAL_BENCHMARK">BENCHMARK</option>
            </select>
          </div>

          {/* Sorting Field */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-[#666] mb-0.5">SORT BY</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-[#050505] border border-[#262626] rounded px-2 py-1 text-[11px] text-[#E0E0E0] focus:outline-none focus:border-emerald-500"
            >
              <option value="risk">RISK (HIGHEST)</option>
              <option value="amount">SANCTION AMOUNT</option>
              <option value="progress">PHYSICAL PROGRESS</option>
              <option value="date">SANCTION DATE</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full py-1 px-2 bg-[#1A1A1C] hover:bg-[#262626] text-[#A1A1AA] hover:text-white rounded text-[10px] font-bold uppercase tracking-tighter border border-[#262626] transition"
            >
              RESET_FILTERS
            </button>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded overflow-hidden">
        <div className="px-3 py-2 border-b border-[#262626] bg-[#111112] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-[#666]">RESULTS:</span>
            <span className="text-white font-bold">{projects.length}</span>
            <span className="text-[#666]">/</span>
            <span className="text-[#A1A1AA]">{pagination.total_items.toLocaleString()} REGISTERED</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#666] text-[10px]">PAGE_SIZE:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-[#050505] text-[#E0E0E0] border border-[#262626] rounded px-1.5 py-0.5 text-[11px]"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#A1A1AA] font-mono text-xs">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-emerald-500 border-t-transparent mx-auto mb-2"></div>
            QUERYING_DATABASE_INDEX...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-[#666] font-mono text-xs">
            <AlertCircle className="w-6 h-6 text-[#555] mx-auto mb-2" />
            NO_PROJECTS_FOUND_MATCHING_CRITERIA
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111112] text-[#A1A1AA] uppercase tracking-wider font-mono text-[9px] border-b border-[#262626]">
                <tr>
                  <th className="py-2 px-3">Project ID & Title</th>
                  <th className="py-2 px-3">State & MP</th>
                  <th className="py-2 px-3">Agency</th>
                  <th className="py-2 px-3">Sanction</th>
                  <th className="py-2 px-3">Progress (Phys / Paid)</th>
                  <th className="py-2 px-3">Risk Tier</th>
                  <th className="py-2 px-3">Scenario</th>
                  <th className="py-2 px-3 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1C] bg-[#0A0A0B]">
                {projects.map((p) => {
                  const delta = p.financial_progress - p.physical_progress;
                  return (
                    <tr
                      key={p.project_id}
                      onClick={() => onSelectProject(p.project_id)}
                      className="hover:bg-[#141416] transition cursor-pointer group"
                    >
                      {/* ID & Name */}
                      <td className="py-2 px-3 max-w-[240px]">
                        <div className="font-mono font-bold text-blue-400 group-hover:text-emerald-400 text-[11px]">
                          {p.project_id}
                        </div>
                        <div className="font-medium text-[#E0E0E0] truncate text-xs" title={p.project_name}>
                          {p.project_name}
                        </div>
                        <div className="text-[10px] text-[#666] font-mono">{p.category}</div>
                      </td>

                      {/* State & MP */}
                      <td className="py-2 px-3 max-w-[170px] font-mono text-[11px]">
                        <div className="font-medium text-white">{p.state_name}</div>
                        <div className="text-[10px] text-[#A1A1AA] truncate" title={p.mp_name}>
                          {p.mp_name}
                        </div>
                        <div className="text-[9px] text-[#666]">{p.constituency_name}</div>
                      </td>

                      {/* IA */}
                      <td className="py-2 px-3 max-w-[150px]">
                        <div className="text-[#A1A1AA] text-[11px] truncate font-mono" title={p.ia_name}>
                          {p.ia_name}
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                        <div className="font-bold text-white">
                          ₹{(p.sanction_amount / 100000).toFixed(1)} L
                        </div>
                        <div className="text-[9px] text-[#666]">{p.sanction_date}</div>
                      </td>

                      {/* Progress */}
                      <td className="py-2 px-3 min-w-[140px] font-mono text-[10px]">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[#A1A1AA]">Phys: <strong className="text-white">{p.physical_progress}%</strong></span>
                            <span className="text-[#A1A1AA]">Paid: <strong className="text-blue-400">{p.financial_progress}%</strong></span>
                          </div>
                          {/* Visual Progress bar */}
                          <div className="w-full bg-[#1A1A1C] rounded-full h-1 overflow-hidden flex">
                            <div
                              className="bg-emerald-500 h-full"
                              style={{ width: `${p.physical_progress}%` }}
                            ></div>
                          </div>
                          {delta > 25 && (
                            <div className="text-[9px] font-bold text-rose-400">
                              GAP: +{delta}% PAID
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Risk */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {getRiskBadge(p.risk_score?.risk_level, p.risk_score?.overall_score)}
                      </td>

                      {/* Scenario Tag */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {getScenarioBadge(p.synthetic_scenario)}
                      </td>

                      {/* CTA */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(p.project_id);
                          }}
                          className="px-2 py-0.5 bg-[#1A1A1C] group-hover:bg-emerald-500 group-hover:text-black text-white border border-[#262626] rounded text-[10px] font-mono font-bold uppercase tracking-tighter transition inline-flex items-center gap-1"
                        >
                          DOSSIER
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="px-3 py-2 border-t border-[#262626] bg-[#111112] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="text-[#A1A1AA] text-[11px]">
            PAGE <span className="font-bold text-white">{pagination.page}</span> OF{' '}
            <span className="font-bold text-white">{pagination.total_pages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1 || loading}
              className="px-2.5 py-1 bg-[#1A1A1C] hover:bg-[#262626] disabled:opacity-30 text-[#E0E0E0] rounded border border-[#262626] text-[10px] font-bold uppercase tracking-tighter transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> PREV
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
              disabled={pagination.page >= pagination.total_pages || loading}
              className="px-2.5 py-1 bg-[#1A1A1C] hover:bg-[#262626] disabled:opacity-30 text-[#E0E0E0] rounded border border-[#262626] text-[10px] font-bold uppercase tracking-tighter transition flex items-center gap-1"
            >
              NEXT <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
