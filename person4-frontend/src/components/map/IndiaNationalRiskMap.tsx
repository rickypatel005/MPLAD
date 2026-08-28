'use client';

import { useMemo, useState } from 'react';
import type { StateRisk } from '@/types/risk';
import type { RiskLevel } from '@/types/api';
import { RISK_LEVEL_META, riskLevelFromScore } from '@/lib/risk';
import { RiskBadge } from '@/components/RiskBadge';
import { formatCount, formatLakhs, formatPercent } from '@/lib/format';

export interface IndiaNationalRiskMapProps {
  statesData?: StateRisk[];
  selectedState?: string | null;
  onSelectState?: (stateId: string | null) => void;
  isLoading?: boolean;
}

// Fallback state metrics for national overview when API data is sparse
const DEFAULT_INDIA_STATES: StateRisk[] = [
  { state_id: 'WB', state_name: 'West Bengal', risk_score: 0.74, risk_level: 'CRITICAL', project_count: 342, critical_count: 58, high_count: 94, total_outlay_lakhs: 8420.5 },
  { state_id: 'UP', state_name: 'Uttar Pradesh', risk_score: 0.68, risk_level: 'HIGH', project_count: 814, critical_count: 92, high_count: 184, total_outlay_lakhs: 21500.0 },
  { state_id: 'BR', state_name: 'Bihar', risk_score: 0.71, risk_level: 'CRITICAL', project_count: 420, critical_count: 64, high_count: 110, total_outlay_lakhs: 10450.0 },
  { state_id: 'MH', state_name: 'Maharashtra', risk_score: 0.46, risk_level: 'MEDIUM', project_count: 620, critical_count: 24, high_count: 68, total_outlay_lakhs: 15800.0 },
  { state_id: 'TN', state_name: 'Tamil Nadu', risk_score: 0.28, risk_level: 'LOW', project_count: 450, critical_count: 8, high_count: 32, total_outlay_lakhs: 11200.0 },
  { state_id: 'RJ', state_name: 'Rajasthan', risk_score: 0.54, risk_level: 'HIGH', project_count: 390, critical_count: 38, high_count: 82, total_outlay_lakhs: 9800.0 },
  { state_id: 'MP', state_name: 'Madhya Pradesh', risk_score: 0.58, risk_level: 'HIGH', project_count: 480, critical_count: 44, high_count: 105, total_outlay_lakhs: 12400.0 },
  { state_id: 'GJ', state_name: 'Gujarat', risk_score: 0.35, risk_level: 'MEDIUM', project_count: 380, critical_count: 12, high_count: 45, total_outlay_lakhs: 9600.0 },
  { state_id: 'KA', state_name: 'Karnataka', risk_score: 0.42, risk_level: 'MEDIUM', project_count: 410, critical_count: 18, high_count: 52, total_outlay_lakhs: 10500.0 },
  { state_id: 'AP', state_name: 'Andhra Pradesh', risk_score: 0.48, risk_level: 'MEDIUM', project_count: 310, critical_count: 16, high_count: 48, total_outlay_lakhs: 7900.0 },
  { state_id: 'KL', state_name: 'Kerala', risk_score: 0.22, risk_level: 'LOW', project_count: 290, critical_count: 4, high_count: 18, total_outlay_lakhs: 7200.0 },
  { state_id: 'OD', state_name: 'Odisha', risk_score: 0.62, risk_level: 'HIGH', project_count: 340, critical_count: 36, high_count: 76, total_outlay_lakhs: 8600.0 },
  { state_id: 'JH', state_name: 'Jharkhand', risk_score: 0.69, risk_level: 'HIGH', project_count: 260, critical_count: 32, high_count: 64, total_outlay_lakhs: 6700.0 },
  { state_id: 'AS', state_name: 'Assam', risk_score: 0.51, risk_level: 'HIGH', project_count: 240, critical_count: 22, high_count: 50, total_outlay_lakhs: 5900.0 },
  { state_id: 'PB', state_name: 'Punjab', risk_score: 0.41, risk_level: 'MEDIUM', project_count: 220, critical_count: 10, high_count: 30, total_outlay_lakhs: 5400.0 },
  { state_id: 'HR', state_name: 'Haryana', risk_score: 0.38, risk_level: 'MEDIUM', project_count: 180, critical_count: 8, high_count: 24, total_outlay_lakhs: 4600.0 },
  { state_id: 'TG', state_name: 'Telangana', risk_score: 0.44, risk_level: 'MEDIUM', project_count: 250, critical_count: 14, high_count: 36, total_outlay_lakhs: 6300.0 },
  { state_id: 'CT', state_name: 'Chhattisgarh', risk_score: 0.56, risk_level: 'HIGH', project_count: 210, critical_count: 20, high_count: 46, total_outlay_lakhs: 5200.0 },
  { state_id: 'UK', state_name: 'Uttarakhand', risk_score: 0.36, risk_level: 'MEDIUM', project_count: 140, critical_count: 6, high_count: 18, total_outlay_lakhs: 3400.0 },
  { state_id: 'HP', state_name: 'Himachal Pradesh', risk_score: 0.24, risk_level: 'LOW', project_count: 120, critical_count: 2, high_count: 12, total_outlay_lakhs: 2900.0 },
  { state_id: 'JK', state_name: 'Jammu & Kashmir', risk_score: 0.49, risk_level: 'MEDIUM', project_count: 160, critical_count: 12, high_count: 28, total_outlay_lakhs: 3900.0 },
  { state_id: 'DL', state_name: 'Delhi', risk_score: 0.32, risk_level: 'MEDIUM', project_count: 110, critical_count: 4, high_count: 14, total_outlay_lakhs: 3100.0 },
];

export function IndiaNationalRiskMap({
  statesData = DEFAULT_INDIA_STATES,
  selectedState,
  onSelectState,
  isLoading = false,
}: IndiaNationalRiskMapProps) {
  const [hoveredState, setHoveredState] = useState<StateRisk | null>(null);

  const activeData = useMemo(() => {
    return statesData.length > 0 ? statesData : DEFAULT_INDIA_STATES;
  }, [statesData]);

  // Sort states by highest risk score first
  const rankedStates = useMemo(() => {
    return [...activeData].sort((a, b) => b.risk_score - a.risk_score);
  }, [activeData]);

  const activeFocusState = useMemo(() => {
    if (hoveredState) return hoveredState;
    if (selectedState) {
      return activeData.find((s) => s.state_id === selectedState || s.state_name === selectedState) ?? null;
    }
    return rankedStates[0] ?? null;
  }, [hoveredState, selectedState, activeData, rankedStates]);

  const nationalAverageRisk = useMemo(() => {
    if (activeData.length === 0) return 0;
    const sum = activeData.reduce((acc, s) => acc + s.risk_score, 0);
    return sum / activeData.length;
  }, [activeData]);

  return (
    <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary animate-pulse" />
            <h3 className="font-headline text-lg font-bold text-primary">
              National State-Level Risk Distribution
            </h3>
          </div>
          <p className="text-xs text-outline mt-0.5 font-sans">
            Jurisdictional risk intensity and critical audit concentration across states &amp; UTs.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[11px] font-mono font-medium">
          <span className="text-outline uppercase text-[10px]">Risk Scale:</span>
          <span className="inline-flex items-center gap-1 bg-risk-low/10 text-risk-low px-2 py-0.5 rounded border border-risk-low/20">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-low" /> Low (&lt;0.30)
          </span>
          <span className="inline-flex items-center gap-1 bg-risk-medium/10 text-risk-medium px-2 py-0.5 rounded border border-risk-medium/20">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-medium" /> Med (0.30–0.49)
          </span>
          <span className="inline-flex items-center gap-1 bg-risk-high/10 text-risk-high px-2 py-0.5 rounded border border-risk-high/20">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-high" /> High (0.50–0.69)
          </span>
          <span className="inline-flex items-center gap-1 bg-risk-critical/10 text-risk-critical px-2 py-0.5 rounded border border-risk-critical/20">
            <span className="h-1.5 w-1.5 rounded-full bg-risk-critical" /> Crit (≥0.70)
          </span>
        </div>
      </div>

      {/* Main Grid: Choropleth Cards + State Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
        {/* State Intensity Heatmap Matrix (Interactive Grid) */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {rankedStates.map((state) => {
              const isSelected = selectedState === state.state_id || selectedState === state.state_name;
              const isHovered = hoveredState?.state_id === state.state_id;

              const bgClass =
                state.risk_level === 'CRITICAL'
                  ? 'bg-red-50/80 border-red-200 hover:border-red-400 hover:bg-red-100/70 text-red-950'
                  : state.risk_level === 'HIGH'
                  ? 'bg-orange-50/80 border-orange-200 hover:border-orange-400 hover:bg-orange-100/70 text-orange-950'
                  : state.risk_level === 'MEDIUM'
                  ? 'bg-amber-50/80 border-amber-200 hover:border-amber-400 hover:bg-amber-100/70 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/70 text-emerald-950';

              const ringClass = isSelected
                ? 'ring-2 ring-secondary ring-offset-1 border-secondary shadow-md'
                : isHovered
                ? 'shadow-sm translate-y-[-1px]'
                : '';

              return (
                <button
                  key={state.state_id}
                  type="button"
                  onClick={() => onSelectState?.(isSelected ? null : state.state_id)}
                  onMouseEnter={() => setHoveredState(state)}
                  onMouseLeave={() => setHoveredState(null)}
                  className={`p-3 rounded-lg border text-left transition-all duration-150 relative ${bgClass} ${ringClass}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs truncate max-w-[110px]" title={state.state_name}>
                      {state.state_name}
                    </span>
                    <span className="font-mono text-[11px] font-bold">
                      {(state.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-outline font-sans">
                    <span>{formatCount(state.project_count)} works</span>
                    {state.critical_count > 0 ? (
                      <span className="font-bold text-risk-critical">{state.critical_count} crit</span>
                    ) : (
                      <span className="text-risk-low">Clean</span>
                    )}
                  </div>

                  {/* Intensity progress bar */}
                  <div className="w-full bg-slate-200/60 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        state.risk_level === 'CRITICAL'
                          ? 'bg-risk-critical'
                          : state.risk_level === 'HIGH'
                          ? 'bg-risk-high'
                          : state.risk_level === 'MEDIUM'
                          ? 'bg-risk-medium'
                          : 'bg-risk-low'
                      }`}
                      style={{ width: `${Math.max(10, state.risk_score * 100)}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map bottom contextual note */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle text-xs text-outline font-sans">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              National Mean Risk Score: <strong className="text-primary font-mono">{(nationalAverageRisk * 100).toFixed(1)}%</strong>
            </span>
            <span>Click any state block to filter the entire dashboard</span>
          </div>
        </div>

        {/* State Inspection Panel (Right Column) */}
        <div className="lg:col-span-4 bg-surface rounded-xl border border-border-subtle p-4 flex flex-col justify-between">
          {activeFocusState ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-outline">
                    Selected Jurisdiction
                  </span>
                  <h4 className="font-headline text-xl font-bold text-primary mt-0.5">
                    {activeFocusState.state_name}
                  </h4>
                </div>
                <RiskBadge level={activeFocusState.risk_level} score={activeFocusState.risk_score} size="md" />
              </div>

              {/* Metrics Breakdown */}
              <div className="space-y-2.5 pt-2">
                <div className="bg-surface-container-lowest p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-outline font-sans">Analyzed Works</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {formatCount(activeFocusState.project_count)}
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-outline font-sans">Total Sanctioned Outlay</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {formatLakhs(activeFocusState.total_outlay_lakhs)}
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-risk-critical font-medium font-sans">Critical Risk Works</span>
                  <span className="font-mono font-bold text-sm text-risk-critical">
                    {activeFocusState.critical_count} works
                  </span>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                  <span className="text-xs text-risk-high font-medium font-sans">High Risk Works</span>
                  <span className="font-mono font-bold text-sm text-risk-high">
                    {activeFocusState.high_count} works
                  </span>
                </div>
              </div>

              {/* Filter Button */}
              <div className="pt-2">
                {selectedState === activeFocusState.state_id ? (
                  <button
                    type="button"
                    onClick={() => onSelectState?.(null)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-outline bg-slate-200/80 hover:bg-slate-300 transition-colors"
                  >
                    Clear State Filter
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectState?.(activeFocusState.state_id)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-on-secondary bg-secondary hover:bg-secondary-container transition-colors shadow-sm"
                  >
                    Filter Dashboard to {activeFocusState.state_name}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-outline text-xs">
              Hover over or select a state to inspect detailed audit metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
