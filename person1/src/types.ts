/**
 * SIH26102 — MPLADS Audit Intelligence
 * Core Type Definitions & Data Contracts (Person 1 + Person 2 + Person 3 + Person 4)
 */

export type UserRole = 'ADMIN' | 'AUDITOR' | 'REVIEWER' | 'VIEWER';

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'STALLED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReviewActionType = 'ACKNOWLEDGE' | 'INVESTIGATE' | 'ESCALATE' | 'DISMISS';

export type AnomalyScenario =
  | 'NORMAL_BENCHMARK'
  | 'HIGH_COST_ANOMALY'
  | 'PAYMENT_PROGRESS_MISMATCH'
  | 'TIMELINE_DELAY_ANOMALY'
  | 'IA_CONCENTRATION_ANOMALY'
  | 'DUPLICATE_PROJECT_PAIR'
  | 'COMPLIANCE_ANOMALY';

export interface StateEntity {
  state_id: string; // ST01 to ST36
  name: string;
  normalized_name: string;
  state_type: 'STATE' | 'UNION_TERRITORY';
  total_mps: number;
  total_allocated: number;
  latitude: number;
  longitude: number;
}

export interface DistrictEntity {
  district_id: string; // D001
  state_id: string;
  name: string;
  normalized_name: string;
}

export interface ConstituencyEntity {
  constituency_id: string; // C001
  state_id: string;
  district_id: string;
  name: string;
  normalized_name: string;
}

export interface MPEntity {
  mp_id: string; // MP001
  constituency_id: string;
  state_id: string;
  name: string;
  normalized_name: string;
  allocated_amount: number | null;
  allocation_quality_flag?: string; // e.g. "MISSING_SOURCE_VALUE"
  source_row: number;
}

export interface ImplementingAgencyEntity {
  ia_id: string; // IA001
  name: string;
  normalized_name: string;
  agency_type: 'PWD' | 'DRDA' | 'MUNICIPAL' | 'PHED' | 'ZILLA_PARISHAD' | 'ELECTRICITY' | 'IRRIGATION' | 'OTHER';
  state_id: string;
  projects_count: number;
  total_budget_handled: number;
  hhi_score?: number; // Herfindahl-Hirschman Index concentration
  average_risk_score?: number;
}

export interface PaymentTransaction {
  payment_id: string; // PAY00001
  project_id: string;
  payment_date: string; // YYYY-MM-DD
  payment_amount: number;
  cumulative_payment: number;
  payment_status: 'PROCESSED' | 'PENDING_AUDIT' | 'FLAGGED';
  milestone_description: string;
  voucher_no: string;
}

export interface RiskFlag {
  flag_id: string;
  project_id: string;
  flag_type: 'FINANCIAL' | 'TIMELINE' | 'COMPLIANCE' | 'IA_CONCENTRATION' | 'DUPLICATE' | 'GEO_SPATIAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule_code: string;
  message: string;
  evidence_json: Record<string, any>;
  created_at: string;
}

export interface ComplianceRuleEntity {
  rule_code: string;
  rule_name: string;
  description: string;
  severity: RiskLevel;
  category: string;
  threshold_config: Record<string, any>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskScore {
  project_id: string;
  overall_score: number; // 0.00 to 1.00
  risk_level: RiskLevel;
  financial_score: number;
  timeline_score: number;
  compliance_score: number;
  ia_score: number;
  geo_score: number;
  evidence_score: number;
  model_version: string;
  scored_at: string;
  reasons: string[];
  feature_contributions?: {
    feature: string;
    weight: number;
    description: string;
  }[];
}

export interface ProjectLocation {
  latitude: number;
  longitude: number;
  address?: string;
  gps_accuracy_meters?: number;
}

export interface ProjectEntity {
  project_id: string; // e.g. P10001
  project_name: string;
  description: string;
  category: string;
  state_id: string;
  state_name: string;
  district_id: string;
  district_name: string;
  constituency_id: string;
  constituency_name: string;
  mp_id: string;
  mp_name: string;
  ia_id: string;
  ia_name: string;
  sanction_amount: number;
  sanction_date: string;
  start_date: string;
  expected_completion_date: string;
  actual_completion_date: string | null;
  physical_progress: number; // 0 - 100
  financial_progress: number; // 0 - 100
  status: ProjectStatus;
  location: ProjectLocation;
  record_source: 'SOURCE' | 'SYNTHETIC';
  synthetic_scenario: AnomalyScenario;
  // Separate Person 2/3 model detector results from synthetic ground truth
  detector_flagged?: boolean;
  detector_model_version?: string;
  detector_score?: number;
  source_file: string;
  source_row: number;
  synthetic_seed: number;
  created_at: string;
  updated_at: string;
  // Embedded / relational summaries
  risk_score?: RiskScore;
  flags?: RiskFlag[];
  payments?: PaymentTransaction[];
  review_status?: ReviewActionType | 'UNREVIEWED';
  review_count?: number;
}

export interface DuplicateMatch {
  match_project_id: string;
  match_project_name: string;
  match_description: string;
  overall_similarity: number; // 0.00 - 1.00
  text_similarity: number;
  geo_distance_meters: number;
  date_proximity_days: number;
  same_ia: boolean;
  match_reasons: string[];
}

export interface DuplicateCluster {
  cluster_id: string;
  primary_project_id: string;
  suspected_count: number;
  max_similarity: number;
  total_suspect_amount: number;
  matches: DuplicateMatch[];
}

export interface ReviewAction {
  review_id: string;
  project_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: UserRole;
  action: ReviewActionType;
  comment: string;
  created_at: string;
}

export interface AuditLog {
  audit_id: string;
  project_id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  payload_json: Record<string, any>;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  title: string;
  category: 'FINANCIAL' | 'PHYSICAL_AUDIT' | 'GEO_COORDINATES' | 'TIMELINE' | 'CONTRACTOR_IA' | 'DUPLICATE';
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'CRITICAL';
  metric_label: string;
  observed_value: string;
  benchmark_value: string;
  delta_description: string;
  timestamp: string;
}

export interface EvidenceDossier {
  project_id: string;
  generated_at: string;
  dossier_version: string;
  project_summary: ProjectEntity;
  risk_vector: RiskScore;
  evidence_items: EvidenceItem[];
  anomaly_narrative: string;
  regulatory_infractions: string[];
  duplicate_findings?: DuplicateCluster;
  agency_concentration_summary?: {
    ia_name: string;
    constituency_share_pct: number;
    hhi_index: number;
    total_projects: number;
  };
  audit_chronology: AuditLog[];
  review_decisions: ReviewAction[];
}

export interface DashboardSummary {
  total_projects: number;
  total_allocated_budget: number;
  total_utilized_budget: number;
  overall_physical_avg: number;
  overall_financial_avg: number;
  high_risk_count: number;
  critical_risk_count: number;
  reviewed_count: number;
  pending_investigation_count: number;
  status_breakdown: Record<ProjectStatus, number>;
  risk_level_breakdown: Record<RiskLevel, number>;
  category_breakdown: { category: string; count: number; total_amount: number; avg_risk: number }[];
  state_aggregates: {
    state_id: string;
    state_name: string;
    project_count: number;
    allocated_sum: number;
    risk_count: number;
    critical_count: number;
    avg_physical_progress: number;
    avg_financial_progress: number;
  }[];
  recent_alerts: {
    project_id: string;
    project_name: string;
    state_name: string;
    risk_level: RiskLevel;
    overall_score: number;
    scenario: AnomalyScenario;
    message: string;
    date: string;
  }[];
}

export interface PipelineProfileReport {
  raw_file_name: string;
  raw_total_rows: number;
  raw_rows_count?: number;
  clean_mps_count?: number;
  synthetic_projects_count?: number;
  synthetic_payments_count?: number;
  grand_total_row_detected: boolean;
  grand_total_value_inr: string;
  operational_mp_records: number;
  unique_states_raw: number;
  unique_states_normalized: number;
  unique_constituencies: number;
  missing_amount_records: {
    row: number;
    mp_name: string;
    constituency: string;
    state: string;
    action_taken: string;
  }[];
  synthetic_generation: {
    seed: number;
    target_projects: number;
    generated_projects: number;
    generated_payments: number;
    generated_ias: number;
    injected_anomalies: Record<AnomalyScenario, number>;
  };
  validation_suite: {
    checks_run: number;
    checks_passed: number;
    all_passed: boolean;
    validations: {
      check_name: string;
      status: 'PASSED' | 'FAILED';
      details: string;
    }[];
    tests?: {
      id: string;
      name: string;
      passed: boolean;
      details: string;
    }[];
  };
}

export type DataProfileReport = PipelineProfileReport;

export interface UserEntity {
  user_id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  is_demo_account?: boolean;
  created_at?: string;
  updated_at?: string;
}
