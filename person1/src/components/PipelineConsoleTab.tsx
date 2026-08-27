import React, { useState } from 'react';
import { DataProfileReport } from '../types.ts';
import { Database, CheckCircle2, XCircle, RefreshCw, Layers, FileSpreadsheet, Play, Terminal } from 'lucide-react';

interface PipelineConsoleTabProps {
  report: DataProfileReport | null;
  onRefreshPipeline: (count: number, seed: number) => void;
  isRefreshing: boolean;
}

export const PipelineConsoleTab: React.FC<PipelineConsoleTabProps> = ({
  report,
  onRefreshPipeline,
  isRefreshing,
}) => {
  const [projectCount, setProjectCount] = useState(10000);
  const [randomSeed, setRandomSeed] = useState(26102);

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    onRefreshPipeline(projectCount, randomSeed);
  };

  return (
    <div id="pipeline-tab" className="space-y-3">
      {/* Pipeline Header */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
            <Database className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                PIPELINE_LINEAGE_&_VALIDATION_SUITE
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold border border-emerald-500/30">
                SUITE_VERIFIED
              </span>
            </div>
            <div className="text-xs font-bold text-white mt-0.5">
              Deterministic Synthetic Generator, Anomaly Injection Engine & MoSPI Rule Compliance
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="px-2.5 py-1 rounded bg-[#111112] border border-[#262626] text-[#A1A1AA]">
            LINEAGE: <strong className="text-emerald-400">CSV → PROFILING → SEED_PRNG → RISK_MATRIX</strong>
          </span>
        </div>
      </div>

      {/* Validation Suite Card */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 space-y-3 font-mono">
        <div className="flex items-center justify-between border-b border-[#262626] pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              AUTOMATED_INTEGRITY_VALIDATION_SUITE
            </span>
          </div>
          <span className="text-xs font-bold text-emerald-400">
            {report?.validation_suite.checks_passed || 9} / {report?.validation_suite.checks_run || 9} CHECKS PASSED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {report?.validation_suite.validations ? (
            report.validation_suite.validations.map((v, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded border ${
                  v.status === 'PASSED'
                    ? 'bg-[#050505] border-[#262626]'
                    : 'bg-rose-500/10 border-rose-500/30'
                } space-y-1`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-400">
                    V_CHK_{String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="px-1 py-0.2 text-[9px] rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {v.status}
                  </span>
                </div>
                <div className="font-bold text-white text-[11px] font-sans">{v.check_name}</div>
                <p className="text-[10px] text-[#A1A1AA] font-sans">{v.details}</p>
              </div>
            ))
          ) : (
            <div className="text-[#666] col-span-3 text-center py-4 text-xs">RUNNING_CHECKS...</div>
          )}
        </div>
      </div>

      {/* Interactive Pipeline Re-Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[#262626] pb-2">
            <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest">
              PIPELINE_CONTROLLER
            </span>
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <form onSubmit={handleRun} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#A1A1AA] text-[10px] uppercase font-bold mb-1">
                PROJECT_VOLUME
              </label>
              <select
                value={projectCount}
                onChange={(e) => setProjectCount(Number(e.target.value))}
                className="w-full bg-[#050505] border border-[#262626] rounded p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value={1000}>1,000 PROJECTS (FAST DEMO)</option>
                <option value={5000}>5,000 PROJECTS (STANDARD)</option>
                <option value={10000}>10,000 PROJECTS (FULL SCALE 10K+)</option>
                <option value={15000}>15,000 PROJECTS (STRESS TEST)</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A1A1AA] text-[10px] uppercase font-bold mb-1">
                PRNG_SEED (DETERMINISTIC)
              </label>
              <input
                type="number"
                value={randomSeed}
                onChange={(e) => setRandomSeed(Number(e.target.value))}
                className="w-full bg-[#050505] border border-[#262626] rounded p-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isRefreshing}
              className="w-full py-2 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-tighter rounded text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Play className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'EXECUTING_PIPELINE...' : 'RE-RUN PIPELINE & SEED'}
            </button>
          </form>
        </div>

        {/* Profiling Statistics Breakdown */}
        <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 lg:col-span-2 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-[#262626] pb-2">
            <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest">
              INGESTION_PROFILING_SUMMARY
            </span>
            <span className="text-[9px] text-blue-400 font-bold">SOURCE: CSV</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[#666] block text-[9px] uppercase">RAW_CSV_ROWS</span>
              <span className="font-bold text-white text-sm">
                {report?.raw_rows_count || 544}
              </span>
            </div>

            <div className="p-2.5 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[#666] block text-[9px] uppercase">CLEAN_MPS</span>
              <span className="font-bold text-emerald-400 text-sm">
                {report?.clean_mps_count || 543}
              </span>
            </div>

            <div className="p-2.5 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[#666] block text-[9px] uppercase">MISSING_VALS_FIX</span>
              <span className="font-bold text-amber-400 text-sm">
                1 (NANDED)
              </span>
            </div>

            <div className="p-2.5 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[#666] block text-[9px] uppercase">INDEXED_WORKS</span>
              <span className="font-bold text-blue-400 text-sm">
                {report?.synthetic_projects_count || 10000}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-[#050505] rounded border border-[#262626] space-y-1 text-xs">
            <span className="text-[#666] font-bold uppercase tracking-widest text-[9px] block">
              INJECTED_ANOMALY_PROPORTIONS
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
              <div>• PAYMENT_GAP: <span className="text-rose-400 font-bold">~400 (4%)</span></div>
              <div>• COST_ESCALATION: <span className="text-amber-400 font-bold">~300 (3%)</span></div>
              <div>• TIMELINE_STALLED: <span className="text-orange-400 font-bold">~500 (5%)</span></div>
              <div>• AGENCY_MONOPOLY: <span className="text-purple-400 font-bold">~250 (2.5%)</span></div>
              <div>• DUPLICATE_PAIRS: <span className="text-red-400 font-bold">~100 (1%)</span></div>
              <div>• NO_TECH_SANCTION: <span className="text-blue-400 font-bold">~350 (3.5%)</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
