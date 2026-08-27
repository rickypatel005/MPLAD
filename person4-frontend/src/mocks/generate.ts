import type { IAType, MPHouse, MPRef, Project, SanctionStatus } from '@/types/api';
import {
  DISTRICTS_BY_STATE,
  MOCK_DISTRICTS,
  MOCK_STATES,
  offsetCoordinate,
} from '@/mocks/geo';
import { IA_NAME_STEMS, WORK_TYPES, WORK_TYPE_BY_NAME, type WorkTypeSpec } from '@/mocks/taxonomy';
import {
  DUPLICATE_COUNTERPART,
  DUPLICATE_PAIR,
  HERO_IA,
  HERO_MP_ID,
  HERO_PROJECT,
  SC_SHARE_FLOOR_FOR_OTHERS,
  SC_SHORTFALL_MPS,
} from '@/mocks/scenario';
import { addDays, financialYearOf, parseDate, round, toISODate, type Rng } from '@/mocks/rng';
import { DATASET_NOW } from '@/mocks/score';

/**
 * Fact generation for the synthetic MPLADS dataset.
 *
 * Produces plausible works, MPs and implementing agencies — and nothing else. Risk
 * scores are derived from these facts separately (src/mocks/score.ts), so that no
 * number on screen can contradict the record behind it.
 *
 * The seeded demo fixtures are injected here as facts too, via `seedScenario`. They
 * then flow through exactly the same scoring, aggregation and filtering code as the
 * other twelve thousand records.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MPState extends MPRef {
  /** Share of recommended value this MP directs to SC-area works. */
  targetScShare: number;
  targetStShare: number;
}

export interface IAState {
  ia_id: string;
  ia_name: string;
  ia_type: IAType;
  state_id: string;
}

export interface ProjectFacts {
  project_id: string;
  mp_id: string;
  mp_house: MPHouse;
  constituency_id: string;
  district_id: string;
  state_id: string;
  spec: WorkTypeSpec;
  work_description: string;
  quantity: number;
  unitCost: number;
  estimated_cost_lakhs: number;
  recommended_date: string;
  sanction_date: string | null;
  sanction_status: SanctionStatus;
  completion_date: string | null;
  ia_id: string;
  photo_count: number;
  requiredPhotos: number;
  work_lat: number | null;
  work_lon: number | null;
  is_sc_area: boolean;
  is_st_area: boolean;
  is_calamity: boolean;
  first_installment_dt: string | null;
  first_installment_amt: number | null;
  final_payment_dt: string | null;
  total_paid_lakhs: number;
  /** Set only for the seeded hero record, where the script quotes a fixed value. */
  delayProbabilityOverride?: number;
}

/** Converts generated facts into the wire-shape `Project` from TRD §6. */
export function toProject(facts: ProjectFacts): Project {
  return {
    project_id: facts.project_id,
    mp_id: facts.mp_id,
    mp_house: facts.mp_house,
    constituency_id: facts.constituency_id,
    district_id: facts.district_id,
    state_id: facts.state_id,
    work_type: facts.spec.work_type,
    work_description: facts.work_description,
    estimated_cost_lakhs: facts.estimated_cost_lakhs,
    is_sc_area: facts.is_sc_area,
    is_st_area: facts.is_st_area,
    is_calamity: facts.is_calamity,
    recommended_date: facts.recommended_date,
    sanction_status: facts.sanction_status,
    sanction_date: facts.sanction_date,
    ia_id: facts.ia_id,
    first_installment_dt: facts.first_installment_dt,
    first_installment_amt: facts.first_installment_amt,
    final_payment_dt: facts.final_payment_dt,
    total_paid_lakhs: facts.total_paid_lakhs,
    completion_date: facts.completion_date,
    work_lat: facts.work_lat,
    work_lon: facts.work_lon,
    photo_count: facts.photo_count,
    fy: financialYearOf(parseDate(facts.recommended_date)),
  };
}

// ---------------------------------------------------------------------------
// Synthetic names
// ---------------------------------------------------------------------------

/**
 * Name parts combined at random to label synthetic MPs. No real officeholder is
 * represented, and identities are masked by default in any case (Design Doc §8).
 */
const HONORIFICS = ['Shri', 'Smt.', 'Dr.'] as const;
const INITIALS = 'ABDGHIJKLMNPRSTVY';
const SURNAMES = [
  'Verma', 'Sharma', 'Patil', 'Reddy', 'Nair', 'Iyer', 'Das', 'Ghosh', 'Singh', 'Yadav',
  'Mishra', 'Pandey', 'Chauhan', 'Rathore', 'Desai', 'Mehta', 'Joshi', 'Kulkarni',
  'Deshmukh', 'Naik', 'Rao', 'Murthy', 'Pillai', 'Menon', 'Bose', 'Chatterjee', 'Sen',
  'Barman', 'Gogoi', 'Saikia', 'Thakur', 'Jha', 'Sahu', 'Behera', 'Mohanty', 'Swain',
  'Gill', 'Bedi', 'Grewal', 'Bhatt', 'Rawat', 'Negi', 'Lama', 'Bhutia', 'Tiwari',
] as const;

const CONSTITUENCY_SUFFIXES = ['', ' North', ' South', ' East', ' West', ' Rural', ' Sadar'] as const;

// ---------------------------------------------------------------------------
// MPs and IAs
// ---------------------------------------------------------------------------

export function buildMPs(rng: Rng): MPState[] {
  const mps: MPState[] = [];
  const shortfallShare = new Map<string, number>(
    SC_SHORTFALL_MPS.map((m) => [m.mp_id, m.sc_share]),
  );

  for (const state of MOCK_STATES) {
    const districts = DISTRICTS_BY_STATE[state.state_id] ?? [];
    for (let seat = 1; seat <= state.weight; seat += 1) {
      const mp_id = `MP-${state.state_id}-${String(seat).padStart(4, '0')}`;
      const district = districts.length > 0 ? districts[(seat - 1) % districts.length] : undefined;
      const base = district?.district_name ?? state.state_name;
      const house: MPHouse = rng.chance(0.78)
        ? 'LOK_SABHA'
        : rng.chance(0.9)
          ? 'RAJYA_SABHA'
          : 'NOMINATED';

      // Seeded shortfall MPs get their exact share; every other MP is kept clear of
      // the 10% line, so "exactly 3 MPs below 10%" holds however the dice fall.
      const seeded = shortfallShare.get(mp_id);

      mps.push({
        mp_id,
        mp_name: `${rng.pick(HONORIFICS)} ${INITIALS[rng.int(0, INITIALS.length - 1)]}. ${rng.pick(SURNAMES)}`,
        mp_house: house,
        constituency_id: `${state.state_id}-PC-${String(seat).padStart(3, '0')}`,
        constituency_name: `${base}${rng.pick(CONSTITUENCY_SUFFIXES)}`.trim(),
        state_id: state.state_id,
        targetScShare: seeded ?? round(rng.float(SC_SHARE_FLOOR_FOR_OTHERS, 0.34), 4),
        targetStShare: round(rng.float(0.04, 0.19), 4),
      });
    }
  }
  return mps;
}

export function buildIAs(rng: Rng): IAState[] {
  const ias: IAState[] = [];

  for (const state of MOCK_STATES) {
    const districts = DISTRICTS_BY_STATE[state.state_id] ?? [];
    const count = Math.max(4, Math.min(16, Math.round(state.weight / 3.2) + 3));
    for (let i = 0; i < count; i += 1) {
      const stem = IA_NAME_STEMS[i % IA_NAME_STEMS.length];
      const place =
        districts.length > 0 ? districts[i % districts.length].district_name : state.state_name;
      ias.push({
        ia_id: `IA-${state.state_id}-${String(i + 1).padStart(4, '0')}`,
        ia_name: `${place} ${stem.base}`,
        ia_type: stem.ia_type,
        state_id: state.state_id,
      });
    }
  }

  // The concentrated agency the demo script names explicitly.
  ias.push({
    ia_id: HERO_IA.ia_id,
    ia_name: HERO_IA.ia_name,
    ia_type: HERO_IA.ia_type,
    state_id: HERO_IA.state_id,
  });

  return rng.shuffle(ias);
}

// ---------------------------------------------------------------------------
// Works
// ---------------------------------------------------------------------------

/**
 * Anomaly profiles. Facts are generated to match a profile, then scored. Tuned so
 * most works are unremarkable and the flagged tail is still large enough to fill the
 * alert feed — a dashboard where everything is critical says nothing.
 */
type Profile = 'CLEAN' | 'MINOR' | 'OVERPRICED' | 'STALLED' | 'UNDOCUMENTED' | 'COMPOUND';

function pickProfile(rng: Rng): Profile {
  const roll = rng.next();
  if (roll < 0.47) return 'CLEAN';
  if (roll < 0.74) return 'MINOR';
  if (roll < 0.83) return 'STALLED';
  if (roll < 0.9) return 'OVERPRICED';
  if (roll < 0.965) return 'UNDOCUMENTED';
  return 'COMPOUND';
}

/**
 * Generated serials start at 1000 so the seeded fixture IDs (…-0179, …-0412) sit
 * below the generated range and can never be produced by chance.
 */
const SERIAL_BASE = 1000;

export function generateFactsForMP(
  rng: Rng,
  mp: MPState,
  ias: readonly IAState[],
  nextSerial: () => number,
): ProjectFacts[] {
  const districts = DISTRICTS_BY_STATE[mp.state_id] ?? MOCK_DISTRICTS.slice(0, 1);
  const stateIas = ias.filter((ia) => ia.state_id === mp.state_id);
  const pool = stateIas.length > 0 ? stateIas : ias;
  const preferred = rng.shuffle(pool).slice(0, Math.max(2, Math.min(5, pool.length)));
  const count = rng.int(8, 45);
  const facts: ProjectFacts[] = [];

  for (let i = 0; i < count; i += 1) {
    const district = rng.pick(districts);
    const spec = rng.pickWeighted(WORK_TYPES, (w) => (w.work_type.includes('Road') ? 3 : 1));
    const profile = pickProfile(rng);

    const quantity = round(rng.float(spec.quantity_range[0], spec.quantity_range[1]), 2);
    const multiplier =
      profile === 'OVERPRICED'
        ? rng.float(1.9, 3.2)
        : profile === 'COMPOUND'
          ? rng.float(2.2, 3.6)
          : profile === 'MINOR'
            ? rng.float(1.05, 1.45)
            : rng.float(0.78, 1.18);
    const unitCost = round(spec.benchmark_unit_cost * multiplier, 3);
    const estimated = Math.max(1, round(unitCost * quantity, 2));

    const recommended = addDays(DATASET_NOW, -rng.int(90, 1250));
    const sanctionLag =
      profile === 'CLEAN' ? rng.int(9, 42) : profile === 'MINOR' ? rng.int(20, 58) : rng.int(46, 190);
    const sanctioned = rng.chance(profile === 'CLEAN' ? 0.97 : 0.9);
    const sanctionDate = sanctioned ? addDays(recommended, sanctionLag) : null;
    const sanction_status: SanctionStatus = sanctioned
      ? 'SANCTIONED'
      : rng.chance(0.85)
        ? 'PENDING'
        : 'REJECTED';

    const monthsSinceSanction =
      sanctionDate === null
        ? null
        : (DATASET_NOW.getTime() - sanctionDate.getTime()) / (86_400_000 * 30.44);

    let completionDate: Date | null = null;
    if (sanctionDate && monthsSinceSanction !== null && monthsSinceSanction > 3) {
      const completes =
        profile === 'STALLED' || profile === 'COMPOUND'
          ? rng.chance(0.12)
          : profile === 'CLEAN'
            ? rng.chance(0.9)
            : rng.chance(0.66);
      if (completes) {
        const durationMonths =
          profile === 'CLEAN'
            ? rng.float(3, Math.min(11, monthsSinceSanction))
            : rng.float(6, Math.max(7, monthsSinceSanction));
        if (durationMonths <= monthsSinceSanction) {
          completionDate = addDays(sanctionDate, Math.round(durationMonths * 30.44));
        }
      }
    }

    const requiredPhotos = sanctionDate ? 3 : 0;
    const shortfall =
      profile === 'UNDOCUMENTED' || profile === 'COMPOUND'
        ? rng.int(2, 3)
        : profile === 'CLEAN'
          ? rng.chance(0.12)
            ? 1
            : 0
          : rng.int(0, 2);
    const photoCount = Math.max(0, requiredPhotos - shortfall);

    const hasGps = rng.chance(spec.gps_rate);
    const work_lat = hasGps ? round(district.lat + rng.float(-0.22, 0.22), 6) : null;
    const work_lon = hasGps ? round(district.lon + rng.float(-0.22, 0.22), 6) : null;

    let firstDt: string | null = null;
    let firstAmt: number | null = null;
    let finalDt: string | null = null;
    let totalPaid = 0;
    if (sanctionDate) {
      const releasedShare = completionDate
        ? 1
        : profile === 'STALLED' || profile === 'COMPOUND'
          ? rng.float(0.45, 0.85)
          : rng.float(0.25, 0.8);
      firstDt = toISODate(addDays(sanctionDate, rng.int(12, 70)));
      firstAmt = round(estimated * 0.5, 2);
      totalPaid = round(estimated * releasedShare, 2);
      if (completionDate) finalDt = toISODate(addDays(completionDate, rng.int(8, 60)));
    }

    facts.push({
      project_id: `${district.district_id}-${recommended.getUTCFullYear()}-${String(nextSerial()).padStart(4, '0')}`,
      mp_id: mp.mp_id,
      mp_house: mp.mp_house,
      constituency_id: mp.constituency_id,
      district_id: district.district_id,
      state_id: mp.state_id,
      spec,
      work_description: `${rng.pick(spec.descriptors)} at ${district.district_name}${rng.chance(0.6) ? `, block ${rng.int(1, 9)}` : ''}`,
      quantity,
      unitCost,
      estimated_cost_lakhs: estimated,
      recommended_date: toISODate(recommended),
      sanction_date: sanctionDate ? toISODate(sanctionDate) : null,
      sanction_status,
      completion_date: completionDate ? toISODate(completionDate) : null,
      ia_id: rng.chance(0.82) ? rng.pick(preferred).ia_id : rng.pick(pool).ia_id,
      photo_count: photoCount,
      requiredPhotos,
      work_lat,
      work_lon,
      is_sc_area: false, // assigned below, once the MP's total is known
      is_st_area: false,
      is_calamity: rng.chance(0.04),
      first_installment_dt: firstDt,
      first_installment_amt: firstAmt,
      final_payment_dt: finalDt,
      total_paid_lakhs: totalPaid,
    });
  }

  return facts;
}

/**
 * Flags works as SC-area or ST-area until the MP's cumulative share of recommended
 * value reaches their target.
 *
 * Done across the MP's whole portfolio rather than per work, because the mandate is
 * a share of the annual entitlement — the denominator has to exist before the share
 * can be controlled. This is what makes the SC/ST tracker land on exact figures.
 */
export function assignSpecialAreaFlags(rng: Rng, facts: ProjectFacts[], mp: MPState): void {
  const total = facts.reduce((sum, f) => sum + f.estimated_cost_lakhs, 0);
  if (total <= 0) return;

  let scAssigned = 0;
  const scTarget = total * mp.targetScShare;
  for (const fact of rng.shuffle(facts)) {
    if (scAssigned >= scTarget) break;
    fact.is_sc_area = true;
    scAssigned += fact.estimated_cost_lakhs;
  }

  let stAssigned = 0;
  const stTarget = total * mp.targetStShare;
  for (const fact of rng.shuffle(facts)) {
    if (stAssigned >= stTarget) break;
    if (fact.is_sc_area) continue;
    fact.is_st_area = true;
    stAssigned += fact.estimated_cost_lakhs;
  }
}

export { SERIAL_BASE };

// ---------------------------------------------------------------------------
// Seeded demo fixtures
// ---------------------------------------------------------------------------

/** Approximate coordinates for the seeded work site, north of Lucknow city. */
const HERO_LAT = 26.9891;
const HERO_LON = 80.9312;

/**
 * Value share the dominant MP must hold for the agency's HHI to read 0.91.
 *
 * Concentration is measured over recommended *value*, not work count — the standard
 * formulation in procurement analysis, and the one that reconciles the two figures
 * the demo script quotes together ("43 of 47 works", "HHI 0.91"). A count-based
 * index over the same portfolio would read 0.84.
 *
 * With one dominant MP at share s and four singletons splitting the rest:
 *   HHI = s² + 4·((1−s)/4)²  →  s ≈ 0.9538 gives 0.910.
 */
const HERO_DOMINANT_VALUE_SHARE = 0.9538;

/** Works held by the concentrated agency, and how many belong to the dominant MP. */
const HERO_IA_TOTAL = HERO_IA.total_projects;
const HERO_IA_DOMINANT = HERO_IA.projects_for_dominant_mp;

/**
 * Injects the seeded fixtures and reshapes the hero agency's portfolio around them.
 *
 * Mutates `facts` in place. Everything written here is a *fact* — a cost, a date, an
 * agency assignment. No score is set, and no component special-cases these records.
 */
export function seedScenario(rng: Rng, facts: ProjectFacts[], mps: readonly MPState[]): void {
  const heroMp = mps.find((m) => m.mp_id === HERO_MP_ID);
  if (!heroMp) return;

  const heroSpec = WORK_TYPE_BY_NAME[HERO_PROJECT.work_type] ?? WORK_TYPES[0];
  const counterpartSpec = WORK_TYPE_BY_NAME[DUPLICATE_COUNTERPART.work_type] ?? heroSpec;
  const counterpartPoint = offsetCoordinate(
    HERO_LAT,
    HERO_LON,
    DUPLICATE_PAIR.separation_metres,
    DUPLICATE_PAIR.bearing_degrees,
  );

  const heroCost = round(HERO_PROJECT.unit_cost_lakhs * HERO_PROJECT.quantity_km, 2);
  const counterpartCost = round(
    DUPLICATE_COUNTERPART.unit_cost_lakhs * DUPLICATE_COUNTERPART.quantity_km,
    2,
  );

  // ---- The CRITICAL work the script opens on -----------------------------
  const hero: ProjectFacts = {
    project_id: HERO_PROJECT.project_id,
    mp_id: heroMp.mp_id,
    mp_house: heroMp.mp_house,
    constituency_id: heroMp.constituency_id,
    district_id: HERO_PROJECT.district_id,
    state_id: HERO_PROJECT.state_id,
    spec: heroSpec,
    work_description: HERO_PROJECT.work_description,
    quantity: HERO_PROJECT.quantity_km,
    unitCost: HERO_PROJECT.unit_cost_lakhs,
    estimated_cost_lakhs: heroCost,
    recommended_date: HERO_PROJECT.recommended_date,
    sanction_date: HERO_PROJECT.sanction_date,
    sanction_status: 'SANCTIONED',
    // Still incomplete 24 months after sanction — the timeline breach the script names.
    completion_date: null,
    ia_id: HERO_IA.ia_id,
    photo_count: HERO_PROJECT.photo_count,
    requiredPhotos: 3,
    work_lat: HERO_LAT,
    work_lon: HERO_LON,
    is_sc_area: HERO_PROJECT.is_sc_area,
    is_st_area: HERO_PROJECT.is_st_area,
    is_calamity: false,
    first_installment_dt: toISODate(addDays(parseDate(HERO_PROJECT.sanction_date), 34)),
    first_installment_amt: round(heroCost * 0.5, 2),
    final_payment_dt: null,
    // A second release at 62% utilisation with one photograph on file — the
    // instalment-utilisation breach.
    total_paid_lakhs: round(heroCost * 0.62, 2),
    delayProbabilityOverride: HERO_PROJECT.delay_probability,
  };

  // ---- The earlier near-identical work ------------------------------------
  const counterpartMp = mps.find(
    (m) => m.state_id === HERO_PROJECT.state_id && m.mp_id !== HERO_MP_ID,
  );
  const counterpart: ProjectFacts = {
    project_id: DUPLICATE_COUNTERPART.project_id,
    mp_id: counterpartMp?.mp_id ?? heroMp.mp_id,
    mp_house: counterpartMp?.mp_house ?? heroMp.mp_house,
    constituency_id: counterpartMp?.constituency_id ?? heroMp.constituency_id,
    district_id: DUPLICATE_COUNTERPART.district_id,
    state_id: DUPLICATE_COUNTERPART.state_id,
    spec: counterpartSpec,
    work_description: DUPLICATE_COUNTERPART.work_description,
    quantity: DUPLICATE_COUNTERPART.quantity_km,
    unitCost: DUPLICATE_COUNTERPART.unit_cost_lakhs,
    estimated_cost_lakhs: counterpartCost,
    recommended_date: DUPLICATE_COUNTERPART.recommended_date,
    sanction_date: DUPLICATE_COUNTERPART.sanction_date,
    sanction_status: 'SANCTIONED',
    completion_date: DUPLICATE_COUNTERPART.completion_date,
    ia_id: HERO_IA.ia_id,
    photo_count: DUPLICATE_COUNTERPART.photo_count,
    requiredPhotos: 3,
    work_lat: counterpartPoint.lat,
    work_lon: counterpartPoint.lon,
    is_sc_area: DUPLICATE_COUNTERPART.is_sc_area,
    is_st_area: DUPLICATE_COUNTERPART.is_st_area,
    is_calamity: false,
    first_installment_dt: toISODate(addDays(parseDate(DUPLICATE_COUNTERPART.sanction_date), 28)),
    first_installment_amt: round(counterpartCost * 0.5, 2),
    final_payment_dt: toISODate(addDays(parseDate(DUPLICATE_COUNTERPART.completion_date), 22)),
    total_paid_lakhs: counterpartCost,
  };

  facts.push(hero, counterpart);

  // ---- Reshape the hero agency's portfolio --------------------------------
  // Move works onto the agency until it holds exactly 47, of which 43 belong to the
  // dominant MP. Everything moved is a real generated work; only its IA changes.
  const heroMpPool = facts.filter(
    (f) => f.mp_id === HERO_MP_ID && f.project_id !== HERO_PROJECT.project_id,
  );
  const otherPool = facts.filter(
    (f) =>
      f.state_id === HERO_PROJECT.state_id &&
      f.mp_id !== HERO_MP_ID &&
      f.project_id !== DUPLICATE_COUNTERPART.project_id,
  );

  // Clear any incidental assignments first, so the counts below are exact.
  for (const fact of facts) {
    if (
      fact.ia_id === HERO_IA.ia_id &&
      fact.project_id !== HERO_PROJECT.project_id &&
      fact.project_id !== DUPLICATE_COUNTERPART.project_id
    ) {
      const alternatives = facts.filter(
        (f) => f.state_id === fact.state_id && f.ia_id !== HERO_IA.ia_id,
      );
      fact.ia_id = alternatives.length > 0 ? rng.pick(alternatives).ia_id : fact.ia_id;
    }
  }

  const dominantPicks = rng.shuffle(heroMpPool).slice(0, HERO_IA_DOMINANT - 1);
  for (const fact of dominantPicks) fact.ia_id = HERO_IA.ia_id;

  const otherCount = HERO_IA_TOTAL - HERO_IA_DOMINANT - 1; // counterpart already counted
  const otherPicks = rng.shuffle(otherPool).slice(0, Math.max(0, otherCount));
  for (const fact of otherPicks) fact.ia_id = HERO_IA.ia_id;

  tuneHeroConcentration(facts);
}

/**
 * Sizes the hero agency's non-dominant works so that the concentration index
 * *computed from the data* reads 0.91.
 *
 * The dominant MP's value share is the only free variable: fix the 43 dominant works
 * at whatever they cost, then give the remaining four exactly the total that puts the
 * dominant share at HERO_DOMINANT_VALUE_SHARE. The counterpart's cost is dictated by
 * the demo script (₹5.2 L/km × 3.0 km), so it is treated as fixed and the balance is
 * spread across the other three.
 *
 * Exported and idempotent because the dataset builder adjusts some generated costs
 * after its first scoring pass; this has to be re-run afterwards or the index would
 * drift away from the figure the script quotes.
 *
 * How many distinct MPs the four non-dominant works belong to barely matters: their
 * combined contribution to the index is under 0.002 either way, which is well inside
 * the two decimal places the UI shows.
 */
export function tuneHeroConcentration(facts: readonly ProjectFacts[]): void {
  const own = facts.filter((f) => f.ia_id === HERO_IA.ia_id);
  const dominant = own.filter((f) => f.mp_id === HERO_MP_ID);
  const others = own.filter((f) => f.mp_id !== HERO_MP_ID);
  const adjustable = others.filter((f) => f.project_id !== DUPLICATE_COUNTERPART.project_id);
  if (dominant.length === 0 || adjustable.length === 0) return;

  const fixedValue = others
    .filter((f) => f.project_id === DUPLICATE_COUNTERPART.project_id)
    .reduce((sum, f) => sum + f.estimated_cost_lakhs, 0);
  const dominantValue = dominant.reduce((sum, f) => sum + f.estimated_cost_lakhs, 0);
  const requiredOtherValue =
    (dominantValue * (1 - HERO_DOMINANT_VALUE_SHARE)) / HERO_DOMINANT_VALUE_SHARE;
  const each = round(Math.max(3, requiredOtherValue - fixedValue) / adjustable.length, 2);

  for (const fact of adjustable) {
    fact.estimated_cost_lakhs = Math.max(1, each);
    fact.unitCost = round(fact.estimated_cost_lakhs / Math.max(0.1, fact.quantity), 3);
    fact.first_installment_amt =
      fact.first_installment_dt === null ? null : round(fact.estimated_cost_lakhs * 0.5, 2);
    fact.total_paid_lakhs = round(Math.min(fact.total_paid_lakhs, fact.estimated_cost_lakhs), 2);
  }
}

/**
 * Softens one generated work's anomalies by one step, and reports whether anything
 * changed.
 *
 * Used to guarantee the seeded record is the single highest-risk work in the country —
 * the demo opens by drilling into "the highest-risk project", and a randomly generated
 * record edging past it would break the narration on the first click.
 *
 * Crucially this edits *facts*, not scores: the work's cost is moved toward the
 * benchmark, or its missing photographs are filled in, and then the whole record is
 * re-scored from scratch. Every dimension score, evidence sentence and rule outcome is
 * re-derived, so nothing on screen ends up disagreeing with the record behind it. The
 * alternative — clamping the displayed score — would leave explanation text quoting a
 * number the record no longer holds.
 */
export function dampenFacts(fact: ProjectFacts): boolean {
  const benchmark = fact.spec.benchmark_unit_cost;
  const excess = fact.unitCost - benchmark;

  if (excess > benchmark * 0.05) {
    fact.unitCost = round(benchmark + excess * 0.45, 3);
    fact.estimated_cost_lakhs = Math.max(1, round(fact.unitCost * fact.quantity, 2));
    fact.first_installment_amt =
      fact.first_installment_dt === null ? null : round(fact.estimated_cost_lakhs * 0.5, 2);
    fact.total_paid_lakhs = round(Math.min(fact.total_paid_lakhs, fact.estimated_cost_lakhs), 2);
    return true;
  }

  if (fact.photo_count < fact.requiredPhotos) {
    fact.photo_count = fact.requiredPhotos;
    return true;
  }

  return false;
}
