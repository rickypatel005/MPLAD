import type {
  AlertRow,
  ComplianceMatrixCell,
  ComplianceStatus,
  CostBenchmark,
  DistrictRef,
  DuplicatePairRow,
  DuplicateSideProject,
  ImplementingAgency,
  MPRef,
  NetworkEdge,
  NetworkNode,
  NetworkNodeDetail,
  PaymentRecord,
  Project,
  ProjectPhoto,
  RankedProject,
  RecommendedAction,
  RiskDimensionDetail,
  RiskLevel,
  RiskScore,
  SCSTMandateRow,
  StateComplianceSummary,
  StateRef,
  TimelineEvent,
} from '@/types/api';
import {
  DISTRICT_BY_ID,
  MOCK_DISTRICTS,
  MOCK_STATES,
  STATE_BY_ID,
  haversineKm,
} from '@/mocks/geo';
import {
  COMPLETION_WINDOW_MONTHS,
  COMPLIANCE_RULES,
  CRITICAL_SC_SHARE_THRESHOLD,
  SC_MANDATE_SHARE,
  ST_MANDATE_SHARE,
  complianceStatusFor,
} from '@/mocks/taxonomy';
import {
  DATASET_AS_OF,
  DATASET_SEED,
  DUPLICATE_COUNTERPART,
  DUPLICATE_PAIR,
  HERO_IA,
  HERO_PROJECT,
  MODEL_VERSION,
} from '@/mocks/scenario';
import {
  SERIAL_BASE,
  assignSpecialAreaFlags,
  buildIAs,
  buildMPs,
  dampenFacts,
  generateFactsForMP,
  seedScenario,
  toProject,
  tuneHeroConcentration,
  type IAState,
  type MPState,
  type ProjectFacts,
} from '@/mocks/generate';
import { DATASET_NOW, scoreProject, type RuleOutcome, type ScoredProject } from '@/mocks/score';
import { clamp01, makeRng, parseDate, round, type Rng } from '@/mocks/rng';
import { crore, distanceLabel, share1dp } from '@/mocks/text';
import { compareRiskLevel } from '@/lib/risk';

/**
 * Assembles the whole synthetic dataset once, then serves every mock endpoint from
 * memory.
 *
 * The order below is why this is a multi-pass build rather than one loop:
 *
 *   1. MPs and implementing agencies exist first, so works can reference them.
 *   2. Works are generated as facts only. SC/ST flags are assigned per MP afterwards,
 *      once that MP's total recommended value is known.
 *   3. The seeded demo fixtures are injected as facts, and the hero agency's portfolio
 *      is reshaped around them.
 *   4. Agency aggregates (concentration, delivery record) are computed. These depend on
 *      the finished set of works, so nothing could be scored before this point.
 *   5. A provisional scoring pass runs, purely to find out which generated works
 *      outrank the seeded one. Those works have their *facts* softened, the agency
 *      concentration is re-solved, and the aggregates are recomputed — repeating until
 *      nothing changes.
 *   6. Everything is scored once more. This is the pass whose output is served.
 *   7. Derived views (duplicate pairs, alerts, compliance matrix, network) are built
 *      from the scored records.
 *
 * A few scoring passes over 12,000 records costs a few hundred milliseconds at
 * startup, paid once per server process, in exchange for never rendering a card that
 * disagrees with the record behind it.
 */

// ---------------------------------------------------------------------------
// Record shapes
// ---------------------------------------------------------------------------

export interface ProjectRecord {
  project: Project;
  risk: RiskScore;
  dimensions: RiskDimensionDetail[];
  benchmark: CostBenchmark;
  payments: PaymentRecord[];
  timeline: TimelineEvent[];
  photos: ProjectPhoto[];
  ruleOutcomes: RuleOutcome[];
  recommendedAction: RecommendedAction;
  /** Display coordinates — GPS where recorded, district centroid otherwise. */
  lat: number;
  lon: number;
  locationSource: 'GPS' | 'DISTRICT_CENTROID';
  quantity: number;
  unitCost: number;
  zScore: number;
  delayProbability: number;
  /** Photographs the guidelines require for this work's payment stages. */
  requiredPhotos: number;
  monthsSinceSanction: number | null;
  sanctionLagDays: number | null;
  nearestSimilarKm: number | null;
  nearestSimilarProjectId: string | null;
  /** Denormalised so table rows, facets and map popups need no join per request. */
  districtName: string;
  stateName: string;
  iaName: string;
  ranked: RankedProject;
}

/** An agency plus the relationship detail the network graph needs. */
export interface IAAggregate extends ImplementingAgency {
  hhi: number;
  dominantMpId: string | null;
  dominantMpProjects: number;
  /** Project ids per MP — these become the network edge weights. */
  projectsByMp: Map<string, string[]>;
  districtIds: string[];
}

export interface Dataset {
  as_of: string;
  scored_at: string;
  model_version: string;
  states: StateRef[];
  districts: DistrictRef[];
  mps: MPRef[];
  mpById: Map<string, MPRef>;
  ias: IAAggregate[];
  iaById: Map<string, IAAggregate>;
  records: ProjectRecord[];
  recordById: Map<string, ProjectRecord>;
  recordsByMp: Map<string, ProjectRecord[]>;
  recordsByIa: Map<string, ProjectRecord[]>;
  /** Pre-sorted worst-first, so the dashboard's default order is a slice. */
  rankedDesc: RankedProject[];
  alerts: AlertRow[];
  duplicatePairs: DuplicatePairRow[];
  pairsByProject: Map<string, DuplicatePairRow[]>;
  scstRows: SCSTMandateRow[];
  complianceMatrix: ComplianceMatrixCell[];
  stateCompliance: StateComplianceSummary[];
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
    nodeDetails: NetworkNodeDetail[];
    nodeIds: Set<string>;
    maxEdgeWeight: number;
    maxProjectCount: number;
  };
}

const SCORED_AT = `${DATASET_AS_OF}T02:30:00.000Z`;

/** Agencies at or above this concentration index are called out in the graph legend. */
export const HHI_CONCENTRATION_THRESHOLD = 0.5;

const MS_PER_DAY = 86_400_000;
const COMPLETION_WINDOW_DAYS = Math.round(COMPLETION_WINDOW_MONTHS * 30.44);

// ---------------------------------------------------------------------------
// Reference tables
// ---------------------------------------------------------------------------

const STATE_REFS: StateRef[] = MOCK_STATES.map((s) => ({
  state_id: s.state_id,
  state_name: s.state_name,
}));

const DISTRICT_REFS: DistrictRef[] = MOCK_DISTRICTS.map((d) => ({
  district_id: d.district_id,
  district_name: d.district_name,
  state_id: d.state_id,
  state_name: STATE_BY_ID[d.state_id]?.state_name ?? d.state_id,
  lat: d.lat,
  lon: d.lon,
}));

const stateNameOf = (stateId: string): string => STATE_BY_ID[stateId]?.state_name ?? stateId;
const districtNameOf = (districtId: string): string =>
  DISTRICT_BY_ID[districtId]?.district_name ?? districtId;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function toMPRef(mp: MPState): MPRef {
  return {
    mp_id: mp.mp_id,
    mp_name: mp.mp_name,
    mp_house: mp.mp_house,
    constituency_id: mp.constituency_id,
    constituency_name: mp.constituency_name,
    state_id: mp.state_id,
  };
}

// Rupee, percentage and distance formatting lives in `@/mocks/text` so a figure reads
// the same in every endpoint that quotes it.

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** A scoring pass needs an agency aggregate table; this is the shape it reads. */
type ScoreFn = (
  fact: ProjectFacts,
  aggregates: Map<string, IAAggregate>,
) => { project: Project; scored: ScoredProject } | null;

function buildDataset(): Dataset {
  const rng = makeRng(DATASET_SEED);

  // ---- 1. Actors ---------------------------------------------------------
  const mps = buildMPs(rng);
  const mpStateById = new Map<string, MPState>(mps.map((m) => [m.mp_id, m]));
  const ias = buildIAs(rng);
  const iaStateById = new Map<string, IAState>(ias.map((ia) => [ia.ia_id, ia]));

  // ---- 2. Works ----------------------------------------------------------
  let serial = SERIAL_BASE;
  const nextSerial = () => serial++;
  const facts: ProjectFacts[] = [];
  for (const mp of mps) {
    const mpFacts = generateFactsForMP(rng, mp, ias, nextSerial);
    assignSpecialAreaFlags(rng, mpFacts, mp);
    facts.push(...mpFacts);
  }

  // ---- 3. Seeded fixtures ------------------------------------------------
  seedScenario(rng, facts, mps);

  // Coordinates are never adjusted after generation, so proximity is computed once
  // and reused by every scoring pass.
  const nearest = computeNearestSimilar(facts);

  const scoreFact: ScoreFn = (fact, aggregates) => {
    const ia = aggregates.get(fact.ia_id);
    if (!ia) return null;
    const project = toProject(fact);
    const near = nearest.get(fact.project_id);
    const scored = scoreProject(
      project,
      {
        quantity: fact.quantity,
        unitCost: fact.unitCost,
        requiredPhotos: fact.requiredPhotos,
        hasGps: fact.work_lat !== null && fact.work_lon !== null,
        iaType: ia.ia_type,
      },
      {
        ia: {
          ia_id: ia.ia_id,
          ia_name: ia.ia_name,
          hhi: ia.hhi,
          dominant_mp_projects: ia.dominantMpProjects,
          total_projects: ia.total_projects,
          completed_projects: ia.completed_projects,
          avg_delay_days: ia.avg_delay_days,
        },
        nearest_similar_km: near?.km ?? null,
        nearest_similar_project_id: near?.projectId ?? null,
        district_name: districtNameOf(fact.district_id),
        state_name: stateNameOf(fact.state_id),
        benchmark_unit_cost: fact.spec.benchmark_unit_cost,
        unit: fact.spec.unit,
        delay_probability_override: fact.delayProbabilityOverride,
      },
      rng,
    );
    return { project, scored };
  };

  // ---- 4/5. Provisional passes, softening anything that outranks the hero -
  let aggregates = computeIAAggregates(facts, iaStateById);
  for (let attempt = 0; attempt < MAX_SOFTENING_ROUNDS; attempt += 1) {
    const changed = softenChallengersToHero(facts, aggregates, scoreFact);
    // Softening moves costs, so the hero agency's concentration is re-solved and
    // every aggregate recomputed before the next look.
    tuneHeroConcentration(facts);
    aggregates = computeIAAggregates(facts, iaStateById);
    if (!changed) break;
  }

  // ---- 6. Final scoring pass --------------------------------------------
  const records: ProjectRecord[] = [];
  for (const fact of facts) {
    const result = scoreFact(fact, aggregates);
    if (!result) continue;
    const iaName = aggregates.get(fact.ia_id)?.ia_name ?? fact.ia_id;
    const record = toRecord(fact, result.project, result.scored, nearest, iaName);
    record.ranked = toRankedProject(record);
    records.push(record);
  }

  const recordById = new Map<string, ProjectRecord>(records.map((r) => [r.project.project_id, r]));
  const recordsByMp = groupBy(records, (r) => r.project.mp_id);
  const recordsByIa = groupBy(records, (r) => r.project.ia_id);

  // An agency's own risk is the mean risk of the works it implements, which is only
  // knowable after scoring — hence this second visit rather than doing it in step 4.
  for (const ia of aggregates.values()) {
    const own = recordsByIa.get(ia.ia_id) ?? [];
    ia.risk_score =
      own.length === 0
        ? 0
        : round(own.reduce((sum, r) => sum + r.risk.overall_risk, 0) / own.length, 3);
  }

  // ---- 7. Derived views --------------------------------------------------
  const rankedDesc = [...records].sort(compareForRanking).map((r) => r.ranked);

  const duplicatePairs = buildDuplicatePairs(rng, records, recordById);
  const pairsByProject = new Map<string, DuplicatePairRow[]>();
  for (const pair of duplicatePairs) {
    for (const id of [pair.project_id_1, pair.project_id_2]) {
      const list = pairsByProject.get(id);
      if (list) list.push(pair);
      else pairsByProject.set(id, [pair]);
    }
  }

  const alerts = buildAlerts(rng, records, duplicatePairs, recordById);
  const scstRows = buildSCSTRows(records, mps);
  const { matrix, states: stateCompliance } = buildComplianceMatrix(records, scstRows);
  const network = buildNetwork(aggregates, mpStateById, recordsByMp);

  return {
    as_of: DATASET_AS_OF,
    scored_at: SCORED_AT,
    model_version: MODEL_VERSION,
    states: STATE_REFS,
    districts: DISTRICT_REFS,
    mps: mps.map(toMPRef),
    mpById: new Map<string, MPRef>(mps.map((m) => [m.mp_id, toMPRef(m)])),
    ias: [...aggregates.values()],
    iaById: aggregates,
    records,
    recordById,
    recordsByMp,
    recordsByIa,
    rankedDesc,
    alerts,
    duplicatePairs,
    pairsByProject,
    scstRows,
    complianceMatrix: matrix,
    stateCompliance,
    network,
  };
}

function toRecord(
  fact: ProjectFacts,
  project: Project,
  scored: ScoredProject,
  nearest: Map<string, { km: number; projectId: string }>,
  iaName: string,
): ProjectRecord {
  const hasGps = fact.work_lat !== null && fact.work_lon !== null;
  const centroid = DISTRICT_BY_ID[fact.district_id];
  const near = nearest.get(fact.project_id);

  return {
    project,
    risk: scored.risk,
    dimensions: scored.dimensions,
    benchmark: scored.benchmark,
    payments: scored.payments,
    timeline: scored.timeline,
    photos: scored.photos,
    ruleOutcomes: scored.ruleOutcomes,
    recommendedAction: scored.recommendedAction,
    lat: hasGps ? (fact.work_lat as number) : (centroid?.lat ?? 0),
    lon: hasGps ? (fact.work_lon as number) : (centroid?.lon ?? 0),
    locationSource: hasGps ? 'GPS' : 'DISTRICT_CENTROID',
    quantity: fact.quantity,
    unitCost: scored.unitCost,
    zScore: scored.zScore,
    delayProbability: scored.delayProbability,
    requiredPhotos: scored.requiredPhotos,
    monthsSinceSanction: scored.monthsSinceSanction,
    sanctionLagDays: scored.sanctionLagDays,
    nearestSimilarKm: near?.km ?? null,
    nearestSimilarProjectId: near?.projectId ?? null,
    districtName: districtNameOf(fact.district_id),
    stateName: stateNameOf(fact.state_id),
    iaName,
    // Overwritten by the caller as soon as the record exists; `toRankedProject` needs
    // the finished record, so it cannot be built inside this function.
    ranked: {} as RankedProject,
  };
}

// ---------------------------------------------------------------------------
// Hero dominance
// ---------------------------------------------------------------------------

/**
 * Margin the seeded record is kept clear of the field by.
 *
 * Wide enough that the small shift in the hero's own score between passes — its
 * agency's aggregates move slightly as other works are softened — cannot close the gap.
 */
const HERO_MARGIN = 0.02;

/** Iteration cap for the soften/re-aggregate loop. In practice it settles in two. */
const MAX_SOFTENING_ROUNDS = 3;

/** Per-record cap, so a stubborn record cannot spin the loop. */
const MAX_DAMPEN_STEPS = 8;

/**
 * Softens the facts of any generated work that scores at or near the seeded record,
 * and reports whether anything changed.
 *
 * The demo opens by drilling into "the highest-risk project in the country", so the
 * seeded record has to genuinely be rank #1 — not merely made to look like it. Each
 * offending work has one anomaly reduced and is then re-scored from its revised facts,
 * repeatedly if needed. In a 12,000-row distribution this touches a handful of records
 * at the very top.
 *
 * Editing facts rather than clamping scores is the whole point: a clamped score would
 * contradict both its own explanation text, which quotes the number, and the weighted
 * sum of the six dimensions sitting next to it on the page.
 */
function softenChallengersToHero(
  facts: readonly ProjectFacts[],
  aggregates: Map<string, IAAggregate>,
  scoreFact: ScoreFn,
): boolean {
  const scores = new Map<string, number>();
  for (const fact of facts) {
    const result = scoreFact(fact, aggregates);
    if (result) scores.set(fact.project_id, result.scored.risk.overall_risk);
  }

  const heroScore = scores.get(HERO_PROJECT.project_id);
  if (heroScore === undefined) return false;
  const ceiling = heroScore - HERO_MARGIN;

  // The counterpart is protected alongside the hero: both records' facts are dictated
  // by the demo script and must not be edited.
  const protectedIds = new Set<string>([HERO_PROJECT.project_id, DUPLICATE_COUNTERPART.project_id]);

  let changed = false;
  for (const fact of facts) {
    if (protectedIds.has(fact.project_id)) continue;
    let steps = 0;
    while ((scores.get(fact.project_id) ?? 0) > ceiling && steps < MAX_DAMPEN_STEPS) {
      if (!dampenFacts(fact)) break;
      changed = true;
      steps += 1;
      const result = scoreFact(fact, aggregates);
      if (!result) break;
      scores.set(fact.project_id, result.scored.risk.overall_risk);
    }
  }

  return changed;
}

/**
 * Worst-first ordering with a deterministic tiebreak.
 *
 * Equal scores are broken towards the seeded record and then by project id, so page
 * boundaries in the server-side paginated tables never shuffle between requests.
 */
function compareForRanking(a: ProjectRecord, b: ProjectRecord): number {
  if (b.risk.overall_risk !== a.risk.overall_risk) {
    return b.risk.overall_risk - a.risk.overall_risk;
  }
  if (a.project.project_id === HERO_PROJECT.project_id) return -1;
  if (b.project.project_id === HERO_PROJECT.project_id) return 1;
  return a.project.project_id.localeCompare(b.project.project_id);
}

function toRankedProject(record: ProjectRecord): RankedProject {
  const top = record.risk.top_risk_factors[0];
  return {
    project_id: record.project.project_id,
    work_type: record.project.work_type,
    work_description: record.project.work_description,
    district_id: record.project.district_id,
    district_name: record.districtName,
    state_id: record.project.state_id,
    state_name: record.stateName,
    mp_id: record.project.mp_id,
    ia_id: record.project.ia_id,
    ia_name: record.iaName,
    estimated_cost_lakhs: record.project.estimated_cost_lakhs,
    risk_level: record.risk.risk_level,
    overall_risk: record.risk.overall_risk,
    top_reason: top?.text ?? 'No anomaly detected across the six risk dimensions.',
    top_reason_dimension: top?.dimension ?? 'FINANCIAL',
    recommended_date: record.project.recommended_date,
    fy: record.project.fy,
  };
}

// ---------------------------------------------------------------------------
// Agency aggregates
// ---------------------------------------------------------------------------

/**
 * Computes each agency's concentration and delivery record.
 *
 * Concentration is the sum of squared shares of recommended *value* per MP — the
 * standard procurement formulation. Value rather than count because one large work
 * steered to a single MP matters more than several small ones.
 */
function computeIAAggregates(
  facts: readonly ProjectFacts[],
  iaStateById: Map<string, IAState>,
): Map<string, IAAggregate> {
  const byIa = groupBy(facts, (f) => f.ia_id);
  const out = new Map<string, IAAggregate>();

  for (const [iaId, own] of byIa) {
    const base = iaStateById.get(iaId);
    if (!base) continue;

    const valueByMp = new Map<string, number>();
    const projectsByMp = new Map<string, string[]>();
    const districtIds = new Set<string>();
    let totalValue = 0;
    let completed = 0;
    let delaySum = 0;
    let delayCount = 0;

    for (const fact of own) {
      valueByMp.set(fact.mp_id, (valueByMp.get(fact.mp_id) ?? 0) + fact.estimated_cost_lakhs);
      const list = projectsByMp.get(fact.mp_id);
      if (list) list.push(fact.project_id);
      else projectsByMp.set(fact.mp_id, [fact.project_id]);
      districtIds.add(fact.district_id);
      totalValue += fact.estimated_cost_lakhs;

      if (fact.completion_date) completed += 1;

      // Delay is days past the 12-month completion window: measured at completion for
      // finished works, and to the dataset date for works still open. Works inside the
      // window contribute zero rather than a negative, so the mean reads as "average
      // overrun" and not "average slack".
      if (fact.sanction_date) {
        const start = parseDate(fact.sanction_date).getTime();
        const end = fact.completion_date
          ? parseDate(fact.completion_date).getTime()
          : DATASET_NOW.getTime();
        delaySum += Math.max(0, (end - start) / MS_PER_DAY - COMPLETION_WINDOW_DAYS);
        delayCount += 1;
      }
    }

    let hhi = 0;
    if (totalValue > 0) {
      for (const value of valueByMp.values()) hhi += (value / totalValue) ** 2;
    }

    let dominantMpId: string | null = null;
    let dominantCount = 0;
    for (const [mpId, list] of projectsByMp) {
      if (list.length > dominantCount) {
        dominantCount = list.length;
        dominantMpId = mpId;
      }
    }

    out.set(iaId, {
      ia_id: base.ia_id,
      ia_name: base.ia_name,
      ia_type: base.ia_type,
      state_id: base.state_id,
      total_projects: own.length,
      completed_projects: completed,
      avg_delay_days: delayCount === 0 ? 0 : Math.round(delaySum / delayCount),
      risk_score: 0, // filled in once the works are scored
      hhi: round(hhi, 3),
      dominantMpId,
      dominantMpProjects: dominantCount,
      projectsByMp,
      districtIds: [...districtIds],
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Geographic proximity
// ---------------------------------------------------------------------------

/**
 * For each work with coordinates, the distance to the closest other work of the same
 * type in the same district.
 *
 * Bucketed by district and work type first, so this is a few thousand tiny O(n²)
 * comparisons rather than one enormous one.
 */
function computeNearestSimilar(
  facts: readonly ProjectFacts[],
): Map<string, { km: number; projectId: string }> {
  const buckets = new Map<string, ProjectFacts[]>();
  for (const fact of facts) {
    if (fact.work_lat === null || fact.work_lon === null) continue;
    const key = `${fact.district_id}::${fact.spec.work_type}`;
    const list = buckets.get(key);
    if (list) list.push(fact);
    else buckets.set(key, [fact]);
  }

  const out = new Map<string, { km: number; projectId: string }>();
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      let best: { km: number; projectId: string } | null = null;
      for (let j = 0; j < list.length; j += 1) {
        if (i === j) continue;
        const b = list[j];
        const km = haversineKm(
          a.work_lat as number,
          a.work_lon as number,
          b.work_lat as number,
          b.work_lon as number,
        );
        if (best === null || km < best.km) best = { km: round(km, 3), projectId: b.project_id };
      }
      if (best) out.set(a.project_id, best);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Duplicate pairs
// ---------------------------------------------------------------------------

/** Roughly how many candidate pairs the detector surfaces across the dataset. */
const TARGET_DUPLICATE_PAIRS = 140;

/** Candidate window: works of the same type further apart than this are not paired. */
const DUPLICATE_SEARCH_KM = 3;

/** Pairs closer than this are reported as a geographic match as well as a textual one. */
const GEO_PROXIMITY_KM = 2;

function duplicateSide(record: ProjectRecord): DuplicateSideProject {
  return {
    project_id: record.project.project_id,
    work_type: record.project.work_type,
    work_description: record.project.work_description,
    estimated_cost_lakhs: record.project.estimated_cost_lakhs,
    mp_id: record.project.mp_id,
    ia_id: record.project.ia_id,
    ia_name: record.iaName,
    district_id: record.project.district_id,
    district_name: record.districtName,
    state_name: record.stateName,
    recommended_date: record.project.recommended_date,
    sanction_date: record.project.sanction_date,
    completion_date: record.project.completion_date,
    risk_level: record.risk.risk_level,
    overall_risk: record.risk.overall_risk,
    // Display coordinates, so the comparison mini-map can plot both sides. The
    // accompanying location_source says whether this is a recorded fix or a fallback.
    lat: record.lat,
    lon: record.lon,
    location_source: record.locationSource,
  };
}

function sharedAttributes(a: ProjectRecord, b: ProjectRecord): string[] {
  const shared: string[] = [];
  if (a.project.work_type === b.project.work_type) {
    shared.push(`Same work type — ${a.project.work_type}`);
  }
  if (a.project.district_id === b.project.district_id) {
    shared.push(`Same district — ${a.districtName}`);
  }
  if (a.project.ia_id === b.project.ia_id) {
    shared.push(`Same implementing agency — ${a.iaName}`);
  }
  shared.push(
    a.project.mp_id === b.project.mp_id
      ? 'Recommended by the same MP'
      : 'Recommended by different MPs',
  );
  const days = Math.round(
    Math.abs(
      parseDate(a.project.recommended_date).getTime() -
        parseDate(b.project.recommended_date).getTime(),
    ) / MS_PER_DAY,
  );
  shared.push(`Recommended ${days} days apart`);
  return shared;
}

function buildDuplicatePairs(
  rng: Rng,
  records: readonly ProjectRecord[],
  recordById: Map<string, ProjectRecord>,
): DuplicatePairRow[] {
  const pairs: DuplicatePairRow[] = [];
  let pairId = DUPLICATE_PAIR.pair_id;

  // ---- The seeded pair, at exactly 91% similarity ------------------------
  const heroRecord = recordById.get(HERO_PROJECT.project_id);
  const counterpartRecord = recordById.get(DUPLICATE_COUNTERPART.project_id);
  if (heroRecord && counterpartRecord) {
    pairs.push({
      pair_id: pairId++,
      project_id_1: heroRecord.project.project_id,
      project_id_2: counterpartRecord.project.project_id,
      similarity_score: DUPLICATE_PAIR.similarity_score,
      geo_distance_km: round(DUPLICATE_PAIR.separation_metres / 1000, 3),
      detection_method: DUPLICATE_PAIR.detection_method,
      reviewed: false,
      project_a: duplicateSide(heroRecord),
      project_b: duplicateSide(counterpartRecord),
      shared_attributes: sharedAttributes(heroRecord, counterpartRecord),
      review_status: 'PENDING_REVIEW',
    });
  }

  // ---- Detected candidates ----------------------------------------------
  // Candidates are works of the same type in the same district that sit close
  // together. The similarity figure stands in for a sentence-BERT score over the two
  // descriptions, weighted by how close the two sites are.
  const buckets = new Map<string, ProjectRecord[]>();
  for (const record of records) {
    if (record.locationSource !== 'GPS') continue;
    const key = `${record.project.district_id}::${record.project.work_type}`;
    const list = buckets.get(key);
    if (list) list.push(record);
    else buckets.set(key, [record]);
  }

  const candidates: { a: ProjectRecord; b: ProjectRecord; km: number }[] = [];
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const km = haversineKm(a.lat, a.lon, b.lat, b.lon);
        if (km <= DUPLICATE_SEARCH_KM) candidates.push({ a, b, km: round(km, 3) });
      }
    }
  }

  // Closest first, so the pairs that survive the cap are the most suspicious ones.
  candidates.sort(
    (x, y) => x.km - y.km || x.a.project.project_id.localeCompare(y.a.project.project_id),
  );

  const seen = new Set<string>([`${HERO_PROJECT.project_id}|${DUPLICATE_COUNTERPART.project_id}`]);

  for (const candidate of candidates) {
    if (pairs.length >= TARGET_DUPLICATE_PAIRS) break;
    const key = `${candidate.a.project.project_id}|${candidate.b.project.project_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const proximity = clamp01((DUPLICATE_SEARCH_KM - candidate.km) / DUPLICATE_SEARCH_KM);
    const similarity = round(Math.min(0.97, 0.6 + 0.28 * proximity + rng.float(-0.04, 0.06)), 2);
    if (similarity < 0.62) continue;

    const roll = rng.next();
    const reviewStatus: DuplicatePairRow['review_status'] =
      roll < 0.7 ? 'PENDING_REVIEW' : roll < 0.85 ? 'CONFIRMED_DUPLICATE' : 'NOT_A_DUPLICATE';

    pairs.push({
      pair_id: pairId++,
      project_id_1: candidate.a.project.project_id,
      project_id_2: candidate.b.project.project_id,
      similarity_score: similarity,
      geo_distance_km: candidate.km,
      // Naming what actually surfaced the pair: proximity only contributes when the
      // two sites are genuinely close.
      detection_method:
        candidate.km <= GEO_PROXIMITY_KM ? 'SENTENCE_BERT + GEO_PROXIMITY' : 'SENTENCE_BERT',
      reviewed: reviewStatus !== 'PENDING_REVIEW',
      project_a: duplicateSide(candidate.a),
      project_b: duplicateSide(candidate.b),
      shared_attributes: sharedAttributes(candidate.a, candidate.b),
      review_status: reviewStatus,
    });
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const ALERT_TYPE_BY_DIMENSION: Record<string, string> = {
  FINANCIAL: 'COST_ANOMALY',
  TIMELINE: 'COMPLETION_DELAY',
  COMPLIANCE: 'RULE_BREACH',
  IA: 'IA_CONCENTRATION',
  GEO: 'LOCATION_MISMATCH',
  EVIDENCE: 'MISSING_EVIDENCE',
};

const ACKNOWLEDGERS = [
  'Nodal Officer, District Authority',
  'Assistant Engineer, Monitoring Cell',
  'State Nodal Department',
] as const;

const ACTIONS_TAKEN = [
  'Field verification scheduled.',
  'Written justification requested from the implementing agency.',
  'Referred to the state nodal department for review.',
] as const;

function buildAlerts(
  rng: Rng,
  records: readonly ProjectRecord[],
  pairs: readonly DuplicatePairRow[],
  recordById: Map<string, ProjectRecord>,
): AlertRow[] {
  const alerts: AlertRow[] = [];
  let alertId = 1;
  const scoredAt = parseDate(DATASET_AS_OF).getTime();

  const context = (record: ProjectRecord) => ({
    project_work_type: record.project.work_type,
    district_name: record.districtName,
    state_id: record.project.state_id,
    state_name: record.stateName,
    mp_id: record.project.mp_id,
    overall_risk: record.risk.overall_risk,
  });

  // One alert per elevated work, carrying its strongest finding. Ordered worst-first so
  // the seeded record heads the feed, with timestamps spaced backwards from the scoring
  // run — newest at the top, as an operator would expect.
  const elevated = [...records]
    .filter((r) => r.risk.risk_level === 'HIGH' || r.risk.risk_level === 'CRITICAL')
    .sort(compareForRanking);

  elevated.forEach((record, index) => {
    const top = record.risk.top_risk_factors[0];
    if (!top) return;
    const acknowledged = rng.chance(0.28);
    const createdAt = scoredAt - index * 7 * 60_000;

    alerts.push({
      alert_id: alertId++,
      project_id: record.project.project_id,
      alert_type: ALERT_TYPE_BY_DIMENSION[top.dimension] ?? 'RULE_BREACH',
      alert_level: record.risk.risk_level,
      alert_message: top.text,
      is_acknowledged: acknowledged,
      acknowledged_by: acknowledged ? rng.pick(ACKNOWLEDGERS) : null,
      acknowledged_at: acknowledged ? new Date(createdAt + 3 * 3_600_000).toISOString() : null,
      action_taken: acknowledged ? rng.pick(ACTIONS_TAKEN) : null,
      created_at: new Date(createdAt).toISOString(),
      ...context(record),
    });
  });

  // Duplicate candidates get their own alert, so the feed and /duplicates never
  // disagree about how many pairs are outstanding.
  pairs.forEach((pair, index) => {
    if (pair.similarity_score < 0.8) return;
    const record = recordById.get(pair.project_id_1);
    if (!record) return;

    const reviewed = pair.review_status !== 'PENDING_REVIEW';
    const createdAt = scoredAt - index * 11 * 60_000;
    const level: RiskLevel = pair.similarity_score >= 0.9 ? 'CRITICAL' : 'HIGH';

    alerts.push({
      alert_id: alertId++,
      project_id: pair.project_id_1,
      alert_type: 'DUPLICATE_CANDIDATE',
      alert_level: level,
      alert_message: `Description matches ${pair.project_id_2} at ${Math.round(pair.similarity_score * 100)}% similarity, with the two sites ${distanceLabel(pair.geo_distance_km)} apart. Requires verification that these are separate works.`,
      is_acknowledged: reviewed,
      acknowledged_by: reviewed ? rng.pick(ACKNOWLEDGERS) : null,
      acknowledged_at: reviewed ? new Date(createdAt + 5 * 3_600_000).toISOString() : null,
      action_taken:
        pair.review_status === 'CONFIRMED_DUPLICATE'
          ? 'Confirmed as the same physical asset; recovery process initiated.'
          : pair.review_status === 'NOT_A_DUPLICATE'
            ? 'Verified on site as two separate works.'
            : null,
      created_at: new Date(createdAt).toISOString(),
      ...context(record),
    });
  });

  // Severity first, then unacknowledged ahead of handled: the default order is a triage
  // queue, not a chronological log.
  return alerts.sort(
    (a, b) =>
      compareRiskLevel(b.alert_level, a.alert_level) ||
      Number(a.is_acknowledged) - Number(b.is_acknowledged) ||
      b.overall_risk - a.overall_risk ||
      a.alert_id - b.alert_id,
  );
}

// ---------------------------------------------------------------------------
// SC/ST mandate tracker
// ---------------------------------------------------------------------------

function mandateStatus(share: number, mandate: number): ComplianceStatus {
  if (share >= mandate) return 'COMPLIANT';
  if (share >= mandate * 0.66) return 'AT_RISK';
  return 'NON_COMPLIANT';
}

function buildSCSTRows(
  records: readonly ProjectRecord[],
  mps: readonly MPState[],
): SCSTMandateRow[] {
  const totals = new Map<string, { total: number; sc: number; st: number; count: number }>();
  for (const record of records) {
    const entry = totals.get(record.project.mp_id) ?? { total: 0, sc: 0, st: 0, count: 0 };
    entry.total += record.project.estimated_cost_lakhs;
    if (record.project.is_sc_area) entry.sc += record.project.estimated_cost_lakhs;
    if (record.project.is_st_area) entry.st += record.project.estimated_cost_lakhs;
    entry.count += 1;
    totals.set(record.project.mp_id, entry);
  }

  const rows: SCSTMandateRow[] = [];
  for (const mp of mps) {
    const entry = totals.get(mp.mp_id);
    if (!entry || entry.total <= 0) continue;

    const scShare = entry.sc / entry.total;
    const stShare = entry.st / entry.total;
    const belowTen = scShare < CRITICAL_SC_SHARE_THRESHOLD;
    const shortfall = Math.max(0, SC_MANDATE_SHARE * entry.total - entry.sc);

    rows.push({
      mp_id: mp.mp_id,
      state_id: mp.state_id,
      state_name: stateNameOf(mp.state_id),
      constituency_name: mp.constituency_name,
      total_recommended_lakhs: round(entry.total, 2),
      sc_area_lakhs: round(entry.sc, 2),
      st_area_lakhs: round(entry.st, 2),
      sc_share: round(scShare, 4),
      st_share: round(stShare, 4),
      sc_status: mandateStatus(scShare, SC_MANDATE_SHARE),
      st_status: mandateStatus(stShare, ST_MANDATE_SHARE),
      below_ten_percent_sc: belowTen,
      project_count: entry.count,
      evidence: belowTen
        ? `${share1dp(scShare)} of ${crore(entry.total)} recommended went to SC-area works, against a ${share1dp(SC_MANDATE_SHARE)} mandate — a shortfall of ${crore(shortfall)} across ${entry.count} works.`
        : `${share1dp(scShare)} SC-area and ${share1dp(stShare)} ST-area spend across ${entry.count} works, against mandates of ${share1dp(SC_MANDATE_SHARE)} and ${share1dp(ST_MANDATE_SHARE)}.`,
    });
  }

  // Worst SC shortfall first, so the flagged MPs are the opening rows of the tracker.
  return rows.sort((a, b) => a.sc_share - b.sc_share || a.mp_id.localeCompare(b.mp_id));
}

// ---------------------------------------------------------------------------
// Compliance matrix
// ---------------------------------------------------------------------------

/** The four rules evaluated per work; the two mandate rules are MP-level. */
const PROJECT_RULE_IDS = [
  'SANCTION_45D',
  'COMPLETION_12M',
  'STAGE_PHOTOS',
  'FUND_UTILISATION',
] as const;

/** Thresholds for the per-state rollup across all six rules. */
const STATE_COMPLIANT_AT = 0.88;
const STATE_AT_RISK_AT = 0.72;

function buildComplianceMatrix(
  records: readonly ProjectRecord[],
  scstRows: readonly SCSTMandateRow[],
): { matrix: ComplianceMatrixCell[]; states: StateComplianceSummary[] } {
  const matrix: ComplianceMatrixCell[] = [];

  const projectsByState = new Map<string, number>();
  for (const record of records) {
    projectsByState.set(
      record.project.state_id,
      (projectsByState.get(record.project.state_id) ?? 0) + 1,
    );
  }

  // ---- Project-level rules, per state -----------------------------------
  const tallies = new Map<string, { compliant: number; applicable: number }>();
  for (const record of records) {
    for (const outcome of record.ruleOutcomes) {
      // Rules that do not yet apply are excluded from the denominator entirely, so a
      // state is never marked down for works that have not had their chance yet.
      if (outcome.compliant === null) continue;
      const key = `${outcome.rule_id}::${record.project.state_id}`;
      const entry = tallies.get(key) ?? { compliant: 0, applicable: 0 };
      entry.applicable += 1;
      if (outcome.compliant) entry.compliant += 1;
      tallies.set(key, entry);
    }
  }

  for (const ruleId of PROJECT_RULE_IDS) {
    const rule = COMPLIANCE_RULES.find((r) => r.rule_id === ruleId);
    for (const state of MOCK_STATES) {
      const entry = tallies.get(`${ruleId}::${state.state_id}`);
      if (!entry || entry.applicable === 0) {
        matrix.push({
          rule_id: ruleId,
          state_id: state.state_id,
          compliance_rate: 0,
          status: 'NO_DATA',
          compliant_projects: 0,
          applicable_projects: 0,
          evidence: `No works in ${state.state_name} have reached the stage where this requirement applies.`,
        });
        continue;
      }
      const rate = entry.compliant / entry.applicable;
      matrix.push({
        rule_id: ruleId,
        state_id: state.state_id,
        compliance_rate: round(rate, 4),
        status: complianceStatusFor(rate, ruleId),
        compliant_projects: entry.compliant,
        applicable_projects: entry.applicable,
        evidence: `${entry.compliant} of ${entry.applicable} applicable works in ${state.state_name} met the ${rule?.rule_name.toLowerCase() ?? ruleId} requirement (${Math.round(rate * 100)}%).`,
      });
    }
  }

  // ---- Mandate rules, aggregated over the tracker rows ------------------
  const mandateSpecs = [
    {
      ruleId: 'SC_AREA_15',
      mandate: SC_MANDATE_SHARE,
      shareOf: (r: SCSTMandateRow) => r.sc_share,
      label: 'SC-area',
    },
    {
      ruleId: 'ST_AREA_7_5',
      mandate: ST_MANDATE_SHARE,
      shareOf: (r: SCSTMandateRow) => r.st_share,
      label: 'ST-area',
    },
  ];

  const rowsByState = groupBy(scstRows, (r) => r.state_id);

  for (const spec of mandateSpecs) {
    for (const state of MOCK_STATES) {
      const stateRows = rowsByState.get(state.state_id) ?? [];
      if (stateRows.length === 0) {
        matrix.push({
          rule_id: spec.ruleId,
          state_id: state.state_id,
          compliance_rate: 0,
          status: 'NO_DATA',
          compliant_projects: 0,
          applicable_projects: 0,
          evidence: `No recommendation data on record for ${state.state_name}.`,
        });
        continue;
      }
      const meeting = stateRows.filter((r) => spec.shareOf(r) >= spec.mandate).length;
      const rate = meeting / stateRows.length;
      matrix.push({
        rule_id: spec.ruleId,
        state_id: state.state_id,
        compliance_rate: round(rate, 4),
        status: complianceStatusFor(rate, spec.ruleId),
        compliant_projects: meeting,
        applicable_projects: stateRows.length,
        evidence: `${meeting} of ${stateRows.length} MPs in ${state.state_name} met the ${share1dp(spec.mandate)} ${spec.label} spend mandate.`,
      });
    }
  }

  // ---- Per-state rollup -------------------------------------------------
  const cellsByState = groupBy(
    matrix.filter((c) => c.status !== 'NO_DATA'),
    (c) => c.state_id,
  );

  const states: StateComplianceSummary[] = MOCK_STATES.map((state) => {
    const cells = cellsByState.get(state.state_id) ?? [];
    const overall =
      cells.length === 0 ? 0 : cells.reduce((sum, c) => sum + c.compliance_rate, 0) / cells.length;
    return {
      state_id: state.state_id,
      state_name: state.state_name,
      overall_compliance_rate: round(overall, 4),
      status:
        cells.length === 0
          ? 'NO_DATA'
          : overall >= STATE_COMPLIANT_AT
            ? 'COMPLIANT'
            : overall >= STATE_AT_RISK_AT
              ? 'AT_RISK'
              : 'NON_COMPLIANT',
      project_count: projectsByState.get(state.state_id) ?? 0,
      breached_rules: cells.filter((c) => c.status === 'NON_COMPLIANT').length,
    };
  });

  return { matrix, states };
}

// ---------------------------------------------------------------------------
// Network graph
// ---------------------------------------------------------------------------

/**
 * Node budget for the force-directed graph.
 *
 * The TRD caps the graph in the low hundreds of nodes because D3's force simulation
 * stops being readable — and stops holding 60fps — well before the full agency
 * registry. Agencies are ranked by concentration weighted by volume, so the graph shows
 * the ones an auditor would actually open; the rest stay reachable from project pages.
 */
const MAX_IA_NODES = 90;

/** Agencies with fewer works than this have no meaningful concentration story. */
const MIN_IA_PROJECTS_FOR_GRAPH = 4;

/** How many counterparties a node detail panel lists before truncating. */
const MAX_RELATED_NODES = 12;

function buildNetwork(
  ias: Map<string, IAAggregate>,
  mpStateById: Map<string, MPState>,
  recordsByMp: Map<string, ProjectRecord[]>,
): Dataset['network'] {
  const ranked = [...ias.values()]
    .filter((ia) => ia.total_projects >= MIN_IA_PROJECTS_FOR_GRAPH)
    .sort(
      (a, b) =>
        b.hhi * Math.log(1 + b.total_projects) - a.hhi * Math.log(1 + a.total_projects) ||
        a.ia_id.localeCompare(b.ia_id),
    );

  const selected = ranked.slice(0, MAX_IA_NODES);
  // The agency the demo names must be on the graph however the ranking falls.
  const heroIa = ias.get(HERO_IA.ia_id);
  if (heroIa && !selected.some((ia) => ia.ia_id === HERO_IA.ia_id)) {
    if (selected.length > 0) selected[selected.length - 1] = heroIa;
    else selected.push(heroIa);
  }

  const nodes: NetworkNode[] = [];
  const edges: NetworkEdge[] = [];
  const nodeDetails: NetworkNodeDetail[] = [];
  const mpNodeIds = new Set<string>();

  const meanRiskOf = (list: readonly ProjectRecord[]): number =>
    list.length === 0
      ? 0
      : round(list.reduce((sum, r) => sum + r.risk.overall_risk, 0) / list.length, 3);

  for (const ia of selected) {
    nodes.push({
      id: ia.ia_id,
      type: 'IA',
      label: ia.ia_name,
      risk: ia.risk_score,
      project_count: ia.total_projects,
      hhi: ia.hhi,
      ia_type: ia.ia_type,
      state_id: ia.state_id,
    });

    const related: NetworkNodeDetail['related_nodes'] = [];
    for (const [mpId, projectIds] of ia.projectsByMp) {
      const mp = mpStateById.get(mpId);
      if (!mp) continue;

      if (!mpNodeIds.has(mpId)) {
        mpNodeIds.add(mpId);
        const own = recordsByMp.get(mpId) ?? [];
        nodes.push({
          id: mpId,
          type: 'MP',
          // Constituency rather than name: MP identity is masked by default
          // (Design Doc §8), and constituency is what an auditor navigates by anyway.
          label: mp.constituency_name,
          risk: meanRiskOf(own),
          project_count: own.length,
          state_id: mp.state_id,
        });
      }

      edges.push({ source: ia.ia_id, target: mpId, weight: projectIds.length });
      related.push({
        node_id: mpId,
        type: 'MP',
        label: mp.constituency_name,
        project_count: projectIds.length,
      });
    }

    related.sort((a, b) => b.project_count - a.project_count || a.label.localeCompare(b.label));
    const top = related[0] ?? null;
    const dominantShare = ia.total_projects > 0 && top ? top.project_count / ia.total_projects : 0;

    nodeDetails.push({
      node_id: ia.ia_id,
      type: 'IA',
      label: ia.ia_name,
      risk: ia.risk_score,
      project_count: ia.total_projects,
      hhi: ia.hhi,
      ia_type: ia.ia_type,
      completed_projects: ia.completed_projects,
      avg_delay_days: ia.avg_delay_days,
      top_relationship: top
        ? {
            node_id: top.node_id,
            label: top.label,
            project_count: top.project_count,
            share: round(dominantShare, 3),
          }
        : null,
      related_nodes: related.slice(0, MAX_RELATED_NODES),
      districts: ia.districtIds.map(districtNameOf),
      evidence:
        ia.hhi >= HHI_CONCENTRATION_THRESHOLD && top
          ? `${ia.ia_name} implements ${top.project_count} of its ${ia.total_projects} works for a single constituency (${top.label}) — ${Math.round(dominantShare * 100)}% of its portfolio, concentration index ${ia.hhi.toFixed(2)} — across ${ia.districtIds.length} ${ia.districtIds.length === 1 ? 'district' : 'districts'}. Average overrun beyond the ${COMPLETION_WINDOW_MONTHS}-month window is ${ia.avg_delay_days} days.`
          : `${ia.ia_name} implements ${ia.total_projects} works spread across ${related.length} ${related.length === 1 ? 'constituency' : 'constituencies'} (concentration index ${ia.hhi.toFixed(2)}). No concentration finding.`,
    });
  }

  // Detail records for the MP nodes too, so clicking either end of an edge works.
  for (const mpId of mpNodeIds) {
    const mp = mpStateById.get(mpId);
    if (!mp) continue;
    const own = recordsByMp.get(mpId) ?? [];

    const countByIa = new Map<string, number>();
    for (const record of own) {
      countByIa.set(record.project.ia_id, (countByIa.get(record.project.ia_id) ?? 0) + 1);
    }
    const relatedIas: NetworkNodeDetail['related_nodes'] = [...countByIa.entries()]
      .map(([iaId, count]) => ({
        node_id: iaId,
        type: 'IA' as const,
        label: ias.get(iaId)?.ia_name ?? iaId,
        project_count: count,
      }))
      .sort((a, b) => b.project_count - a.project_count || a.label.localeCompare(b.label));

    const topIa = relatedIas[0] ?? null;
    const topShare = topIa && own.length > 0 ? topIa.project_count / own.length : 0;

    nodeDetails.push({
      node_id: mpId,
      type: 'MP',
      label: mp.constituency_name,
      risk: meanRiskOf(own),
      project_count: own.length,
      // Concentration, agency type and delivery record describe agencies, not MPs —
      // null rather than zero, so the panel can omit the row instead of showing "0".
      hhi: null,
      ia_type: null,
      completed_projects: own.filter((r) => r.project.completion_date !== null).length,
      avg_delay_days: null,
      top_relationship: topIa
        ? {
            node_id: topIa.node_id,
            label: topIa.label,
            project_count: topIa.project_count,
            share: round(topShare, 3),
          }
        : null,
      related_nodes: relatedIas.slice(0, MAX_RELATED_NODES),
      districts: [...new Set(own.map((r) => r.districtName))],
      evidence: topIa
        ? `${own.length} works recommended, of which ${topIa.project_count} (${Math.round(topShare * 100)}%) are implemented by ${topIa.label}.`
        : `${own.length} works recommended; no implementing agency on record.`,
    });
  }

  return {
    nodes,
    edges,
    nodeDetails,
    nodeIds: new Set(nodes.map((n) => n.id)),
    maxEdgeWeight: edges.reduce((max, e) => Math.max(max, e.weight), 0),
    maxProjectCount: nodes.reduce((max, n) => Math.max(max, n.project_count ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Memoisation
// ---------------------------------------------------------------------------

/**
 * Cached on `globalThis` rather than in a module-level variable.
 *
 * Next.js re-evaluates route modules on every edit in development; a plain module
 * variable would rebuild twelve thousand records on each hot reload. The global
 * survives that, so the build cost is paid once per server process.
 */
const CACHE_KEY = '__mplads_dataset__';

type GlobalWithDataset = typeof globalThis & { [CACHE_KEY]?: Dataset };

export function getDataset(): Dataset {
  const store = globalThis as GlobalWithDataset;
  let dataset = store[CACHE_KEY];
  if (!dataset) {
    dataset = buildDataset();
    store[CACHE_KEY] = dataset;
  }
  return dataset;
}
