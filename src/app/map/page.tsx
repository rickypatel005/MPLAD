'use client';

import { Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { PageHeader } from '@/components/shell/PageHeader';
import { KPISummaryCard, KPIRow } from '@/components/KPISummaryCard';
import { ErrorState, BlockSkeleton } from '@/components/states';
import { useMapData } from '@/lib/api/hooks';
import { useUrlState } from '@/hooks/useUrlState';
import { formatCount, formatPercent } from '@/lib/format';
import type { MapQuery } from '@/types/query';
import { RefreshIcon } from '@/components/icons';

const InteractiveMap = dynamic(
  () => import('@/components/map/InteractiveMap').then((m) => m.InteractiveMap),
  {
    ssr: false,
    loading: () => <BlockSkeleton height={650} label="Loading map visualization…" />,
  }
);

function MapContent() {
  const urlState = useUrlState();

  const query: MapQuery = useMemo(() => ({
    state: urlState.get('state'),
    district: urlState.get('district'),
    risk_level: urlState.get('risk_level'),
    work_type: urlState.get('work_type'),
  }), [urlState]);

  const { data, isLoading, isError, refetch, isFetching } = useMapData(query);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-shell space-y-4 px-6 py-6">
        <BlockSkeleton height={650} />
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Could not load map data"
          body="Unable to load geospatial audit records. Please try again."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const coverage = data?.coverage;

  return (
    <>
      <PageHeader
        title="Geospatial Risk Map"
        description="Geographic distribution of analyzed works, clustering, and distance anomalies across states and districts."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Map View' }]}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <RefreshIcon size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* Coverage stats */}
        {coverage && (
          <KPIRow columns={3}>
            <KPISummaryCard
              label="Total Mapped Works"
              value={formatCount(coverage.total_projects)}
              context="Geospatially indexed projects"
            />
            <KPISummaryCard
              label="Precise GPS Coordinates"
              value={formatCount(coverage.with_gps)}
              context={`${formatPercent(coverage.with_gps / (coverage.total_projects || 1))} of portfolio`}
              level="LOW"
            />
            <KPISummaryCard
              label="District Centroid Fallbacks"
              value={formatCount(coverage.district_centroid_fallback)}
              context="Works mapped to district center point when exact GPS is absent"
              level="MEDIUM"
            />
          </KPIRow>
        )}

        {/* Filter Controls */}
        <div className="panel p-4 font-sans">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="map-state" className="eyebrow">State</label>
              <select
                id="map-state"
                value={query.state ?? ''}
                onChange={(e) => urlState.set({ state: e.target.value || undefined })}
                className="control font-medium shadow-sm"
              >
                <option value="">All States</option>
                <option value="UP">Uttar Pradesh</option>
                <option value="MH">Maharashtra</option>
                <option value="BR">Bihar</option>
                <option value="WB">West Bengal</option>
                <option value="TN">Tamil Nadu</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="map-risk" className="eyebrow">Risk Level</label>
              <select
                id="map-risk"
                value={query.risk_level ?? ''}
                onChange={(e) => urlState.set({ risk_level: e.target.value || undefined })}
                className="control font-medium shadow-sm"
              >
                <option value="">All Risk Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
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

        {/* Map Container */}
        {data && (
          <InteractiveMap
            data={data}
            selectedState={query.state}
            selectedDistrict={query.district}
          />
        )}
      </div>
    </>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<BlockSkeleton height={650} />}>
      <MapContent />
    </Suspense>
  );
}
