import type { SortOrder } from '@/types/api';

/**
 * Query parameter shapes shared by the API layer, the mock route handlers and the
 * URL-state hooks.
 *
 * Filter, sort and pagination state lives in the URL (TRD §9.2), so these types are
 * the contract between three things at once: what the API accepts, what the address
 * bar contains, and what the filter controls produce. Keeping one definition means a
 * bookmarked or reloaded URL always reproduces the same screen — which matters when
 * a judge reloads mid-demo.
 */

/** Filters accepted by `/dashboard` and `/alerts` (TRD §5). */
export interface CommonFilters {
  state?: string;
  district?: string;
  risk_level?: string;
  work_type?: string;
  /** "YYYY-MM-DD:YYYY-MM-DD" — the wire format the TRD specifies. */
  date_range?: string;
  /** Free-text search over project id and work description. */
  q?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface SortParams {
  sort_by?: string;
  order?: SortOrder;
}

export type DashboardQuery = CommonFilters &
  PaginationParams &
  SortParams & {
    /** Restrict to one implementing agency — powers the network-graph cross-link. */
    ia?: string;
    /** Financial year. */
    fy?: string;
  };

export type AlertsQuery = CommonFilters &
  PaginationParams &
  SortParams & {
    alert_type?: string;
    /** "true" | "false" — omitted means both. */
    acknowledged?: string;
    project?: string;
  };

export interface NetworkQuery {
  state?: string;
  /** Focus a specific node and open its detail panel. */
  focus?: string;
  /** Drop edges below this project count, to keep the graph legible. */
  min_weight?: number;
  /** Cap on node count; the backend keeps the highest-risk nodes. */
  limit?: number;
}

export interface MapQuery {
  state?: string;
  district?: string;
  risk_level?: string;
  work_type?: string;
  /** Focus a single project or duplicate pair. */
  project?: string;
  pair?: number;
}

export type DuplicatesQuery = PaginationParams &
  SortParams & {
    state?: string;
    /** 0–1 lower bound on similarity. */
    min_similarity?: number;
    /** Kilometres; upper bound on separation. */
    max_distance_km?: number;
    detection_method?: string;
    review_status?: string;
    /** Pre-select a specific pair. */
    pair?: number;
  };

export interface ComplianceQuery {
  state?: string;
  fy?: string;
  rule_id?: string;
}

/** Defaults kept here so the API layer, the mocks and the UI cannot disagree. */
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100] as const;
export const MAX_PAGE_SIZE = 200;

/** Sortable columns on the ranked project table. */
export const PROJECT_SORT_FIELDS = [
  'overall_risk',
  'estimated_cost_lakhs',
  'recommended_date',
  'work_type',
  'district_name',
  'state_name',
  'project_id',
] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export const DEFAULT_PROJECT_SORT: { sort_by: ProjectSortField; order: SortOrder } = {
  sort_by: 'overall_risk',
  order: 'desc',
};

export const ALERT_SORT_FIELDS = ['created_at', 'alert_level', 'overall_risk'] as const;
export type AlertSortField = (typeof ALERT_SORT_FIELDS)[number];

export const DUPLICATE_SORT_FIELDS = [
  'similarity_score',
  'geo_distance_km',
  'pair_id',
] as const;
export type DuplicateSortField = (typeof DUPLICATE_SORT_FIELDS)[number];
