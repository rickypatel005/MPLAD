/**
 * The seeded demo fixtures.
 *
 * These are the specific numbers the 5-minute demo script is written around
 * (Implementation Plan §8). They must exist as real, findable records in the
 * dataset — reachable through normal filtering, sorting and deep links — not
 * approximated at demo time or special-cased in a component.
 *
 * Everything here is therefore *input* to the generator: the facts are seeded, and
 * the risk scores, evidence text and derived views come out of the same code path
 * that processes every other record. If the scoring logic changes, these records
 * change with it rather than silently drifting out of agreement with the rest of
 * the screen.
 *
 * Nothing in the UI reads these constants. They exist only inside the mock layer.
 */

/** The #1 CRITICAL project — the first drill-down in the script. */
export const HERO_PROJECT = {
  project_id: 'UP-LKO-2024-0412',
  district_id: 'UP-LKO',
  state_id: 'UP',
  work_type: 'Road & Pavement Construction',
  work_description:
    'Construction of CC road from Bakshi Ka Talab block office to Itaunja market approach, including side drains',
  /** Cost ₹18.4L/km against a ₹4.1L/km benchmark. */
  unit_cost_lakhs: 18.4,
  benchmark_unit_cost_lakhs: 4.1,
  quantity_km: 3.2,
  /** 24 months elapsed since sanction, against a 12-month completion window. */
  months_since_sanction: 24,
  /** Predicted delay probability reported by the timeline model. */
  delay_probability: 0.96,
  sanction_date: '2024-06-18',
  recommended_date: '2024-04-02',
  /** Photographs required at three payment stages; two are missing. */
  photo_count: 1,
  is_sc_area: true,
  is_st_area: false,
} as const;

/** The earlier, near-identical work that forms the duplicate pair. */
export const DUPLICATE_COUNTERPART = {
  project_id: 'UP-LKO-2024-0179',
  district_id: 'UP-LKO',
  state_id: 'UP',
  work_type: 'Road & Pavement Construction',
  work_description:
    'Construction of CC road from Bakshi Ka Talab block office towards Itaunja market with side drain',
  quantity_km: 3.0,
  unit_cost_lakhs: 5.2,
  /** Three months earlier than the hero project. */
  recommended_date: '2024-01-08',
  sanction_date: '2024-02-20',
  completion_date: '2024-11-14',
  photo_count: 3,
  is_sc_area: true,
  is_st_area: false,
} as const;

/** Exactly 91% similarity, with the two work sites about 800 m apart. */
export const DUPLICATE_PAIR = {
  pair_id: 1,
  similarity_score: 0.91,
  separation_metres: 800,
  /** Bearing used to place the counterpart relative to the hero project. */
  bearing_degrees: 62,
  detection_method: 'SENTENCE_BERT + GEO_PROXIMITY',
} as const;

/** The concentrated implementing agency — one click from the hero project. */
export const HERO_IA = {
  ia_id: 'IA-UP-0731',
  ia_name: 'Bharat Infrastructure Services',
  ia_type: 'GOVT' as const,
  state_id: 'UP',
  /** 43 of 47 projects for a single MP. */
  total_projects: 47,
  projects_for_dominant_mp: 43,
  /**
   * Herfindahl-Hirschman concentration index across the agency's MP portfolio,
   * measured over recommended *value* — the standard procurement formulation, and
   * the one under which "43 of 47 works" and "HHI 0.91" are both true at once. A
   * count-based index over the same portfolio reads 0.84.
   *
   * The generator does not assign this number; it sizes the four non-dominant works
   * so that the index computed from the data lands here. See
   * HERO_DOMINANT_VALUE_SHARE in generate.ts.
   */
  hhi: 0.91,
} as const;

/**
 * The three MPs below the 10% SC-area spend line, against a 15% mandate.
 *
 * Three exactly — the script says "3 MPs", and a fourth appearing because of a
 * random draw would contradict the narration. Their shares are seeded so they are
 * visibly distinct from the rest of the tracker rather than clustered at the line.
 */
export const SC_SHORTFALL_MPS = [
  { mp_id: 'MP-UP-0031', sc_share: 0.062 },
  { mp_id: 'MP-BR-0018', sc_share: 0.074 },
  { mp_id: 'MP-MH-0022', sc_share: 0.091 },
] as const;

/** The MP whose portfolio the hero IA dominates. */
export const HERO_MP_ID = 'MP-UP-0031';

/**
 * Every other MP is kept at or above this share, so the "exactly 3" claim holds
 * regardless of the random draw elsewhere in the generator.
 */
export const SC_SHARE_FLOOR_FOR_OTHERS = 0.108;

/** Master seed. Changing this regenerates the whole dataset. */
export const DATASET_SEED = 26102;

/** Total works generated. Within the 10k–50k range the brief specifies. */
export const PROJECT_COUNT = 12_000;

/** Model version reported alongside every score. */
export const MODEL_VERSION = 'risk-engine-0.9.3';

/** Fixed "now" for the dataset, so elapsed-time evidence never drifts day to day. */
export const DATASET_AS_OF = '2026-08-20';
