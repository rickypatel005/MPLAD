/**
 * Canonical API types for MPLADS-AUDIT-AI.
 *
 * These mirror TRD §6 field-for-field. The TRD explicitly describes its shapes as
 * the frontend's *proposed* contract to negotiate from (TRD §5), so anything this
 * file adds beyond TRD §6 is marked `@proposed` — those are the fields to confirm
 * with the backend engineer at the T+14 sync point (Implementation Plan §4).
 *
 * The frontend never computes any of these values. It renders what the API returns
 * (TRD §3). No scoring, no ML, no backend-level aggregation.
 */

// ---------------------------------------------------------------------------
// Enums / literal unions
// ---------------------------------------------------------------------------

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskDimensionKey =
  | 'FINANCIAL'
  | 'TIMELINE'
  | 'COMPLIANCE'
  | 'IA'
  | 'GEO'
  | 'EVIDENCE';

export type MPHouse = 'LOK_SABHA' | 'RAJYA_SABHA' | 'NOMINATED';

export type SanctionStatus = 'PENDING' | 'SANCTIONED' | 'REJECTED';

export type IAType = 'GOVT' | 'LOCAL_BODY' | 'NGO' | 'TRUST' | 'PRIVATE' | 'UNKNOWN';

export type NetworkNodeType = 'IA' | 'MP' | 'DISTRICT';

export type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Core records (TRD §6)
// ---------------------------------------------------------------------------

export interface Project {
  project_id: string;
  mp_id: string;
  mp_house: MPHouse;
  constituency_id: string;
  district_id: string;
  state_id: string;
  work_type: string;
  work_description: string;
  estimated_cost_lakhs: number;
  is_sc_area: boolean;
  is_st_area: boolean;
  is_calamity: boolean;
  /** ISO date (YYYY-MM-DD) */
  recommended_date: string;
  sanction_status: SanctionStatus;
  sanction_date: string | null;
  ia_id: string;
  first_installment_dt: string | null;
  first_installment_amt: number | null;
  final_payment_dt: string | null;
  total_paid_lakhs: number;
  completion_date: string | null;
  work_lat: number | null;
  work_lon: number | null;
  photo_count: number;
  /** Financial year, e.g. "2024-25" */
  fy: string;
}

export interface RiskFactor {
  dimension: RiskDimensionKey;
  severity: RiskLevel;
  /** Human-readable evidence, e.g. "Cost is 3.4× the state average for road works" */
  text: string;
  /** The concrete metric behind the text — Z-score, HHI, similarity %, days overdue. */
  value?: number;
}

export interface RiskScore {
  project_id: string;
  /** All dimension scores are 0–1. */
  financial_risk: number;
  timeline_risk: number;
  compliance_risk: number;
  ia_risk: number;
  geo_risk: number;
  evidence_risk: number;
  /** 0–1 weighted sum: 0.25 financial + 0.20 timeline + 0.20 compliance + 0.20 IA + 0.10 geo + 0.05 evidence */
  overall_risk: number;
  risk_level: RiskLevel;
  top_risk_factors: RiskFactor[];
  explanation_text: string;
  /** ISO timestamp */
  scored_at: string;
  model_version: string;
}

export interface ImplementingAgency {
  ia_id: string;
  ia_name: string;
  ia_type: IAType;
  total_projects: number;
  completed_projects: number;
  avg_delay_days: number;
  /** 0–1 */
  risk_score: number;
  state_id: string;
}

export interface Alert {
  alert_id: number;
  project_id: string;
  alert_type: string;
  alert_level: RiskLevel;
  alert_message: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  action_taken: string | null;
  /** ISO timestamp */
  created_at: string;
}

export interface DuplicatePair {
  pair_id: number;
  project_id_1: string;
  project_id_2: string;
  /** 0–1 */
  similarity_score: number;
  geo_distance_km: number;
  detection_method: string;
  reviewed: boolean;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkNode {
  id: string;
  type: NetworkNodeType;
  label: string;
  /** 0–1 concentration/aggregate risk driving node colour. */
  risk?: number;
  /** @proposed drives node size. */
  project_count?: number;
  /** @proposed Herfindahl-Hirschman concentration index, 0–1. IA nodes only. */
  hhi?: number;
  /** @proposed */
  ia_type?: IAType;
  /** @proposed */
  state_id?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  /** Project count between the two nodes — drives edge thickness. */
  weight: number;
}

// ---------------------------------------------------------------------------
// Shared envelopes
// ---------------------------------------------------------------------------

export interface PageMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  page: PageMeta;
}

/** A selectable filter value plus how many records carry it. */
export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Reference / lookup records
// ---------------------------------------------------------------------------

export interface StateRef {
  state_id: string;
  state_name: string;
}

export interface DistrictRef {
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  /** District centroid — used as the map fallback when project GPS is missing. */
  lat: number;
  lon: number;
}

/**
 * MP reference. `mp_id` is the stable identifier; `mp_name` is only ever rendered
 * when anonymisation is off (PRD §8, Design Doc §8).
 */
export interface MPRef {
  mp_id: string;
  mp_name: string;
  mp_house: MPHouse;
  constituency_id: string;
  constituency_name: string;
  state_id: string;
}

// ---------------------------------------------------------------------------
// GET /dashboard
// ---------------------------------------------------------------------------

/** Row shape for the ranked project table and the Top-10 list. */
export interface RankedProject {
  project_id: string;
  work_type: string;
  work_description: string;
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  mp_id: string;
  ia_id: string;
  ia_name: string;
  estimated_cost_lakhs: number;
  risk_level: RiskLevel;
  overall_risk: number;
  /** Highest-severity single reason — the dashboard must never show a bare score. */
  top_reason: string;
  top_reason_dimension: RiskDimensionKey;
  recommended_date: string;
  fy: string;
}

export interface RiskLevelCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface DashboardKPIs {
  total_projects_analyzed: number;
  counts_by_risk_level: RiskLevelCounts;
  /** Mean overall_risk across the filtered set, 0–1. */
  mean_overall_risk: number;
  top_risk_state: { state_id: string; state_name: string; mean_risk: number } | null;
  top_risk_district: {
    district_id: string;
    district_name: string;
    state_name: string;
    mean_risk: number;
  } | null;
  total_estimated_cost_lakhs: number;
  /** ISO timestamp of the most recent scoring run. */
  last_scored_at: string;
  model_version: string;
}

/** One state in the dashboard choropleth. */
export interface StateRiskAggregate {
  state_id: string;
  state_name: string;
  project_count: number;
  mean_risk: number;
  risk_level: RiskLevel;
  counts_by_risk_level: RiskLevelCounts;
}

/** One cell in the Recharts treemap (alternate view of risk concentration). */
export interface RiskTreemapNode {
  name: string;
  project_count: number;
  mean_risk: number;
  risk_level: RiskLevel;
  total_cost_lakhs: number;
}

export interface DashboardResponse {
  kpis: DashboardKPIs;
  state_risk: StateRiskAggregate[];
  /** Grouped by work type — powers the treemap toggle. */
  work_type_risk: RiskTreemapNode[];
  /** Always the highest-risk N of the filtered set, regardless of table sort. */
  top_projects: RankedProject[];
  /** The paginated, sorted, filtered ranked table. */
  projects: Paginated<RankedProject>;
  facets: {
    states: FacetOption[];
    work_types: FacetOption[];
    risk_levels: FacetOption[];
  };
}

// ---------------------------------------------------------------------------
// GET /project/{id}
// ---------------------------------------------------------------------------

/**
 * @proposed
 * One of the six risk-dimension cards on the Project Investigation page.
 *
 * The Design Doc (§4.2) and brief (§7) require six cards, each with an icon,
 * severity, score, concrete evidence, a relevant metric and an explanation. TRD §6
 * only guarantees `top_risk_factors`, which may not cover all six dimensions — so
 * the frontend asks for this explicitly. If the backend cannot supply it,
 * `buildRiskDimensions()` in src/lib/risk.ts reconstructs the six cards from the
 * numeric dimension scores plus whichever factors are present.
 */
export interface RiskDimensionDetail {
  dimension: RiskDimensionKey;
  /** 0–1 */
  score: number;
  severity: RiskLevel;
  /** Concrete evidence sentence. Never a bare label. */
  evidence: string;
  /** The headline number, pre-formatted for display, e.g. "₹18.4L/km vs ₹4.1L/km". */
  metric_label: string | null;
  /** Named statistic behind the metric, e.g. "Z-score", "HHI", "Similarity". */
  metric_name: string | null;
  metric_value: number | null;
  /** Longer "why this matters" text shown under the evidence line. */
  explanation: string;
  /** Guideline or benchmark the finding is measured against, when applicable. */
  reference: string | null;
}

export interface PaymentRecord {
  stage: string;
  /** ISO date */
  paid_date: string | null;
  amount_lakhs: number | null;
  /** Share of sanctioned cost released at this stage, 0–1. */
  share_of_sanctioned: number | null;
  /** Reported physical progress at this stage, 0–1. */
  reported_progress: number | null;
  photo_required: boolean;
  photo_present: boolean;
  note: string | null;
}

export interface TimelineEvent {
  key: string;
  label: string;
  /** ISO date, null when the stage has not happened yet. */
  date: string | null;
  status: 'COMPLETE' | 'PENDING' | 'OVERDUE' | 'BREACH' | 'NOT_APPLICABLE';
  detail: string | null;
  /** Set when a MPLADS guideline threshold was crossed at this stage. */
  breach: { rule: string; text: string; days_over: number | null } | null;
}

export interface ProjectPhoto {
  photo_id: string;
  stage: string;
  /** ISO date */
  uploaded_at: string | null;
  /** Present only if the backend exposes a served image. Null renders a placeholder. */
  url: string | null;
  /** Perceptual-hash match against another project's photo, if any. */
  similar_to_project_id: string | null;
  hamming_distance: number | null;
}

/** Peer projects used to contextualise the cost anomaly (PRD §6.3). */
export interface ComparableProject {
  project_id: string;
  district_name: string;
  work_type: string;
  estimated_cost_lakhs: number;
  unit_cost_lakhs: number | null;
  risk_level: RiskLevel;
}

export interface CostBenchmark {
  work_type: string;
  state_id: string;
  unit: string;
  /** Project's own unit cost, e.g. lakhs per km. */
  project_unit_cost: number;
  benchmark_unit_cost: number;
  ratio: number;
  z_score: number;
  source: string;
  fy: string;
}

export interface RecommendedAction {
  action: string;
  /** Who the project should be routed to. */
  refer_to: string;
  urgency: RiskLevel;
  rationale: string;
}

export interface ProjectDetailResponse {
  project: Project;
  risk_score: RiskScore;
  /** @proposed the six dimension cards, pre-built by the backend where possible. */
  risk_dimensions?: RiskDimensionDetail[];
  implementing_agency: ImplementingAgency;
  mp: MPRef;
  district: DistrictRef;
  state: StateRef;
  payments: PaymentRecord[];
  timeline: TimelineEvent[];
  photos: ProjectPhoto[];
  cost_benchmark: CostBenchmark | null;
  comparable_projects: ComparableProject[];
  /** Duplicate pairs this project participates in — drives the cross-link to /duplicates. */
  duplicate_pairs: DuplicatePairSummary[];
  recommended_action: RecommendedAction;
  /** True when this project's IA appears in the network graph, enabling the deep link. */
  has_network_relationship: boolean;
}

// ---------------------------------------------------------------------------
// GET /alerts
// ---------------------------------------------------------------------------

/** @proposed alert rows joined with the context the feed needs to render a row. */
export interface AlertRow extends Alert {
  project_work_type: string;
  district_name: string;
  state_id: string;
  state_name: string;
  mp_id: string;
  overall_risk: number;
  /** ISO timestamp, set when acknowledged. */
  acknowledged_at: string | null;
}

export interface AlertsResponse {
  alerts: Paginated<AlertRow>;
  counts_by_level: RiskLevelCounts;
  unacknowledged_count: number;
  facets: {
    alert_types: FacetOption[];
    states: FacetOption[];
    mps: FacetOption[];
  };
}

export interface AcknowledgeAlertRequest {
  acknowledged_by: string;
  action_taken: string;
}

// ---------------------------------------------------------------------------
// GET /network
// ---------------------------------------------------------------------------

/** @proposed everything the NodeDetailPanel needs, without a second round trip. */
export interface NetworkNodeDetail {
  node_id: string;
  type: NetworkNodeType;
  label: string;
  risk: number;
  project_count: number;
  /** IA nodes only. */
  hhi: number | null;
  ia_type: IAType | null;
  completed_projects: number | null;
  avg_delay_days: number | null;
  /** The MP this IA is most concentrated on — the headline concentration finding. */
  top_relationship: {
    node_id: string;
    label: string;
    project_count: number;
    /** Share of the counterparty's portfolio, 0–1. */
    share: number;
  } | null;
  related_nodes: {
    node_id: string;
    type: NetworkNodeType;
    label: string;
    project_count: number;
  }[];
  districts: string[];
  /** Explainability: the concentration finding in words, never a bare HHI. */
  evidence: string;
}

export interface NetworkResponse extends NetworkGraphData {
  node_details: NetworkNodeDetail[];
  /** Legend thresholds so the graph legend matches whatever the backend used. */
  legend: {
    max_edge_weight: number;
    max_project_count: number;
    hhi_concentration_threshold: number;
  };
}

// ---------------------------------------------------------------------------
// GET /map-data
// ---------------------------------------------------------------------------

export interface DistrictRiskAggregate {
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  lat: number;
  lon: number;
  project_count: number;
  mean_risk: number;
  risk_level: RiskLevel;
  counts_by_risk_level: RiskLevelCounts;
}

export interface MapProjectMarker {
  project_id: string;
  lat: number;
  lon: number;
  /** GPS = real coordinates from eSAKSHI; DISTRICT_CENTROID = fallback (PRD §10). */
  location_source: 'GPS' | 'DISTRICT_CENTROID';
  risk_level: RiskLevel;
  overall_risk: number;
  work_type: string;
  district_id: string;
  district_name: string;
  state_name: string;
  /** One-line reason for the popup — no bare scores on the map either. */
  top_reason: string;
}

export interface MapDataResponse {
  districts: DistrictRiskAggregate[];
  projects: MapProjectMarker[];
  /** Duplicate pairs with both endpoints resolved, for two-point distance display. */
  duplicate_links: {
    pair_id: number;
    similarity_score: number;
    geo_distance_km: number;
    from: { project_id: string; lat: number; lon: number };
    to: { project_id: string; lat: number; lon: number };
  }[];
  coverage: {
    total_projects: number;
    with_gps: number;
    district_centroid_fallback: number;
  };
}

// ---------------------------------------------------------------------------
// GET /duplicates
// ---------------------------------------------------------------------------

/** Minimal duplicate reference embedded in the project detail response. */
export interface DuplicatePairSummary {
  pair_id: number;
  counterpart_project_id: string;
  similarity_score: number;
  geo_distance_km: number;
  detection_method: string;
  /** Why the pair is notable, in words. */
  note: string;
}

/** One side of a duplicate pair, with everything the comparison modal shows. */
export interface DuplicateSideProject {
  project_id: string;
  work_type: string;
  work_description: string;
  estimated_cost_lakhs: number;
  mp_id: string;
  ia_id: string;
  ia_name: string;
  district_id: string;
  district_name: string;
  state_name: string;
  recommended_date: string;
  sanction_date: string | null;
  completion_date: string | null;
  risk_level: RiskLevel;
  overall_risk: number;
  lat: number | null;
  lon: number | null;
  location_source: 'GPS' | 'DISTRICT_CENTROID';
}

export interface DuplicatePairRow extends DuplicatePair {
  project_a: DuplicateSideProject;
  project_b: DuplicateSideProject;
  /** Shared attributes that make the pair suspicious — same IA, same district, etc. */
  shared_attributes: string[];
  /** Review workflow state; `reviewed` alone cannot express "cleared" vs "escalated". */
  review_status: 'PENDING_REVIEW' | 'CONFIRMED_DUPLICATE' | 'NOT_A_DUPLICATE';
}

export interface DuplicatesResponse {
  pairs: Paginated<DuplicatePairRow>;
  counts: {
    total_pairs: number;
    pending_review: number;
    /** similarity_score >= 0.85 */
    high_similarity: number;
    /** geo_distance_km <= 2 */
    geographically_close: number;
  };
  facets: {
    detection_methods: FacetOption[];
    states: FacetOption[];
  };
}

// ---------------------------------------------------------------------------
// GET /compliance-summary
// ---------------------------------------------------------------------------

export type ComplianceStatus = 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT' | 'NO_DATA';

export interface ComplianceRule {
  rule_id: string;
  rule_name: string;
  /** The guideline requirement in one line, e.g. "Sanction within 45 days". */
  requirement: string;
  /** Citation, e.g. "MPLADS Guidelines 2023, Ch. 4". */
  reference: string;
  /** Compliance rate at or above this is COMPLIANT; below `at_risk_below` is NON_COMPLIANT. */
  compliant_at_or_above: number;
  at_risk_below: number;
}

export interface ComplianceMatrixCell {
  rule_id: string;
  state_id: string;
  /** 0–1 share of applicable projects that comply. */
  compliance_rate: number;
  status: ComplianceStatus;
  compliant_projects: number;
  applicable_projects: number;
  /** Evidence sentence for the cell tooltip — never a bare percentage. */
  evidence: string;
}

export interface StateComplianceSummary {
  state_id: string;
  state_name: string;
  /** Mean compliance across all rules, 0–1. */
  overall_compliance_rate: number;
  status: ComplianceStatus;
  project_count: number;
  breached_rules: number;
}

/** SC/ST mandate tracker row. Mandate is 15% SC and 7.5% ST of recommended amount. */
export interface SCSTMandateRow {
  mp_id: string;
  state_id: string;
  state_name: string;
  constituency_name: string;
  total_recommended_lakhs: number;
  sc_area_lakhs: number;
  st_area_lakhs: number;
  /** 0–1 */
  sc_share: number;
  st_share: number;
  sc_status: ComplianceStatus;
  st_status: ComplianceStatus;
  /** True when sc_share < 0.10 — the specific demo beat (Implementation Plan §8). */
  below_ten_percent_sc: boolean;
  project_count: number;
  evidence: string;
}

export interface ComplianceSummaryResponse {
  rules: ComplianceRule[];
  states: StateComplianceSummary[];
  matrix: ComplianceMatrixCell[];
  scst_mandate: {
    sc_mandate_share: number;
    st_mandate_share: number;
    /** The flag line used by the tracker, i.e. 0.10. */
    critical_sc_share_threshold: number;
    rows: SCSTMandateRow[];
    below_threshold_count: number;
  };
  national: {
    overall_compliance_rate: number;
    rules_breached: number;
    projects_assessed: number;
  };
}

// ---------------------------------------------------------------------------
// POST /analyze
// ---------------------------------------------------------------------------

export interface AnalyzeRequest {
  /** Optional scope; omit to re-score everything. */
  state_id?: string;
  fy?: string;
}

export interface AnalyzeResponse {
  run_id: string;
  status: 'COMPLETED' | 'RUNNING' | 'FAILED';
  projects_analyzed: number;
  projects_flagged: number;
  new_alerts: number;
  duration_seconds: number;
  model_version: string;
  started_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------------------
// GET /report/{id}
// ---------------------------------------------------------------------------

/**
 * PDF-ready payload. The backend may instead return an actual PDF stream; the
 * frontend handles both (see `getReport` in src/lib/api).
 */
export interface ReportResponse {
  project_id: string;
  generated_at: string;
  model_version: string;
  /** Fixed disclaimer text, carried in the payload so the PDF cannot omit it. */
  disclaimer: string;
  summary: string;
  sections: {
    heading: string;
    lines: string[];
  }[];
  /** Populated when the backend renders the PDF itself. */
  pdf_url: string | null;
}
