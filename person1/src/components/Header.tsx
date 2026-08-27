import React from 'react';
import { UserRole } from '../types.ts';
import { Shield, Database, RefreshCw, CheckCircle, Activity, Terminal } from 'lucide-react';

interface HeaderProps {
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  totalProjects: number;
  onRefreshPipeline: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeRole,
  onRoleChange,
  activeTab,
  onTabChange,
  totalProjects,
  onRefreshPipeline,
  isRefreshing,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'EXECUTIVE_DASHBOARD', code: '01', icon: '📊' },
    { id: 'projects', label: 'PROJECT_EXPLORER', code: '02', icon: '📋' },
    { id: 'duplicates', label: 'GEO_DUPLICATE_CLUSTERS', code: '03', icon: '🔍' },
    { id: 'agencies', label: 'AGENCY_HHI_MATRIX', code: '04', icon: '🏢' },
    { id: 'pipeline', label: 'PIPELINE_LINEAGE', code: '05', icon: '⚙️' },
  ];

  const roles: UserRole[] = ['AUDITOR', 'REVIEWER', 'ADMIN', 'VIEWER'];

  return (
    <header id="app-header" className="bg-[#111112] text-[#E0E0E0] border-b border-[#262626] sticky top-0 z-40">
      {/* Top Telemetry & Control Bar */}
      <div className="h-12 px-4 flex items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
            <span className="font-mono text-[11px] font-bold tracking-widest text-emerald-500">AUDIT_ACTIVE</span>
          </div>

          <div className="h-4 w-[1px] bg-[#262626]"></div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-tight">MPLADS INTELLIGENCE</span>
            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#1A1A1C] text-indigo-400 border border-[#262626] rounded">
              SIH26102
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-[#A1A1AA] font-mono">
            <span className="text-[#666]">ENGINE:</span>
            <span className="text-slate-300">MoSPI v4.2 / GFR-2017</span>
          </div>
        </div>

        {/* Dense Status Telemetry & Controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Telemetry Metrics */}
          <div className="hidden md:flex items-center gap-4 text-[10px] font-mono">
            <div className="flex flex-col">
              <span className="text-[#666] uppercase text-[9px] tracking-wider">INDEXED</span>
              <span className="text-white font-bold">{totalProjects.toLocaleString()} ASSETS</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#666] uppercase text-[9px] tracking-wider">INTEGRITY</span>
              <span className="text-emerald-400 font-bold">9/9 PASSED</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#666] uppercase text-[9px] tracking-wider">GEO_MODE</span>
              <span className="text-blue-400 font-bold">POSTGIS_DENSE</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[#262626] hidden md:block"></div>

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 bg-[#0E0E0F] px-2 py-1 rounded border border-[#262626] text-[11px] font-mono">
            <span className="text-[#666] text-[9px] uppercase tracking-wider hidden sm:inline">ROLE:</span>
            <select
              id="role-selector"
              value={activeRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-transparent text-emerald-400 font-bold text-[11px] focus:outline-none cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r} value={r} className="bg-[#111112] text-[#E0E0E0]">
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Pipeline Trigger */}
          <button
            id="refresh-pipeline-btn"
            onClick={onRefreshPipeline}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#262626] border border-[#3F3F46] rounded text-[10px] font-bold uppercase tracking-tighter hover:bg-[#323235] text-white transition disabled:opacity-50"
            title="Re-run Pipeline & Validation Suite"
          >
            <RefreshCw className={`w-3 h-3 text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">RE-RUN PIPELINE</span>
          </button>
        </div>
      </div>

      {/* High Density Sub-Header Navigation Tabs */}
      <div className="bg-[#0A0A0B] border-t border-[#262626] px-4">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono font-medium rounded transition uppercase tracking-wider ${
                  isActive
                    ? 'bg-[#1A1A1C] text-white border border-[#3F3F46] font-bold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#141416] border border-transparent'
                }`}
              >
                <span className="opacity-70">{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-[#666]'}`}>
                  {tab.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
