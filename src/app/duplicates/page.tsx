'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { SideBySideComparisonModal } from '@/components/SideBySideComparisonModal';
import { KPISummaryCard, KPIRow } from '@/components/KPISummaryCard';
import { PageHeader } from '@/components/shell/PageHeader';
import { EmptyState, ErrorState, TableSkeleton, CardsSkeleton } from '@/components/states';
import { useDuplicates } from '@/lib/api/hooks';
import { useUrlState } from '@/hooks/useUrlState';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { formatCount, formatDistanceKm, formatSimilarity, humanizeEnum } from '@/lib/format';
import type { DuplicatesQuery } from '@/types/query';
import type { DuplicatePairRow } from '@/types/api';
import { RefreshIcon } from '@/components/icons';

function DuplicatesContent() {
  const urlState = useUrlState();
  const { mpLabel } = useAnonymize();

  const query: DuplicatesQuery = useMemo(() => ({
    state: urlState.get('state'),
    min_similarity: urlState.get('min_similarity') ? Number(urlState.get('min_similarity')) : undefined,
    max_distance_km: urlState.get('max_distance_km') ? Number(urlState.get('max_distance_km')) : undefined,
    detection_method: urlState.get('detection_method'),
    review_status: urlState.get('review_status'),
    page: urlState.page,
    page_size: urlState.pageSize,
  }), [urlState]);

  const { data, isLoading, isError, refetch, isFetching } = useDuplicates(query);
  const [selectedPair, setSelectedPair] = useState<DuplicatePairRow | null>(null);

  useEffect(() => {
    const pairParam = urlState.get('pair');
    if (pairParam && data?.pairs?.items) {
      const match = data.pairs.items.find((p) => p.pair_id === Number(pairParam));
      if (match) {
        setSelectedPair(match);
      }
    }
  }, [urlState, data]);

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
          title="Failed to load candidate duplicates"
          body="Could not retrieve duplicate detection pairs from the audit service."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const counts = data?.counts;
  const pairsPage = data?.pairs;
  const facets = data?.facets;

  return (
    <>
      <PageHeader
        title="Duplicate Work Detection"
        description="Textual and spatial similarity matching across recommendations to identify potential double-funding or re-sanctioned works."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Duplicates' }]}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <RefreshIcon size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* KPI Cards */}
        {counts && (
          <KPIRow columns={4}>
            <KPISummaryCard
              label="Total Duplicate Pairs"
              value={formatCount(counts.total_pairs)}
              context="Pairs surfaced by NLP & GIS engines"
            />
            <KPISummaryCard
              label="Pending Review"
              value={formatCount(counts.pending_review)}
              context="Awaiting MoSPI officer verification"
              level="HIGH"
            />
            <KPISummaryCard
              label="High Similarity (≥85%)"
              value={formatCount(counts.high_similarity)}
              context="Near-identical work descriptions"
              level="CRITICAL"
            />
            <KPISummaryCard
              label="Geographically Close (≤2km)"
              value={formatCount(counts.geographically_close)}
              context="Works located in close physical proximity"
              level="MEDIUM"
            />
          </KPIRow>
        )}

        {/* Filter Bar */}
        <div className="panel px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2 text-body-sm font-semibold text-ink">
              <span>Filter Candidate Pairs</span>
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
            <select
              value={query.review_status ?? ''}
              onChange={(e) => urlState.set({ review_status: e.target.value || undefined })}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
            >
              <option value="">All Review Statuses</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="CONFIRMED_DUPLICATE">Confirmed Duplicate</option>
              <option value="NOT_A_DUPLICATE">Not A Duplicate</option>
            </select>

            <select
              value={query.detection_method ?? ''}
              onChange={(e) => urlState.set({ detection_method: e.target.value || undefined })}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
            >
              <option value="">All Detection Methods</option>
              {facets?.detection_methods.map((dm) => (
                <option key={dm.value} value={dm.value}>
                  {dm.label} ({dm.count})
                </option>
              ))}
            </select>

            <select
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
        </div>

        {/* Duplicates Table */}
        {pairsPage && (
          <section aria-label="Duplicate pairs listing" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-card-title font-semibold text-ink">
                Surfaced Pairs ({formatCount(pairsPage.page.total_items)})
              </h2>
              <span className="text-caption text-ink-muted">
                Page {pairsPage.page.page} of {pairsPage.page.total_pages}
              </span>
            </div>

            {pairsPage.items.length === 0 ? (
              <EmptyState
                title="No duplicate pairs found"
                body="Try adjusting or clearing your active filters."
                actionLabel="Clear Filters"
                onAction={() => urlState.clearFilters()}
              />
            ) : (
              <div className="panel overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" className="w-16">Pair ID</th>
                      <th scope="col">Work A (Project ID & Description)</th>
                      <th scope="col">Work B (Project ID & Description)</th>
                      <th scope="col">Similarity</th>
                      <th scope="col">Distance</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="w-28 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairsPage.items.map((pair) => (
                      <tr key={pair.pair_id}>
                        <td className="tabular font-semibold">#{pair.pair_id}</td>
                        <td>
                          <div className="space-y-0.5">
                            <Link
                              href={`/project/${encodeURIComponent(pair.project_a.project_id)}`}
                              className="tabular text-caption font-bold text-gov-700 hover:underline"
                            >
                              {pair.project_a.project_id}
                            </Link>
                            <p className="text-caption text-ink line-clamp-1">{pair.project_a.work_description}</p>
                            <p className="text-meta text-ink-muted">
                              {pair.project_a.district_name} · {mpLabel({ mp_id: pair.project_a.mp_id })}
                            </p>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            <Link
                              href={`/project/${encodeURIComponent(pair.project_b.project_id)}`}
                              className="tabular text-caption font-bold text-gov-700 hover:underline"
                            >
                              {pair.project_b.project_id}
                            </Link>
                            <p className="text-caption text-ink line-clamp-1">{pair.project_b.work_description}</p>
                            <p className="text-meta text-ink-muted">
                              {pair.project_b.district_name} · {mpLabel({ mp_id: pair.project_b.mp_id })}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className="tabular font-bold text-risk-critical-text">
                            {formatSimilarity(pair.similarity_score)}
                          </span>
                        </td>
                        <td>
                          <span className="tabular text-body-sm">
                            {formatDistanceKm(pair.geo_distance_km)}
                          </span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center rounded-control border px-2 py-0.5 text-meta font-semibold uppercase ${
                            pair.review_status === 'CONFIRMED_DUPLICATE'
                              ? 'bg-risk-critical-surface border-risk-critical-border text-risk-critical-text'
                              : pair.review_status === 'NOT_A_DUPLICATE'
                              ? 'bg-risk-low-surface border-risk-low-border text-risk-low-text'
                              : 'bg-risk-high-surface border-risk-high-border text-risk-high-text'
                          }`}>
                            {humanizeEnum(pair.review_status)}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPair(pair)}
                            className="btn-primary text-caption"
                          >
                            Compare
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Side-by-Side Comparison Modal */}
      <SideBySideComparisonModal
        pair={selectedPair}
        open={Boolean(selectedPair)}
        onClose={() => setSelectedPair(null)}
      />
    </>
  );
}

export default function DuplicatesPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} columns={6} />
      </div>
    }>
      <DuplicatesContent />
    </Suspense>
  );
}
