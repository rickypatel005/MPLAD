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
        <div className="panel p-4 font-sans">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="alert-status" className="eyebrow">Status</label>
              <select
                id="alert-status"
                value={query.acknowledged ?? ''}
                onChange={(e) => urlState.set({ acknowledged: e.target.value || undefined })}
                className="control font-medium shadow-sm"
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
                className="control font-medium shadow-sm"
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
                className="control font-medium shadow-sm"
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
                className="ml-auto text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Alert List */}
        {alertsPage && (
          <section aria-label="Alert feed listing" className="space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Alert Items ({formatCount(alertsPage.page.total_items)})
              </h2>
              <span className="text-xs font-semibold text-slate-500 font-sans">
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
              <div className="space-y-3.5">
                {alertsPage.items.map((alert: AlertRow) => (
                  <div
                    key={alert.alert_id}
                    className={`panel p-5 transition-all duration-200 hover:shadow-md ${
                      !alert.is_acknowledged ? 'border-l-4 border-l-red-600 bg-white' : 'opacity-90 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <RiskBadge level={alert.alert_level} score={alert.overall_risk} size="sm" />
                          <span className="eyebrow rounded-full bg-slate-100 px-2.5 py-0.5 border border-slate-200">
                            {humanizeEnum(alert.alert_type)}
                          </span>
                          <span className="text-xs text-slate-500 font-sans font-medium">
                            {formatRelativeTime(alert.created_at)}
                          </span>
                        </div>

                        <p className="text-sm font-semibold leading-relaxed text-slate-900 mt-1 font-sans">
                          {alert.alert_message}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-sans pt-1">
                          <Link
                            href={`/project/${encodeURIComponent(alert.project_id)}`}
                            className="font-mono font-bold text-amber-700 hover:underline flex items-center gap-1"
                          >
                            Project {alert.project_id} <ExternalLinkIcon size={12} />
                          </Link>
                          <span>&bull;</span>
                          <span className="font-medium text-slate-700">{alert.district_name}, {alert.state_name}</span>
                          <span>&bull;</span>
                          <span className="font-medium text-slate-700">MP: {mpLabel({ mp_id: alert.mp_id })}</span>
                        </div>
                      </div>

                      <div className="shrink-0 space-y-2 text-right">
                        {alert.is_acknowledged ? (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-300 px-3.5 py-2 text-xs text-emerald-900 font-sans shadow-sm">
                            <span className="font-bold block text-emerald-800">✓ Acknowledged</span>
                            <span className="text-[0.65rem] font-semibold text-emerald-700">{alert.acknowledged_by}</span>
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
                              className="control h-9 w-44 text-xs font-medium shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleAcknowledge(alert.alert_id)}
                              disabled={ackMutation.isPending}
                              className="btn-primary h-9 text-xs whitespace-nowrap"
                            >
                              <CheckIcon size={14} />
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
