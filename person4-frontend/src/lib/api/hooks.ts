'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import type {
  AcknowledgeAlertRequest,
  AlertRow,
  AlertsResponse,
  AnalyzeRequest,
  AnalyzeResponse,
  ComplianceSummaryResponse,
  DashboardResponse,
  DuplicatePairRow,
  DuplicatesResponse,
  MapDataResponse,
  NetworkResponse,
  ProjectDetailResponse,
  ReportResponse,
} from '@/types/api';
import type {
  AlertsQuery,
  ComplianceQuery,
  DashboardQuery,
  DuplicatesQuery,
  MapQuery,
  NetworkQuery,
} from '@/types/query';
import {
  acknowledgeAlert,
  getAlerts,
  getComplianceSummary,
  getDashboard,
  getDuplicates,
  getMapData,
  getNetwork,
  getProject,
  getReport,
  postAnalyze,
  reviewDuplicatePair,
} from '@/lib/api/endpoints';

/**
 * Server-state hooks.
 *
 * Caching is deliberate per endpoint rather than uniform:
 *
 * - `/dashboard` and `/alerts` are paginated and filtered server-side, so their keys
 *   include the full query. `placeholderData: keepPreviousData` keeps the previous
 *   page's rows on screen while the next page loads, so paging never blanks the
 *   table (TRD §8).
 * - `/network` and `/map-data` return large payloads that do not change between
 *   filter tweaks, so they are cached for the whole session (`staleTime: Infinity`)
 *   and refetched only on an explicit user action. Re-downloading the graph on every
 *   navigation would be the single biggest avoidable cost in the demo.
 * - `/project/{id}` is cached per id so the back-and-forth between the dashboard and
 *   a project page is instant — that round trip happens repeatedly in the script.
 */

/** Cache keys in one place, so invalidation after `/analyze` cannot miss a view. */
export const queryKeys = {
  dashboard: (query: DashboardQuery) => ['dashboard', query] as const,
  project: (projectId: string) => ['project', projectId] as const,
  alerts: (query: AlertsQuery) => ['alerts', query] as const,
  network: (query: NetworkQuery) => ['network', query] as const,
  mapData: (query: MapQuery) => ['map-data', query] as const,
  duplicates: (query: DuplicatesQuery) => ['duplicates', query] as const,
  compliance: (query: ComplianceQuery) => ['compliance-summary', query] as const,
  report: (projectId: string) => ['report', projectId] as const,
} as const;

const SESSION_CACHE = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
} as const;

export function useDashboard(query: DashboardQuery): UseQueryResult<DashboardResponse> {
  return useQuery({
    queryKey: queryKeys.dashboard(query),
    queryFn: ({ signal }) => getDashboard(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useProject(
  projectId: string | undefined,
): UseQueryResult<ProjectDetailResponse> {
  return useQuery({
    queryKey: queryKeys.project(projectId ?? ''),
    queryFn: ({ signal }) => getProject(projectId as string, signal),
    enabled: Boolean(projectId),
  });
}

export function useAlerts(query: AlertsQuery): UseQueryResult<AlertsResponse> {
  return useQuery({
    queryKey: queryKeys.alerts(query),
    queryFn: ({ signal }) => getAlerts(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** Session-cached: the graph payload is large and stable. */
export function useNetwork(query: NetworkQuery): UseQueryResult<NetworkResponse> {
  return useQuery({
    queryKey: queryKeys.network(query),
    queryFn: ({ signal }) => getNetwork(query, signal),
    ...SESSION_CACHE,
  });
}

/** Session-cached: marker and district payloads are large and stable. */
export function useMapData(query: MapQuery): UseQueryResult<MapDataResponse> {
  return useQuery({
    queryKey: queryKeys.mapData(query),
    queryFn: ({ signal }) => getMapData(query, signal),
    ...SESSION_CACHE,
  });
}

export function useDuplicates(query: DuplicatesQuery): UseQueryResult<DuplicatesResponse> {
  return useQuery({
    queryKey: queryKeys.duplicates(query),
    queryFn: ({ signal }) => getDuplicates(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useComplianceSummary(
  query: ComplianceQuery,
): UseQueryResult<ComplianceSummaryResponse> {
  return useQuery({
    queryKey: queryKeys.compliance(query),
    queryFn: ({ signal }) => getComplianceSummary(query, signal),
  });
}

/**
 * Report payload. Disabled by default and enabled only when the user asks to
 * export, so opening a project page does not generate a report nobody requested.
 */
export function useReport(
  projectId: string | undefined,
  enabled: boolean,
): UseQueryResult<ReportResponse> {
  return useQuery({
    queryKey: queryKeys.report(projectId ?? ''),
    queryFn: ({ signal }) => getReport(projectId as string, signal),
    enabled: Boolean(projectId) && enabled,
  });
}

/**
 * Triggers a re-scoring run, then invalidates every cached view so the UI reflects
 * the new model output rather than the previous run's numbers.
 */
export function useAnalyze(): UseMutationResult<AnalyzeResponse, Error, AnalyzeRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AnalyzeRequest) => postAnalyze(body),
    onSuccess: () => {
      for (const key of ['dashboard', 'project', 'alerts', 'network', 'map-data', 'duplicates', 'compliance-summary']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useAcknowledgeAlert(): UseMutationResult<
  AlertRow,
  Error,
  { alertId: number } & AcknowledgeAlertRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, ...body }) => acknowledgeAlert(alertId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useReviewDuplicatePair(): UseMutationResult<
  DuplicatePairRow,
  Error,
  { pairId: number; review_status: DuplicatePairRow['review_status']; reviewed_by: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pairId, ...body }) => reviewDuplicatePair(pairId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });
}
