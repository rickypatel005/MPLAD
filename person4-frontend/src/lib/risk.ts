import type { RiskDimensionDetail, RiskDimensionKey, RiskFactor, RiskLevel, RiskScore } from '@/types/api';

/**
 * Risk semantics for MPLADS-AUDIT-AI.
 *
 * The frontend NEVER computes risk (brief §5, TRD §3). Everything here is
 * presentation logic over values the API returns: mapping a score the backend
 * already produced onto the fixed level bands, and mapping levels/dimensions onto
 * fixed labels and design tokens.
 *
 * The one derivation allowed is `buildRiskDimensions`, which reshapes fields the
 * API already sent into the six cards the Design Doc requires. It invents no
 * numbers.
 *
 * This module is intentionally JSX-free so route handlers and server components
 * can import it. Icons live in src/components/icons.tsx.
 */

// ---------------------------------------------------------------------------
// Fixed model constants (PRD §7 — do not change)
// ---------------------------------------------------------------------------

/** Weighted sum used by the backend. Displayed in the UI so the model is legible. */
export const RISK_WEIGHTS: Record<RiskDimensionKey, number> = {
  FINANCIAL: 0.25,
  TIMELINE: 0.2,
  COMPLIANCE: 0.2,
  IA: 0.2,
  GEO: 0.1,
  EVIDENCE: 0.05,
};

/** Ordered worst-last. Index doubles as severity rank. */
export const RISK_LEVELS: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/** Fixed level bands. Lower bound inclusive, upper bound exclusive (1.0 is CRITICAL). */
export const RISK_LEVEL_BANDS: readonly { level: RiskLevel; min: number; max: number }[] = [
  { level: 'LOW', min: 0, max: 0.25 },
  { level: 'MEDIUM', min: 0.25, max: 0.5 },
  { level: 'HIGH', min: 0.5, max: 0.75 },
  { level: 'CRITICAL', min: 0.75, max: 1 },
] as const;

/** Levels that count as "flagged" for KPI counts and the alert feed. */
export const ELEVATED_RISK_LEVELS: readonly RiskLevel[] = ['HIGH', 'CRITICAL'] as const;

// ---------------------------------------------------------------------------
// Level metadata
// ---------------------------------------------------------------------------

export interface RiskLevelMeta {
  level: RiskLevel;
  /** Rank 0–3, higher is worse. */
  rank: number;
  /** Display label. Always rendered next to the colour — never colour alone. */
  label: string;
  /** Fixed hex, for canvas/SVG/D3/Leaflet contexts that cannot use Tailwind classes. */
  hex: string;
  /** CSS custom property name, for stylesheet use. */
  cssVar: string;
  /** Solid fill (swatches, chart series, map markers). */
  fillClass: string;
  /** Tinted panel background for cards and table row emphasis. */
  surfaceClass: string;
  /** Border to pair with `surfaceClass`. */
  borderClass: string;
  /** Readable text colour on `surfaceClass`. */
  textClass: string;
  /** Full badge styling — surface + border + text together. */
  badgeClass: string;
  /**
   * Shape used by the severity icon. A second, non-colour encoding so the scale
   * survives greyscale printing and colour-vision deficiency (Design Doc §7).
   */
  shape: 'circle' | 'diamond' | 'triangle' | 'octagon';
  /** Band, for legends and tooltips. */
  range: string;
  /** What the level means operationally — used in legends and help text. */
  meaning: string;
}

export const RISK_LEVEL_META: Record<RiskLevel, RiskLevelMeta> = {
  LOW: {
    level: 'LOW',
    rank: 0,
    label: 'Low',
    hex: '#16A34A',
    cssVar: '--risk-low',
    fillClass: 'bg-risk-low',
    surfaceClass: 'bg-risk-low-surface',
    borderClass: 'border-risk-low-border',
    textClass: 'text-risk-low-text',
    badgeClass: 'bg-risk-low-surface border-risk-low-border text-risk-low-text',
    shape: 'circle',
    range: '0.00–0.25',
    meaning: 'No material anomaly detected. Routine monitoring only.',
  },
  MEDIUM: {
    level: 'MEDIUM',
    rank: 1,
    label: 'Medium',
    hex: '#EAB308',
    cssVar: '--risk-medium',
    fillClass: 'bg-risk-medium',
    surfaceClass: 'bg-risk-medium-surface',
    borderClass: 'border-risk-medium-border',
    textClass: 'text-risk-medium-text',
    badgeClass: 'bg-risk-medium-surface border-risk-medium-border text-risk-medium-text',
    shape: 'diamond',
    range: '0.25–0.50',
    meaning: 'Minor deviations present. Review when capacity allows.',
  },
  HIGH: {
    level: 'HIGH',
    rank: 2,
    label: 'High',
    hex: '#F97316',
    cssVar: '--risk-high',
    fillClass: 'bg-risk-high',
    surfaceClass: 'bg-risk-high-surface',
    borderClass: 'border-risk-high-border',
    textClass: 'text-risk-high-text',
    badgeClass: 'bg-risk-high-surface border-risk-high-border text-risk-high-text',
    shape: 'triangle',
    range: '0.50–0.75',
    meaning: 'Multiple corroborating anomalies. Requires officer verification.',
  },
  CRITICAL: {
    level: 'CRITICAL',
    rank: 3,
    label: 'Critical',
    hex: '#DC2626',
    cssVar: '--risk-critical',
    fillClass: 'bg-risk-critical',
    surfaceClass: 'bg-risk-critical-surface',
    borderClass: 'border-risk-critical-border',
    textClass: 'text-risk-critical-text',
    badgeClass: 'bg-risk-critical-surface border-risk-critical-border text-risk-critical-text',
    shape: 'octagon',
    range: '0.75–1.00',
    meaning: 'Severe, multi-dimensional anomaly. Priority verification recommended.',
  },
};

/**
 * Maps a backend score onto its fixed band. This is a lookup, not a calculation —
 * the API also sends `risk_level`, and that value always wins where present.
 */
export function riskLevelFromScore(score: number): RiskLevel {
  if (!Number.isFinite(score)) return 'LOW';
  const clamped = Math.min(Math.max(score, 0), 1);
  for (const band of RISK_LEVEL_BANDS) {
    if (clamped >= band.min && clamped < band.max) return band.level;
  }
  return 'CRITICAL';
}

export function riskMeta(level: RiskLevel): RiskLevelMeta {
  return RISK_LEVEL_META[level];
}

/** Sort comparator: negative when `a` is less severe than `b`. */
export function compareRiskLevel(a: RiskLevel, b: RiskLevel): number {
  return RISK_LEVEL_META[a].rank - RISK_LEVEL_META[b].rank;
}

export function isElevated(level: RiskLevel): boolean {
  return RISK_LEVEL_META[level].rank >= RISK_LEVEL_META.HIGH.rank;
}

/** Hex ramp for D3 / Leaflet / Recharts, ordered LOW → CRITICAL. */
export const RISK_COLOR_RAMP: readonly string[] = RISK_LEVELS.map((l) => RISK_LEVEL_META[l].hex);

// ---------------------------------------------------------------------------
// Dimension metadata
// ---------------------------------------------------------------------------

export interface RiskDimensionMeta {
  key: RiskDimensionKey;
  /** Full label, e.g. "Financial Risk". */
  label: string;
  /** Compact label for chart axes and table headers. */
  shortLabel: string;
  weight: number;
  /** The matching numeric field on RiskScore. */
  scoreField: keyof Pick<
    RiskScore,
    | 'financial_risk'
    | 'timeline_risk'
    | 'compliance_risk'
    | 'ia_risk'
    | 'geo_risk'
    | 'evidence_risk'
  >;
  /** What the dimension measures — shown on the dimension card. */
  description: string;
  /** The statistic the backend uses, named on-screen so the number is legible. */
  primaryStatistic: string;
}

/** Canonical display order for the six cards. Highest weight first. */
export const RISK_DIMENSION_ORDER: readonly RiskDimensionKey[] = [
  'FINANCIAL',
  'TIMELINE',
  'COMPLIANCE',
  'IA',
  'GEO',
  'EVIDENCE',
] as const;

export const RISK_DIMENSION_META: Record<RiskDimensionKey, RiskDimensionMeta> = {
  FINANCIAL: {
    key: 'FINANCIAL',
    label: 'Financial Risk',
    shortLabel: 'Financial',
    weight: RISK_WEIGHTS.FINANCIAL,
    scoreField: 'financial_risk',
    description:
      'Unit cost compared against peer projects of the same work type in the same state.',
    primaryStatistic: 'Z-score vs. state benchmark',
  },
  TIMELINE: {
    key: 'TIMELINE',
    label: 'Timeline Risk',
    shortLabel: 'Timeline',
    weight: RISK_WEIGHTS.TIMELINE,
    scoreField: 'timeline_risk',
    description:
      'Elapsed time at each stage against the sanction and completion windows in the guidelines.',
    primaryStatistic: 'Predicted delay probability',
  },
  COMPLIANCE: {
    key: 'COMPLIANCE',
    label: 'Compliance Risk',
    shortLabel: 'Compliance',
    weight: RISK_WEIGHTS.COMPLIANCE,
    scoreField: 'compliance_risk',
    description:
      'Rule-by-rule checks: 45-day sanction, 12-month completion, SC/ST spend mandate, stage photographs.',
    primaryStatistic: 'Rules breached',
  },
  IA: {
    key: 'IA',
    label: 'IA / Contractor Risk',
    shortLabel: 'IA',
    weight: RISK_WEIGHTS.IA,
    scoreField: 'ia_risk',
    description:
      'Concentration of the implementing agency across a single MP or district, plus its delivery record.',
    primaryStatistic: 'HHI concentration index',
  },
  GEO: {
    key: 'GEO',
    label: 'Geospatial Risk',
    shortLabel: 'Geospatial',
    weight: RISK_WEIGHTS.GEO,
    scoreField: 'geo_risk',
    description:
      'Work location plausibility: distance from the constituency, clustering, and proximity to similar works.',
    primaryStatistic: 'Distance to nearest similar work',
  },
  EVIDENCE: {
    key: 'EVIDENCE',
    label: 'Evidence / Data Risk',
    shortLabel: 'Evidence',
    weight: RISK_WEIGHTS.EVIDENCE,
    scoreField: 'evidence_risk',
    description:
      'Completeness of the documentary record: stage photographs, dates, and payment entries.',
    primaryStatistic: 'Required photographs present',
  },
};

export function dimensionMeta(dimension: RiskDimensionKey): RiskDimensionMeta {
  return RISK_DIMENSION_META[dimension];
}

/** Reads a dimension's score off a RiskScore without a switch at every call site. */
export function dimensionScore(riskScore: RiskScore, dimension: RiskDimensionKey): number {
  return riskScore[RISK_DIMENSION_META[dimension].scoreField];
}

/** Contribution of one dimension to the overall score, i.e. score × weight. */
export function dimensionContribution(
  riskScore: RiskScore,
  dimension: RiskDimensionKey,
): number {
  return dimensionScore(riskScore, dimension) * RISK_WEIGHTS[dimension];
}

// ---------------------------------------------------------------------------
// Six-card assembly
// ---------------------------------------------------------------------------

/**
 * Produces exactly six dimension cards in canonical order.
 *
 * Prefers `risk_dimensions` from the API. Where the backend has not supplied it,
 * falls back to the dimension's numeric score plus the matching entry in
 * `top_risk_factors` — both already in the payload. Nothing is fabricated: a
 * dimension with no evidence text gets an explicit "no anomaly detected" line
 * rather than an invented finding.
 */
export function buildRiskDimensions(
  riskScore: RiskScore,
  provided?: RiskDimensionDetail[],
): RiskDimensionDetail[] {
  const byDimension = new Map<RiskDimensionKey, RiskDimensionDetail>();
  for (const detail of provided ?? []) {
    byDimension.set(detail.dimension, detail);
  }

  const factorsByDimension = new Map<RiskDimensionKey, RiskFactor>();
  for (const factor of riskScore.top_risk_factors) {
    const existing = factorsByDimension.get(factor.dimension);
    if (!existing || compareRiskLevel(factor.severity, existing.severity) > 0) {
      factorsByDimension.set(factor.dimension, factor);
    }
  }

  return RISK_DIMENSION_ORDER.map((dimension) => {
    const supplied = byDimension.get(dimension);
    if (supplied) return supplied;

    const meta = RISK_DIMENSION_META[dimension];
    const score = dimensionScore(riskScore, dimension);
    const factor = factorsByDimension.get(dimension);
    const severity = factor?.severity ?? riskLevelFromScore(score);

    return {
      dimension,
      score,
      severity,
      evidence:
        factor?.text ??
        (isElevated(severity)
          ? `${meta.label} is elevated but no itemised finding was returned for this dimension.`
          : 'No anomaly detected in this dimension.'),
      metric_label: factor?.value !== undefined ? formatMetric(dimension, factor.value) : null,
      metric_name: factor?.value !== undefined ? meta.primaryStatistic : null,
      metric_value: factor?.value ?? null,
      explanation: meta.description,
      reference: null,
    } satisfies RiskDimensionDetail;
  });
}

/** Formats a raw factor value using the statistic that dimension is measured in. */
function formatMetric(dimension: RiskDimensionKey, value: number): string {
  switch (dimension) {
    case 'FINANCIAL':
      return `Z-score ${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    case 'TIMELINE':
      return value <= 1
        ? `${Math.round(value * 100)}% predicted delay probability`
        : `${Math.round(value)} days overdue`;
    case 'COMPLIANCE':
      return `${Math.round(value)} rule${Math.round(value) === 1 ? '' : 's'} breached`;
    case 'IA':
      return `HHI ${value.toFixed(2)}`;
    case 'GEO':
      return `${value.toFixed(2)} km from nearest similar work`;
    case 'EVIDENCE':
      return `${Math.round(value)} required photograph${Math.round(value) === 1 ? '' : 's'} missing`;
    default:
      return value.toFixed(2);
  }
}

/** Highest-severity factor — used for the one-line reason in ranked tables. */
export function topRiskFactor(riskScore: RiskScore): RiskFactor | null {
  if (riskScore.top_risk_factors.length === 0) return null;
  return [...riskScore.top_risk_factors].sort(
    (a, b) => compareRiskLevel(b.severity, a.severity) || (b.value ?? 0) - (a.value ?? 0),
  )[0];
}
