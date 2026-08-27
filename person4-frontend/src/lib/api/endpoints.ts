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
import { apiGet, apiPatch, apiPost, type QueryParams } from '@/lib/api/client';

/**
 * Typed wrappers for the nine endpoints in TRD §5.
 *
 * One function per endpoint, each returning the declared response type. Components
 * call these (through the hooks in `src/lib/api/hooks.ts`) and never construct a
 * URL, which is what keeps the mock/live swap to a single environment variable.
 */

/** Narrows a query object to the plain string/number map the client accepts. */
function toParams(query: object | undefined): QueryParams | undefined {
  if (!query) return undefined;
  const out: QueryParams = {};
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
}

/** GET /dashboard — aggregated risk stats plus the ranked project list. */
export function getDashboard(
  query: DashboardQuery = {},
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  return apiGet<DashboardResponse>('/dashboard', { params: toParams(query), signal });
}

/** GET /project/{id} — the full evidence pack for one work. */
export function getProject(projectId: string, signal?: AbortSignal): Promise<ProjectDetailResponse> {
  return apiGet<ProjectDetailResponse>(`/project/${encodeURIComponent(projectId)}`, { signal });
}

/** GET /alerts — chronological HIGH/CRITICAL flags with acknowledgement state. */
export function getAlerts(query: AlertsQuery = {}, signal?: AbortSignal): Promise<AlertsResponse> {
  return apiGet<AlertsResponse>('/alerts', { params: toParams(query), signal });
}

/** GET /network — IA/MP/district graph. Cached per session; the payload is large. */
export function getNetwork(query: NetworkQuery = {}, signal?: AbortSignal): Promise<NetworkResponse> {
  return apiGet<NetworkResponse>('/network', { params: toParams(query), signal });
}

/** GET /map-data — district aggregates plus point markers. Cached per session. */
export function getMapData(query: MapQuery = {}, signal?: AbortSignal): Promise<MapDataResponse> {
  return apiGet<MapDataResponse>('/map-data', { params: toParams(query), signal });
}

/** GET /duplicates — candidate duplicate pairs, ranked by similarity. */
export function getDuplicates(
  query: DuplicatesQuery = {},
  signal?: AbortSignal,
): Promise<DuplicatesResponse> {
  return apiGet<DuplicatesResponse>('/duplicates', { params: toParams(query), signal });
}

/** GET /compliance-summary — rule-by-rule adherence and the SC/ST mandate tracker. */
export function getComplianceSummary(
  query: ComplianceQuery = {},
  signal?: AbortSignal,
): Promise<ComplianceSummaryResponse> {
  return apiGet<ComplianceSummaryResponse>('/compliance-summary', {
    params: toParams(query),
    signal,
  });
}

/** GET /report/{id} — structured payload for the exported risk report. */
export function getReport(projectId: string, signal?: AbortSignal): Promise<ReportResponse> {
  return apiGet<ReportResponse>(`/report/${encodeURIComponent(projectId)}`, { signal });
}

/**
 * POST /analyze — asks the backend to re-run scoring.
 *
 * The frontend triggers this and reports the outcome. It performs none of the
 * analysis itself (brief §5).
 */
export function postAnalyze(
  body: AnalyzeRequest = {},
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  return apiPost<AnalyzeResponse>('/analyze', body, { signal });
}

/**
 * PATCH /alerts/{id} — records acknowledgement and the action taken.
 *
 * Not in the TRD §5 table, because §5 lists reads. The `alerts` model carries
 * `is_acknowledged`, `acknowledged_by` and `action_taken`, and PRD §6.7 requires the
 * feed to support that state, so a write is implied. Flagged for the backend sync.
 */
export function acknowledgeAlert(
  alertId: number,
  body: AcknowledgeAlertRequest,
  signal?: AbortSignal,
): Promise<AlertRow> {
  return apiPatch<AlertRow>(`/alerts/${alertId}`, body, { signal });
}

/**
 * PATCH /duplicates/{id} — records a reviewer's verdict on a candidate pair.
 *
 * Same reasoning as above: the `duplicate_pairs` model carries `reviewed`, and PRD
 * §6.4 requires a review workflow. Flagged for the backend sync.
 */
export function reviewDuplicatePair(
  pairId: number,
  body: { review_status: DuplicatePairRow['review_status']; reviewed_by: string },
  signal?: AbortSignal,
): Promise<DuplicatePairRow> {
  return apiPatch<DuplicatePairRow>(`/duplicates/${pairId}`, body, { signal });
}
