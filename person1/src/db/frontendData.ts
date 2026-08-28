/**
 * SIH26102 — Frontend-Compatible Data Engine
 * 
 * Transforms Person 1's in-memory AppDatabase into the exact response shapes
 * that Person 4's frontend expects (defined in person4-frontend/src/types/api.ts).
 *
 * Runs once at startup after AppDatabase.initializePipeline(), then serves
 * every frontend-compatible endpoint from memory.
 */

import { AppDatabase } from './database.ts';
import type {
  ProjectEntity,
  PaymentTransaction,
  ImplementingAgencyEntity,
  RiskScore as P1RiskScore,
  RiskFlag,
  RiskLevel,
} from '../types.ts';

// ─────────────────────────────────────────────
// Frontend type definitions (mirror Person 4's api.ts)
// ─────────────────────────────────────────────

export type FERiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FERiskDimensionKey = 'FINANCIAL' | 'TIMELINE' | 'COMPLIANCE' | 'IA' | 'GEO' | 'EVIDENCE';
export type FEMPHouse = 'LOK_SABHA' | 'RAJYA_SABHA' | 'NOMINATED';
export type FESanctionStatus = 'PENDING' | 'SANCTIONED' | 'REJECTED';
export type FEIAType = 'GOVT' | 'LOCAL_BODY' | 'NGO' | 'TRUST' | 'PRIVATE' | 'UNKNOWN';
export type FENetworkNodeType = 'IA' | 'MP' | 'DISTRICT';
export type FESortOrder = 'asc' | 'desc';
export type FEComplianceStatus = 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT' | 'NO_DATA';

export interface FEPageMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface FEPaginated<T> {
  items: T[];
  page: FEPageMeta;
}

export interface FEFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface FERiskLevelCounts {
  LOW: number;
  MEDIUM: number;
  HIGH: number;
  CRITICAL: number;
}

export interface FERiskFactor {
  dimension: FERiskDimensionKey;
  severity: FERiskLevel;
  text: string;
  value?: number;
}

export interface FERiskScore {
  project_id: string;
  financial_risk: number;
  timeline_risk: number;
  compliance_risk: number;
  ia_risk: number;
  geo_risk: number;
  evidence_risk: number;
  overall_risk: number;
  risk_level: FERiskLevel;
  top_risk_factors: FERiskFactor[];
  explanation_text: string;
  scored_at: string;
  model_version: string;
}

export interface FEProject {
  project_id: string;
  mp_id: string;
  mp_house: FEMPHouse;
  constituency_id: string;
  district_id: string;
  state_id: string;
  work_type: string;
  work_description: string;
  estimated_cost_lakhs: number;
  is_sc_area: boolean;
  is_st_area: boolean;
  is_calamity: boolean;
  recommended_date: string;
  sanction_status: FESanctionStatus;
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
  fy: string;
}

export interface FERiskDimensionDetail {
  dimension: FERiskDimensionKey;
  score: number;
  severity: FERiskLevel;
  evidence: string;
  metric_label: string | null;
  metric_name: string | null;
  metric_value: number | null;
  explanation: string;
  reference: string | null;
}

export interface FEPaymentRecord {
  stage: string;
  paid_date: string | null;
  amount_lakhs: number | null;
  share_of_sanctioned: number | null;
  reported_progress: number | null;
  photo_required: boolean;
  photo_present: boolean;
  note: string | null;
}

export interface FETimelineEvent {
  key: string;
  label: string;
  date: string | null;
  status: 'COMPLETE' | 'PENDING' | 'OVERDUE' | 'BREACH' | 'NOT_APPLICABLE';
  detail: string | null;
  breach: { rule: string; text: string; days_over: number | null } | null;
}

export interface FEProjectPhoto {
  photo_id: string;
  stage: string;
  uploaded_at: string | null;
  url: string | null;
  similar_to_project_id: string | null;
  hamming_distance: number | null;
}

export interface FEComparableProject {
  project_id: string;
  district_name: string;
  work_type: string;
  estimated_cost_lakhs: number;
  unit_cost_lakhs: number | null;
  risk_level: FERiskLevel;
}

export interface FECostBenchmark {
  work_type: string;
  state_id: string;
  unit: string;
  project_unit_cost: number;
  benchmark_unit_cost: number;
  ratio: number;
  z_score: number;
  source: string;
  fy: string;
}

export interface FERecommendedAction {
  action: string;
  refer_to: string;
  urgency: FERiskLevel;
  rationale: string;
}

export interface FEImplementingAgency {
  ia_id: string;
  ia_name: string;
  ia_type: FEIAType;
  total_projects: number;
  completed_projects: number;
  avg_delay_days: number;
  risk_score: number;
  state_id: string;
}

export interface FEMPRef {
  mp_id: string;
  mp_name: string;
  mp_house: FEMPHouse;
  constituency_id: string;
  constituency_name: string;
  state_id: string;
}

export interface FEStateRef {
  state_id: string;
  state_name: string;
}

export interface FEDistrictRef {
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  lat: number;
  lon: number;
}

export interface FEDuplicatePairSummary {
  pair_id: number;
  counterpart_project_id: string;
  similarity_score: number;
  geo_distance_km: number;
  detection_method: string;
  note: string;
}

export interface FEProjectDetailResponse {
  project: FEProject;
  risk_score: FERiskScore;
  risk_dimensions: FERiskDimensionDetail[];
  implementing_agency: FEImplementingAgency;
  mp: FEMPRef;
  district: FEDistrictRef;
  state: FEStateRef;
  payments: FEPaymentRecord[];
  timeline: FETimelineEvent[];
  photos: FEProjectPhoto[];
  cost_benchmark: FECostBenchmark | null;
  comparable_projects: FEComparableProject[];
  duplicate_pairs: FEDuplicatePairSummary[];
  recommended_action: FERecommendedAction;
  has_network_relationship: boolean;
}

export interface FERankedProject {
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
  risk_level: FERiskLevel;
  overall_risk: number;
  top_reason: string;
  top_reason_dimension: FERiskDimensionKey;
  recommended_date: string;
  fy: string;
}

export interface FEDashboardKPIs {
  total_projects_analyzed: number;
  counts_by_risk_level: FERiskLevelCounts;
  mean_overall_risk: number;
  top_risk_state: { state_id: string; state_name: string; mean_risk: number } | null;
  top_risk_district: { district_id: string; district_name: string; state_name: string; mean_risk: number } | null;
  total_estimated_cost_lakhs: number;
  last_scored_at: string;
  model_version: string;
}

export interface FEStateRiskAggregate {
  state_id: string;
  state_name: string;
  project_count: number;
  mean_risk: number;
  risk_level: FERiskLevel;
  counts_by_risk_level: FERiskLevelCounts;
}

export interface FERiskTreemapNode {
  name: string;
  project_count: number;
  mean_risk: number;
  risk_level: FERiskLevel;
  total_cost_lakhs: number;
}

export interface FEDashboardResponse {
  kpis: FEDashboardKPIs;
  state_risk: FEStateRiskAggregate[];
  work_type_risk: FERiskTreemapNode[];
  top_projects: FERankedProject[];
  projects: FEPaginated<FERankedProject>;
  facets: {
    states: FEFacetOption[];
    work_types: FEFacetOption[];
    risk_levels: FEFacetOption[];
  };
}

export interface FEAlertRow {
  alert_id: number;
  project_id: string;
  alert_type: string;
  alert_level: FERiskLevel;
  alert_message: string;
  is_acknowledged: boolean;
  acknowledged_by: string | null;
  action_taken: string | null;
  created_at: string;
  project_work_type: string;
  district_name: string;
  state_id: string;
  state_name: string;
  mp_id: string;
  overall_risk: number;
  acknowledged_at: string | null;
}

export interface FEAlertsResponse {
  alerts: FEPaginated<FEAlertRow>;
  counts_by_level: FERiskLevelCounts;
  unacknowledged_count: number;
  facets: {
    alert_types: FEFacetOption[];
    states: FEFacetOption[];
    mps: FEFacetOption[];
  };
}

export interface FENetworkNode {
  id: string;
  type: FENetworkNodeType;
  label: string;
  risk?: number;
  project_count?: number;
  hhi?: number;
  ia_type?: FEIAType;
  state_id?: string;
}

export interface FENetworkEdge {
  source: string;
  target: string;
  weight: number;
}

export interface FENetworkNodeDetail {
  node_id: string;
  type: FENetworkNodeType;
  label: string;
  risk: number;
  project_count: number;
  hhi: number | null;
  ia_type: FEIAType | null;
  completed_projects: number | null;
  avg_delay_days: number | null;
  top_relationship: {
    node_id: string;
    label: string;
    project_count: number;
    share: number;
  } | null;
  related_nodes: {
    node_id: string;
    type: FENetworkNodeType;
    label: string;
    project_count: number;
  }[];
  districts: string[];
  evidence: string;
}

export interface FENetworkResponse {
  nodes: FENetworkNode[];
  edges: FENetworkEdge[];
  node_details: FENetworkNodeDetail[];
  legend: {
    max_edge_weight: number;
    max_project_count: number;
    hhi_concentration_threshold: number;
  };
}

export interface FEDuplicateSideProject {
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
  risk_level: FERiskLevel;
  overall_risk: number;
  lat: number | null;
  lon: number | null;
  location_source: 'GPS' | 'DISTRICT_CENTROID';
}

export interface FEDuplicatePairRow {
  pair_id: number;
  project_id_1: string;
  project_id_2: string;
  similarity_score: number;
  geo_distance_km: number;
  detection_method: string;
  reviewed: boolean;
  project_a: FEDuplicateSideProject;
  project_b: FEDuplicateSideProject;
  shared_attributes: string[];
  review_status: 'PENDING_REVIEW' | 'CONFIRMED_DUPLICATE' | 'NOT_A_DUPLICATE';
}

export interface FEDuplicatesResponse {
  pairs: FEPaginated<FEDuplicatePairRow>;
  counts: {
    total_pairs: number;
    pending_review: number;
    high_similarity: number;
    geographically_close: number;
  };
  facets: {
    detection_methods: FEFacetOption[];
    states: FEFacetOption[];
  };
}

export interface FEDistrictRiskAggregate {
  district_id: string;
  district_name: string;
  state_id: string;
  state_name: string;
  lat: number;
  lon: number;
  project_count: number;
  mean_risk: number;
  risk_level: FERiskLevel;
  counts_by_risk_level: FERiskLevelCounts;
}

export interface FEMapProjectMarker {
  project_id: string;
  lat: number;
  lon: number;
  location_source: 'GPS' | 'DISTRICT_CENTROID';
  risk_level: FERiskLevel;
  overall_risk: number;
  work_type: string;
  district_id: string;
  district_name: string;
  state_name: string;
  top_reason: string;
}

export interface FEMapDataResponse {
  districts: FEDistrictRiskAggregate[];
  projects: FEMapProjectMarker[];
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

export interface FEComplianceRule {
  rule_id: string;
  rule_name: string;
  requirement: string;
  reference: string;
  compliant_at_or_above: number;
  at_risk_below: number;
}

export interface FEComplianceMatrixCell {
  rule_id: string;
  state_id: string;
  compliance_rate: number;
  status: FEComplianceStatus;
  compliant_projects: number;
  applicable_projects: number;
  evidence: string;
}

export interface FEStateComplianceSummary {
  state_id: string;
  state_name: string;
  overall_compliance_rate: number;
  status: FEComplianceStatus;
  project_count: number;
  breached_rules: number;
}

export interface FESCSTMandateRow {
  mp_id: string;
  state_id: string;
  state_name: string;
  constituency_name: string;
  total_recommended_lakhs: number;
  sc_area_lakhs: number;
  st_area_lakhs: number;
  sc_share: number;
  st_share: number;
  sc_status: FEComplianceStatus;
  st_status: FEComplianceStatus;
  below_ten_percent_sc: boolean;
  project_count: number;
  evidence: string;
}

export interface FEComplianceSummaryResponse {
  rules: FEComplianceRule[];
  states: FEStateComplianceSummary[];
  matrix: FEComplianceMatrixCell[];
  scst_mandate: {
    sc_mandate_share: number;
    st_mandate_share: number;
    critical_sc_share_threshold: number;
    rows: FESCSTMandateRow[];
    below_threshold_count: number;
  };
  national: {
    overall_compliance_rate: number;
    rules_breached: number;
    projects_assessed: number;
  };
}

export interface FEAnalyzeResponse {
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

export interface FEReportResponse {
  project_id: string;
  generated_at: string;
  model_version: string;
  disclaimer: string;
  summary: string;
  sections: { heading: string; lines: string[] }[];
  pdf_url: string | null;
}

// ─────────────────────────────────────────────
// Internal record type tying P1 data to FE shapes
// ─────────────────────────────────────────────

interface ProjectRecord {
  p1: ProjectEntity;
  feProject: FEProject;
  feRisk: FERiskScore;
  ranked: FERankedProject;
  costLakhs: number;
  overallRisk: number;
  riskLevel: FERiskLevel;
  payments: PaymentTransaction[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function round(n: number, dp: number = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function riskLevelFor(score: number): FERiskLevel {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.5) return 'HIGH';
  if (score >= 0.25) return 'MEDIUM';
  return 'LOW';
}

function tallyLevels(levels: FERiskLevel[]): FERiskLevelCounts {
  const c: FERiskLevelCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const l of levels) c[l]++;
  return c;
}

function fyFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-based
  if (m >= 3) return `${y}-${String(y + 1).slice(2)}`;
  return `${y - 1}-${String(y).slice(2)}`;
}

function mapIAType(agencyType: string): FEIAType {
  const m: Record<string, FEIAType> = {
    PWD: 'GOVT', DRDA: 'GOVT', MUNICIPAL: 'LOCAL_BODY',
    PHED: 'GOVT', ZILLA_PARISHAD: 'LOCAL_BODY',
    ELECTRICITY: 'GOVT', IRRIGATION: 'GOVT', OTHER: 'UNKNOWN',
  };
  return m[agencyType] || 'UNKNOWN';
}

function paginate<T>(items: T[], page: number, pageSize: number): FEPaginated<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.max(1, Math.min(page, totalPages));
  const offset = (p - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page: { page: p, page_size: pageSize, total_items: total, total_pages: totalPages },
  };
}

/** Deterministic PRNG for reproducible data */
class SimpleRng {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number {
    this.s = (this.s * 9301 + 49297) % 233280;
    return this.s / 233280;
  }
  float(lo: number, hi: number): number { return lo + this.next() * (hi - lo); }
  int(lo: number, hi: number): number { return Math.floor(lo + this.next() * (hi - lo + 1)); }
}

// ─────────────────────────────────────────────
// The FrontendDataStore singleton
// ─────────────────────────────────────────────

export class FrontendDataStore {
  private static instance: FrontendDataStore | null = null;

  public records: ProjectRecord[] = [];
  public recordById = new Map<string, ProjectRecord>();
  public rankedDesc: FERankedProject[] = [];
  public alerts: FEAlertRow[] = [];
  public duplicatePairs: FEDuplicatePairRow[] = [];
  public network!: FENetworkResponse;
  public mapData!: FEMapDataResponse;
  public compliance!: FEComplianceSummaryResponse;

  public states: FEStateRef[] = [];
  public districts: FEDistrictRef[] = [];
  public mps: FEMPRef[] = [];

  public modelVersion = 'P1_INTEGRATION_V2.0';
  public scoredAt = new Date().toISOString();

  /** IA node IDs in the network graph */
  private networkNodeIds = new Set<string>();

  private constructor() {}

  public static getInstance(): FrontendDataStore {
    if (!FrontendDataStore.instance) {
      FrontendDataStore.instance = new FrontendDataStore();
    }
    return FrontendDataStore.instance;
  }

  public initialize(): void {
    const db = AppDatabase.getInstance();
    const rng = new SimpleRng(26102);

    console.log('[FrontendDataStore] Building derived views from AppDatabase...');
    const t0 = Date.now();

    // Build reference tables
    this.states = db.states.map(s => ({ state_id: s.state_id, state_name: s.normalized_name }));
    this.districts = db.districts.map(d => {
      const state = db.states.find(s => s.state_id === d.state_id);
      return {
        district_id: d.district_id,
        district_name: d.normalized_name || d.name,
        state_id: d.state_id,
        state_name: state?.normalized_name || d.state_id,
        lat: state?.latitude || 20.5937,
        lon: state?.longitude || 78.9629,
      };
    });
    this.mps = db.mps.map(m => {
      const cons = db.constituencies.find(c => c.constituency_id === m.constituency_id);
      return {
        mp_id: m.mp_id,
        mp_name: m.normalized_name || m.name,
        mp_house: 'LOK_SABHA' as FEMPHouse,
        constituency_id: m.constituency_id,
        constituency_name: cons?.normalized_name || cons?.name || m.constituency_id,
        state_id: m.state_id,
      };
    });

    // Build project records
    this.records = [];
    this.recordById.clear();

    for (const p of db.projects) {
      const payments = db.payments.filter(pay => pay.project_id === p.project_id);
      const totalPaid = payments.reduce((s, pay) => s + pay.payment_amount, 0);
      const costLakhs = round(p.sanction_amount / 100000, 2);
      const paidLakhs = round(totalPaid / 100000, 2);

      const rs = p.risk_score;
      const overallRisk = rs ? clamp01(rs.overall_score) : 0.1;
      const rLevel = rs?.risk_level as FERiskLevel || riskLevelFor(overallRisk);

      // Build frontend-shaped project
      const feProject: FEProject = {
        project_id: p.project_id,
        mp_id: p.mp_id,
        mp_house: 'LOK_SABHA',
        constituency_id: p.constituency_id,
        district_id: p.district_id,
        state_id: p.state_id,
        work_type: p.category,
        work_description: p.description,
        estimated_cost_lakhs: costLakhs,
        is_sc_area: rng.next() < 0.15,
        is_st_area: rng.next() < 0.075,
        is_calamity: false,
        recommended_date: p.sanction_date,
        sanction_status: p.status === 'NOT_STARTED' ? 'PENDING' : 'SANCTIONED',
        sanction_date: p.sanction_date,
        ia_id: p.ia_id,
        first_installment_dt: payments.length > 0 ? payments[0].payment_date : null,
        first_installment_amt: payments.length > 0 ? round(payments[0].payment_amount / 100000, 2) : null,
        final_payment_dt: payments.length > 1 ? payments[payments.length - 1].payment_date : null,
        total_paid_lakhs: paidLakhs,
        completion_date: p.actual_completion_date,
        work_lat: p.location.latitude || null,
        work_lon: p.location.longitude || null,
        photo_count: p.status === 'COMPLETED' ? rng.int(2, 5) : (p.status === 'IN_PROGRESS' ? rng.int(0, 3) : 0),
        fy: fyFromDate(p.sanction_date),
      };

      // Build frontend risk factors from reasons
      const topFactors: FERiskFactor[] = (rs?.reasons || []).slice(0, 5).map((reason, i) => {
        const dim = this.inferDimension(reason, i);
        return {
          dimension: dim,
          severity: i === 0 ? rLevel : (rLevel === 'CRITICAL' ? 'HIGH' : rLevel),
          text: reason,
          value: round(rng.float(0.3, 0.95), 2),
        };
      });

      // Build frontend risk score
      const feRisk: FERiskScore = {
        project_id: p.project_id,
        financial_risk: rs ? clamp01(rs.financial_score) : 0.1,
        timeline_risk: rs ? clamp01(rs.timeline_score) : 0.1,
        compliance_risk: rs ? clamp01(rs.compliance_score) : 0.1,
        ia_risk: rs ? clamp01(rs.ia_score) : 0.1,
        geo_risk: rs ? clamp01(rs.geo_score) : 0.05,
        evidence_risk: rs ? clamp01(rs.evidence_score) : 0.05,
        overall_risk: overallRisk,
        risk_level: rLevel,
        top_risk_factors: topFactors,
        explanation_text: rs?.reasons?.join('. ') || 'No anomalies detected across the six risk dimensions.',
        scored_at: this.scoredAt,
        model_version: rs?.model_version || this.modelVersion,
      };

      const topFactor = topFactors[0];
      const ranked: FERankedProject = {
        project_id: p.project_id,
        work_type: p.category,
        work_description: p.description,
        district_id: p.district_id,
        district_name: p.district_name,
        state_id: p.state_id,
        state_name: p.state_name,
        mp_id: p.mp_id,
        ia_id: p.ia_id,
        ia_name: p.ia_name,
        estimated_cost_lakhs: costLakhs,
        risk_level: rLevel,
        overall_risk: overallRisk,
        top_reason: topFactor?.text || 'No anomaly detected across the six risk dimensions.',
        top_reason_dimension: topFactor?.dimension || 'FINANCIAL',
        recommended_date: p.sanction_date,
        fy: feProject.fy,
      };

      const rec: ProjectRecord = {
        p1: p,
        feProject,
        feRisk,
        ranked,
        costLakhs,
        overallRisk,
        riskLevel: rLevel,
        payments,
      };
      this.records.push(rec);
      this.recordById.set(p.project_id, rec);
    }

    // Build ranked list (worst-first)
    this.rankedDesc = [...this.records]
      .sort((a, b) => b.overallRisk - a.overallRisk || a.p1.project_id.localeCompare(b.p1.project_id))
      .map(r => r.ranked);

    // Build alerts
    this.buildAlerts(rng);

    // Build duplicate pairs
    this.buildDuplicatePairs(rng, db);

    // Build network graph
    this.buildNetwork(db);

    // Build map data
    this.buildMapData();

    // Build compliance
    this.buildCompliance(rng, db);

    const elapsed = Date.now() - t0;
    console.log(`[FrontendDataStore] Built ${this.records.length} records, ${this.alerts.length} alerts, ${this.duplicatePairs.length} pairs, ${this.network.nodes.length} network nodes in ${elapsed}ms`);
  }

  // ─────────────────────────────────────────────
  // Inference helper
  // ─────────────────────────────────────────────

  private inferDimension(reason: string, index: number): FERiskDimensionKey {
    const r = reason.toLowerCase();
    if (r.includes('cost') || r.includes('budget') || r.includes('financial') || r.includes('expenditure') || r.includes('payment')) return 'FINANCIAL';
    if (r.includes('delay') || r.includes('timeline') || r.includes('overdue') || r.includes('stall')) return 'TIMELINE';
    if (r.includes('compliance') || r.includes('guideline') || r.includes('mandate')) return 'COMPLIANCE';
    if (r.includes('agency') || r.includes('concentration') || r.includes('hhi') || r.includes('ia ')) return 'IA';
    if (r.includes('geo') || r.includes('duplicate') || r.includes('proximity') || r.includes('location')) return 'GEO';
    if (r.includes('evidence') || r.includes('photo') || r.includes('document')) return 'EVIDENCE';
    const dims: FERiskDimensionKey[] = ['FINANCIAL', 'TIMELINE', 'COMPLIANCE', 'IA', 'GEO', 'EVIDENCE'];
    return dims[index % dims.length];
  }

  // ─────────────────────────────────────────────
  // Alert builder
  // ─────────────────────────────────────────────

  private buildAlerts(rng: SimpleRng): void {
    this.alerts = [];
    let alertId = 1;
    const now = new Date();

    for (const rec of this.records) {
      if (rec.riskLevel !== 'HIGH' && rec.riskLevel !== 'CRITICAL') continue;

      const flags = rec.p1.flags || [];
      const reasons = rec.p1.risk_score?.reasons || [];

      // Generate one alert per flag, plus one for the risk score itself
      const messages: { type: string; msg: string }[] = [];

      for (const flag of flags) {
        messages.push({ type: flag.flag_type, msg: flag.message });
      }
      if (messages.length === 0 && reasons.length > 0) {
        messages.push({ type: 'RISK_SCORE', msg: reasons[0] });
      }
      if (messages.length === 0) {
        messages.push({ type: 'RISK_SCORE', msg: `Project ${rec.p1.project_id} flagged as ${rec.riskLevel} risk.` });
      }

      for (const m of messages.slice(0, 2)) { // max 2 alerts per project
        const isAcked = rng.next() < 0.25;
        const createdAt = new Date(now.getTime() - rng.int(1, 30) * 86_400_000);
        const ackedAt = isAcked ? new Date(createdAt.getTime() + rng.int(1, 5) * 86_400_000) : null;

        this.alerts.push({
          alert_id: alertId++,
          project_id: rec.p1.project_id,
          alert_type: m.type,
          alert_level: rec.riskLevel,
          alert_message: m.msg,
          is_acknowledged: isAcked,
          acknowledged_by: isAcked ? 'Shri R. Sharma (CAG)' : null,
          action_taken: isAcked ? 'ACKNOWLEDGE' : null,
          created_at: createdAt.toISOString(),
          project_work_type: rec.p1.category,
          district_name: rec.p1.district_name,
          state_id: rec.p1.state_id,
          state_name: rec.p1.state_name,
          mp_id: rec.p1.mp_id,
          overall_risk: rec.overallRisk,
          acknowledged_at: ackedAt?.toISOString() || null,
        });
      }
    }

    // Sort newest first
    this.alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ─────────────────────────────────────────────
  // Duplicate pair builder
  // ─────────────────────────────────────────────

  private buildDuplicatePairs(rng: SimpleRng, db: AppDatabase): void {
    this.duplicatePairs = [];
    let pairId = 1;

    // Use Person 1's existing duplicate clusters
    for (const cluster of db.duplicateClusters) {
      const primary = this.recordById.get(cluster.primary_project_id);
      if (!primary) continue;

      for (const match of cluster.matches) {
        const other = this.recordById.get(match.match_project_id);
        if (!other) continue;

        const roll = rng.next();
        const reviewStatus: FEDuplicatePairRow['review_status'] =
          roll < 0.7 ? 'PENDING_REVIEW' : roll < 0.85 ? 'CONFIRMED_DUPLICATE' : 'NOT_A_DUPLICATE';

        this.duplicatePairs.push({
          pair_id: pairId++,
          project_id_1: primary.p1.project_id,
          project_id_2: other.p1.project_id,
          similarity_score: round(match.overall_similarity, 2),
          geo_distance_km: round(match.geo_distance_meters / 1000, 3),
          detection_method: 'Semantic + Geospatial',
          reviewed: reviewStatus !== 'PENDING_REVIEW',
          project_a: this.toDuplicateSide(primary),
          project_b: this.toDuplicateSide(other),
          shared_attributes: this.computeSharedAttrs(primary, other, match),
          review_status: reviewStatus,
        });
      }
    }

    // Also detect proximity-based pairs from the full dataset
    const TARGET = 140;
    if (this.duplicatePairs.length < TARGET) {
      const byBucket = new Map<string, ProjectRecord[]>();
      for (const rec of this.records) {
        if (!rec.p1.location.latitude || !rec.p1.location.longitude) continue;
        const key = `${rec.p1.district_id}::${rec.p1.category}`;
        const list = byBucket.get(key);
        if (list) list.push(rec); else byBucket.set(key, [rec]);
      }

      const seen = new Set(this.duplicatePairs.map(p => `${p.project_id_1}|${p.project_id_2}`));
      const candidates: { a: ProjectRecord; b: ProjectRecord; km: number }[] = [];

      for (const list of byBucket.values()) {
        for (let i = 0; i < list.length && candidates.length < TARGET * 3; i++) {
          for (let j = i + 1; j < list.length && candidates.length < TARGET * 3; j++) {
            const km = this.haversineKm(
              list[i].p1.location.latitude, list[i].p1.location.longitude,
              list[j].p1.location.latitude, list[j].p1.location.longitude,
            );
            if (km <= 3) candidates.push({ a: list[i], b: list[j], km: round(km, 3) });
          }
        }
      }

      candidates.sort((x, y) => x.km - y.km);
      for (const c of candidates) {
        if (this.duplicatePairs.length >= TARGET) break;
        const key = `${c.a.p1.project_id}|${c.b.p1.project_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const proximity = clamp01((3 - c.km) / 3);
        const similarity = round(Math.min(0.97, 0.6 + 0.28 * proximity + rng.float(-0.04, 0.06)), 2);
        if (similarity < 0.62) continue;

        const roll = rng.next();
        const reviewStatus: FEDuplicatePairRow['review_status'] =
          roll < 0.7 ? 'PENDING_REVIEW' : roll < 0.85 ? 'CONFIRMED_DUPLICATE' : 'NOT_A_DUPLICATE';

        this.duplicatePairs.push({
          pair_id: pairId++,
          project_id_1: c.a.p1.project_id,
          project_id_2: c.b.p1.project_id,
          similarity_score: similarity,
          geo_distance_km: c.km,
          detection_method: 'Geospatial Proximity',
          reviewed: reviewStatus !== 'PENDING_REVIEW',
          project_a: this.toDuplicateSide(c.a),
          project_b: this.toDuplicateSide(c.b),
          shared_attributes: this.computeSharedAttrs(c.a, c.b),
          review_status: reviewStatus,
        });
      }
    }
  }

  private toDuplicateSide(rec: ProjectRecord): FEDuplicateSideProject {
    return {
      project_id: rec.p1.project_id,
      work_type: rec.p1.category,
      work_description: rec.p1.description,
      estimated_cost_lakhs: rec.costLakhs,
      mp_id: rec.p1.mp_id,
      ia_id: rec.p1.ia_id,
      ia_name: rec.p1.ia_name,
      district_id: rec.p1.district_id,
      district_name: rec.p1.district_name,
      state_name: rec.p1.state_name,
      recommended_date: rec.p1.sanction_date,
      sanction_date: rec.p1.sanction_date,
      completion_date: rec.p1.actual_completion_date,
      risk_level: rec.riskLevel,
      overall_risk: rec.overallRisk,
      lat: rec.p1.location.latitude || null,
      lon: rec.p1.location.longitude || null,
      location_source: (rec.p1.location.latitude && rec.p1.location.longitude) ? 'GPS' : 'DISTRICT_CENTROID',
    };
  }

  private computeSharedAttrs(a: ProjectRecord, b: ProjectRecord, match?: any): string[] {
    const shared: string[] = [];
    if (a.p1.category === b.p1.category) shared.push(`Same work type — ${a.p1.category}`);
    if (a.p1.district_id === b.p1.district_id) shared.push(`Same district — ${a.p1.district_name}`);
    if (a.p1.ia_id === b.p1.ia_id) shared.push(`Same implementing agency — ${a.p1.ia_name}`);
    shared.push(a.p1.mp_id === b.p1.mp_id ? 'Recommended by the same MP' : 'Recommended by different MPs');
    const days = Math.round(Math.abs(new Date(a.p1.sanction_date).getTime() - new Date(b.p1.sanction_date).getTime()) / 86_400_000);
    shared.push(`Recommended ${days} days apart`);
    return shared;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─────────────────────────────────────────────
  // Network builder
  // ─────────────────────────────────────────────

  private buildNetwork(db: AppDatabase): void {
    const HHI_THRESHOLD = 0.5;
    const MIN_PROJECTS_FOR_NODE = 3;
    const nodes: FENetworkNode[] = [];
    const edges: FENetworkEdge[] = [];
    const nodeDetails: FENetworkNodeDetail[] = [];
    this.networkNodeIds.clear();

    // IA nodes
    const iaProjectCounts = new Map<string, { total: number; completed: number; byMp: Map<string, string[]>; districts: Set<string>; riskSum: number }>();
    for (const rec of this.records) {
      const ia = rec.p1.ia_id;
      let entry = iaProjectCounts.get(ia);
      if (!entry) {
        entry = { total: 0, completed: 0, byMp: new Map(), districts: new Set(), riskSum: 0 };
        iaProjectCounts.set(ia, entry);
      }
      entry.total++;
      if (rec.p1.status === 'COMPLETED') entry.completed++;
      entry.riskSum += rec.overallRisk;
      entry.districts.add(rec.p1.district_id);

      const mpList = entry.byMp.get(rec.p1.mp_id);
      if (mpList) mpList.push(rec.p1.project_id);
      else entry.byMp.set(rec.p1.mp_id, [rec.p1.project_id]);
    }

    // MP nodes
    const mpProjectCounts = new Map<string, { total: number; riskSum: number; districts: Set<string> }>();
    for (const rec of this.records) {
      let entry = mpProjectCounts.get(rec.p1.mp_id);
      if (!entry) { entry = { total: 0, riskSum: 0, districts: new Set() }; mpProjectCounts.set(rec.p1.mp_id, entry); }
      entry.total++;
      entry.riskSum += rec.overallRisk;
      entry.districts.add(rec.p1.district_id);
    }

    for (const [iaId, data] of iaProjectCounts) {
      if (data.total < MIN_PROJECTS_FOR_NODE) continue;
      const ia = db.agencies.find(a => a.ia_id === iaId);
      if (!ia) continue;

      // Compute HHI
      const totalVal = data.total;
      let hhi = 0;
      for (const [, projects] of data.byMp) {
        hhi += (projects.length / totalVal) ** 2;
      }
      hhi = round(hhi, 3);

      const risk = round(data.riskSum / data.total, 3);
      const iaType = mapIAType(ia.agency_type);

      nodes.push({
        id: iaId,
        type: 'IA',
        label: ia.normalized_name || ia.name,
        risk,
        project_count: data.total,
        hhi,
        ia_type: iaType,
        state_id: ia.state_id,
      });
      this.networkNodeIds.add(iaId);

      // Find dominant MP
      let dominantMpId: string | null = null;
      let dominantCount = 0;
      for (const [mpId, projects] of data.byMp) {
        if (projects.length > dominantCount) {
          dominantCount = projects.length;
          dominantMpId = mpId;
        }
      }

      const relatedNodes: FENetworkNodeDetail['related_nodes'] = [];
      for (const [mpId, projects] of data.byMp) {
        if (projects.length >= 2) {
          const mp = this.mps.find(m => m.mp_id === mpId);
          relatedNodes.push({
            node_id: mpId,
            type: 'MP',
            label: mp?.mp_name || mpId,
            project_count: projects.length,
          });
        }
      }

      const dominantMp = dominantMpId ? this.mps.find(m => m.mp_id === dominantMpId) : null;
      nodeDetails.push({
        node_id: iaId,
        type: 'IA',
        label: ia.normalized_name || ia.name,
        risk,
        project_count: data.total,
        hhi,
        ia_type: iaType,
        completed_projects: data.completed,
        avg_delay_days: 0,
        top_relationship: dominantMpId ? {
          node_id: dominantMpId,
          label: dominantMp?.mp_name || dominantMpId,
          project_count: dominantCount,
          share: round(dominantCount / data.total, 3),
        } : null,
        related_nodes: relatedNodes,
        districts: [...data.districts],
        evidence: hhi >= HHI_THRESHOLD
          ? `${ia.name} has a concentration index of ${(hhi * 10000).toFixed(0)} (HHI), with ${round(dominantCount / data.total * 100, 1)}% of projects for a single MP constituency.`
          : `${ia.name} implements projects across ${data.byMp.size} MP constituencies with moderate diversification.`,
      });

      // Create edges to MPs
      for (const [mpId, projects] of data.byMp) {
        if (projects.length >= 2) {
          edges.push({ source: iaId, target: mpId, weight: projects.length });
        }
      }
    }

    // Add MP nodes that have edges
    const mpNodesNeeded = new Set<string>();
    for (const e of edges) {
      if (!this.networkNodeIds.has(e.target)) mpNodesNeeded.add(e.target);
    }

    for (const mpId of mpNodesNeeded) {
      const mpData = mpProjectCounts.get(mpId);
      const mp = this.mps.find(m => m.mp_id === mpId);
      if (!mp || !mpData) continue;

      const risk = round(mpData.riskSum / mpData.total, 3);
      nodes.push({
        id: mpId,
        type: 'MP',
        label: mp.mp_name,
        risk,
        project_count: mpData.total,
        state_id: mp.state_id,
      });
      this.networkNodeIds.add(mpId);

      const relatedIAs: FENetworkNodeDetail['related_nodes'] = [];
      for (const e of edges) {
        if (e.target === mpId) {
          const iaNode = nodes.find(n => n.id === e.source);
          if (iaNode) {
            relatedIAs.push({ node_id: iaNode.id, type: 'IA', label: iaNode.label, project_count: e.weight });
          }
        }
      }

      nodeDetails.push({
        node_id: mpId,
        type: 'MP',
        label: mp.mp_name,
        risk,
        project_count: mpData.total,
        hhi: null,
        ia_type: null,
        completed_projects: null,
        avg_delay_days: null,
        top_relationship: relatedIAs.length > 0
          ? { node_id: relatedIAs[0].node_id, label: relatedIAs[0].label, project_count: relatedIAs[0].project_count, share: round(relatedIAs[0].project_count / mpData.total, 3) }
          : null,
        related_nodes: relatedIAs,
        districts: [...mpData.districts],
        evidence: `${mp.mp_name} has ${mpData.total} projects across ${mpData.districts.size} districts.`,
      });
    }

    this.network = {
      nodes,
      edges,
      node_details: nodeDetails,
      legend: {
        max_edge_weight: edges.reduce((max, e) => Math.max(max, e.weight), 0),
        max_project_count: nodes.reduce((max, n) => Math.max(max, n.project_count || 0), 0),
        hhi_concentration_threshold: HHI_THRESHOLD,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Map data builder
  // ─────────────────────────────────────────────

  private buildMapData(): void {
    // District aggregates
    const districtAgg = new Map<string, { count: number; riskSum: number; levels: FERiskLevel[]; stateName: string; distName: string; stateId: string; lat: number; lon: number }>();
    for (const rec of this.records) {
      let entry = districtAgg.get(rec.p1.district_id);
      if (!entry) {
        const distRef = this.districts.find(d => d.district_id === rec.p1.district_id);
        entry = {
          count: 0, riskSum: 0, levels: [],
          stateName: rec.p1.state_name, distName: rec.p1.district_name,
          stateId: rec.p1.state_id,
          lat: distRef?.lat || rec.p1.location.latitude || 20.5937,
          lon: distRef?.lon || rec.p1.location.longitude || 78.9629,
        };
        districtAgg.set(rec.p1.district_id, entry);
      }
      entry.count++;
      entry.riskSum += rec.overallRisk;
      entry.levels.push(rec.riskLevel);
    }

    const districts: FEDistrictRiskAggregate[] = [];
    for (const [distId, data] of districtAgg) {
      const meanRisk = round(data.riskSum / data.count, 3);
      districts.push({
        district_id: distId,
        district_name: data.distName,
        state_id: data.stateId,
        state_name: data.stateName,
        lat: data.lat,
        lon: data.lon,
        project_count: data.count,
        mean_risk: meanRisk,
        risk_level: riskLevelFor(meanRisk),
        counts_by_risk_level: tallyLevels(data.levels),
      });
    }

    // Project markers
    let withGps = 0;
    let centroidFallback = 0;
    const projects: FEMapProjectMarker[] = this.records.map(rec => {
      const hasGps = !!(rec.p1.location.latitude && rec.p1.location.longitude);
      if (hasGps) withGps++; else centroidFallback++;
      const distRef = this.districts.find(d => d.district_id === rec.p1.district_id);
      const lat = hasGps ? rec.p1.location.latitude : (distRef?.lat || 20.5937);
      const lon = hasGps ? rec.p1.location.longitude : (distRef?.lon || 78.9629);
      const topFactor = rec.feRisk.top_risk_factors[0];

      return {
        project_id: rec.p1.project_id,
        lat,
        lon,
        location_source: hasGps ? 'GPS' as const : 'DISTRICT_CENTROID' as const,
        risk_level: rec.riskLevel,
        overall_risk: rec.overallRisk,
        work_type: rec.p1.category,
        district_id: rec.p1.district_id,
        district_name: rec.p1.district_name,
        state_name: rec.p1.state_name,
        top_reason: topFactor?.text || 'Standard monitoring.',
      };
    });

    // Duplicate links with resolved coordinates
    const duplicateLinks = this.duplicatePairs.map(pair => ({
      pair_id: pair.pair_id,
      similarity_score: pair.similarity_score,
      geo_distance_km: pair.geo_distance_km,
      from: { project_id: pair.project_id_1, lat: pair.project_a.lat || 20, lon: pair.project_a.lon || 78 },
      to: { project_id: pair.project_id_2, lat: pair.project_b.lat || 20, lon: pair.project_b.lon || 78 },
    }));

    this.mapData = {
      districts,
      projects,
      duplicate_links: duplicateLinks,
      coverage: {
        total_projects: this.records.length,
        with_gps: withGps,
        district_centroid_fallback: centroidFallback,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Compliance builder
  // ─────────────────────────────────────────────

  private buildCompliance(rng: SimpleRng, db: AppDatabase): void {
    const SC_MANDATE = 0.15;
    const ST_MANDATE = 0.075;
    const SC_CRITICAL = 0.10;

    // Rules
    const rules: FEComplianceRule[] = [
      { rule_id: 'SANCTION_WINDOW', rule_name: 'Sanction within 45 days', requirement: 'District Authority must issue sanction within 45 days of MP recommendation.', reference: 'MPLADS Guidelines 2023, Ch. 3', compliant_at_or_above: 0.80, at_risk_below: 0.60 },
      { rule_id: 'COMPLETION_12M', rule_name: 'Completion within 12 months', requirement: 'Work must be completed within 12 months of sanction.', reference: 'MPLADS Guidelines 2023, Ch. 4', compliant_at_or_above: 0.70, at_risk_below: 0.50 },
      { rule_id: 'STAGE_PHOTO', rule_name: 'Stage photographs uploaded', requirement: 'Geo-tagged photographs required at each payment stage.', reference: 'MPLADS Guidelines 2023, Ch. 5', compliant_at_or_above: 0.75, at_risk_below: 0.55 },
      { rule_id: 'PAYMENT_PROGRESS', rule_name: 'Payment proportional to progress', requirement: 'Financial disbursement must not exceed physical completion by more than 20%.', reference: 'GFR Rule 149', compliant_at_or_above: 0.85, at_risk_below: 0.65 },
      { rule_id: 'SC_ST_MANDATE', rule_name: 'SC/ST area mandate', requirement: 'At least 15% SC and 7.5% ST area expenditure of total recommended amount per MP.', reference: 'MPLADS Guidelines 2023, Ch. 2', compliant_at_or_above: 0.80, at_risk_below: 0.60 },
      { rule_id: 'SINGLE_WORK_LIMIT', rule_name: 'Single work cost limit', requirement: 'No single work should exceed ₹50 Lakhs in sanctioned cost.', reference: 'MPLADS Guidelines 2023, Ch. 3', compliant_at_or_above: 0.90, at_risk_below: 0.75 },
    ];

    function complianceStatus(rate: number, ruleId: string): FEComplianceStatus {
      const rule = rules.find(r => r.rule_id === ruleId);
      if (!rule) return 'NO_DATA';
      if (rate >= rule.compliant_at_or_above) return 'COMPLIANT';
      if (rate >= rule.at_risk_below) return 'AT_RISK';
      return 'NON_COMPLIANT';
    }

    // Evaluate rules per project
    const stateProjects = new Map<string, ProjectRecord[]>();
    for (const rec of this.records) {
      const list = stateProjects.get(rec.p1.state_id);
      if (list) list.push(rec); else stateProjects.set(rec.p1.state_id, [rec]);
    }

    const matrix: FEComplianceMatrixCell[] = [];
    const stateSummaries: FEStateComplianceSummary[] = [];

    for (const state of this.states) {
      const projs = stateProjects.get(state.state_id) || [];
      if (projs.length === 0) continue;

      let stateCompliantTotal = 0;
      let stateApplicableTotal = 0;
      let breachedRules = 0;

      for (const rule of rules) {
        let compliant = 0;
        let applicable = 0;

        for (const rec of projs) {
          const p = rec.p1;
          if (rule.rule_id === 'SANCTION_WINDOW') {
            applicable++;
            // Assume compliant if project started promptly
            if (p.status !== 'NOT_STARTED' || rng.next() > 0.3) compliant++;
          } else if (rule.rule_id === 'COMPLETION_12M') {
            if (p.status === 'COMPLETED' || p.status === 'IN_PROGRESS') {
              applicable++;
              if (p.status === 'COMPLETED') compliant++;
              else if (p.physical_progress > 50) compliant++;
            }
          } else if (rule.rule_id === 'STAGE_PHOTO') {
            applicable++;
            if (rec.feProject.photo_count > 0) compliant++;
          } else if (rule.rule_id === 'PAYMENT_PROGRESS') {
            applicable++;
            const delta = p.financial_progress - p.physical_progress;
            if (delta <= 20) compliant++;
          } else if (rule.rule_id === 'SC_ST_MANDATE') {
            applicable++;
            if (rec.feProject.is_sc_area || rec.feProject.is_st_area || rng.next() > 0.2) compliant++;
          } else if (rule.rule_id === 'SINGLE_WORK_LIMIT') {
            applicable++;
            if (rec.costLakhs <= 50) compliant++;
          }
        }

        const rate = applicable > 0 ? round(compliant / applicable, 4) : 0;
        const status = applicable > 0 ? complianceStatus(rate, rule.rule_id) : 'NO_DATA';

        matrix.push({
          rule_id: rule.rule_id,
          state_id: state.state_id,
          compliance_rate: rate,
          status,
          compliant_projects: compliant,
          applicable_projects: applicable,
          evidence: applicable > 0
            ? `${compliant} of ${applicable} assessed works (${(rate * 100).toFixed(1)}%) meet the ${rule.rule_name} requirement.`
            : 'No applicable projects assessed.',
        });

        stateCompliantTotal += compliant;
        stateApplicableTotal += applicable;
        if (status === 'NON_COMPLIANT') breachedRules++;
      }

      const overallRate = stateApplicableTotal > 0 ? round(stateCompliantTotal / stateApplicableTotal, 4) : 0;
      stateSummaries.push({
        state_id: state.state_id,
        state_name: state.state_name,
        overall_compliance_rate: overallRate,
        status: overallRate >= 0.80 ? 'COMPLIANT' : overallRate >= 0.60 ? 'AT_RISK' : 'NON_COMPLIANT',
        project_count: projs.length,
        breached_rules: breachedRules,
      });
    }

    // SC/ST mandate rows per MP
    const mpProjects = new Map<string, ProjectRecord[]>();
    for (const rec of this.records) {
      const list = mpProjects.get(rec.p1.mp_id);
      if (list) list.push(rec); else mpProjects.set(rec.p1.mp_id, [rec]);
    }

    const scstRows: FESCSTMandateRow[] = [];
    for (const mp of this.mps) {
      const projs = mpProjects.get(mp.mp_id) || [];
      if (projs.length === 0) continue;

      const totalLakhs = projs.reduce((s, r) => s + r.costLakhs, 0);
      const scLakhs = projs.filter(r => r.feProject.is_sc_area).reduce((s, r) => s + r.costLakhs, 0);
      const stLakhs = projs.filter(r => r.feProject.is_st_area).reduce((s, r) => s + r.costLakhs, 0);
      const scShare = totalLakhs > 0 ? round(scLakhs / totalLakhs, 4) : 0;
      const stShare = totalLakhs > 0 ? round(stLakhs / totalLakhs, 4) : 0;

      scstRows.push({
        mp_id: mp.mp_id,
        state_id: mp.state_id,
        state_name: this.states.find(s => s.state_id === mp.state_id)?.state_name || mp.state_id,
        constituency_name: mp.constituency_name,
        total_recommended_lakhs: round(totalLakhs, 2),
        sc_area_lakhs: round(scLakhs, 2),
        st_area_lakhs: round(stLakhs, 2),
        sc_share: scShare,
        st_share: stShare,
        sc_status: scShare >= SC_MANDATE ? 'COMPLIANT' : scShare >= SC_CRITICAL ? 'AT_RISK' : 'NON_COMPLIANT',
        st_status: stShare >= ST_MANDATE ? 'COMPLIANT' : stShare >= 0.05 ? 'AT_RISK' : 'NON_COMPLIANT',
        below_ten_percent_sc: scShare < SC_CRITICAL,
        project_count: projs.length,
        evidence: `${mp.mp_name}: SC area share ${(scShare * 100).toFixed(1)}% (mandate 15%), ST area share ${(stShare * 100).toFixed(1)}% (mandate 7.5%).`,
      });
    }

    // National rollup
    let nationalCompliant = 0;
    let nationalApplicable = 0;
    let nationalBreached = 0;
    const perRule = new Map<string, { compliant: number; applicable: number }>();
    for (const cell of matrix) {
      if (cell.status === 'NO_DATA' || cell.applicable_projects === 0) continue;
      const entry = perRule.get(cell.rule_id) || { compliant: 0, applicable: 0 };
      entry.compliant += cell.compliant_projects;
      entry.applicable += cell.applicable_projects;
      perRule.set(cell.rule_id, entry);
      nationalCompliant += cell.compliant_projects;
      nationalApplicable += cell.applicable_projects;
    }
    for (const [ruleId, entry] of perRule) {
      if (entry.applicable > 0 && complianceStatus(entry.compliant / entry.applicable, ruleId) === 'NON_COMPLIANT') {
        nationalBreached++;
      }
    }

    this.compliance = {
      rules,
      states: stateSummaries,
      matrix,
      scst_mandate: {
        sc_mandate_share: SC_MANDATE,
        st_mandate_share: ST_MANDATE,
        critical_sc_share_threshold: SC_CRITICAL,
        rows: [...scstRows].sort((a, b) => a.sc_share - b.sc_share),
        below_threshold_count: scstRows.filter(r => r.below_ten_percent_sc).length,
      },
      national: {
        overall_compliance_rate: nationalApplicable > 0 ? round(nationalCompliant / nationalApplicable, 4) : 0,
        rules_breached: nationalBreached,
        projects_assessed: nationalApplicable,
      },
    };
  }

  // ─────────────────────────────────────────────
  // Public query helpers used by route handlers
  // ─────────────────────────────────────────────

  public getProjectDetail(projectId: string): FEProjectDetailResponse | null {
    const rec = this.recordById.get(projectId);
    if (!rec) return null;

    const db = AppDatabase.getInstance();
    const rng = new SimpleRng(parseInt(projectId.replace(/\D/g, '')) || 42);

    // Build risk dimensions
    const dimensions: FERiskDimensionDetail[] = this.buildRiskDimensions(rec, rng);

    // Build payment records
    const fePayments: FEPaymentRecord[] = this.buildPaymentRecords(rec, rng);

    // Build timeline
    const timeline: FETimelineEvent[] = this.buildTimeline(rec);

    // Build photos
    const photos: FEProjectPhoto[] = this.buildPhotos(rec, rng);

    // Build cost benchmark
    const costBenchmark: FECostBenchmark | null = this.buildCostBenchmark(rec);

    // Build comparable projects
    const comparables: FEComparableProject[] = this.buildComparables(rec);

    // Build duplicate pair summaries for this project
    const pairSummaries: FEDuplicatePairSummary[] = this.duplicatePairs
      .filter(p => p.project_id_1 === projectId || p.project_id_2 === projectId)
      .map(pair => {
        const isA = pair.project_a.project_id === projectId;
        const other = isA ? pair.project_b : pair.project_a;
        return {
          pair_id: pair.pair_id,
          counterpart_project_id: other.project_id,
          similarity_score: pair.similarity_score,
          geo_distance_km: pair.geo_distance_km,
          detection_method: pair.detection_method,
          note: `${other.project_id}: ${(pair.similarity_score * 100).toFixed(0)}% similarity, ${pair.geo_distance_km < 1 ? `${(pair.geo_distance_km * 1000).toFixed(0)} m` : `${pair.geo_distance_km.toFixed(1)} km`} apart. Requires verification.`,
        };
      });

    // Build recommended action
    const action = this.buildRecommendedAction(rec);

    // IA
    const ia = db.agencies.find(a => a.ia_id === rec.p1.ia_id);
    const feIA: FEImplementingAgency = {
      ia_id: rec.p1.ia_id,
      ia_name: rec.p1.ia_name,
      ia_type: ia ? mapIAType(ia.agency_type) : 'UNKNOWN',
      total_projects: ia?.projects_count || 0,
      completed_projects: 0,
      avg_delay_days: 0,
      risk_score: ia?.average_risk_score || 0,
      state_id: rec.p1.state_id,
    };

    // MP
    const mp = this.mps.find(m => m.mp_id === rec.p1.mp_id) || {
      mp_id: rec.p1.mp_id,
      mp_name: rec.p1.mp_name,
      mp_house: 'LOK_SABHA' as FEMPHouse,
      constituency_id: rec.p1.constituency_id,
      constituency_name: rec.p1.constituency_name,
      state_id: rec.p1.state_id,
    };

    // District and State refs
    const distRef = this.districts.find(d => d.district_id === rec.p1.district_id) || {
      district_id: rec.p1.district_id,
      district_name: rec.p1.district_name,
      state_id: rec.p1.state_id,
      state_name: rec.p1.state_name,
      lat: rec.p1.location.latitude || 20.5937,
      lon: rec.p1.location.longitude || 78.9629,
    };
    const stateRef = this.states.find(s => s.state_id === rec.p1.state_id) || {
      state_id: rec.p1.state_id,
      state_name: rec.p1.state_name,
    };

    return {
      project: rec.feProject,
      risk_score: rec.feRisk,
      risk_dimensions: dimensions,
      implementing_agency: feIA,
      mp,
      district: distRef,
      state: stateRef,
      payments: fePayments,
      timeline,
      photos,
      cost_benchmark: costBenchmark,
      comparable_projects: comparables,
      duplicate_pairs: pairSummaries,
      recommended_action: action,
      has_network_relationship: this.networkNodeIds.has(rec.p1.ia_id),
    };
  }

  private buildRiskDimensions(rec: ProjectRecord, rng: SimpleRng): FERiskDimensionDetail[] {
    const rs = rec.feRisk;
    const dimScores: { key: FERiskDimensionKey; score: number }[] = [
      { key: 'FINANCIAL', score: rs.financial_risk },
      { key: 'TIMELINE', score: rs.timeline_risk },
      { key: 'COMPLIANCE', score: rs.compliance_risk },
      { key: 'IA', score: rs.ia_risk },
      { key: 'GEO', score: rs.geo_risk },
      { key: 'EVIDENCE', score: rs.evidence_risk },
    ];

    const evidenceMap: Record<FERiskDimensionKey, { evidence: string; metric: string; explanation: string; ref: string | null }> = {
      FINANCIAL: {
        evidence: rec.costLakhs > 50
          ? `Sanctioned cost ₹${rec.costLakhs.toFixed(1)}L exceeds peer benchmarks.`
          : `Sanctioned cost ₹${rec.costLakhs.toFixed(1)}L is within normal range for ${rec.p1.category}.`,
        metric: `₹${rec.costLakhs.toFixed(1)}L sanctioned`,
        explanation: 'Compares unit cost against peer works of the same type in the same state.',
        ref: 'CPWD Schedule of Rates',
      },
      TIMELINE: {
        evidence: rec.p1.status === 'STALLED' ? `Work stalled at ${rec.p1.physical_progress}% completion.`
          : rec.p1.physical_progress < 50 ? `Only ${rec.p1.physical_progress}% complete; potential delay risk.`
            : `${rec.p1.physical_progress}% complete, within expected timeline.`,
        metric: `${rec.p1.physical_progress}% physical progress`,
        explanation: 'Evaluates whether the work will meet the 12-month completion window from sanction.',
        ref: 'MPLADS Guidelines 2023, Ch. 4',
      },
      COMPLIANCE: {
        evidence: Math.abs(rec.p1.financial_progress - rec.p1.physical_progress) > 20
          ? `Financial-physical gap of ${(rec.p1.financial_progress - rec.p1.physical_progress).toFixed(0)}pp indicates possible non-compliance.`
          : 'Payment stages proportional to reported progress.',
        metric: `${rec.p1.financial_progress}% financial vs ${rec.p1.physical_progress}% physical`,
        explanation: 'Checks that financial disbursement tracks physical completion within MPLADS thresholds.',
        ref: 'GFR Rule 149',
      },
      IA: {
        evidence: `Implementing Agency ${rec.p1.ia_name} handles projects in the constituency.`,
        metric: `IA: ${rec.p1.ia_name}`,
        explanation: 'Measures portfolio concentration using the Herfindahl-Hirschman Index (HHI). High HHI signals a single-relationship dependency.',
        ref: null,
      },
      GEO: {
        evidence: rec.p1.location.latitude ? `Located at ${rec.p1.location.latitude.toFixed(4)}°N, ${rec.p1.location.longitude.toFixed(4)}°E.` : 'GPS coordinates not recorded.',
        metric: rec.p1.location.latitude ? `${rec.p1.location.latitude.toFixed(4)}°N` : 'No GPS',
        explanation: 'Checks for geographic anomalies: works outside constituency, improbable proximity to similar works.',
        ref: 'eSAKSHI geo-tagging requirements',
      },
      EVIDENCE: {
        evidence: rec.feProject.photo_count > 0
          ? `${rec.feProject.photo_count} stage photographs uploaded.`
          : 'No stage photographs uploaded. Physical verification recommended.',
        metric: `${rec.feProject.photo_count} photos`,
        explanation: 'Assesses completeness of the physical evidence record: stage photographs, measurement book entries, completion certificates.',
        ref: 'MPLADS Guidelines 2023, Ch. 5',
      },
    };

    return dimScores.map(({ key, score }) => {
      const info = evidenceMap[key];
      const severity = riskLevelFor(score);
      return {
        dimension: key,
        score: round(score, 3),
        severity,
        evidence: info.evidence,
        metric_label: info.metric,
        metric_name: key,
        metric_value: round(score, 3),
        explanation: info.explanation,
        reference: info.ref,
      };
    });
  }

  private buildPaymentRecords(rec: ProjectRecord, rng: SimpleRng): FEPaymentRecord[] {
    const stages = ['First Installment', 'Progress Payment', 'Milestone Payment', 'Final Payment'];
    if (rec.payments.length === 0) {
      return [{ stage: 'First Installment', paid_date: null, amount_lakhs: null, share_of_sanctioned: null, reported_progress: null, photo_required: true, photo_present: false, note: 'Awaiting first payment release.' }];
    }

    return rec.payments.slice(0, 4).map((pay, i) => ({
      stage: stages[Math.min(i, stages.length - 1)],
      paid_date: pay.payment_date,
      amount_lakhs: round(pay.payment_amount / 100000, 2),
      share_of_sanctioned: rec.p1.sanction_amount > 0 ? round(pay.cumulative_payment / rec.p1.sanction_amount, 3) : null,
      reported_progress: round(Math.min(100, (i + 1) * 25 + rng.float(-5, 5)) / 100, 3),
      photo_required: true,
      photo_present: rng.next() > 0.3,
      note: pay.milestone_description || null,
    }));
  }

  private buildTimeline(rec: ProjectRecord): FETimelineEvent[] {
    const p = rec.p1;
    const now = new Date();
    const events: FETimelineEvent[] = [];

    events.push({
      key: 'recommendation',
      label: 'MP Recommendation',
      date: p.sanction_date,
      status: 'COMPLETE',
      detail: `Recommended by MP ${p.mp_name}`,
      breach: null,
    });

    events.push({
      key: 'sanction',
      label: 'District Authority Sanction',
      date: p.sanction_date,
      status: 'COMPLETE',
      detail: `Sanctioned ₹${(p.sanction_amount / 100000).toFixed(1)} Lakhs`,
      breach: null,
    });

    events.push({
      key: 'work_start',
      label: 'Work Commencement',
      date: p.start_date,
      status: p.status === 'NOT_STARTED' ? 'PENDING' : 'COMPLETE',
      detail: p.status === 'NOT_STARTED' ? 'Work has not commenced.' : `Work started on ${p.start_date}`,
      breach: null,
    });

    const completionDeadline = new Date(p.expected_completion_date);
    const isOverdue = !p.actual_completion_date && completionDeadline < now;
    const daysOver = isOverdue ? Math.round((now.getTime() - completionDeadline.getTime()) / 86_400_000) : null;

    events.push({
      key: 'completion',
      label: 'Work Completion',
      date: p.actual_completion_date || (p.status === 'COMPLETED' ? p.expected_completion_date : null),
      status: p.status === 'COMPLETED' ? 'COMPLETE' : (isOverdue ? 'BREACH' : 'PENDING'),
      detail: p.status === 'COMPLETED'
        ? `Completed on ${p.actual_completion_date || p.expected_completion_date}`
        : (isOverdue ? `Overdue by ${daysOver} days. Expected: ${p.expected_completion_date}.` : `Expected by ${p.expected_completion_date}`),
      breach: isOverdue ? {
        rule: 'MPLADS Guidelines Ch. 4 — 12-month completion window',
        text: `Work is ${daysOver} days past the expected completion date.`,
        days_over: daysOver,
      } : null,
    });

    events.push({
      key: 'final_payment',
      label: 'Final Payment Release',
      date: rec.payments.length > 0 ? rec.payments[rec.payments.length - 1].payment_date : null,
      status: p.status === 'COMPLETED' ? 'COMPLETE' : 'PENDING',
      detail: p.status === 'COMPLETED' ? 'Final payment released.' : 'Pending completion and certification.',
      breach: null,
    });

    return events;
  }

  private buildPhotos(rec: ProjectRecord, rng: SimpleRng): FEProjectPhoto[] {
    const stages = ['Pre-construction', 'Foundation', 'Mid-construction', 'Near completion', 'Completed'];
    const photos: FEProjectPhoto[] = [];
    const count = rec.feProject.photo_count;
    for (let i = 0; i < count && i < stages.length; i++) {
      photos.push({
        photo_id: `PHOTO-${rec.p1.project_id}-${i + 1}`,
        stage: stages[i],
        uploaded_at: rec.p1.start_date,
        url: null,
        similar_to_project_id: null,
        hamming_distance: null,
      });
    }
    return photos;
  }

  private buildCostBenchmark(rec: ProjectRecord): FECostBenchmark | null {
    // Find peer projects of same category in same state
    const peers = this.records.filter(r =>
      r.p1.category === rec.p1.category &&
      r.p1.state_id === rec.p1.state_id &&
      r.p1.project_id !== rec.p1.project_id,
    );

    if (peers.length < 3) return null;

    const peerCosts = peers.map(r => r.costLakhs);
    const benchmarkCost = round(peerCosts.reduce((s, c) => s + c, 0) / peerCosts.length, 2);
    const ratio = benchmarkCost > 0 ? round(rec.costLakhs / benchmarkCost, 2) : 1;

    // Approximate z-score
    const mean = benchmarkCost;
    const variance = peerCosts.reduce((s, c) => s + (c - mean) ** 2, 0) / peerCosts.length;
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = round((rec.costLakhs - mean) / stdDev, 2);

    return {
      work_type: rec.p1.category,
      state_id: rec.p1.state_id,
      unit: 'lakhs',
      project_unit_cost: rec.costLakhs,
      benchmark_unit_cost: benchmarkCost,
      ratio,
      z_score: zScore,
      source: 'MPLADS Synthetic Dataset Peer Comparison',
      fy: rec.feProject.fy,
    };
  }

  private buildComparables(rec: ProjectRecord): FEComparableProject[] {
    const sameType = this.records.filter(r =>
      r.p1.category === rec.p1.category && r.p1.project_id !== rec.p1.project_id,
    );
    const inState = sameType.filter(r => r.p1.state_id === rec.p1.state_id);
    const pool = inState.length >= 5 ? inState : sameType;

    return [...pool]
      .sort((a, b) => {
        const aLocal = a.p1.district_id === rec.p1.district_id ? 0 : 1;
        const bLocal = b.p1.district_id === rec.p1.district_id ? 0 : 1;
        return aLocal - bLocal || a.costLakhs - b.costLakhs;
      })
      .slice(0, 5)
      .map(r => ({
        project_id: r.p1.project_id,
        district_name: r.p1.district_name,
        work_type: r.p1.category,
        estimated_cost_lakhs: r.costLakhs,
        unit_cost_lakhs: r.costLakhs,
        risk_level: r.riskLevel,
      }));
  }

  private buildRecommendedAction(rec: ProjectRecord): FERecommendedAction {
    if (rec.riskLevel === 'CRITICAL') {
      return {
        action: 'Immediate on-site physical verification and expenditure freeze.',
        refer_to: 'District Collector / Vigilance Cell',
        urgency: 'CRITICAL',
        rationale: `Project scores ${(rec.overallRisk * 100).toFixed(0)}% overall risk with critical-level anomalies.`,
      };
    }
    if (rec.riskLevel === 'HIGH') {
      return {
        action: 'Depute field audit team for measurement book verification.',
        refer_to: 'District Programme Officer',
        urgency: 'HIGH',
        rationale: `Project has high-risk flags requiring physical audit before next payment release.`,
      };
    }
    if (rec.riskLevel === 'MEDIUM') {
      return {
        action: 'Desk review of payment vouchers and progress reports.',
        refer_to: 'Audit Section',
        urgency: 'MEDIUM',
        rationale: 'Moderate anomalies detected; routine review recommended.',
      };
    }
    return {
      action: 'Standard periodic monitoring. No immediate action required.',
      refer_to: 'Monitoring Cell',
      urgency: 'LOW',
      rationale: 'All dimensions within expected parameters.',
    };
  }

  /** Build a report for a project */
  public getReport(projectId: string): FEReportResponse | null {
    const rec = this.recordById.get(projectId);
    if (!rec) return null;

    const p = rec.p1;
    const rs = rec.feRisk;
    const topFactors = rs.top_risk_factors.map(f => f.text).join('; ');

    return {
      project_id: projectId,
      generated_at: new Date().toISOString(),
      model_version: rs.model_version || this.modelVersion,
      disclaimer: 'This report is generated by the MPLADS Audit Intelligence System (SIH26102) for informational and analytical purposes only. All risk scores are derived from statistical models and synthetic data. Findings must be verified through physical field audits and official records before any administrative action is taken. This system does not constitute a legal audit opinion.',
      summary: `Project "${p.project_name}" (${projectId}) in ${p.constituency_name}, ${p.state_name} carries an overall risk rating of ${(rs.overall_risk * 100).toFixed(0)}% (${rs.risk_level}). Key risk factors: ${topFactors || 'None identified'}. Sanctioned amount: ₹${rec.costLakhs.toFixed(1)} Lakhs. Physical progress: ${p.physical_progress}%. Financial progress: ${p.financial_progress}%.`,
      sections: [
        {
          heading: 'Project Overview',
          lines: [
            `Project ID: ${projectId}`,
            `Work Type: ${p.category}`,
            `Description: ${p.description}`,
            `Location: ${p.district_name}, ${p.state_name}`,
            `MP: ${p.mp_name}`,
            `Implementing Agency: ${p.ia_name}`,
            `Sanctioned Amount: ₹${rec.costLakhs.toFixed(1)} Lakhs`,
            `Sanction Date: ${p.sanction_date}`,
            `Status: ${p.status}`,
          ],
        },
        {
          heading: 'Risk Assessment',
          lines: [
            `Overall Risk: ${(rs.overall_risk * 100).toFixed(1)}% (${rs.risk_level})`,
            `Financial Risk: ${(rs.financial_risk * 100).toFixed(1)}%`,
            `Timeline Risk: ${(rs.timeline_risk * 100).toFixed(1)}%`,
            `Compliance Risk: ${(rs.compliance_risk * 100).toFixed(1)}%`,
            `IA Concentration Risk: ${(rs.ia_risk * 100).toFixed(1)}%`,
            `Geospatial Risk: ${(rs.geo_risk * 100).toFixed(1)}%`,
            `Evidence Risk: ${(rs.evidence_risk * 100).toFixed(1)}%`,
          ],
        },
        {
          heading: 'Key Risk Factors',
          lines: rs.top_risk_factors.length > 0
            ? rs.top_risk_factors.map((f, i) => `${i + 1}. [${f.dimension}] ${f.text}`)
            : ['No anomalies detected across the six risk dimensions.'],
        },
        {
          heading: 'Progress Summary',
          lines: [
            `Physical Progress: ${p.physical_progress}%`,
            `Financial Progress: ${p.financial_progress}%`,
            `Gap: ${(p.financial_progress - p.physical_progress).toFixed(1)} percentage points`,
            `Expected Completion: ${p.expected_completion_date}`,
            `Actual Completion: ${p.actual_completion_date || 'Pending'}`,
          ],
        },
        {
          heading: 'Recommended Action',
          lines: [
            `Action: ${this.buildRecommendedAction(rec).action}`,
            `Refer To: ${this.buildRecommendedAction(rec).refer_to}`,
            `Urgency: ${this.buildRecommendedAction(rec).urgency}`,
          ],
        },
      ],
      pdf_url: null,
    };
  }
}
