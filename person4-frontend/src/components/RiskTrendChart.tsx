'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { RiskTrendPoint } from '@/types/risk';
import { formatCount } from '@/lib/format';

export interface RiskTrendChartProps {
  data?: RiskTrendPoint[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

// Calibrated monthly risk trend fixtures
const DEFAULT_TREND_DATA: RiskTrendPoint[] = [
  { month: '2023-04', display_name: 'Apr 23', avg_risk_score: 0.42, critical_count: 14, high_count: 32, medium_count: 54, low_count: 110, total_projects: 210 },
  { month: '2023-06', display_name: 'Jun 23', avg_risk_score: 0.45, critical_count: 18, high_count: 38, medium_count: 62, low_count: 104, total_projects: 222 },
  { month: '2023-08', display_name: 'Aug 23', avg_risk_score: 0.49, critical_count: 22, high_count: 45, medium_count: 70, low_count: 98, total_projects: 235 },
  { month: '2023-10', display_name: 'Oct 23', avg_risk_score: 0.54, critical_count: 31, high_count: 58, medium_count: 75, low_count: 86, total_projects: 250 },
  { month: '2023-12', display_name: 'Dec 23', avg_risk_score: 0.59, critical_count: 42, high_count: 72, medium_count: 81, low_count: 75, total_projects: 270 },
  { month: '2024-02', display_name: 'Feb 24', avg_risk_score: 0.63, critical_count: 55, high_count: 88, medium_count: 88, low_count: 69, total_projects: 300 },
  { month: '2024-04', display_name: 'Apr 24', avg_risk_score: 0.67, critical_count: 68, high_count: 104, medium_count: 92, low_count: 64, total_projects: 328 },
  { month: '2024-06', display_name: 'Jun 24', avg_risk_score: 0.61, critical_count: 52, high_count: 94, medium_count: 98, low_count: 76, total_projects: 320 },
  { month: '2024-08', display_name: 'Aug 24', avg_risk_score: 0.58, critical_count: 46, high_count: 86, medium_count: 104, low_count: 84, total_projects: 320 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const point: RiskTrendPoint = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-border-subtle p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[200px] font-sans">
      <div className="flex items-center justify-between border-b border-border-subtle pb-1">
        <span className="font-bold text-primary">{point.display_name}</span>
        <span className="font-mono text-[10px] text-outline">{point.month}</span>
      </div>
      <div className="flex justify-between items-center text-risk-critical font-medium">
        <span>Critical Risk Works:</span>
        <span className="font-mono font-bold">{point.critical_count}</span>
      </div>
      <div className="flex justify-between items-center text-risk-high font-medium">
        <span>High Risk Works:</span>
        <span className="font-mono font-bold">{point.high_count}</span>
      </div>
      <div className="flex justify-between items-center text-outline">
        <span>Medium / Low Works:</span>
        <span className="font-mono font-semibold">{point.medium_count + point.low_count}</span>
      </div>
      <div className="flex justify-between items-center border-t border-border-subtle pt-1 font-bold text-primary">
        <span>Mean Risk Score:</span>
        <span className="font-mono text-secondary">{(point.avg_risk_score * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function RiskTrendChart({
  data = DEFAULT_TREND_DATA,
  isLoading = false,
  isError = false,
  onRetry,
}: RiskTrendChartProps) {
  const chartData = useMemo(() => (data.length > 0 ? data : DEFAULT_TREND_DATA), [data]);

  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-6 shadow-sm h-[380px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-outline font-sans">Loading risk trajectory data…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-6 shadow-sm h-[380px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-xs text-risk-critical font-medium">Unable to load trend data</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-secondary hover:underline"
            >
              Retry loading
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-risk-high" />
            <h3 className="font-headline text-lg font-bold text-primary">
              Temporal Risk &amp; Anomaly Trajectory
            </h3>
          </div>
          <p className="text-xs text-outline mt-0.5 font-sans">
            Evolution of flagged critical works and aggregate portfolio risk intensity over time.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-sans text-outline">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-risk-critical" />
            <span>Critical Works</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-risk-high" />
            <span>High Risk Works</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-secondary" />
            <span>Avg Risk Score</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis
              dataKey="display_name"
              stroke="#76777D"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis
              yAxisId="left"
              stroke="#76777D"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#0051D5"
              fontSize={11}
              domain={[0, 1]}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="left"
              dataKey="critical_count"
              name="Critical Risk"
              fill="#DC2626"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              yAxisId="left"
              dataKey="high_count"
              name="High Risk"
              fill="#EA580C"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avg_risk_score"
              name="Mean Risk Score"
              stroke="#0051D5"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0051D5' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
