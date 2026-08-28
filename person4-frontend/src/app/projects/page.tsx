'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';

import { AnonymizeToggle } from '@/components/AnonymizeToggle';
import { RankedProjectTable } from '@/components/RankedProjectTable';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { SearchIcon, RefreshIcon } from '@/components/icons';
import { useUrlSearch, useUrlState } from '@/hooks/useUrlState';
import { useDashboard } from '@/lib/api/hooks';
import { formatCount } from '@/lib/format';
import type { DashboardQuery } from '@/types/query';
import type { RiskLevel, SortOrder } from '@/types/api';

function ProjectsDirectoryContent() {
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

  const projectsPage = data?.projects;
  const facets = data?.facets;

  const currentRisk = urlState.get('risk');
  const currentState = urlState.get('state');
  const currentWorkType = urlState.get('work_type');

  return (
    <>
      <PageHeader
        title="Civic Projects Directory"
        description="Comprehensive audit repository of all analyzed MPLADS works, ranked by six-dimensional risk index."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Projects' },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <AnonymizeToggle />
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="btn-secondary"
            >
              <RefreshIcon size={14} />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* Search & Filter Bar */}
        <div className="panel p-4 bg-white shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Project ID, work description, district, or category…"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              {/* Risk Level Filter */}
              <select
                value={currentRisk ?? ''}
                onChange={(e) => urlState.set({ risk: e.target.value || null })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="">All Risk Bands</option>
                <option value="CRITICAL">Critical (≥0.70)</option>
                <option value="HIGH">High (0.50–0.69)</option>
                <option value="MEDIUM">Medium (0.30–0.49)</option>
                <option value="LOW">Low (&lt;0.30)</option>
              </select>

              {/* State Filter */}
              {facets?.states && (
                <select
                  value={currentState ?? ''}
                  onChange={(e) => urlState.set({ state: e.target.value || null })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none max-w-[160px] truncate"
                >
                  <option value="">All States ({facets.states.length})</option>
                  {facets.states.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label} ({s.count})
                    </option>
                  ))}
                </select>
              )}

              {/* Work Type Filter */}
              {facets?.work_types && (
                <select
                  value={currentWorkType ?? ''}
                  onChange={(e) => urlState.set({ work_type: e.target.value || null })}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none max-w-[160px] truncate"
                >
                  <option value="">All Categories ({facets.work_types.length})</option>
                  {facets.work_types.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.value} ({w.count})
                    </option>
                  ))}
                </select>
              )}

              {/* Reset Filters */}
              {(currentRisk || currentState || currentWorkType || searchValue) && (
                <button
                  type="button"
                  onClick={() => urlState.clearFilters()}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1">
            <span>
              Showing {projectsPage ? formatCount(projectsPage.page.total_items) : '…'} matching works
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Page {projectsPage?.page.page || 1} of {projectsPage?.page.total_pages || 1}
            </span>
          </div>
        </div>

        {/* Table Content State */}
        {isLoading && !data ? (
          <TableSkeleton rows={15} columns={6} />
        ) : isError && !data ? (
          <div className="panel p-12">
            <ErrorState
              title="Failed to load projects list"
              body="Unable to query project records from the central audit database."
              onRetry={() => refetch()}
            />
          </div>
        ) : projectsPage && projectsPage.items.length > 0 ? (
          <section className="panel bg-white shadow-sm overflow-hidden" aria-label="Risk ranked projects table">
            <RankedProjectTable
              projects={projectsPage.items}
              page={projectsPage.page}
              sortBy={sortBy}
              order={order}
              onSort={(field, newOrder) => {
                urlState.set({ sort: field, order: newOrder });
              }}
              onPageChange={(p) => urlState.set({ page: p })}
              onPageSizeChange={(ps) => urlState.set({ page_size: ps })}
              isFetching={isFetching}
              variant="full"
            />
          </section>
        ) : (
          <div className="panel p-12">
            <EmptyState
              title="No matching projects found"
              body="Try widening your search terms or clearing active filters."
              actionLabel="Clear all filters"
              onAction={() => urlState.clearFilters()}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default function ProjectsDirectoryPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={15} columns={6} />}>
      <ProjectsDirectoryContent />
    </Suspense>
  );
}
