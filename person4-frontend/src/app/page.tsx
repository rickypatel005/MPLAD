'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { ResponsiveContainer, Treemap } from 'recharts';

import { AnonymizeToggle } from '@/components/AnonymizeToggle';
import { KPISummaryCard, KPIRow, RiskCountsBar } from '@/components/KPISummaryCard';
import { RankedProjectTable } from '@/components/RankedProjectTable';
import { RiskBadge } from '@/components/RiskBadge';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton, CardsSkeleton, BlockSkeleton } from '@/components/states';
import { IndiaNationalRiskMap } from '@/components/map/IndiaNationalRiskMap';
import { RiskTrendChart } from '@/components/RiskTrendChart';
import { RefreshIcon } from '@/components/icons';
import { useUrlSearch, useUrlState } from '@/hooks/useUrlState';
import { useAnalyze, useDashboard } from '@/lib/api/hooks';
import { formatLakhs, formatCount, formatDate, formatPercent } from '@/lib/format';
import { RISK_LEVEL_META, riskLevelFromScore } from '@/lib/risk';
import type { DashboardQuery } from '@/types/query';
import type { RankedProject, RiskLevel, SortOrder } from '@/types/api';

function DashboardContent() {
  const urlState = useUrlState();
  const [searchValue, setSearchValue] = useUrlSearch('q', 300);

  const sortBy = urlState.get('sort') ?? 'overall_risk';
  const order = (urlState.get('order') as SortOrder) ?? 'desc';

  const query: DashboardQuery = useMemo(() => ({
    state: urlState.get('state'),
    district: urlState.get('district'),
    risk: urlState.get('risk') as RiskLevel | undefined,
    work_type: urlState.get('work_type'),
    q: urlState.get('q'),
    sort: sortBy,
    order,
    page: urlState.page,
    page_size: urlState.pageSize,
  }), [urlState, sortBy, order]);

  const { data, isLoading, isError, refetch, isFetching } = useDashboard(query);
  const analyzeMutation = useAnalyze();

  const [activeView, setActiveView] = useState<'state' | 'treemap'>('state');

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={5} />
        <BlockSkeleton height={360} />
        <TableSkeleton rows={10} columns={6} />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Failed to load dashboard data"
          body="Could not connect to the audit intelligence service. Please retry."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const kpis = data?.kpis;
  const topProjects = data?.top_projects ?? [];
  const projectsPage = data?.projects;
  const facets = data?.facets;

  const currentRisk = urlState.get('risk');
  const currentState = urlState.get('state');
  const currentWorkType = urlState.get('work_type');

  return (
    <>
      <PageHeader
        title="Risk Dashboard"
        description="National, state, and district overview of analyzed MPLADS works, ranked by risk score."
        actions={
          <div className="flex items-center gap-3">
            <AnonymizeToggle />
            <button
              type="button"
              disabled={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate({})}
              className="btn-primary"
            >
              <RefreshIcon size={14} />
              {analyzeMutation.isPending ? 'Re-scoring…' : 'Re-run Analysis'}
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-16">
        {/* KPI Summary Row */}
        {kpis && (
          <KPIRow columns={5}>
            <KPISummaryCard
              label="Projects Analyzed"
              value={formatCount(kpis.total_projects_analyzed)}
              context={`Total outlay: ${formatLakhs(kpis.total_estimated_cost_lakhs)}`}
              footer={<RiskCountsBar counts={kpis.counts_by_risk_level} />}
            />
            <KPISummaryCard
              label="Critical Risk Works"
              value={formatCount(kpis.counts_by_risk_level.CRITICAL)}
              context={`${formatCount(kpis.counts_by_risk_level.HIGH)} high-risk works also flagged`}
              level="CRITICAL"
            />
            <KPISummaryCard
              label="Medium / Low Works"
              value={formatCount(kpis.counts_by_risk_level.MEDIUM + kpis.counts_by_risk_level.LOW)}
              context={`${formatCount(kpis.counts_by_risk_level.LOW)} assessed as low risk`}
              level="LOW"
            />
            <KPISummaryCard
              label="Highest Risk District"
              value={kpis.top_risk_district?.district_name ?? '—'}
              context={kpis.top_risk_district ? `${kpis.top_risk_district.state_name} — mean risk ${formatPercent(kpis.top_risk_district.mean_risk)}` : 'No data'}
              level={kpis.top_risk_district ? riskLevelFromScore(kpis.top_risk_district.mean_risk) : undefined}
              href={kpis.top_risk_district ? `/?state=${kpis.top_risk_district.state_name}` : undefined}
            />
            <KPISummaryCard
              label="Engine Version"
              value={kpis.model_version}
              context={`Last scored: ${formatDate(kpis.last_scored_at)}`}
            />
          </KPIRow>
        )}

        {/* India National State Risk Map Section */}
        <IndiaNationalRiskMap
          statesData={(data?.state_risk ?? []).map((sr) => ({
            state_id: sr.state_id,
            state_name: sr.state_name,
            risk_score: sr.mean_risk,
            risk_level: sr.risk_level,
            project_count: sr.project_count,
            critical_count: sr.counts_by_risk_level?.CRITICAL ?? 0,
            high_count: sr.counts_by_risk_level?.HIGH ?? 0,
            total_outlay_lakhs: (sr as any).total_estimated_cost_lakhs ?? (sr.project_count * 25.5),
          }))}
          selectedState={currentState}
          onSelectState={(stateId) => urlState.set({ state: stateId || undefined, page: 1 })}
          isLoading={isFetching}
        />

        {/* Temporal Risk Trajectory & Top High-Risk Section */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Risk Trend Chart (8 cols) */}
          <div className="lg:col-span-8">
            <RiskTrendChart onRetry={() => refetch()} />
          </div>

          {/* Top-10 Critical Works List (4 cols) */}
          <section className="bg-surface-container-lowest border border-border-subtle rounded-xl p-5 shadow-sm lg:col-span-4 flex flex-col justify-between" aria-label="Top 10 highest-risk works">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-critical" />
                  <h3 className="font-headline text-base font-bold text-primary">Top Priority Works</h3>
                </div>
                <span className="font-mono text-[10px] font-bold text-risk-critical bg-risk-critical/10 px-2 py-0.5 rounded border border-risk-critical/20">
                  Critical
                </span>
              </div>
              <div className="divide-y divide-border-subtle font-sans max-h-[300px] overflow-y-auto pr-1">
                {topProjects.slice(0, 6).map((proj: RankedProject, idx) => (
                  <Link
                    key={proj.project_id}
                    href={`/project/${encodeURIComponent(proj.project_id)}`}
                    className="group flex items-start justify-between gap-3 py-2.5 transition-all duration-150 hover:bg-slate-50 px-1 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-outline">#{idx + 1}</span>
                        <span className="font-mono text-xs font-bold text-primary group-hover:text-secondary group-hover:underline">
                          {proj.project_id}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-800">{proj.work_type}</p>
                      <p className="text-[10px] text-outline">
                        {proj.district_name}, {proj.state_name}
                      </p>
                    </div>
                    <RiskBadge level={proj.risk_level} score={proj.overall_risk} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-border-subtle mt-2">
              <Link
                href="/projects?risk=CRITICAL"
                className="w-full text-center block text-xs font-semibold text-secondary hover:text-secondary-container hover:underline py-1"
              >
                View all critical works →
              </Link>
            </div>
          </section>
        </div>

        {/* Filter Bar */}
        <div className="panel p-5 font-sans">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
              <span className="font-display text-lg">Filter & Search Works</span>
              {urlState.activeFilterCount > 0 && (
                <span className="eyebrow rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800 border border-amber-300">
                  {urlState.activeFilterCount} active
                </span>
              )}
            </div>
            {urlState.activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => urlState.clearFilters()}
                className="text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[260px]">
              <input
                type="text"
                placeholder="Search by Project ID, description, MP or IA…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full control shadow-sm"
              />
            </div>
            <select
              value={currentRisk ?? ''}
              onChange={(e) => urlState.set({ risk: e.target.value || undefined })}
              className="control shadow-sm font-medium"
            >
              <option value="">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              value={currentState ?? ''}
              onChange={(e) => urlState.set({ state: e.target.value || undefined })}
              className="control shadow-sm font-medium"
            >
              <option value="">All States</option>
              {facets?.states.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label} ({formatCount(st.count)})
                </option>
              ))}
            </select>
            <select
              value={currentWorkType ?? ''}
              onChange={(e) => urlState.set({ work_type: e.target.value || undefined })}
              className="control shadow-sm font-medium"
            >
              <option value="">All Work Types</option>
              {facets?.work_types.map((wt) => (
                <option key={wt.value} value={wt.value}>
                  {wt.label} ({formatCount(wt.count)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Ranked Project Table */}
        {projectsPage && (
          <section aria-label="Project listing" className="space-y-4 font-sans">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Analyzed Works ({formatCount(projectsPage.page.total_items)})
              </h2>
              <span className="text-xs font-semibold text-slate-500 font-sans">
                Page {projectsPage.page.page} of {projectsPage.page.total_pages}
              </span>
            </div>

            {projectsPage.items.length === 0 ? (
              <EmptyState
                title="No works match the selected filters"
                body="Try resetting your active filters or searching with a different term."
                actionLabel="Clear Filters"
                onAction={() => urlState.clearFilters()}
              />
            ) : (
              <RankedProjectTable
                projects={projectsPage.items}
                page={projectsPage.page}
                sortBy={sortBy}
                order={order}
                onSort={(field, dir) => urlState.set({ sort: field, order: dir })}
                onPageChange={(p) => urlState.set({ page: p })}
                onPageSizeChange={(ps) => urlState.set({ page_size: ps })}
                isFetching={isFetching}
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={5} />
        <BlockSkeleton height={360} />
        <TableSkeleton rows={10} columns={6} />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

/** Custom render content for Recharts Treemap */
function CustomTreemapContent(props: Record<string, any>) {
  const { x, y, width, height, name, mean_risk, fill } = props;
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: '#fff', strokeWidth: 2, opacity: 0.9 }} />
      <text x={x + 6} y={y + 18} fill="#fff" fontSize={11} fontWeight="bold" style={{ pointerEvents: 'none' }}>
        {name && name.length > width / 7 ? `${name.slice(0, Math.floor(width / 7))}…` : name}
      </text>
      {height > 45 && (
        <text x={x + 6} y={y + 32} fill="#fff" fontSize={10} opacity={0.9} style={{ pointerEvents: 'none' }}>
          {typeof mean_risk === 'number' ? `${(mean_risk * 100).toFixed(0)}% risk` : ''}
        </text>
      )}
    </g>
  );
}
