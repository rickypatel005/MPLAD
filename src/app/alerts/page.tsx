'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';

import { KPISummaryCard, KPIRow } from '@/components/KPISummaryCard';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton, CardsSkeleton } from '@/components/states';
import { RiskBadge } from '@/components/RiskBadge';
import { useAlerts, useAcknowledgeAlert } from '@/lib/api/hooks';
import { useUrlState } from '@/hooks/useUrlState';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { formatCount, formatRelativeTime, humanizeEnum } from '@/lib/format';
import type { AlertsQuery } from '@/types/query';
import type { AlertRow } from '@/types/api';
import { RefreshIcon, CheckIcon, ExternalLinkIcon } from '@/components/icons';

function AlertsContent() {
  const urlState = useUrlState();
  const { mpLabel } = useAnonymize();

  const query: AlertsQuery = useMemo(() => ({
    state: urlState.get('state'),
    alert_type: urlState.get('alert_type'),
    acknowledged: urlState.get('acknowledged'),
    page: urlState.page,
    page_size: urlState.pageSize,
  }), [urlState]);

  const { data, isLoading, isError, refetch, isFetching } = useAlerts(query);
  const ackMutation = useAcknowledgeAlert();

  const [ackActionText, setAckActionText] = useState<Record<number, string>>({});

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Could not load alert feed"
          body="Unable to fetch alert records from the server."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const unackCount = data?.unacknowledged_count ?? 0;
  const countsByLevel = data?.counts_by_level;
  const alertsPage = data?.alerts;
  const facets = data?.facets;

  const handleAcknowledge = (alertId: number) => {
    const text = ackActionText[alertId] || 'Acknowledged in audit review session';
    ackMutation.mutate({
      alertId,
      acknowledged_by: 'MoSPI Audit Officer',
      action_taken: text,
    });
  };

  return (
    <>
      <PageHeader
        title="Alert Feed"
        description="Real-time stream of high and critical risk notifications requiring officer review and acknowledgment."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Alerts' }]}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <RefreshIcon size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* KPI Row */}
        {countsByLevel && (
          <KPIRow columns={4}>
            <KPISummaryCard
              label="Unacknowledged Alerts"
              value={formatCount(unackCount)}
              context="Action required by inspecting officer"
              level={unackCount > 0 ? 'CRITICAL' : 'LOW'}
            />
            <KPISummaryCard
              label="Critical Severity"
              value={formatCount(countsByLevel.CRITICAL)}
              context="Priority escalation alerts"
              level="CRITICAL"
            />
            <KPISummaryCard
              label="High Severity"
              value={formatCount(countsByLevel.HIGH)}
              context="Corroborating anomaly flags"
              level="HIGH"
            />
            <KPISummaryCard
              label="Medium / Low Severity"
              value={formatCount(countsByLevel.MEDIUM + countsByLevel.LOW)}
              context="Informational audit flags"
              level="LOW"
            />
          </KPIRow>
        )}

        {/* Filter Bar */}
        <div className="panel px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="alert-status" className="eyebrow">Status</label>
              <select
                id="alert-status"
                value={query.acknowledged ?? ''}
                onChange={(e) => urlState.set({ acknowledged: e.target.value || undefined })}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
              >
                <option value="">All Alerts</option>
                <option value="false">Unacknowledged Only</option>
                <option value="true">Acknowledged Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="alert-type" className="eyebrow">Alert Type</label>
              <select
                id="alert-type"
                value={query.alert_type ?? ''}
                onChange={(e) => urlState.set({ alert_type: e.target.value || undefined })}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
              >
                <option value="">All Alert Types</option>
                {facets?.alert_types.map((at) => (
                  <option key={at.value} value={at.value}>
                    {at.label} ({at.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="alert-state" className="eyebrow">State</label>
              <select
                id="alert-state"
                value={query.state ?? ''}
                onChange={(e) => urlState.set({ state: e.target.value || undefined })}
                className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
              >
                <option value="">All States</option>
                {facets?.states.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label} ({st.count})
                  </option>
                ))}
              </select>
            </div>

            {urlState.activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => urlState.clearFilters()}
                className="ml-auto text-caption font-medium text-gov-600 hover:text-gov-800"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Alert List */}
        {alertsPage && (
          <section aria-label="Alert feed listing" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-card-title font-semibold text-ink">
                Alert Items ({formatCount(alertsPage.page.total_items)})
              </h2>
              <span className="text-caption text-ink-muted">
                Page {alertsPage.page.page} of {alertsPage.page.total_pages}
              </span>
            </div>

            {alertsPage.items.length === 0 ? (
              <EmptyState
                title="No alerts match the active filters"
                body="Try adjusting or clearing your filters."
                actionLabel="Clear Filters"
                onAction={() => urlState.clearFilters()}
              />
            ) : (
              <div className="space-y-3">
                {alertsPage.items.map((alert: AlertRow) => (
                  <div
                    key={alert.alert_id}
                    className={`panel p-4 transition-colors ${
                      !alert.is_acknowledged ? 'border-l-4 border-l-risk-critical' : 'opacity-85'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <RiskBadge level={alert.alert_level} score={alert.overall_risk} size="sm" />
                          <span className="eyebrow rounded-control bg-surface-sunken px-2 py-0.5 border border-line">
                            {humanizeEnum(alert.alert_type)}
                          </span>
                          <span className="text-caption text-ink-muted">
                            {formatRelativeTime(alert.created_at)}
                          </span>
                        </div>

                        <p className="text-body font-medium leading-relaxed text-ink mt-1">
                          {alert.alert_message}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-caption text-ink-muted pt-1">
                          <Link
                            href={`/project/${encodeURIComponent(alert.project_id)}`}
                            className="tabular font-bold text-gov-700 hover:underline flex items-center gap-1"
                          >
                            Project {alert.project_id} <ExternalLinkIcon size={12} />
                          </Link>
                          <span>·</span>
                          <span>{alert.district_name}, {alert.state_name}</span>
                          <span>·</span>
                          <span>MP: {mpLabel({ mp_id: alert.mp_id })}</span>
                        </div>
                      </div>

                      <div className="shrink-0 space-y-2 text-right">
                        {alert.is_acknowledged ? (
                          <div className="rounded-control bg-risk-low-surface border border-risk-low-border px-3 py-1.5 text-caption text-risk-low-text">
                            <span className="font-bold block">✓ Acknowledged</span>
                            <span className="text-meta opacity-90">{alert.acknowledged_by}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Action notes…"
                              value={ackActionText[alert.alert_id] ?? ''}
                              onChange={(e) =>
                                setAckActionText({ ...ackActionText, [alert.alert_id]: e.target.value })
                              }
                              className="w-40 rounded-control border border-line bg-surface px-2.5 py-1 text-caption text-ink focus:outline-none focus:border-gov-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alert.alert_id)}
                              disabled={ackMutation.isPending}
                              className="btn-primary text-caption whitespace-nowrap"
                            >
                              <CheckIcon size={13} />
                              Acknowledge
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

export default function AlertsPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} columns={6} />
      </div>
    }>
      <AlertsContent />
    </Suspense>
  );
}
