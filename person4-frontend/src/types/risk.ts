import type { RiskLevel } from './api';

/**
 * Clean canonical risk model representing a scored MPLADS project.
 * Decoupled from backend ML/heuristic implementation details.
 */
export interface ProjectRisk {
  project_id: string;

  /** Six core risk dimension scores (0.0 to 1.0) */
  financial_score: number;
  timeline_score: number;
  compliance_score: number;
  ia_score: number;
  geo_score: number;
  evidence_score: number;

  /** Overall composite risk score (0.0 to 1.0) */
  overall_score: number;
  risk_level: RiskLevel;

  /** Key reasons / anomaly flags */
  reasons: string[];
}

/** State-level risk aggregate for the National Risk Map */
export interface StateRisk {
  state_id: string;
  state_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  project_count: number;
  critical_count: number;
  high_count: number;
  total_outlay_lakhs: number;
}

/** Month-by-month risk trend point for Recharts visualization */
export interface RiskTrendPoint {
  month: string;
  display_name: string;
  avg_risk_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_projects: number;
}

/** Human review action types and payloads */
export type HumanReviewActionType = 'ACKNOWLEDGE' | 'INVESTIGATE' | 'ESCALATE' | 'DISMISS';

export interface HumanReviewActionRecord {
  id: string;
  project_id: string;
  action: HumanReviewActionType;
  comment: string;
  reviewer_name: string;
  reviewer_role: string;
  created_at: string;
}
