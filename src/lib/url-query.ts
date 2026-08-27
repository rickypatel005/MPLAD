import type { SortOrder } from '@/types/api';
import type {
  AlertsQuery,
  CommonFilters,
  ComplianceQuery,
  DashboardQuery,
  DuplicatesQuery,
  MapQuery,
  NetworkQuery,
} from '@/types/query';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PROJECT_SORT,
  DUPLICATE_SORT_FIELDS,
  MAX_PAGE_SIZE,
  PROJECT_SORT_FIELDS,
} from '@/types/query';

/**
 * URL → typed query object.
 *
 * The address bar is the single source of truth for filter, sort and pagination state
 * (TRD §9.2). These functions are the one place that reading happens, so a bookmarked
 * URL, a reload mid-demo, and a link pasted into a review thread all reproduce exactly
 * the same screen.
 *
 * Pure and dependency-free on purpose: no React, no `next/navigation`. That keeps them
 * usable from a server component, a route handler, or a test, and it means the mapping
 * can be reasoned about without rendering anything.
 *
 * Reading is forgiving by design. A hand-edited URL with `page=0`, `page_size=99999` or
 * `sort_by=nonsense` must not produce an error screen in front of judges — every reader
 * clamps or discards, and the view falls back to its documented default.
 */

// ---------------------------------------------------------------------------
// Primitive readers
// ---------------------------------------------------------------------------

/** Single value, trimmed; absent and blank are both `undefined`. */
export function getParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Multi-select values, accepted either repeated (`state=S09&state=S24`) or comma-joined
 * (`state=S09,S24`).
 *
 * Both spellings exist in the wild — checkbox groups tend to produce the first, hand-built
 * deep links the second — so both are read and de-duplicated rather than one being
 * declared correct.
 */
export function getListParam(params: URLSearchParams, key: string): string[] {
  const out: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(',')) {
      const value = part.trim();
      if (value.length > 0 && !out.includes(value)) out.push(value);
    }
  }
  return out;
}

/** Canonical comma-joined form of a multi-select, which is what the API accepts. */
export function getCsvParam(params: URLSearchParams, key: string): string | undefined {
  const list = getListParam(params, key);
  return list.length === 0 ? undefined : list.join(',');
}

export function getNumberParam(params: URLSearchParams, key: string): number | undefined {
  const raw = getParam(params, key);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Integer, clamped into range. Junk yields `undefined`, never NaN. */
export function getIntParam(
  params: URLSearchParams,
  key: string,
  min: number,
  max: number,
): number | undefined {
  const parsed = getNumberParam(params, key);
  if (parsed === undefined) return undefined;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function getBoolParam(params: URLSearchParams, key: string): boolean | undefined {
  const raw = getParam(params, key)?.toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

export function getSortOrder(params: URLSearchParams, key = 'order'): SortOrder | undefined {
  const raw = getParam(params, key)?.toLowerCase();
  return raw === 'asc' || raw === 'desc' ? raw : undefined;
}

/** Sort field, validated against the columns the endpoint actually supports. */
export function getSortField<T extends string>(
  params: URLSearchParams,
  allowed: readonly T[],
  key = 'sort_by',
): T | undefined {
  const raw = getParam(params, key);
  if (raw === undefined) return undefined;
  return allowed.find((field) => field === raw);
}

// ---------------------------------------------------------------------------
// Key classification
// ---------------------------------------------------------------------------

export const PAGE_KEY = 'page';

/**
 * Keys that narrow the result set.
 *
 * Changing any of these must send the table back to page 1 — filtering 12,000 works down
 * to four while sitting on page 7 otherwise produces an empty table and a user who
 * concludes the filter is broken. The hook enforces that; this list defines it.
 */
export const FILTER_KEYS: readonly string[] = [
  'state',
  'district',
  'risk_level',
  'work_type',
  'date_range',
  'q',
  'ia',
  'fy',
  'mp',
  'alert_type',
  'acknowledged',
  'min_similarity',
  'max_distance_km',
  'detection_method',
  'review_status',
  'rule_id',
  'min_weight',
] as const;

/**
 * Keys that change what is highlighted rather than what is included.
 *
 * A deep link that opens one duplicate pair or focuses one agency node must not reset
 * pagination — the target may well be on page 3, and the endpoints deliberately page *to*
 * it rather than filtering everything else away.
 */
export const VIEW_KEYS: readonly string[] = [
  'project',
  'pair',
  'focus',
  'tab',
  'page',
  'page_size',
  'sort_by',
  'order',
  'limit',
] as const;

export function isFilterKey(key: string): boolean {
  return FILTER_KEYS.includes(key);
}

/** How many filters are active, for the "Clear filters (3)" control. */
export function countActiveFilters(params: URLSearchParams): number {
  let count = 0;
  for (const key of FILTER_KEYS) {
    if (getListParam(params, key).length > 0) count += 1;
  }
  return count;
}

/** Copy of the params with every filter dropped, keeping view state intact. */
export function withoutFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of FILTER_KEYS) next.delete(key);
  next.delete(PAGE_KEY);
  return next;
}

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

/** Filters common to `/dashboard` and `/alerts` (TRD §5). */
export function commonFilters(params: URLSearchParams): CommonFilters {
  return {
    state: getCsvParam(params, 'state'),
    district: getCsvParam(params, 'district'),
    risk_level: getCsvParam(params, 'risk_level'),
    work_type: getCsvParam(params, 'work_type'),
    date_range: getParam(params, 'date_range'),
    q: getParam(params, 'q'),
  };
}

function pagination(params: URLSearchParams): { page?: number; page_size?: number } {
  return {
    page: getIntParam(params, 'page', 1, 100_000),
    page_size: getIntParam(params, 'page_size', 1, MAX_PAGE_SIZE),
  };
}

/**
 * The page size in force, resolved rather than optional.
 *
 * The page-size control needs a concrete current value to show as selected, while the
 * query object leaves it absent so the server's default applies and the URL stays clean.
 */
export function resolvedPageSize(params: URLSearchParams): number {
  return getIntParam(params, 'page_size', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE;
}

/** The page in force, resolved for the pager's own display. */
export function resolvedPage(params: URLSearchParams): number {
  return getIntParam(params, 'page', 1, 100_000) ?? 1;
}

// ---------------------------------------------------------------------------
// Per-endpoint query builders
// ---------------------------------------------------------------------------

/**
 * `/dashboard`.
 *
 * The default sort is sent explicitly rather than left to the server. The ranked table
 * draws its sort arrow from this object, and an arrow that disagrees with the order of the
 * rows underneath it is worse than no arrow at all.
 */
export function dashboardQuery(params: URLSearchParams): DashboardQuery {
  return {
    ...commonFilters(params),
    ia: getParam(params, 'ia'),
    fy: getCsvParam(params, 'fy'),
    ...pagination(params),
    sort_by: getSortField(params, PROJECT_SORT_FIELDS) ?? DEFAULT_PROJECT_SORT.sort_by,
    order: getSortOrder(params) ?? DEFAULT_PROJECT_SORT.order,
  };
}

/**
 * `/alerts`.
 *
 * `sort_by` is deliberately left absent unless the user picks a column. The endpoint reads
 * its absence as "keep the triage order" — severity, then unhandled ahead of handled, then
 * score — which is the order an officer opening the feed needs. Injecting a default here
 * would silently replace that work queue with a chronological log.
 */
export function alertsQuery(params: URLSearchParams): AlertsQuery {
  return {
    ...commonFilters(params),
    alert_type: getCsvParam(params, 'alert_type'),
    acknowledged: getParam(params, 'acknowledged'),
    project: getParam(params, 'project'),
    ...pagination(params),
    sort_by: getParam(params, 'sort_by'),
    order: getSortOrder(params),
  };
}

export function networkQuery(params: URLSearchParams): NetworkQuery {
  return {
    state: getCsvParam(params, 'state'),
    focus: getParam(params, 'focus'),
    min_weight: getIntParam(params, 'min_weight', 1, 500),
    limit: getIntParam(params, 'limit', 10, 500),
  };
}

export function mapQuery(params: URLSearchParams): MapQuery {
  return {
    state: getCsvParam(params, 'state'),
    district: getCsvParam(params, 'district'),
    risk_level: getCsvParam(params, 'risk_level'),
    work_type: getCsvParam(params, 'work_type'),
    project: getParam(params, 'project'),
    pair: getIntParam(params, 'pair', 1, 1_000_000),
  };
}

export function duplicatesQuery(params: URLSearchParams): DuplicatesQuery {
  return {
    state: getCsvParam(params, 'state'),
    min_similarity: getNumberParam(params, 'min_similarity'),
    max_distance_km: getNumberParam(params, 'max_distance_km'),
    detection_method: getCsvParam(params, 'detection_method'),
    review_status: getCsvParam(params, 'review_status'),
    pair: getIntParam(params, 'pair', 1, 1_000_000),
    ...pagination(params),
    sort_by: getSortField(params, DUPLICATE_SORT_FIELDS) ?? 'similarity_score',
    order: getSortOrder(params) ?? 'desc',
  };
}

export function complianceQuery(params: URLSearchParams): ComplianceQuery {
  return {
    state: getCsvParam(params, 'state'),
    fy: getCsvParam(params, 'fy'),
    rule_id: getCsvParam(params, 'rule_id'),
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Values a control may write into the URL. */
export type UrlValue = string | number | boolean | readonly string[] | null | undefined;

/**
 * Applies a patch to a copy of the params.
 *
 * Three rules make the resulting URLs behave:
 *
 * 1. Empty values (`''`, `null`, `undefined`, `[]`) delete their key rather than writing
 *    `?state=`, so a cleared filter leaves no trace and the URL stays legible.
 * 2. Changing a filter resets pagination, unless the patch sets the page itself.
 * 3. Keys are sorted, so the same screen always has the same URL regardless of the order
 *    the user clicked things — which keeps the query cache from storing two copies of one
 *    result set.
 */
export function applyPatch(
  params: URLSearchParams,
  patch: Record<string, UrlValue>,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  let touchedFilter = false;

  for (const [key, value] of Object.entries(patch)) {
    const encoded = Array.isArray(value) ? value.join(',') : value;

    if (encoded === undefined || encoded === null || encoded === '' || encoded === false) {
      next.delete(key);
    } else {
      next.set(key, String(encoded));
    }

    if (isFilterKey(key)) touchedFilter = true;
  }

  if (touchedFilter && !Object.prototype.hasOwnProperty.call(patch, PAGE_KEY)) {
    next.delete(PAGE_KEY);
  }

  // De-duplicated before sorting: `keys()` yields a repeated key once per value, and
  // re-appending `getAll` for each occurrence would square the values.
  const sorted = new URLSearchParams();
  for (const key of [...new Set(next.keys())].sort()) {
    for (const value of next.getAll(key)) sorted.append(key, value);
  }
  return sorted;
}

/** `?a=1&b=2`, or `''` when there is nothing to append. */
export function toQueryString(params: URLSearchParams): string {
  const serialized = params.toString();
  return serialized.length === 0 ? '' : `?${serialized}`;
}

/** Builds an href with query state, for cross-screen deep links. */
export function hrefWith(pathname: string, patch: Record<string, UrlValue>): string {
  return `${pathname}${toQueryString(applyPatch(new URLSearchParams(), patch))}`;
}
