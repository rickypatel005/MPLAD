import type { AlertRow, DuplicatePairRow, FacetOption, Paginated, SortOrder } from '@/types/api';
import type { ProjectRecord } from '@/mocks/dataset';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/types/query';
import { DISTRICT_BY_ID, STATE_BY_ID } from '@/mocks/geo';
import { RISK_LEVEL_META } from '@/lib/risk';
import { parseDate } from '@/mocks/rng';

/**
 * Server-side filtering, sorting and pagination for the mock API.
 *
 * This exists because the brief is explicit that 10,000–50,000 records must never be
 * shipped to the browser (PRD §6). The mock layer therefore does the same work the
 * FastAPI service will do — narrow, order, then slice — so the components consuming it
 * are written against realistic responses from the start. Swapping the base URL to the
 * real backend changes no component code.
 *
 * Every filter is read from the query string rather than a request body, because the
 * URL is the single source of truth for screen state (TRD §9.2): a reloaded or
 * bookmarked link has to reproduce the same table, in the same order, on the same page.
 */

// ---------------------------------------------------------------------------
// Reading parameters
// ---------------------------------------------------------------------------

/** Trimmed string, or undefined for absent and blank values alike. */
export function readString(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * Comma-separated multi-value parameter, e.g. `risk_level=HIGH,CRITICAL`.
 *
 * Repeated keys (`risk_level=HIGH&risk_level=CRITICAL`) are accepted too, since that is
 * what a plain HTML form would produce.
 */
export function readList(params: URLSearchParams, key: string): string[] {
  const values = params.getAll(key).flatMap((value) => value.split(','));
  return [...new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))];
}

export function readNumber(params: URLSearchParams, key: string): number | undefined {
  const raw = readString(params, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function readBoolean(params: URLSearchParams, key: string): boolean | undefined {
  const raw = readString(params, key)?.toLowerCase();
  if (raw === undefined) return undefined;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return undefined;
}

export function readSortOrder(params: URLSearchParams, fallback: SortOrder): SortOrder {
  return readString(params, 'order')?.toLowerCase() === 'asc' ? 'asc' : fallback;
}

/**
 * Restricts `sort_by` to a known column.
 *
 * An unrecognised value falls back to the default rather than erroring: a stale
 * bookmark should still render a sensible screen instead of a 400.
 */
export function readSortField<T extends string>(
  params: URLSearchParams,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = readString(params, 'sort_by');
  return raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export interface PaginationInput {
  page: number;
  pageSize: number;
}

/** Clamped so a hand-edited URL cannot request page 0 or 50,000 rows. */
export function readPagination(params: URLSearchParams): PaginationInput {
  const page = Math.max(1, Math.floor(readNumber(params, 'page') ?? 1));
  const requested = Math.floor(readNumber(params, 'page_size') ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested || DEFAULT_PAGE_SIZE));
  return { page, pageSize };
}

// ---------------------------------------------------------------------------
// Date range
// ---------------------------------------------------------------------------

export interface DateRange {
  from: number | null;
  to: number | null;
}

/**
 * Parses the `date_range=YYYY-MM-DD:YYYY-MM-DD` wire format (TRD §5).
 *
 * Either side may be blank — `:2025-03-31` means "up to that date" — because the
 * date pickers on the dashboard allow one-sided ranges.
 */
export function readDateRange(params: URLSearchParams): DateRange | undefined {
  const raw = readString(params, 'date_range');
  if (raw === undefined) return undefined;
  const [fromRaw, toRaw] = raw.split(':');
  const toTime = (value: string | undefined): number | null => {
    if (!value || value.trim().length === 0) return null;
    const time = parseDate(value.trim()).getTime();
    return Number.isNaN(time) ? null : time;
  };
  const range = { from: toTime(fromRaw), to: toTime(toRaw) };
  return range.from === null && range.to === null ? undefined : range;
}

/**
 * Range test at day granularity.
 *
 * The value may be a plain `YYYY-MM-DD` (a recommendation date) or a full timestamp (an
 * alert's `created_at`); both are truncated to the day, because the filter controls are
 * date pickers and a range that silently excluded this morning's alerts would be wrong.
 *
 * A null date fails the test rather than passing it: "recommended between these dates"
 * cannot honestly include a work with no recommendation date on record.
 */
export function withinRange(iso: string | null, range: DateRange | undefined): boolean {
  if (range === undefined) return true;
  if (iso === null) return false;
  const time = parseDate(iso.slice(0, 10)).getTime();
  if (Number.isNaN(time)) return false;
  if (range.from !== null && time < range.from) return false;
  if (range.to !== null && time > range.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Project filtering
// ---------------------------------------------------------------------------

export interface ProjectFilter {
  states: string[];
  districts: string[];
  riskLevels: string[];
  workTypes: string[];
  fys: string[];
  iaIds: string[];
  mpIds: string[];
  dateRange: DateRange | undefined;
  search: string | undefined;
}

export function readProjectFilter(params: URLSearchParams): ProjectFilter {
  return {
    states: readList(params, 'state'),
    districts: readList(params, 'district'),
    riskLevels: readList(params, 'risk_level').map((v) => v.toUpperCase()),
    workTypes: readList(params, 'work_type'),
    fys: readList(params, 'fy'),
    iaIds: readList(params, 'ia'),
    mpIds: readList(params, 'mp'),
    dateRange: readDateRange(params),
    search: readString(params, 'q')?.toLowerCase(),
  };
}

/** True when no filter is set, so callers can skip the scan entirely. */
export function isEmptyProjectFilter(filter: ProjectFilter): boolean {
  return (
    filter.states.length === 0 &&
    filter.districts.length === 0 &&
    filter.riskLevels.length === 0 &&
    filter.workTypes.length === 0 &&
    filter.fys.length === 0 &&
    filter.iaIds.length === 0 &&
    filter.mpIds.length === 0 &&
    filter.dateRange === undefined &&
    filter.search === undefined
  );
}

/**
 * Filters are ordered cheapest-first — id equality before the string search — because
 * this runs over every record on every request.
 */
export function matchesProjectFilter(record: ProjectRecord, filter: ProjectFilter): boolean {
  const { project } = record;

  if (filter.states.length > 0 && !filter.states.includes(project.state_id)) return false;
  if (filter.districts.length > 0 && !filter.districts.includes(project.district_id)) return false;
  if (filter.riskLevels.length > 0 && !filter.riskLevels.includes(record.risk.risk_level)) {
    return false;
  }
  if (filter.workTypes.length > 0 && !filter.workTypes.includes(project.work_type)) return false;
  if (filter.fys.length > 0 && !filter.fys.includes(project.fy)) return false;
  if (filter.iaIds.length > 0 && !filter.iaIds.includes(project.ia_id)) return false;
  if (filter.mpIds.length > 0 && !filter.mpIds.includes(project.mp_id)) return false;
  if (!withinRange(project.recommended_date, filter.dateRange)) return false;

  if (filter.search !== undefined) {
    const needle = filter.search;
    const haystack = `${project.project_id} ${project.work_description} ${project.work_type} ${record.districtName}`;
    if (!haystack.toLowerCase().includes(needle)) return false;
  }

  return true;
}

export function filterProjects(
  records: readonly ProjectRecord[],
  filter: ProjectFilter,
): ProjectRecord[] {
  if (isEmptyProjectFilter(filter)) return records as ProjectRecord[];
  return records.filter((record) => matchesProjectFilter(record, filter));
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type Comparable = string | number | null;

/**
 * Comparator over a keyed value, with nulls last in both directions.
 *
 * Nulls last regardless of direction is deliberate: a record with no sanction date is
 * missing information, not the earliest date, and burying it at the top of an ascending
 * sort would read as a finding that isn't there.
 */
export function compareBy<T>(
  key: (item: T) => Comparable,
  order: SortOrder,
  tiebreak: (item: T) => string,
): (a: T, b: T) => number {
  const direction = order === 'asc' ? 1 : -1;
  return (a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av === null && bv === null) return tiebreak(a).localeCompare(tiebreak(b));
    if (av === null) return 1;
    if (bv === null) return -1;
    let result: number;
    if (typeof av === 'number' && typeof bv === 'number') result = av - bv;
    else result = String(av).localeCompare(String(bv));
    if (result !== 0) return result * direction;
    // Stable, deterministic tail: without it, page boundaries shuffle between
    // requests whenever two rows tie on the sort column.
    return tiebreak(a).localeCompare(tiebreak(b));
  };
}

/** The sortable columns exposed on the ranked project table (TRD §5). */
const PROJECT_SORT_KEYS: Record<string, (record: ProjectRecord) => Comparable> = {
  overall_risk: (r) => r.risk.overall_risk,
  estimated_cost_lakhs: (r) => r.project.estimated_cost_lakhs,
  recommended_date: (r) => r.project.recommended_date,
  work_type: (r) => r.project.work_type,
  district_name: (r) => r.districtName,
  state_name: (r) => r.stateName,
  project_id: (r) => r.project.project_id,
};

export function sortProjects(
  records: ProjectRecord[],
  sortBy: string,
  order: SortOrder,
): ProjectRecord[] {
  const key = PROJECT_SORT_KEYS[sortBy] ?? PROJECT_SORT_KEYS.overall_risk;
  return [...records].sort(compareBy(key, order, (r) => r.project.project_id));
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Slices a filtered, sorted list into one page plus its metadata.
 *
 * `total_items` is the count *after* filtering, so the table can report "128 of 12,000
 * works match" honestly rather than implying the filter found everything.
 */
export function paginate<T>(items: readonly T[], input: PaginationInput): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const start = (page - 1) * input.pageSize;
  return {
    items: items.slice(start, start + input.pageSize),
    page: {
      page,
      page_size: input.pageSize,
      total_items: totalItems,
      total_pages: totalPages,
    },
  };
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

/**
 * Counts distinct values so filter dropdowns can show how many records each option
 * would return.
 *
 * Facets are computed over the *filtered* set, which is what makes the filter panel
 * self-explanatory: an option showing zero tells the user why their combination is
 * empty, rather than leaving them to guess.
 */
export function facetsOf<T>(
  items: readonly T[],
  value: (item: T) => string | null,
  label: (value: string) => string,
  order: 'count' | 'label' = 'count',
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = value(item);
    if (key === null || key.length === 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const options: FacetOption[] = [...counts.entries()].map(([key, count]) => ({
    value: key,
    label: label(key),
    count,
  }));

  return options.sort((a, b) =>
    order === 'label'
      ? a.label.localeCompare(b.label)
      : b.count - a.count || a.label.localeCompare(b.label),
  );
}

// ---------------------------------------------------------------------------
// Alert filtering
// ---------------------------------------------------------------------------

/**
 * Accepts either identifiers or display names for a place.
 *
 * The alert and duplicate rows carry district and state *names* rather than ids, because
 * that is what their tables display. A filter arriving from the dashboard carries ids.
 * Rather than force one side to change shape, the filter holds both spellings and matches
 * on whichever the row happens to have.
 */
function placeMatcher(values: readonly string[], names: (id: string) => string): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    set.add(value);
    const name = names(value);
    if (name.length > 0) set.add(name);
  }
  return set;
}

const districtNameOf = (id: string): string => DISTRICT_BY_ID[id]?.district_name ?? '';
const stateNameOf = (id: string): string => STATE_BY_ID[id]?.state_name ?? '';

export interface AlertFilter {
  states: Set<string>;
  districts: Set<string>;
  levels: string[];
  workTypes: string[];
  alertTypes: string[];
  mpIds: string[];
  projectIds: string[];
  acknowledged: boolean | undefined;
  dateRange: DateRange | undefined;
  search: string | undefined;
}

export function readAlertFilter(params: URLSearchParams): AlertFilter {
  return {
    states: placeMatcher(readList(params, 'state'), stateNameOf),
    districts: placeMatcher(readList(params, 'district'), districtNameOf),
    levels: readList(params, 'risk_level').map((v) => v.toUpperCase()),
    workTypes: readList(params, 'work_type'),
    alertTypes: readList(params, 'alert_type').map((v) => v.toUpperCase()),
    mpIds: readList(params, 'mp'),
    projectIds: readList(params, 'project'),
    acknowledged: readBoolean(params, 'acknowledged'),
    dateRange: readDateRange(params),
    search: readString(params, 'q')?.toLowerCase(),
  };
}

export function isEmptyAlertFilter(filter: AlertFilter): boolean {
  return (
    filter.states.size === 0 &&
    filter.districts.size === 0 &&
    filter.levels.length === 0 &&
    filter.workTypes.length === 0 &&
    filter.alertTypes.length === 0 &&
    filter.mpIds.length === 0 &&
    filter.projectIds.length === 0 &&
    filter.acknowledged === undefined &&
    filter.dateRange === undefined &&
    filter.search === undefined
  );
}

export function matchesAlertFilter(alert: AlertRow, filter: AlertFilter): boolean {
  if (filter.states.size > 0 && !filter.states.has(alert.state_id) && !filter.states.has(alert.state_name)) {
    return false;
  }
  if (filter.districts.size > 0 && !filter.districts.has(alert.district_name)) return false;
  if (filter.levels.length > 0 && !filter.levels.includes(alert.alert_level)) return false;
  if (filter.workTypes.length > 0 && !filter.workTypes.includes(alert.project_work_type)) return false;
  if (filter.alertTypes.length > 0 && !filter.alertTypes.includes(alert.alert_type)) return false;
  if (filter.mpIds.length > 0 && !filter.mpIds.includes(alert.mp_id)) return false;
  if (filter.projectIds.length > 0 && !filter.projectIds.includes(alert.project_id)) return false;
  if (filter.acknowledged !== undefined && alert.is_acknowledged !== filter.acknowledged) return false;
  if (!withinRange(alert.created_at, filter.dateRange)) return false;

  if (filter.search !== undefined) {
    const haystack = `${alert.project_id} ${alert.alert_message} ${alert.district_name} ${alert.project_work_type}`;
    if (!haystack.toLowerCase().includes(filter.search)) return false;
  }

  return true;
}

export function filterAlerts(alerts: readonly AlertRow[], filter: AlertFilter): AlertRow[] {
  if (isEmptyAlertFilter(filter)) return alerts as AlertRow[];
  return alerts.filter((alert) => matchesAlertFilter(alert, filter));
}

/**
 * Sortable columns on the alert feed.
 *
 * Severity sorts by the level's rank rather than its name, so descending order runs
 * Critical → High → Medium → Low instead of the alphabetical nonsense of
 * "MEDIUM" > "LOW" > "HIGH" > "CRITICAL".
 */
const ALERT_SORT_KEYS: Record<string, (alert: AlertRow) => Comparable> = {
  created_at: (a) => a.created_at,
  alert_level: (a) => RISK_LEVEL_META[a.alert_level].rank,
  overall_risk: (a) => a.overall_risk,
};

export function sortAlerts(alerts: AlertRow[], sortBy: string, order: SortOrder): AlertRow[] {
  const key = ALERT_SORT_KEYS[sortBy] ?? ALERT_SORT_KEYS.created_at;
  return [...alerts].sort(compareBy(key, order, (a) => String(a.alert_id).padStart(8, '0')));
}

// ---------------------------------------------------------------------------
// Duplicate pair filtering
// ---------------------------------------------------------------------------

export interface DuplicateFilter {
  states: Set<string>;
  minSimilarity: number | undefined;
  maxDistanceKm: number | undefined;
  detectionMethods: string[];
  reviewStatuses: string[];
  search: string | undefined;
}

export function readDuplicateFilter(params: URLSearchParams): DuplicateFilter {
  return {
    states: placeMatcher(readList(params, 'state'), stateNameOf),
    minSimilarity: readNumber(params, 'min_similarity'),
    maxDistanceKm: readNumber(params, 'max_distance_km'),
    detectionMethods: readList(params, 'detection_method'),
    reviewStatuses: readList(params, 'review_status').map((v) => v.toUpperCase()),
    search: readString(params, 'q')?.toLowerCase(),
  };
}

export function isEmptyDuplicateFilter(filter: DuplicateFilter): boolean {
  return (
    filter.states.size === 0 &&
    filter.minSimilarity === undefined &&
    filter.maxDistanceKm === undefined &&
    filter.detectionMethods.length === 0 &&
    filter.reviewStatuses.length === 0 &&
    filter.search === undefined
  );
}

export function matchesDuplicateFilter(pair: DuplicatePairRow, filter: DuplicateFilter): boolean {
  if (filter.minSimilarity !== undefined && pair.similarity_score < filter.minSimilarity) return false;
  if (filter.maxDistanceKm !== undefined && pair.geo_distance_km > filter.maxDistanceKm) return false;
  if (filter.detectionMethods.length > 0 && !filter.detectionMethods.includes(pair.detection_method)) {
    return false;
  }
  if (filter.reviewStatuses.length > 0 && !filter.reviewStatuses.includes(pair.review_status)) {
    return false;
  }
  // A pair is in scope if *either* side sits in the state — the interesting cases are the
  // ones that straddle a boundary, and dropping them would hide exactly those.
  if (
    filter.states.size > 0 &&
    !filter.states.has(pair.project_a.state_name) &&
    !filter.states.has(pair.project_b.state_name)
  ) {
    return false;
  }

  if (filter.search !== undefined) {
    const haystack = `${pair.project_a.project_id} ${pair.project_b.project_id} ${pair.project_a.work_description} ${pair.project_b.work_description} ${pair.project_a.district_name}`;
    if (!haystack.toLowerCase().includes(filter.search)) return false;
  }

  return true;
}

export function filterDuplicates(
  pairs: readonly DuplicatePairRow[],
  filter: DuplicateFilter,
): DuplicatePairRow[] {
  if (isEmptyDuplicateFilter(filter)) return pairs as DuplicatePairRow[];
  return pairs.filter((pair) => matchesDuplicateFilter(pair, filter));
}

const DUPLICATE_SORT_KEYS: Record<string, (pair: DuplicatePairRow) => Comparable> = {
  similarity_score: (p) => p.similarity_score,
  geo_distance_km: (p) => p.geo_distance_km,
  pair_id: (p) => p.pair_id,
};

export function sortDuplicates(
  pairs: DuplicatePairRow[],
  sortBy: string,
  order: SortOrder,
): DuplicatePairRow[] {
  const key = DUPLICATE_SORT_KEYS[sortBy] ?? DUPLICATE_SORT_KEYS.similarity_score;
  return [...pairs].sort(compareBy(key, order, (p) => String(p.pair_id).padStart(8, '0')));
}

/**
 * Page number holding a given item, so a deep link can open the page containing its
 * target instead of page one.
 *
 * The duplicates screen is entered by link from a project page ("see the pair"), and
 * landing on page one of 140 pairs with the relevant row six pages away would make the
 * link useless.
 */
export function pageContaining<T>(
  items: readonly T[],
  pageSize: number,
  predicate: (item: T) => boolean,
): number | null {
  const index = items.findIndex(predicate);
  return index < 0 ? null : Math.floor(index / pageSize) + 1;
}
