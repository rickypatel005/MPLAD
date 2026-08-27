import type { ComplianceRule, ComplianceStatus, IAType } from '@/types/api';

/**
 * MPLADS domain taxonomy for the synthetic dataset.
 *
 * Work categories mirror the sanctioned works list in the MPLADS guidelines. Unit
 * cost benchmarks are order-of-magnitude realistic figures used to make the
 * financial-risk dimension legible; they are illustrative, not published rates.
 *
 * The compliance rules, by contrast, are the actual guideline requirements the
 * product checks against: sanction within 45 days, completion within 12 months,
 * 15% SC-area and 7.5% ST-area spend, and stage photographs as release evidence.
 */

export interface WorkTypeSpec {
  work_type: string;
  /** Unit the benchmark is expressed in. */
  unit: string;
  /** Typical cost per unit, in lakhs. */
  benchmark_unit_cost: number;
  /** Typical total project cost range, in lakhs. */
  cost_range: [number, number];
  /** Typical quantity range in `unit`, used to derive a plausible unit cost. */
  quantity_range: [number, number];
  /** Share of works of this type that record GPS coordinates. */
  gps_rate: number;
  /** Phrase fragments used to compose plausible work descriptions. */
  descriptors: readonly string[];
}

export const WORK_TYPES: readonly WorkTypeSpec[] = [
  {
    work_type: 'Road & Pavement Construction',
    unit: 'km',
    benchmark_unit_cost: 4.1,
    cost_range: [6, 95],
    quantity_range: [1.2, 14],
    gps_rate: 0.72,
    descriptors: [
      'Construction of CC road',
      'Bituminous surfacing of village approach road',
      'Construction of interlocking paver block road',
      'Widening and strengthening of link road',
    ],
  },
  {
    work_type: 'Community Hall',
    unit: 'unit',
    benchmark_unit_cost: 22.5,
    cost_range: [12, 60],
    quantity_range: [1, 1],
    gps_rate: 0.81,
    descriptors: [
      'Construction of community hall',
      'Construction of multipurpose community centre',
      'Construction of Samudayik Bhawan',
    ],
  },
  {
    work_type: 'School Building & Classrooms',
    unit: 'room',
    benchmark_unit_cost: 8.6,
    cost_range: [9, 70],
    quantity_range: [2, 8],
    gps_rate: 0.86,
    descriptors: [
      'Construction of additional classrooms at government primary school',
      'Construction of school boundary wall and gate',
      'Construction of two-room block at upper primary school',
    ],
  },
  {
    work_type: 'Drinking Water Facility',
    unit: 'unit',
    benchmark_unit_cost: 3.2,
    cost_range: [3, 34],
    quantity_range: [1, 8],
    gps_rate: 0.64,
    descriptors: [
      'Installation of India Mark-II handpumps',
      'Construction of overhead water tank',
      'Provision of submersible pump and pipeline',
      'Construction of RO water treatment unit',
    ],
  },
  {
    work_type: 'Street Lighting (Solar)',
    unit: 'pole',
    benchmark_unit_cost: 0.34,
    cost_range: [4, 42],
    quantity_range: [15, 120],
    gps_rate: 0.48,
    descriptors: [
      'Installation of solar street lighting system',
      'Provision of LED high-mast lighting',
      'Installation of solar street lights along main road',
    ],
  },
  {
    work_type: 'Sanitation & Public Toilets',
    unit: 'block',
    benchmark_unit_cost: 6.4,
    cost_range: [5, 38],
    quantity_range: [1, 5],
    gps_rate: 0.7,
    descriptors: [
      'Construction of community toilet block',
      'Construction of separate toilet units at girls school',
      'Construction of public sanitation complex',
    ],
  },
  {
    work_type: 'Drainage & Sewerage',
    unit: 'km',
    benchmark_unit_cost: 5.8,
    cost_range: [7, 55],
    quantity_range: [0.6, 6],
    gps_rate: 0.58,
    descriptors: [
      'Construction of RCC covered drain',
      'Construction of pucca nali along village road',
      'Construction of storm water drain',
    ],
  },
  {
    work_type: 'Health Sub-Centre',
    unit: 'unit',
    benchmark_unit_cost: 26.0,
    cost_range: [18, 78],
    quantity_range: [1, 1],
    gps_rate: 0.88,
    descriptors: [
      'Construction of health sub-centre building',
      'Construction of ward block at primary health centre',
      'Provision of building for ayushman arogya mandir',
    ],
  },
  {
    work_type: 'Anganwadi Centre',
    unit: 'unit',
    benchmark_unit_cost: 9.4,
    cost_range: [7, 32],
    quantity_range: [1, 3],
    gps_rate: 0.76,
    descriptors: [
      'Construction of anganwadi centre building',
      'Construction of anganwadi with kitchen and toilet',
    ],
  },
  {
    work_type: 'Library & Reading Room',
    unit: 'unit',
    benchmark_unit_cost: 12.0,
    cost_range: [8, 40],
    quantity_range: [1, 1],
    gps_rate: 0.79,
    descriptors: [
      'Construction of public library building',
      'Provision of reading room and study hall for students',
    ],
  },
  {
    work_type: 'Sports Facility',
    unit: 'unit',
    benchmark_unit_cost: 18.0,
    cost_range: [10, 65],
    quantity_range: [1, 2],
    gps_rate: 0.67,
    descriptors: [
      'Development of playground with boundary wall',
      'Construction of open gymnasium and jogging track',
      'Construction of indoor sports facility',
    ],
  },
  {
    work_type: 'Bus Shelter & Passenger Amenity',
    unit: 'unit',
    benchmark_unit_cost: 3.6,
    cost_range: [3, 22],
    quantity_range: [1, 6],
    gps_rate: 0.61,
    descriptors: [
      'Construction of bus passenger shelter',
      'Construction of waiting shed at bus stand',
    ],
  },
  {
    work_type: 'Crematorium & Burial Ground',
    unit: 'unit',
    benchmark_unit_cost: 11.5,
    cost_range: [8, 36],
    quantity_range: [1, 1],
    gps_rate: 0.55,
    descriptors: [
      'Construction of shed at cremation ground',
      'Construction of boundary wall at burial ground',
    ],
  },
  {
    work_type: 'E-Learning & IT Equipment',
    unit: 'set',
    benchmark_unit_cost: 2.8,
    cost_range: [4, 28],
    quantity_range: [2, 10],
    gps_rate: 0.34,
    descriptors: [
      'Provision of smart classroom equipment',
      'Provision of computers and projectors for government school',
    ],
  },
  {
    work_type: 'Ambulance & Mobility Aid',
    unit: 'unit',
    benchmark_unit_cost: 14.5,
    cost_range: [12, 45],
    quantity_range: [1, 3],
    gps_rate: 0.22,
    descriptors: [
      'Provision of ambulance for community health centre',
      'Provision of tricycles and mobility aids for persons with disabilities',
    ],
  },
] as const;

export const WORK_TYPE_BY_NAME: Record<string, WorkTypeSpec> = Object.fromEntries(
  WORK_TYPES.map((w) => [w.work_type, w]),
);

export const WORK_TYPE_NAMES: readonly string[] = WORK_TYPES.map((w) => w.work_type);

// ---------------------------------------------------------------------------
// Implementing agencies
// ---------------------------------------------------------------------------

export interface IANameSpec {
  base: string;
  ia_type: IAType;
}

/**
 * Name stems for synthetic implementing agencies, combined with a place name at
 * generation time. Types follow the eSAKSHI IA categories the risk model uses:
 * government bodies, local bodies, NGOs, trusts, and unclassified records.
 */
export const IA_NAME_STEMS: readonly IANameSpec[] = [
  { base: 'Public Works Division', ia_type: 'GOVT' },
  { base: 'Rural Engineering Service', ia_type: 'GOVT' },
  { base: 'Zilla Parishad Works Department', ia_type: 'LOCAL_BODY' },
  { base: 'Municipal Corporation Engineering Wing', ia_type: 'LOCAL_BODY' },
  { base: 'Panchayati Raj Engineering Division', ia_type: 'LOCAL_BODY' },
  { base: 'District Rural Development Agency', ia_type: 'GOVT' },
  { base: 'Jal Nigam Construction Unit', ia_type: 'GOVT' },
  { base: 'Nagar Panchayat Works Cell', ia_type: 'LOCAL_BODY' },
  { base: 'Gramin Vikas Samiti', ia_type: 'NGO' },
  { base: 'Jan Kalyan Seva Sansthan', ia_type: 'NGO' },
  { base: 'Shiksha Vikas Trust', ia_type: 'TRUST' },
  { base: 'Sarvodaya Charitable Trust', ia_type: 'TRUST' },
  { base: 'Infrastructure Services', ia_type: 'GOVT' },
  { base: 'Works Committee', ia_type: 'UNKNOWN' },
] as const;

// ---------------------------------------------------------------------------
// Compliance rules — the real guideline requirements
// ---------------------------------------------------------------------------

export const SC_MANDATE_SHARE = 0.15;
export const ST_MANDATE_SHARE = 0.075;
/** The specific line the Compliance Monitor flags against (Implementation Plan §8). */
export const CRITICAL_SC_SHARE_THRESHOLD = 0.1;

export const SANCTION_WINDOW_DAYS = 45;
export const COMPLETION_WINDOW_MONTHS = 12;

export const COMPLIANCE_RULES: readonly ComplianceRule[] = [
  {
    rule_id: 'SANCTION_45D',
    rule_name: '45-day sanction',
    requirement:
      'District Authority sanctions an eligible recommended work within 45 days of receipt.',
    reference: 'MPLADS Guidelines, Ch. 3 — Sanction of works',
    compliant_at_or_above: 0.9,
    at_risk_below: 0.75,
  },
  {
    rule_id: 'COMPLETION_12M',
    rule_name: '12-month completion',
    requirement: 'Sanctioned works are completed within twelve months of the sanction date.',
    reference: 'MPLADS Guidelines, Ch. 4 — Execution and completion',
    compliant_at_or_above: 0.85,
    at_risk_below: 0.7,
  },
  {
    rule_id: 'SC_AREA_15',
    rule_name: 'SC-area spend mandate',
    requirement:
      'At least 15% of the annual entitlement is recommended for works in areas with a substantial Scheduled Caste population.',
    reference: 'MPLADS Guidelines, Ch. 2 — Special area obligations',
    compliant_at_or_above: 0.9,
    at_risk_below: 0.7,
  },
  {
    rule_id: 'ST_AREA_7_5',
    rule_name: 'ST-area spend mandate',
    requirement:
      'At least 7.5% of the annual entitlement is recommended for works in areas with a substantial Scheduled Tribe population.',
    reference: 'MPLADS Guidelines, Ch. 2 — Special area obligations',
    compliant_at_or_above: 0.9,
    at_risk_below: 0.7,
  },
  {
    rule_id: 'STAGE_PHOTOS',
    rule_name: 'Stage photograph evidence',
    requirement:
      'Geo-tagged photographs are uploaded at each payment stage before the corresponding instalment is released.',
    reference: 'MPLADS Guidelines, Ch. 6 — Monitoring and eSAKSHI reporting',
    compliant_at_or_above: 0.85,
    at_risk_below: 0.65,
  },
  {
    rule_id: 'FUND_UTILISATION',
    rule_name: 'Instalment utilisation',
    requirement:
      'The second instalment is released only after utilisation of at least 80% of the first instalment is certified.',
    reference: 'MPLADS Guidelines, Ch. 5 — Release of funds',
    compliant_at_or_above: 0.88,
    at_risk_below: 0.72,
  },
] as const;

/** Financial years the dataset spans. */
export const FINANCIAL_YEARS: readonly string[] = ['2022-23', '2023-24', '2024-25', '2025-26'] as const;

export const RULE_BY_ID: Record<string, ComplianceRule> = Object.fromEntries(
  COMPLIANCE_RULES.map((rule) => [rule.rule_id, rule]),
);

/**
 * Grades a compliance rate against the thresholds the rule itself declares.
 *
 * The bands live on the rule rather than in this function because they are not uniform:
 * the 45-day sanction window is a hard administrative deadline and is held to 90%, while
 * the stage-photograph requirement is graded more leniently because eSAKSHI adoption is
 * still uneven and marking every state non-compliant for a data-capture gap would say
 * nothing useful about the works themselves.
 *
 * An unknown rule returns NO_DATA rather than a pass: silence is not compliance.
 */
export function complianceStatusFor(rate: number, ruleId: string): ComplianceStatus {
  const rule = RULE_BY_ID[ruleId];
  if (!rule) return 'NO_DATA';
  if (rate >= rule.compliant_at_or_above) return 'COMPLIANT';
  if (rate >= rule.at_risk_below) return 'AT_RISK';
  return 'NON_COMPLIANT';
}

/** Alert categories, aligned to the six risk dimensions. */
export const ALERT_TYPES: readonly string[] = [
  'COST_ANOMALY',
  'COMPLETION_DELAY',
  'RULE_BREACH',
  'IA_CONCENTRATION',
  'DUPLICATE_CANDIDATE',
  'MISSING_EVIDENCE',
  'LOCATION_MISMATCH',
] as const;

/**
 * Display labels for the alert categories.
 *
 * Written out rather than derived by de-underscoring the code, because "Ia concentration"
 * is what that would produce and the filter panel is part of the product. Every label
 * names an observation, never a conclusion — "Duplicate candidate", not "Duplicate".
 */
export const ALERT_TYPE_LABELS: Record<string, string> = {
  COST_ANOMALY: 'Cost anomaly',
  COMPLETION_DELAY: 'Completion delay',
  RULE_BREACH: 'Guideline breach',
  IA_CONCENTRATION: 'Agency concentration',
  DUPLICATE_CANDIDATE: 'Duplicate candidate',
  MISSING_EVIDENCE: 'Missing evidence',
  LOCATION_MISMATCH: 'Location mismatch',
};

export const alertTypeLabel = (code: string): string => ALERT_TYPE_LABELS[code] ?? code;
