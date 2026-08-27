'use client';

import { Suspense, useMemo } from 'react';

import { KPISummaryCard, KPIRow } from '@/components/KPISummaryCard';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton, CardsSkeleton } from '@/components/states';
import { useComplianceSummary } from '@/lib/api/hooks';
import { useUrlState } from '@/hooks/useUrlState';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { formatCount, formatLakhs, formatPercent } from '@/lib/format';
import type { ComplianceQuery } from '@/types/query';
import type { ComplianceStatus } from '@/types/api';
import { RefreshIcon, AlertTriangleIcon } from '@/components/icons';

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const styles: Record<ComplianceStatus, string> = {
    COMPLIANT: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    AT_RISK: 'bg-amber-50 border-amber-300 text-amber-900',
    NON_COMPLIANT: 'bg-red-50 border-red-300 text-red-800',
    NO_DATA: 'bg-slate-100 border-slate-300 text-slate-500',
  };

  const labels: Record<ComplianceStatus, string> = {
    COMPLIANT: 'Compliant',
    AT_RISK: 'At Risk',
    NON_COMPLIANT: 'Non-Compliant',
    NO_DATA: 'No Data',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider font-sans shadow-sm ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ComplianceContent() {
  const urlState = useUrlState();
  const { mpLabel, constituencyLabel } = useAnonymize();

  const query: ComplianceQuery = useMemo(() => ({
    state: urlState.get('state'),
    fy: urlState.get('fy'),
    rule_id: urlState.get('rule_id'),
  }), [urlState]);

  const { data, isLoading, isError, refetch, isFetching } = useComplianceSummary(query);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={3} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Could not load compliance summary"
          body="Unable to retrieve guideline compliance metrics from the audit service."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const national = data?.national;
  const scst = data?.scst_mandate;
  const rules = data?.rules ?? [];
  const matrix = data?.matrix ?? [];
  const states = data?.states ?? [];

  return (
    <>
      <PageHeader
        title="MPLADS Compliance Monitor"
        description="State-by-state compliance matrix against official MPLADS Guidelines: 45-day sanction window, 12-month completion, stage photos, and SC/ST expenditure mandates."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Compliance' }]}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <RefreshIcon size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* National Compliance KPIs */}
        {national && (
          <KPIRow columns={3}>
            <KPISummaryCard
              label="Overall Guideline Compliance"
              value={formatPercent(national.overall_compliance_rate)}
              context="Across all assessed rules and projects"
              level={national.overall_compliance_rate >= 0.85 ? 'LOW' : 'HIGH'}
            />
            <KPISummaryCard
              label="Projects Assessed"
              value={formatCount(national.projects_assessed)}
              context="Total portfolio under active compliance tracking"
            />
            <KPISummaryCard
              label="Rules Breached"
              value={formatCount(national.rules_breached)}
              context="Individual rule breaches detected across all works"
              level="CRITICAL"
            />
          </KPIRow>
        )}

        {/* SC/ST Expenditure Mandate Tracking */}
        {scst && (
          <section className="panel" aria-label="SC/ST expenditure mandate">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">SC / ST Expenditure Mandate Tracker</h2>
                <p className="panel-hint">
                  Guidelines mandate 15% SC area and 7.5% ST area recommended outlay per MP portfolio.
                </p>
              </div>
              {scst.below_threshold_count > 0 && (
                <span className="eyebrow text-risk-critical-text font-bold flex items-center gap-1">
                  <AlertTriangleIcon size={14} />
                  {scst.below_threshold_count} MPs below 10% SC threshold
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Member of Parliament</th>
                    <th scope="col">Constituency & State</th>
                    <th scope="col">Total Recommended</th>
                    <th scope="col">SC Share (%)</th>
                    <th scope="col">SC Mandate Status</th>
                    <th scope="col">ST Share (%)</th>
                    <th scope="col">ST Mandate Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scst.rows.map((row) => (
                    <tr
                      key={row.mp_id}
                      className={row.below_ten_percent_sc ? 'bg-risk-critical-surface/40' : undefined}
                    >
                      <td className="font-semibold text-ink">
                        {mpLabel({ mp_id: row.mp_id })}
                      </td>
                      <td>
                        <span className="text-body-sm">{constituencyLabel({ mp_id: row.mp_id, constituency_name: row.constituency_name })}</span>
                        <span className="text-caption text-ink-muted"> ({row.state_name})</span>
                      </td>
                      <td className="tabular">{formatLakhs(row.total_recommended_lakhs)}</td>
                      <td className={`tabular font-bold ${row.below_ten_percent_sc ? 'text-risk-critical-text' : 'text-ink'}`}>
                        {formatPercent(row.sc_share, 1)}
                      </td>
                      <td><StatusBadge status={row.sc_status} /></td>
                      <td className="tabular font-bold">{formatPercent(row.st_share, 1)}</td>
                      <td><StatusBadge status={row.st_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* State Compliance Matrix */}
        <section className="panel" aria-label="Rule compliance by state">
          <div className="panel-header">
            <h2 className="panel-title">Rule Compliance Rate by State</h2>
            <span className="panel-hint">Cell value = % of applicable projects complying with rule</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col" className="text-center">Overall</th>
                  {rules.map((r) => (
                    <th key={r.rule_id} scope="col" title={`${r.requirement} (${r.reference})`}>
                      {r.rule_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {states.map((st) => (
                  <tr key={st.state_id}>
                    <td className="font-semibold text-ink">{st.state_name}</td>
                    <td className="text-center font-bold">
                      {formatPercent(st.overall_compliance_rate)}
                    </td>
                    {rules.map((r) => {
                      const cell = matrix.find(
                        (m) => m.state_id === st.state_id && m.rule_id === r.rule_id
                      );
                      return (
                        <td key={r.rule_id} className="text-center">
                          {cell ? (
                            <div title={cell.evidence} className="inline-flex flex-col items-center">
                              <StatusBadge status={cell.status} />
                              <span className="tabular text-meta text-ink-muted mt-0.5">
                                {formatPercent(cell.compliance_rate)}
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default function CompliancePage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={3} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    }>
      <ComplianceContent />
    </Suspense>
  );
}
