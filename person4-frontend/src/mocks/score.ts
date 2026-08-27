import type {
  CostBenchmark,
  PaymentRecord,
  Project,
  ProjectPhoto,
  RecommendedAction,
  RiskDimensionDetail,
  RiskDimensionKey,
  RiskFactor,
  RiskLevel,
  RiskScore,
  TimelineEvent,
} from '@/types/api';
import { RISK_DIMENSION_META, RISK_WEIGHTS, riskLevelFromScore } from '@/lib/risk';
import { COMPLETION_WINDOW_MONTHS, SANCTION_WINDOW_DAYS } from '@/mocks/taxonomy';
import { MODEL_VERSION, DATASET_AS_OF } from '@/mocks/scenario';
import { addDays, clamp01, financialYearOf, parseDate, round, toISODate, type Rng } from '@/mocks/rng';

/**
 * Derives the six risk dimensions from generated facts.
 *
 * This is the mock stand-in for the backend's scoring service. It exists so that
 * every number on screen traces back to a fact in the record: the financial score
 * comes from the same unit cost the evidence sentence quotes, the compliance score
 * comes from the same rule outcomes the timeline renders. A judge can compare the
 * card against the raw data and they will agree.
 *
 * All six dimension cards are produced for every project, at every severity. A
 * project with no cost anomaly gets an explicit "within 8% of the benchmark" line
 * rather than an empty card — the Design Doc requires six cards, and an unexplained
 * blank reads as a bug.
 *
 * Vocabulary here is audit language: "anomaly", "requires verification", "flagged
 * for review". Never an accusation (Design Doc §4.2).
 */

// ---------------------------------------------------------------------------
// Small formatting helpers, local to the mock layer
// ---------------------------------------------------------------------------

const inr = (lakhs: number): string =>
  lakhs >= 100 ? `₹${round(lakhs / 100, 2)} Cr` : `₹${round(lakhs, 2)} L`;

const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;

const metres = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${round(km, 2)} km`;

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

const months = (n: number): string => `${Math.round(n)} ${plural(Math.round(n), 'month', 'months')}`;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Everything the scorer needs that is not on the project record itself. */
export interface ScoringContext {
  ia: {
    ia_id: string;
    ia_name: string;
    hhi: number;
    /** Works held for the single MP the agency is most concentrated on. */
    dominant_mp_projects: number;
    total_projects: number;
    completed_projects: number;
    avg_delay_days: number;
  };
  /** Distance to the closest work of the same type in the same district, if any. */
  nearest_similar_km: number | null;
  nearest_similar_project_id: string | null;
  district_name: string;
  state_name: string;
  /** Benchmark unit cost for this work type in this state. */
  benchmark_unit_cost: number;
  unit: string;
  /** Set for the seeded demo record; otherwise derived from the facts. */
  delay_probability_override?: number;
}

export interface RuleOutcome {
  rule_id: string;
  compliant: boolean | null;
  /** Standalone sentence, shown in the project's compliance list. */
  evidence: string;
  /**
   * Noun phrase for embedding mid-sentence, e.g. "…breached, including **the
   * 45-day sanction window, exceeded by 32 days**." Kept separate from `evidence`
   * so neither string has to read awkwardly to serve both jobs.
   */
  fragment: string;
}

export interface ScoredProject {
  risk: RiskScore;
  dimensions: RiskDimensionDetail[];
  benchmark: CostBenchmark;
  timeline: TimelineEvent[];
  payments: PaymentRecord[];
  photos: ProjectPhoto[];
  ruleOutcomes: RuleOutcome[];
  recommendedAction: RecommendedAction;
  zScore: number;
  unitCost: number;
  delayProbability: number;
  monthsSinceSanction: number | null;
  sanctionLagDays: number | null;
  requiredPhotos: number;
}

// ---------------------------------------------------------------------------
// Derived facts
// ---------------------------------------------------------------------------

const MS_PER_MONTH = 86_400_000 * 30.44;

/**
 * Standard deviation of unit cost, expressed as half the benchmark.
 *
 * Chosen so that a work costing 3.4× the benchmark lands at roughly Z = +4.8, which
 * is the worked example in the Design Doc. It keeps the Z-scores in a range an
 * auditor would recognise instead of producing implausible double-digit values.
 */
const UNIT_COST_SD_FRACTION = 0.5;

function zScoreFor(unitCost: number, benchmark: number): number {
  if (benchmark <= 0) return 0;
  return round((unitCost - benchmark) / (benchmark * UNIT_COST_SD_FRACTION), 2);
}

/**
 * The timeline model's predicted probability that a live work misses its window.
 *
 * Stands in for an ML output, so it is a *fact* on the record rather than something
 * the scorer derives from other scores. Completed works get 0 — there is no future
 * delay left to predict, and their timeline risk comes from the actual overrun.
 */
function predictDelayProbability(input: {
  completed: boolean;
  monthsSinceSanction: number | null;
  sanctionLagDays: number | null;
  missingPhotos: number;
  utilisationShare: number;
}): number {
  if (input.completed) return 0;
  if (input.monthsSinceSanction === null) return 0.35;
  const overdue = Math.max(0, input.monthsSinceSanction - COMPLETION_WINDOW_MONTHS);
  return round(
    clamp01(
      0.06 +
        0.55 * Math.min(1, overdue / 12) +
        ((input.sanctionLagDays ?? 0) > SANCTION_WINDOW_DAYS ? 0.15 : 0) +
        (input.missingPhotos > 0 ? 0.12 : 0) +
        (input.utilisationShare < 0.5 ? 0.08 : 0),
    ),
    2,
  );
}

// ---------------------------------------------------------------------------
// The six dimensions
// ---------------------------------------------------------------------------

function financialDimension(args: {
  unitCost: number;
  benchmark: number;
  unit: string;
  ratio: number;
  z: number;
  workType: string;
  stateName: string;
}): RiskDimensionDetail {
  const { unitCost, benchmark, unit, ratio, z, workType, stateName } = args;
  const score = clamp01((Math.abs(z) - 0.75) / 5.25);
  const severity = riskLevelFromScore(score);
  const costPair = `${inr(unitCost)}/${unit} vs ${inr(benchmark)}/${unit}`;

  const evidence =
    z >= 0.75
      ? `Unit cost is ${round(ratio, 1)}× the state benchmark for ${workType.toLowerCase()} (${costPair}) — requires cost justification.`
      : z <= -0.75
        ? `Unit cost is ${pct(1 - ratio)} below the state benchmark (${costPair}), which can indicate under-specification or a data entry error.`
        : `Unit cost is within ${pct(Math.abs(ratio - 1))} of the state benchmark (${costPair}). No cost anomaly.`;

  return {
    dimension: 'FINANCIAL',
    score: round(score, 3),
    severity,
    evidence,
    metric_label: `Z-score ${z >= 0 ? '+' : ''}${z.toFixed(1)}`,
    metric_name: 'Z-score vs. state benchmark',
    metric_value: z,
    explanation: `Compared against ${stateName} works of the same type and unit. A Z-score above +2 places the work outside the range covering roughly 95% of comparable works.`,
    reference: 'State Schedule of Rates (illustrative benchmark)',
  };
}

function timelineDimension(args: {
  completed: boolean;
  monthsSinceSanction: number | null;
  durationMonths: number | null;
  sanctionLagDays: number | null;
  delayProbability: number;
  sanctioned: boolean;
}): RiskDimensionDetail {
  const { completed, monthsSinceSanction, durationMonths, sanctionLagDays, delayProbability, sanctioned } =
    args;

  const lagPenalty =
    sanctionLagDays === null ? 0.25 : clamp01((sanctionLagDays - 30) / 120) * 0.35;

  let score: number;
  let evidence: string;
  let metricLabel: string | null;
  let metricValue: number | null;
  let metricName: string | null;

  if (completed && durationMonths !== null) {
    const overrun = Math.max(0, durationMonths - COMPLETION_WINDOW_MONTHS);
    score = clamp01(0.65 * clamp01(overrun / 18) + lagPenalty * 0.5);
    evidence =
      overrun > 0
        ? `Completed in ${months(durationMonths)}, which is ${months(overrun)} beyond the 12-month window.`
        : `Completed in ${months(durationMonths)}, within the 12-month window.`;
    metricLabel = `${Math.round(durationMonths)} months to completion`;
    metricName = 'Months from sanction to completion';
    metricValue = round(durationMonths, 1);
  } else if (!sanctioned) {
    score = clamp01(0.2 + lagPenalty);
    evidence =
      sanctionLagDays === null
        ? 'Recommended but not yet sanctioned; no sanction date recorded against the work.'
        : `Awaiting sanction ${months(sanctionLagDays / 30.44)} after recommendation, against a 45-day window.`;
    metricLabel = 'Not yet sanctioned';
    metricName = 'Days awaiting sanction';
    metricValue = sanctionLagDays;
  } else {
    const elapsed = monthsSinceSanction ?? 0;
    const overdue = clamp01((elapsed - COMPLETION_WINDOW_MONTHS) / 18);
    score = clamp01(0.5 * delayProbability + 0.35 * overdue + lagPenalty * 0.4);
    evidence =
      elapsed > COMPLETION_WINDOW_MONTHS
        ? `${months(elapsed)} since sanction against a 12-month completion window, with no completion recorded; predicted delay probability ${pct(delayProbability)}.`
        : `In progress ${months(elapsed)} after sanction, inside the 12-month window; predicted delay probability ${pct(delayProbability)}.`;
    metricLabel = `${pct(delayProbability)} predicted delay probability`;
    metricName = 'Predicted delay probability';
    metricValue = delayProbability;
  }

  return {
    dimension: 'TIMELINE',
    score: round(score, 3),
    severity: riskLevelFromScore(score),
    evidence,
    metric_label: metricLabel,
    metric_name: metricName,
    metric_value: metricValue,
    explanation:
      'Elapsed time is measured against the two guideline windows: sanction within 45 days of recommendation, and completion within 12 months of sanction.',
    reference: 'MPLADS Guidelines, Ch. 3 & Ch. 4',
  };
}

function complianceDimension(outcomes: RuleOutcome[]): RiskDimensionDetail {
  const applicable = outcomes.filter((o) => o.compliant !== null);
  const breached = applicable.filter((o) => o.compliant === false);
  const score = applicable.length === 0 ? 0 : breached.length / applicable.length;

  const evidence =
    breached.length === 0
      ? `All ${applicable.length} applicable guideline ${plural(applicable.length, 'check', 'checks')} passed for this work.`
      : `${breached.length} of ${applicable.length} guideline ${plural(applicable.length, 'requirement', 'requirements')} breached, including ${breached[0].fragment}.`;

  return {
    dimension: 'COMPLIANCE',
    score: round(score, 3),
    severity: riskLevelFromScore(score),
    evidence,
    metric_label: `${breached.length} of ${applicable.length} rules breached`,
    metric_name: 'Rules breached',
    metric_value: breached.length,
    explanation:
      'Each MPLADS guideline requirement is evaluated independently. Only requirements that apply at the work’s current stage are counted.',
    reference: 'MPLADS Guidelines — sanction, completion, evidence and release rules',
  };
}

function iaDimension(ia: ScoringContext['ia'], iaType: string): RiskDimensionDetail {
  const completionRate = ia.total_projects > 0 ? ia.completed_projects / ia.total_projects : 0;
  const score = clamp01(
    0.55 * ia.hhi + 0.3 * clamp01(ia.avg_delay_days / 365) + 0.15 * (1 - completionRate),
  );
  const dominantShare = ia.total_projects > 0 ? ia.dominant_mp_projects / ia.total_projects : 0;

  const evidence =
    ia.hhi >= 0.5
      ? `Implementing agency holds ${ia.dominant_mp_projects} of its ${ia.total_projects} works for a single MP (${pct(dominantShare)} of its portfolio), with an average delay of ${Math.round(ia.avg_delay_days)} days.`
      : `Implementing agency works across multiple MPs (largest single share ${pct(dominantShare)} of ${ia.total_projects} works), with an average delay of ${Math.round(ia.avg_delay_days)} days.`;

  return {
    dimension: 'IA',
    score: round(score, 3),
    severity: riskLevelFromScore(score),
    evidence,
    metric_label: `HHI ${ia.hhi.toFixed(2)}`,
    metric_name: 'HHI concentration index',
    metric_value: round(ia.hhi, 3),
    explanation: `The Herfindahl-Hirschman index measures how concentrated an agency’s work is across MPs. 1.00 means every work comes from one MP; below 0.20 indicates a broad spread. Agency type on record: ${iaType.replace('_', ' ').toLowerCase()}.`,
    reference: 'Concentration flagged at HHI ≥ 0.50',
  };
}

function geoDimension(args: {
  hasGps: boolean;
  nearestKm: number | null;
  nearestProjectId: string | null;
  districtName: string;
}): RiskDimensionDetail {
  const { hasGps, nearestKm, nearestProjectId, districtName } = args;

  const proximityScore =
    nearestKm === null ? 0 : clamp01((2 - nearestKm) / 2) * 0.95;
  const missingGpsScore = hasGps ? 0.05 : 0.5;
  const score = clamp01(Math.max(missingGpsScore, proximityScore));

  const evidence = !hasGps
    ? `No GPS coordinates recorded; the work is plotted at the ${districtName} district centroid, so its location cannot be verified.`
    : nearestKm !== null && nearestKm <= 2
      ? `A work of the same type lies ${metres(nearestKm)} away in ${districtName}${nearestProjectId ? ` (${nearestProjectId})` : ''} — close enough to warrant checking whether they overlap.`
      : nearestKm !== null
        ? `Nearest work of the same type is ${metres(nearestKm)} away. Coordinates recorded and plausible for ${districtName}.`
        : `Coordinates recorded and plausible for ${districtName}. No comparable work nearby.`;

  return {
    dimension: 'GEO',
    score: round(score, 3),
    severity: riskLevelFromScore(score),
    evidence,
    metric_label: hasGps
      ? nearestKm !== null
        ? `${metres(nearestKm)} to nearest similar work`
        : 'GPS recorded'
      : 'GPS missing',
    metric_name: hasGps ? 'Distance to nearest similar work' : 'Location source',
    metric_value: nearestKm,
    explanation:
      'Two works of the same type within 2 km of each other may be the same physical asset recorded twice. Works without coordinates cannot be checked at all, which is itself a finding.',
    reference: 'Proximity flagged below 2 km',
  };
}

function evidenceDimension(args: {
  photosPresent: number;
  photosRequired: number;
  missingFields: string[];
}): RiskDimensionDetail {
  const { photosPresent, photosRequired, missingFields } = args;
  const missingPhotos = Math.max(0, photosRequired - photosPresent);
  const photoGap = photosRequired === 0 ? 0 : missingPhotos / photosRequired;
  const fieldGap = missingFields.length / 3;
  const score = clamp01(0.75 * photoGap + 0.25 * clamp01(fieldGap));

  const parts: string[] = [];
  if (photosRequired === 0) {
    parts.push('Stage photographs are not yet due; the work has not been sanctioned.');
  } else if (missingPhotos > 0) {
    parts.push(
      `${missingPhotos} of ${photosRequired} required stage ${plural(missingPhotos, 'photograph is', 'photographs are')} absent from the record.`,
    );
  } else {
    parts.push(`All ${photosRequired} required stage photographs are on record.`);
  }
  if (missingFields.length > 0) {
    parts.push(`Also missing: ${missingFields.join(', ')}.`);
  }

  return {
    dimension: 'EVIDENCE',
    score: round(score, 3),
    severity: riskLevelFromScore(score),
    evidence: parts.join(' '),
    metric_label: `${photosPresent} of ${photosRequired} photographs present`,
    metric_name: 'Required photographs present',
    metric_value: missingPhotos,
    explanation:
      'Geo-tagged photographs at each payment stage are the primary release evidence in eSAKSHI. Missing evidence does not itself indicate a problem, but it prevents any other check from being verified.',
    reference: 'MPLADS Guidelines, Ch. 6 — Monitoring and eSAKSHI reporting',
  };
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

function evaluateRules(args: {
  sanctionLagDays: number | null;
  sanctioned: boolean;
  completed: boolean;
  durationMonths: number | null;
  monthsSinceSanction: number | null;
  photosPresent: number;
  photosRequired: number;
  utilisationShare: number;
  secondInstalmentReleased: boolean;
}): RuleOutcome[] {
  const {
    sanctionLagDays,
    sanctioned,
    completed,
    durationMonths,
    monthsSinceSanction,
    photosPresent,
    photosRequired,
    utilisationShare,
    secondInstalmentReleased,
  } = args;

  const outcomes: RuleOutcome[] = [];

  outcomes.push(
    sanctioned && sanctionLagDays !== null
      ? sanctionLagDays <= SANCTION_WINDOW_DAYS
        ? {
            rule_id: 'SANCTION_45D',
            compliant: true,
            evidence: `Sanctioned ${sanctionLagDays} days after recommendation, within the 45-day window.`,
            fragment: `the 45-day sanction window, met on day ${sanctionLagDays}`,
          }
        : {
            rule_id: 'SANCTION_45D',
            compliant: false,
            evidence: `The 45-day sanction window was exceeded by ${sanctionLagDays - SANCTION_WINDOW_DAYS} days; sanction was issued on day ${sanctionLagDays}.`,
            fragment: `the 45-day sanction window, exceeded by ${sanctionLagDays - SANCTION_WINDOW_DAYS} days`,
          }
      : {
          rule_id: 'SANCTION_45D',
          compliant: null,
          evidence: 'Not yet sanctioned; the 45-day check is still open.',
          fragment: 'the 45-day sanction window, still open',
        },
  );

  if (!sanctioned) {
    outcomes.push({
      rule_id: 'COMPLETION_12M',
      compliant: null,
      evidence: 'The 12-month completion clock starts at sanction, which has not happened.',
      fragment: 'the 12-month completion window, not yet started',
    });
  } else if (completed && durationMonths !== null) {
    const late = durationMonths > COMPLETION_WINDOW_MONTHS;
    outcomes.push({
      rule_id: 'COMPLETION_12M',
      compliant: !late,
      evidence: late
        ? `Completion took ${months(durationMonths)} against a 12-month window.`
        : `Completed ${months(durationMonths)} after sanction, within the 12-month window.`,
      fragment: late
        ? `the 12-month completion window, overrun by ${months(durationMonths - COMPLETION_WINDOW_MONTHS)}`
        : `the 12-month completion window, met in ${months(durationMonths)}`,
    });
  } else {
    const elapsed = monthsSinceSanction ?? 0;
    const overdue = elapsed > COMPLETION_WINDOW_MONTHS;
    outcomes.push({
      rule_id: 'COMPLETION_12M',
      // Still inside the window is neither a pass nor a breach — the work has not
      // had its chance yet, and counting it as compliant would flatter the record.
      compliant: overdue ? false : null,
      evidence: overdue
        ? `Past the 12-month completion window by ${months(elapsed - COMPLETION_WINDOW_MONTHS)}, with no completion recorded.`
        : `In progress ${months(elapsed)} after sanction; still inside the 12-month window.`,
      fragment: overdue
        ? `the 12-month completion window, now ${months(elapsed - COMPLETION_WINDOW_MONTHS)} overdue`
        : `the 12-month completion window, ${months(COMPLETION_WINDOW_MONTHS - elapsed)} remaining`,
    });
  }

  outcomes.push(
    photosRequired === 0
      ? {
          rule_id: 'STAGE_PHOTOS',
          compliant: null,
          evidence: 'Stage photographs are not due until the work is sanctioned.',
          fragment: 'stage photograph evidence, not yet due',
        }
      : photosPresent >= photosRequired
        ? {
            rule_id: 'STAGE_PHOTOS',
            compliant: true,
            evidence: `All ${photosRequired} stage photographs are on record.`,
            fragment: `stage photograph evidence, complete at ${photosRequired} of ${photosRequired}`,
          }
        : {
            rule_id: 'STAGE_PHOTOS',
            compliant: false,
            evidence: `${photosRequired - photosPresent} of ${photosRequired} required stage photographs are missing from the record.`,
            fragment: `stage photograph evidence, missing ${photosRequired - photosPresent} of ${photosRequired}`,
          },
  );

  outcomes.push(
    !secondInstalmentReleased
      ? {
          rule_id: 'FUND_UTILISATION',
          compliant: null,
          evidence:
            'Only the first instalment has been released; the utilisation check is not yet due.',
          fragment: 'the instalment utilisation rule, not yet due',
        }
      : photosPresent >= 2 && utilisationShare >= 0.8
        ? {
            rule_id: 'FUND_UTILISATION',
            compliant: true,
            evidence: `Second instalment released after ${pct(utilisationShare)} certified utilisation.`,
            fragment: `the instalment utilisation rule, met at ${pct(utilisationShare)}`,
          }
        : {
            rule_id: 'FUND_UTILISATION',
            compliant: false,
            evidence: `A further release is recorded at ${pct(utilisationShare)} utilisation with ${photosPresent} supporting ${plural(photosPresent, 'photograph', 'photographs')}, against a requirement of 80% certified utilisation.`,
            fragment: `the instalment utilisation rule, released at ${pct(utilisationShare)} against an 80% requirement`,
          },
  );

  return outcomes;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

const RECOMMENDED_ACTIONS: Record<RiskLevel, { action: string; refer_to: string }> = {
  CRITICAL: {
    action: 'Refer for field verification and written cost justification before any further release.',
    refer_to: 'District Authority — Nodal Officer',
  },
  HIGH: {
    action: 'Seek written cost and progress justification from the implementing agency.',
    refer_to: 'District Authority — Monitoring Cell',
  },
  MEDIUM: {
    action: 'Include in the next monthly monitoring review.',
    refer_to: 'State Nodal Department',
  },
  LOW: {
    action: 'No action required beyond routine monitoring.',
    refer_to: 'Routine monitoring',
  },
};

/** Builds the payment ledger, one row per release stage. */
function buildPayments(args: {
  estimated: number;
  firstDate: string | null;
  firstAmount: number | null;
  finalDate: string | null;
  totalPaid: number;
  photosPresent: number;
  completed: boolean;
  rng: Rng;
}): PaymentRecord[] {
  const { estimated, firstDate, firstAmount, finalDate, totalPaid, photosPresent, completed, rng } =
    args;

  if (firstDate === null) {
    return [
      {
        stage: 'First instalment',
        paid_date: null,
        amount_lakhs: null,
        share_of_sanctioned: null,
        reported_progress: null,
        photo_required: true,
        photo_present: false,
        note: 'No release recorded against this work.',
      },
    ];
  }

  const rows: PaymentRecord[] = [
    {
      stage: 'First instalment',
      paid_date: firstDate,
      amount_lakhs: firstAmount,
      share_of_sanctioned: firstAmount === null ? null : round(firstAmount / estimated, 3),
      reported_progress: round(rng.float(0.2, 0.45), 2),
      photo_required: true,
      photo_present: photosPresent >= 1,
      note: photosPresent >= 1 ? null : 'Released without a stage photograph on record.',
    },
  ];

  const secondAmount = round(totalPaid - (firstAmount ?? 0), 2);
  if (secondAmount > 0.5) {
    rows.push({
      stage: 'Second instalment',
      paid_date: toISODate(addDays(parseDate(firstDate), rng.int(60, 300))),
      amount_lakhs: secondAmount,
      share_of_sanctioned: round(secondAmount / estimated, 3),
      reported_progress: round(rng.float(0.5, completed ? 1 : 0.8), 2),
      photo_required: true,
      photo_present: photosPresent >= 2,
      note: photosPresent >= 2 ? null : 'Released without the corresponding stage photograph.',
    });
  }

  rows.push({
    stage: 'Final settlement',
    paid_date: finalDate,
    amount_lakhs: finalDate === null ? null : round(estimated - totalPaid, 2),
    share_of_sanctioned: finalDate === null ? null : round(1 - totalPaid / estimated, 3),
    reported_progress: completed ? 1 : null,
    photo_required: true,
    photo_present: photosPresent >= 3,
    note: finalDate === null ? 'Not yet due.' : photosPresent >= 3 ? null : 'Completion photograph absent.',
  });

  return rows;
}

/** Builds the vertical timeline, marking guideline breaches inline. */
function buildTimeline(args: {
  recommended: string;
  sanction: string | null;
  sanctionLagDays: number | null;
  firstPaymentDate: string | null;
  completion: string | null;
  durationMonths: number | null;
  monthsSinceSanction: number | null;
}): TimelineEvent[] {
  const {
    recommended,
    sanction,
    sanctionLagDays,
    firstPaymentDate,
    completion,
    durationMonths,
    monthsSinceSanction,
  } = args;

  const events: TimelineEvent[] = [
    {
      key: 'RECOMMENDED',
      label: 'Recommended by MP',
      date: recommended,
      status: 'COMPLETE',
      detail: 'Work recommended to the District Authority.',
      breach: null,
    },
  ];

  const sanctionOver =
    sanctionLagDays !== null ? sanctionLagDays - SANCTION_WINDOW_DAYS : null;
  events.push({
    key: 'SANCTIONED',
    label: 'Sanctioned by District Authority',
    date: sanction,
    status: sanction === null ? 'OVERDUE' : sanctionOver !== null && sanctionOver > 0 ? 'BREACH' : 'COMPLETE',
    detail:
      sanction === null
        ? 'No sanction recorded.'
        : `${sanctionLagDays} days after recommendation (45-day window).`,
    breach:
      sanctionOver !== null && sanctionOver > 0
        ? {
            rule: 'SANCTION_45D',
            text: `Sanction issued ${sanctionOver} days beyond the 45-day window.`,
            days_over: sanctionOver,
          }
        : null,
  });

  events.push({
    key: 'FIRST_PAYMENT',
    label: 'First instalment released',
    date: firstPaymentDate,
    status: sanction === null ? 'NOT_APPLICABLE' : firstPaymentDate === null ? 'PENDING' : 'COMPLETE',
    detail: firstPaymentDate === null ? 'No release recorded.' : null,
    breach: null,
  });

  const overdueMonths =
    completion === null && monthsSinceSanction !== null
      ? monthsSinceSanction - COMPLETION_WINDOW_MONTHS
      : null;
  const overrunMonths =
    completion !== null && durationMonths !== null
      ? durationMonths - COMPLETION_WINDOW_MONTHS
      : null;

  events.push({
    key: 'COMPLETED',
    label: 'Work completed',
    date: completion,
    status:
      sanction === null
        ? 'NOT_APPLICABLE'
        : completion === null
          ? overdueMonths !== null && overdueMonths > 0
            ? 'BREACH'
            : 'PENDING'
          : overrunMonths !== null && overrunMonths > 0
            ? 'BREACH'
            : 'COMPLETE',
    detail:
      completion === null
        ? monthsSinceSanction === null
          ? null
          : `${months(monthsSinceSanction)} elapsed since sanction (12-month window).`
        : `${months(durationMonths ?? 0)} from sanction to completion.`,
    breach:
      overdueMonths !== null && overdueMonths > 0
        ? {
            rule: 'COMPLETION_12M',
            text: `Past the 12-month completion window by ${months(overdueMonths)}, with no completion recorded.`,
            days_over: Math.round(overdueMonths * 30.44),
          }
        : overrunMonths !== null && overrunMonths > 0
          ? {
              rule: 'COMPLETION_12M',
              text: `Completion took ${months(overrunMonths)} longer than the 12-month window.`,
              days_over: Math.round(overrunMonths * 30.44),
            }
          : null,
  });

  return events;
}

function buildPhotos(args: {
  projectId: string;
  photosPresent: number;
  sanction: string | null;
  rng: Rng;
}): ProjectPhoto[] {
  const { projectId, photosPresent, sanction, rng } = args;
  const stages = ['Pre-construction', 'In progress', 'Completed'];
  const photos: ProjectPhoto[] = [];
  for (let i = 0; i < photosPresent && i < stages.length; i += 1) {
    photos.push({
      photo_id: `${projectId}-P${i + 1}`,
      stage: stages[i],
      uploaded_at:
        sanction === null ? null : toISODate(addDays(parseDate(sanction), rng.int(20, 400))),
      // The mock has no image store. A null URL renders the documented placeholder
      // rather than a broken image, which is also the real-world case for records
      // where eSAKSHI holds a reference the API cannot serve.
      url: null,
      similar_to_project_id: null,
      hamming_distance: null,
    });
  }
  return photos;
}

/**
 * Scores one project from its facts.
 *
 * Returns everything the Project Investigation page needs, so the detail route is a
 * lookup rather than a second round of computation.
 */
export function scoreProject(
  project: Project,
  facts: {
    quantity: number;
    unitCost: number;
    requiredPhotos: number;
    hasGps: boolean;
    iaType: string;
  },
  ctx: ScoringContext,
  rng: Rng,
): ScoredProject {
  const sanctioned = project.sanction_date !== null;
  const completed = project.completion_date !== null;

  const sanctionLagDays = project.sanction_date
    ? Math.round(
        (parseDate(project.sanction_date).getTime() - parseDate(project.recommended_date).getTime()) /
          86_400_000,
      )
    : null;

  const monthsSinceSanction = project.sanction_date
    ? round((DATASET_NOW.getTime() - parseDate(project.sanction_date).getTime()) / MS_PER_MONTH, 1)
    : null;

  const durationMonths =
    project.sanction_date && project.completion_date
      ? round(
          (parseDate(project.completion_date).getTime() - parseDate(project.sanction_date).getTime()) /
            MS_PER_MONTH,
          1,
        )
      : null;

  const photosPresent = project.photo_count;
  const missingPhotos = Math.max(0, facts.requiredPhotos - photosPresent);
  const utilisationShare =
    project.estimated_cost_lakhs > 0
      ? clamp01(project.total_paid_lakhs / project.estimated_cost_lakhs)
      : 0;
  const secondInstalmentReleased =
    project.first_installment_amt !== null &&
    project.total_paid_lakhs - project.first_installment_amt > 0.5;

  const delayProbability =
    ctx.delay_probability_override ??
    predictDelayProbability({
      completed,
      monthsSinceSanction,
      sanctionLagDays,
      missingPhotos,
      utilisationShare,
    });

  const missingFields: string[] = [];
  if (!completed && sanctioned && (monthsSinceSanction ?? 0) > COMPLETION_WINDOW_MONTHS) {
    missingFields.push('completion date');
  }
  if (project.final_payment_dt === null && completed) missingFields.push('final payment date');
  if (!facts.hasGps) missingFields.push('GPS coordinates');

  const ratio = ctx.benchmark_unit_cost > 0 ? facts.unitCost / ctx.benchmark_unit_cost : 1;
  const z = zScoreFor(facts.unitCost, ctx.benchmark_unit_cost);

  const ruleOutcomes = evaluateRules({
    sanctionLagDays,
    sanctioned,
    completed,
    durationMonths,
    monthsSinceSanction,
    photosPresent,
    photosRequired: facts.requiredPhotos,
    utilisationShare,
    secondInstalmentReleased,
  });

  const dimensions: RiskDimensionDetail[] = [
    financialDimension({
      unitCost: facts.unitCost,
      benchmark: ctx.benchmark_unit_cost,
      unit: ctx.unit,
      ratio,
      z,
      workType: project.work_type,
      stateName: ctx.state_name,
    }),
    timelineDimension({
      completed,
      monthsSinceSanction,
      durationMonths,
      sanctionLagDays,
      delayProbability,
      sanctioned,
    }),
    complianceDimension(ruleOutcomes),
    iaDimension(ctx.ia, facts.iaType),
    geoDimension({
      hasGps: facts.hasGps,
      nearestKm: ctx.nearest_similar_km,
      nearestProjectId: ctx.nearest_similar_project_id,
      districtName: ctx.district_name,
    }),
    evidenceDimension({
      photosPresent,
      photosRequired: facts.requiredPhotos,
      missingFields,
    }),
  ];

  const byKey = new Map<RiskDimensionKey, RiskDimensionDetail>(
    dimensions.map((d) => [d.dimension, d]),
  );
  const scoreOf = (key: RiskDimensionKey): number => byKey.get(key)?.score ?? 0;

  const overall = round(
    scoreOf('FINANCIAL') * RISK_WEIGHTS.FINANCIAL +
      scoreOf('TIMELINE') * RISK_WEIGHTS.TIMELINE +
      scoreOf('COMPLIANCE') * RISK_WEIGHTS.COMPLIANCE +
      scoreOf('IA') * RISK_WEIGHTS.IA +
      scoreOf('GEO') * RISK_WEIGHTS.GEO +
      scoreOf('EVIDENCE') * RISK_WEIGHTS.EVIDENCE,
    3,
  );

  const level = riskLevelFromScore(overall);

  // Factors are the dimensions worth reading, ranked by how much they moved the
  // score. At least one is always present so no table ever falls back to a bare
  // number for its reason column.
  const ranked = [...dimensions].sort(
    (a, b) => b.score * RISK_WEIGHTS[b.dimension] - a.score * RISK_WEIGHTS[a.dimension],
  );
  const notable = ranked.filter((d) => d.severity !== 'LOW').slice(0, 4);
  const factorSource = notable.length > 0 ? notable : ranked.slice(0, 1);

  const topFactors: RiskFactor[] = factorSource.map((d) => ({
    dimension: d.dimension,
    severity: d.severity,
    text: d.evidence,
    value: d.metric_value ?? undefined,
  }));

  const contributions = ranked
    .slice(0, 3)
    .map(
      (d) =>
        `${RISK_DIMENSION_META[d.dimension].shortLabel.toLowerCase()} +${(d.score * RISK_WEIGHTS[d.dimension]).toFixed(2)}`,
    )
    .join(', ');

  const explanation =
    notable.length > 0
      ? `Overall ${overall.toFixed(2)} of 1.00 (${level.toLowerCase()}). Largest contributions: ${contributions}. ${factorSource[0].evidence} Flagged for review; this is not a determination of wrongdoing.`
      : `Overall ${overall.toFixed(2)} of 1.00 (${level.toLowerCase()}). No dimension exceeded its review threshold. Largest contributions: ${contributions}.`;

  const actionSpec = RECOMMENDED_ACTIONS[level];

  const risk: RiskScore = {
    project_id: project.project_id,
    financial_risk: scoreOf('FINANCIAL'),
    timeline_risk: scoreOf('TIMELINE'),
    compliance_risk: scoreOf('COMPLIANCE'),
    ia_risk: scoreOf('IA'),
    geo_risk: scoreOf('GEO'),
    evidence_risk: scoreOf('EVIDENCE'),
    overall_risk: overall,
    risk_level: level,
    top_risk_factors: topFactors,
    explanation_text: explanation,
    scored_at: SCORED_AT,
    model_version: MODEL_VERSION,
  };

  return {
    risk,
    dimensions,
    benchmark: {
      work_type: project.work_type,
      state_id: project.state_id,
      unit: ctx.unit,
      project_unit_cost: round(facts.unitCost, 3),
      benchmark_unit_cost: round(ctx.benchmark_unit_cost, 3),
      ratio: round(ratio, 2),
      z_score: z,
      source: `Peer works of the same type in ${ctx.state_name} (illustrative benchmark)`,
      fy: project.fy,
    },
    timeline: buildTimeline({
      recommended: project.recommended_date,
      sanction: project.sanction_date,
      sanctionLagDays,
      firstPaymentDate: project.first_installment_dt,
      completion: project.completion_date,
      durationMonths,
      monthsSinceSanction,
    }),
    payments: buildPayments({
      estimated: project.estimated_cost_lakhs,
      firstDate: project.first_installment_dt,
      firstAmount: project.first_installment_amt,
      finalDate: project.final_payment_dt,
      totalPaid: project.total_paid_lakhs,
      photosPresent,
      completed,
      rng,
    }),
    photos: buildPhotos({
      projectId: project.project_id,
      photosPresent,
      sanction: project.sanction_date,
      rng,
    }),
    ruleOutcomes,
    recommendedAction: {
      action: actionSpec.action,
      refer_to: actionSpec.refer_to,
      urgency: level,
      rationale:
        notable.length > 0
          ? `${notable.length} of six risk ${plural(notable.length, 'dimension', 'dimensions')} exceeded their review threshold, led by ${RISK_DIMENSION_META[factorSource[0].dimension].label.toLowerCase()}.`
          : 'No dimension exceeded its review threshold.',
    },
    zScore: z,
    unitCost: round(facts.unitCost, 3),
    delayProbability,
    monthsSinceSanction,
    sanctionLagDays,
    requiredPhotos: facts.requiredPhotos,
  };
}

/**
 * Fixed "now" and a fixed scoring timestamp.
 *
 * Both are frozen so that elapsed-time evidence ("24 months since sanction") stays
 * true tomorrow, and so two runs of the generator produce byte-identical payloads.
 */
export const DATASET_NOW: Date = parseDate(DATASET_AS_OF);
const SCORED_AT = `${DATASET_AS_OF}T02:30:00.000Z`;

/** Financial-year label, re-exported so the generator and scorer agree. */
export function fyFor(iso: string): string {
  return financialYearOf(parseDate(iso));
}
