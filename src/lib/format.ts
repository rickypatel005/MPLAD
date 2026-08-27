/**
 * Display formatting for MPLADS-AUDIT-AI.
 *
 * Indian conventions throughout: amounts arrive from the API in **lakhs** and are
 * rendered in lakhs or crores (1 crore = 100 lakhs), with Indian digit grouping.
 * Every numeric string produced here is meant for tabular columns, so widths stay
 * predictable and decimal places are fixed per unit.
 */

const INR_GROUPED = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const INR_GROUPED_2DP = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLAIN_GROUPED = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Indian digit grouping for counts, e.g. 48219 → "48,219". */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return PLAIN_GROUPED.format(value);
}

/**
 * Amount in lakhs → the most readable unit.
 * 8.5 → "₹8.5 L", 240 → "₹2.40 Cr", 12500 → "₹125 Cr"
 */
export function formatLakhs(lakhs: number | null | undefined): string {
  if (lakhs === null || lakhs === undefined || !Number.isFinite(lakhs)) return '—';
  if (Math.abs(lakhs) >= 100) {
    const crore = lakhs / 100;
    return Math.abs(crore) >= 100
      ? `₹${INR_GROUPED.format(crore)} Cr`
      : `₹${INR_GROUPED_2DP.format(crore)} Cr`;
  }
  return `₹${lakhs.toFixed(1)} L`;
}

/** Always in lakhs, never promoted to crores — for columns that must share a unit. */
export function formatLakhsExact(lakhs: number | null | undefined): string {
  if (lakhs === null || lakhs === undefined || !Number.isFinite(lakhs)) return '—';
  return `₹${INR_GROUPED_2DP.format(lakhs)} L`;
}

/** Unit cost with its unit spelled out, e.g. "₹18.4 L/km". */
export function formatUnitCost(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `₹${value.toFixed(1)} L/${unit}`;
}

/** Risk score, two decimals — the fixed presentation of a 0–1 score. */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return '—';
  return score.toFixed(2);
}

/** 0–1 → "87%". */
export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Similarity is always shown to the whole percent, e.g. 0.91 → "91%". */
export function formatSimilarity(score: number | null | undefined): string {
  return formatPercent(score, 0);
}

/** Z-score with an explicit sign, e.g. "+4.8". */
export function formatZScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
}

/** Multiplier against a benchmark, e.g. 3.4 → "3.4×". */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}×`;
}

/** Sub-kilometre distances read better in metres — 0.8 → "800 m". */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Day counts, promoted to months past roughly a year for readability. */
export function formatDuration(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—';
  const whole = Math.round(days);
  if (Math.abs(whole) < 60) return `${whole} day${Math.abs(whole) === 1 ? '' : 's'}`;
  const months = whole / 30.44;
  return `${months.toFixed(months < 10 ? 1 : 0)} months`;
}

/** Coordinate pair for the map panel, e.g. "26.8467, 80.9462". */
export function formatCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined,
): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return '—';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATETIME_FMT = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

function parseISO(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ISO date → "14 Mar 2024".
 *
 * Formatted in UTC on purpose: MPLADS dates are calendar dates, and rendering them
 * in the viewer's local zone can shift them by a day, which would make the
 * 45-day-rule evidence disagree with the timeline.
 */
export function formatDate(value: string | null | undefined): string {
  const date = parseISO(value);
  return date ? DATE_FMT.format(date) : '—';
}

/** ISO timestamp → "14 Mar 2024, 09:42". */
export function formatDateTime(value: string | null | undefined): string {
  const date = parseISO(value);
  return date ? DATETIME_FMT.format(date) : '—';
}

/** Relative age for the alert feed, e.g. "3 h ago". Falls back to a date past 30 days. */
export function formatRelativeTime(value: string | null | undefined, now = new Date()): string {
  const date = parseISO(value);
  if (!date) return '—';
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/** Whole days between two ISO dates, or null if either is missing. */
export function daysBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const a = parseISO(from);
  const b = parseISO(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** SCREAMING_SNAKE enum → "Title Case" for display. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Truncates on a word boundary and appends an ellipsis. */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Falls back to an em dash so empty cells stay visually aligned. */
export function orDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
