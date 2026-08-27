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

        {/* Top 10 High Risk Section & Quick Highlights */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Top-10 Critical Works List */}
          <section className="panel lg:col-span-1" aria-label="Top 10 highest-risk works">
            <div className="panel-header">
              <h2 className="panel-title">Top-10 Highest Risk Works</h2>
              <span className="eyebrow text-risk-critical-text">Action Priority</span>
            </div>
            <div className="divide-y divide-line">
              {topProjects.slice(0, 10).map((proj: RankedProject, idx) => (
                <Link
                  key={proj.project_id}
                  href={`/project/${encodeURIComponent(proj.project_id)}`}
                  className="group flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tabular text-meta font-bold text-ink-muted">#{idx + 1}</span>
                      <span className="tabular text-caption font-semibold text-gov-700 group-hover:underline">
                        {proj.project_id}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-caption font-medium text-ink">{proj.work_type}</p>
                    <p className="mt-0.5 text-meta text-ink-muted">
                      {proj.district_name}, {proj.state_name}
                    </p>
                  </div>
                  <RiskBadge level={proj.risk_level} score={proj.overall_risk} size="sm" />
                </Link>
              ))}
            </div>
          </section>

          {/* Right Column: Visualization Panel */}
          <section className="panel lg:col-span-2 flex flex-col" aria-label="Risk distribution">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Risk Distribution</h2>
                <p className="panel-hint">Aggregated risk across states and sectors</p>
              </div>
              <div className="flex items-center gap-1 rounded-control border border-line bg-surface-sunken p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveView('state')}
                  className={`rounded-control px-2.5 py-1 text-caption font-medium ${
                    activeView === 'state' ? 'bg-surface text-ink shadow-flat' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  By State
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('treemap')}
                  className={`rounded-control px-2.5 py-1 text-caption font-medium ${
                    activeView === 'treemap' ? 'bg-surface text-ink shadow-flat' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Sector Treemap
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[300px] px-4 py-3">
              {activeView === 'treemap' && data?.work_type_risk ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={data.work_type_risk.map((item) => ({
                        name: item.name,
                        size: item.project_count,
                        mean_risk: item.mean_risk,
                        risk_level: item.risk_level,
                        fill: RISK_LEVEL_META[item.risk_level].hex,
                      }))}
                      dataKey="size"
                      aspectRatio={4 / 3}
                      stroke="#ffffff"
                      content={<CustomTreemapContent />}
                    />
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(data?.state_risk ?? []).slice(0, 9).map((sr) => (
                    <button
                      key={sr.state_id}
                      type="button"
                      onClick={() => urlState.set({ state: sr.state_id })}
                      className="flex flex-col justify-between rounded-card border border-line p-3 text-left transition-colors hover:border-gov-300 hover:bg-surface-sunken"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-body-sm font-semibold text-ink">{sr.state_name}</span>
                        <RiskBadge level={sr.risk_level} size="sm" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-caption text-ink-muted">
                        <span>{formatCount(sr.project_count)} works</span>
                        <span className="tabular font-semibold text-risk-critical-text">
                          {sr.counts_by_risk_level.CRITICAL} critical
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Filter Bar */}
        <div className="panel px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2 text-body-sm font-semibold text-ink">
              <span>Filter & Search Works</span>
              {urlState.activeFilterCount > 0 && (
                <span className="eyebrow rounded-control bg-gov-50 px-2 py-0.5 text-gov-700">
                  {urlState.activeFilterCount} active
                </span>
              )}
            </div>
            {urlState.activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => urlState.clearFilters()}
                className="text-caption font-medium text-gov-600 hover:text-gov-800"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="Search by Project ID, description, MP or IA…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-gov-500 focus:outline-none"
              />
            </div>
            <select
              value={currentRisk ?? ''}
              onChange={(e) => urlState.set({ risk: e.target.value || undefined })}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
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
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
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
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
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
          <section aria-label="Project listing" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-card-title font-semibold text-ink">
                Analyzed Works ({formatCount(projectsPage.page.total_items)})
              </h2>
              <span className="text-caption text-ink-muted">
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
