'use client';

import { RiskBadge } from '@/components/RiskBadge';

export function GraphLegend() {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-flat text-caption space-y-3">
      <h3 className="font-bold text-ink text-body-sm">Graph Legend & Risk Metrics</h3>

      {/* Node Types */}
      <div>
        <span className="font-semibold text-ink-muted block mb-1">Entity Node Types</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-blue-600 inline-block" />
            <span>Implementing Agency (IA)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
            <span>Member of Parliament (MP)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-600 inline-block" />
            <span>District</span>
          </div>
        </div>
      </div>

      {/* Risk Color Thresholds */}
      <div>
        <span className="font-semibold text-ink-muted block mb-1">Concentration Risk (HHI Index)</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span>LOW (&lt;0.25)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span>MEDIUM (0.25–0.50)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            <span>HIGH (0.50–0.75)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            <span>CRITICAL (&gt;0.75)</span>
          </div>
        </div>
      </div>

      {/* Size & Links */}
      <div className="grid grid-cols-2 gap-2 text-ink-muted border-t border-line pt-2">
        <div>
          <span className="font-medium text-ink">Node Size:</span> Proportional to total work count
        </div>
        <div>
          <span className="font-medium text-ink">Edge Width:</span> Number of shared works between entities
        </div>
      </div>
    </div>
  );
}
