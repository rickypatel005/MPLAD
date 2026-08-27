'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';

import { ForceDirectedGraph } from '@/components/graph/ForceDirectedGraph';
import { GraphLegend } from '@/components/graph/GraphLegend';
import { NodeDetailPanel } from '@/components/graph/NodeDetailPanel';
import { PageHeader } from '@/components/shell/PageHeader';
import { ErrorState, BlockSkeleton } from '@/components/states';
import { useNetwork } from '@/lib/api/hooks';
import { useUrlState } from '@/hooks/useUrlState';
import type { NetworkQuery } from '@/types/query';
import { RefreshIcon } from '@/components/icons';

function NetworkContent() {
  const urlState = useUrlState();

  const query: NetworkQuery = {
    state: urlState.get('state'),
    min_weight: urlState.get('min_weight') ? Number(urlState.get('min_weight')) : undefined,
  };

  const { data, isLoading, isError, refetch, isFetching } = useNetwork(query);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const focusParam = urlState.get('focus');
    if (focusParam && data?.nodes) {
      const match = data.nodes.find((n) => n.id === focusParam);
      if (match) {
        setSelectedNodeId(match.id);
      }
    }
  }, [urlState, data]);

  const handleSelect = useCallback((id: string) => setSelectedNodeId(id), []);
  const handleClose = useCallback(() => setSelectedNodeId(null), []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-shell space-y-4 px-6 py-6">
        <BlockSkeleton height={600} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Could not load network data"
          body="The network graph failed to load. This may be a temporary issue."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const selectedDetail = selectedNodeId
    ? data.node_details.find((n) => n.node_id === selectedNodeId) ?? null
    : null;

  return (
    <>
      <PageHeader
        title="MP–Agency Concentration Network"
        description="Interactive graph showing which implementing agencies are concentrated under which MPs. Node size = total works; colour = agency risk."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Network' }]}
        actions={
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
            <RefreshIcon size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      <div className="mx-auto max-w-shell px-6 py-6">
        {/* Filter Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 panel px-4 py-3">
          <div className="flex items-center gap-2">
            <label className="eyebrow" htmlFor="net-state">State filter</label>
            <select
              id="net-state"
              value={query.state ?? ''}
              onChange={(e) => urlState.set({ state: e.target.value || undefined })}
              className="rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink"
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
            <label className="eyebrow" htmlFor="net-min">Min weight</label>
            <input
              id="net-min"
              type="number"
              min={1}
              max={100}
              placeholder="3"
              value={query.min_weight ?? ''}
              onChange={(e) => urlState.set({ min_weight: e.target.value || undefined })}
              className="w-20 rounded-control border border-line bg-surface px-3 py-1.5 text-body-sm text-ink tabular"
            />
          </div>
          <div className="ml-auto text-caption text-ink-muted">
            {data.nodes.length} nodes · {data.edges.length} edges
          </div>
        </div>

        {/* Graph + Detail Panel */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ForceDirectedGraph
              data={data}
              focusedNodeId={selectedNodeId ?? undefined}
              onSelectNode={handleSelect}
            />
          </div>
          <div className="lg:col-span-1 space-y-4">
            {selectedNodeId ? (
              <NodeDetailPanel detail={selectedDetail} onClose={handleClose} />
            ) : (
              <div className="panel flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-3 h-16 w-16 rounded-full bg-gov-50 flex items-center justify-center">
                  <span className="text-section">🔍</span>
                </div>
                <p className="text-card-title font-semibold text-ink">Select a node</p>
                <p className="mt-1 max-w-xs text-caption text-ink-muted">
                  Click any node in the graph to inspect the MP–agency relationship and see associated works.
                </p>
              </div>
            )}
            <GraphLegend />
          </div>
        </div>
      </div>
    </>
  );
}

export default function NetworkPage() {
  return (
    <Suspense fallback={<BlockSkeleton height={600} />}>
      <NetworkContent />
    </Suspense>
  );
}
