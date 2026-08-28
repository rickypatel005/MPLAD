import type { ProjectRisk, StateRisk, RiskTrendPoint } from '@/types/risk';
import type { RiskScore, RiskLevel, Project } from '@/types/api';
import { riskLevelFromScore } from '@/lib/risk';

/**
 * Adapter: Transforms backend risk response (Person 2 or internal RiskScore)
 * into canonical frontend ProjectRisk interface.
 */
export function adaptToProjectRisk(raw: unknown): ProjectRisk {
  if (!raw || typeof raw !== 'object') {
    return {
      project_id: 'UNKNOWN',
      financial_score: 0,
      timeline_score: 0,
      compliance_score: 0,
      ia_score: 0,
      geo_score: 0,
      evidence_score: 0,
      overall_score: 0,
      risk_level: 'LOW',
      reasons: [],
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check for Person 2 specific ML format vs Person 1 / internal format
  const financial = Number(obj.financial_score ?? obj.financial_risk ?? 0);
  const timeline = Number(obj.timeline_score ?? obj.timeline_risk ?? 0);
  const compliance = Number(obj.compliance_score ?? obj.compliance_risk ?? 0);
  const ia = Number(obj.ia_score ?? obj.ia_risk ?? 0);
  const geo = Number(obj.geo_score ?? obj.geo_risk ?? 0);
  const evidence = Number(obj.evidence_score ?? obj.evidence_risk ?? 0);

  const overall = Number(obj.overall_score ?? obj.overall_risk ?? (
    0.25 * financial + 0.20 * timeline + 0.20 * compliance + 0.20 * ia + 0.10 * geo + 0.05 * evidence
  ));

  const risk_level: RiskLevel = (obj.risk_level as RiskLevel) ?? riskLevelFromScore(overall);

  const reasons: string[] = Array.isArray(obj.reasons)
    ? (obj.reasons as string[])
    : Array.isArray(obj.top_risk_factors)
      ? (obj.top_risk_factors as Array<{ text: string }>).map((f) => f.text)
      : [];

  return {
    project_id: String(obj.project_id ?? obj.id ?? ''),
    financial_score: financial,
    timeline_score: timeline,
    compliance_score: compliance,
    ia_score: ia,
    geo_score: geo,
    evidence_score: evidence,
    overall_score: Math.min(1, Math.max(0, overall)),
    risk_level,
    reasons,
  };
}

/**
 * Adapter: Person 3 Duplicate Detector response mapper
 */
export function adaptPerson3Duplicates(raw: unknown) {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  const pairs = Array.isArray(obj.duplicates) ? obj.duplicates : Array.isArray(obj.items) ? obj.items : [];
  return pairs.map((p: any) => ({
    pair_id: p.pair_id ?? p.id,
    project_a_id: p.project_a_id ?? p.source_id,
    project_b_id: p.project_b_id ?? p.target_id,
    similarity_score: Number(p.similarity_score ?? p.similarity ?? 0),
    distance_km: Number(p.distance_km ?? p.distance ?? 0),
    detection_method: p.detection_method ?? 'TF-IDF + Spatial Index',
    flagged_date: p.flagged_date ?? new Date().toISOString().slice(0, 10),
  }));
}

/**
 * Adapter: Person 3 IA Network Graph mapper
 */
export function adaptPerson3NetworkGraph(raw: unknown) {
  if (!raw || typeof raw !== 'object') return { nodes: [], links: [] };
  const obj = raw as Record<string, unknown>;
  return {
    nodes: Array.isArray(obj.nodes) ? obj.nodes : [],
    links: Array.isArray(obj.links) ? obj.links : [],
  };
}
