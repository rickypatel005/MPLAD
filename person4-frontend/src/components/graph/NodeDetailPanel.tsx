'use client';

import Link from 'next/link';

import type { NetworkNodeDetail } from '@/types/api';
import { RiskBadge } from '@/components/RiskBadge';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { formatCount } from '@/lib/format';
import { riskLevelFromScore } from '@/lib/risk';
import { DEEP_LINKS } from '@/lib/nav';
import { CloseIcon, ExternalLinkIcon, AlertTriangleIcon } from '@/components/icons';

interface NodeDetailPanelProps {
  detail: NetworkNodeDetail | null;
  onClose: () => void;
}

export function NodeDetailPanel({ detail, onClose }: NodeDetailPanelProps) {
  if (!detail) return null;

  const level = riskLevelFromScore(detail.risk ?? 0);
  const isCritical = (detail.risk ?? 0) >= 0.75;

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-start justify-between border-b border-line pb-3">
        <div>
          <span className="eyebrow">{detail.type} Inspector</span>
          <h3 className="text-card-title font-bold text-ink">{detail.label}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface-sunken hover:text-ink">
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between rounded-control bg-surface-sunken p-3 border border-line">
        <div>
          <span className="eyebrow block">Concentration</span>
          {detail.hhi !== null && (
            <span className="tabular text-body-sm font-bold text-ink">HHI: {detail.hhi.toFixed(2)}</span>
          )}
        </div>
        <RiskBadge level={level} score={detail.risk} size="md" />
      </div>

      {detail.evidence && (
        <div className={`rounded-control p-3 border text-caption font-medium ${
          isCritical
            ? 'bg-risk-critical-surface border-risk-critical-border text-risk-critical-text'
            : 'bg-risk-high-surface border-risk-high-border text-risk-high-text'
        }`}>
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <AlertTriangleIcon size={14} /> Concentration Finding
          </div>
          <p>{detail.evidence}</p>
        </div>
      )}

      <dl className="space-y-2 text-caption">
        <div className="flex justify-between py-1 border-b border-line">
          <dt className="text-ink-muted">Total Works</dt>
          <dd className="tabular font-semibold">{formatCount(detail.project_count)}</dd>
        </div>
        {detail.completed_projects !== null && (
          <div className="flex justify-between py-1 border-b border-line">
            <dt className="text-ink-muted">Completed</dt>
            <dd className="tabular font-semibold">{formatCount(detail.completed_projects)}</dd>
          </div>
        )}
        {detail.avg_delay_days !== null && (
          <div className="flex justify-between py-1 border-b border-line">
            <dt className="text-ink-muted">Avg Delay</dt>
            <dd className="tabular font-semibold text-risk-critical-text">{detail.avg_delay_days} days</dd>
          </div>
        )}
        {detail.top_relationship && (
          <div className="py-2 border-b border-line space-y-1">
            <dt className="text-ink-muted">Dominant Relationship</dt>
            <dd className="font-semibold text-ink">
              {detail.top_relationship.label} ({detail.top_relationship.project_count} works, {Math.round(detail.top_relationship.share * 100)}% share)
            </dd>
          </div>
        )}
      </dl>

      <Link
        href={DEEP_LINKS.dashboardForIA(detail.node_id)}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        View Works on Dashboard <ExternalLinkIcon size={14} />
      </Link>
    </div>
  );
}
