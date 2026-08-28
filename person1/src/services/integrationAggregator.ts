/**
 * SIH26102 — Central Risk Aggregator & Multi-Service Integration Boundary
 *
 * Coordinates and synthesizes real intelligence outputs from:
 * - Person 2: Risk & ML Service (Port 8002 / Isolation Forest v1, Rules, Cost, Timeline)
 * - Person 3: Intelligence Layer (Port 8000 / Sentence-BERT NLP Duplicates, IA Graph & HHI, Geo)
 * - Person 1: Master Store & Evidence Dossier
 *
 * Produces the canonical 6-dimensional risk assessment:
 * {
 *   project_id,
 *   financial_score,
 *   timeline_score,
 *   compliance_score,
 *   ia_score,
 *   geo_score,
 *   evidence_score,
 *   overall_score,
 *   risk_level,
 *   reasons,
 *   model_metadata
 * }
 */

import http from 'http';
import { ProjectEntity, RiskScore, RiskLevel } from '../types.ts';

export interface ModelMetadata {
  model_source: string;
  models: string[];
  model_version: string;
  mode: 'REAL' | 'DEVELOPMENT_FALLBACK';
  warning?: string;
  scored_at: string;
}

export interface CanonicalRiskAssessment {
  project_id: string;
  financial_score: number;
  timeline_score: number;
  compliance_score: number;
  ia_score: number;
  geo_score: number;
  evidence_score: number;
  overall_score: number;
  risk_level: RiskLevel;
  reasons: string[];
  model_metadata: ModelMetadata;
  // Aliases for frontend interface compatibility
  financial_risk: number;
  timeline_risk: number;
  compliance_risk: number;
  ia_risk: number;
  geo_risk: number;
  evidence_risk: number;
  overall_risk: number;
}

export class IntegrationAggregator {
  private static instance: IntegrationAggregator;

  private person2Url: string;
  private person3Url: string;

  private constructor() {
    this.person2Url = process.env.PERSON2_RISK_URL || 'http://127.0.0.1:8002';
    this.person3Url = process.env.PERSON3_NLP_URL || 'http://127.0.0.1:8000';
  }

  public static getInstance(): IntegrationAggregator {
    if (!IntegrationAggregator.instance) {
      IntegrationAggregator.instance = new IntegrationAggregator();
    }
    return IntegrationAggregator.instance;
  }

  /**
   * Helper to perform HTTP JSON requests with standard timeout.
   */
  private async fetchJson<T>(urlStr: string, method: 'GET' | 'POST', body?: any): Promise<T | null> {
    return new Promise((resolve) => {
      try {
        const url = new URL(urlStr);
        const data = body ? JSON.stringify(body) : null;

        const options: http.RequestOptions = {
          hostname: url.hostname,
          port: url.port || 80,
          path: `${url.pathname}${url.search}`,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
          },
          timeout: 2500, // 2.5 second timeout
        };

        const req = http.request(options, (res) => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            resolve(null);
            return;
          }

          let responseBody = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(responseBody);
              resolve(parsed as T);
            } catch {
              resolve(null);
            }
          });
        });

        req.on('error', () => {
          resolve(null);
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });

        if (data) {
          req.write(data);
        }
        req.end();
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Calls Person 2 FastAPI service to score a real project payload.
   */
  public async scoreWithPerson2(project: ProjectEntity): Promise<{
    financial_score: number;
    timeline_score: number;
    compliance_score: number;
    anomaly_score: number;
    reasons: string[];
    isReal: boolean;
  }> {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const fin = project.financial_progress > project.physical_progress + 25 ? 0.75 : 0.15;
      const time = project.status === 'STALLED' ? 0.85 : project.physical_progress < 30 ? 0.50 : 0.10;
      const comp = project.sanction_amount > 50000000 && project.financial_progress > 50 ? 0.40 : 0.10;
      const anom = project.synthetic_scenario !== 'NORMAL_BENCHMARK' ? 0.65 : 0.10;

      return {
        financial_score: fin,
        timeline_score: time,
        compliance_score: comp,
        anomaly_score: anom,
        reasons: project.synthetic_scenario !== 'NORMAL_BENCHMARK' ? [`Synthetic pattern: ${project.synthetic_scenario}`] : [],
        isReal: false,
      };
    }

    const payload = {
      project_id: project.project_id,
      sanctioned_amount: project.sanction_amount,
      project_cost: project.sanction_amount,
      amount_released: (project.financial_progress / 100.0) * project.sanction_amount,
      amount_paid: (project.financial_progress / 100.0) * project.sanction_amount,
      amount_utilized: (project.financial_progress / 100.0) * project.sanction_amount,
      physical_progress: project.physical_progress,
      financial_progress: project.financial_progress,
      planned_start: project.start_date,
      planned_end: project.expected_completion_date,
      actual_start: project.start_date,
      actual_end: project.actual_completion_date,
      implementing_agency: project.ia_id,
      district: project.district_id,
      constituency: project.constituency_id,
      latitude: project.location.latitude,
      longitude: project.location.longitude,
      category: project.category,
      synthetic_scenario: project.synthetic_scenario,
    };

    const p2Response = await this.fetchJson<any>(`${this.person2Url}/projects/score`, 'POST', payload);

    if (p2Response && typeof p2Response.overall_score === 'number') {
      const reasonsList: string[] = [];
      if (Array.isArray(p2Response.reasons)) {
        for (const r of p2Response.reasons) {
          if (typeof r === 'string') reasonsList.push(r);
          else if (r && typeof r.reason === 'string') reasonsList.push(r.reason);
        }
      }

      return {
        financial_score: Number(p2Response.financial_score ?? 0.20),
        timeline_score: Number(p2Response.timeline_score ?? 0.15),
        compliance_score: Number(p2Response.compliance_score ?? 0.10),
        anomaly_score: Number(p2Response.anomaly_score ?? 0.15),
        reasons: reasonsList,
        isReal: true,
      };
    }

    // Downstream service is offline in non-mock mode: do NOT silently pretend it succeeded
    console.warn(`[IntegrationAggregator] WARNING: Downstream Person 2 ML Service (${this.person2Url}) is unreachable. MOCK_MODE is false.`);
    const fin = project.financial_progress > project.physical_progress + 25 ? 0.75 : 0.15;
    const time = project.status === 'STALLED' ? 0.85 : project.physical_progress < 30 ? 0.50 : 0.10;
    const comp = project.sanction_amount > 50000000 && project.financial_progress > 50 ? 0.40 : 0.10;
    const anom = project.synthetic_scenario !== 'NORMAL_BENCHMARK' ? 0.65 : 0.10;

    return {
      financial_score: fin,
      timeline_score: time,
      compliance_score: comp,
      anomaly_score: anom,
      reasons: [
        `[P2_SERVICE_UNAVAILABLE] Person 2 ML scoring service is unreachable at ${this.person2Url}; fallback score is non-authoritative.`,
        ...(project.synthetic_scenario !== 'NORMAL_BENCHMARK' ? [`Synthetic pattern: ${project.synthetic_scenario}`] : []),
      ],
      isReal: false,
    };
  }

  /**
   * Calls Person 3 FastAPI service to retrieve IA and Geo metrics.
   */
  public async scoreWithPerson3(project: ProjectEntity): Promise<{
    ia_score: number;
    geo_score: number;
    ia_hhi: number;
    geo_within: boolean;
    reasons: string[];
    isReal: boolean;
  }> {
    const isMock = process.env.MOCK_MODE === 'true';

    if (isMock) {
      const iaScore = project.synthetic_scenario === 'IA_CONCENTRATION_ANOMALY' ? 0.80 : 0.15;
      const geoScore = project.synthetic_scenario === 'DUPLICATE_PROJECT_PAIR' ? 0.85 : 0.10;
      return {
        ia_score: iaScore,
        geo_score: geoScore,
        ia_hhi: 3200,
        geo_within: true,
        reasons: project.synthetic_scenario === 'IA_CONCENTRATION_ANOMALY' ? ['High agency concentration detected'] : [],
        isReal: false,
      };
    }

    const geoUrl = `${this.person3Url}/projects/${project.project_id}/geo?lon=${project.location.longitude}&lat=${project.location.latitude}&target_constituency=${project.constituency_id}`;
    const networkUrl = `${this.person3Url}/projects/${project.project_id}/network`;

    const [geoRes, netRes] = await Promise.all([
      this.fetchJson<any>(geoUrl, 'GET'),
      this.fetchJson<any>(networkUrl, 'GET'),
    ]);

    const isReal = geoRes !== null || netRes !== null;
    const geoScore = Number(geoRes?.geo_score ?? (project.location.latitude === 0 ? 0.5 : 0.1));
    const geoWithin = geoRes?.is_within_bounds ?? true;

    const iaScore = Number(netRes?.metrics?.ia_risk_score ?? 0.25);
    const iaHhi = Number(netRes?.metrics?.hhi_concentration_index ?? 0.20);

    const reasons: string[] = [];
    if (!geoWithin) reasons.push(`Project coordinate falls outside assigned constituency (${project.constituency_id})`);
    if (netRes?.metrics?.is_high_concentration) reasons.push(`Implementing Agency exhibits high MP concentration (HHI: ${iaHhi})`);

    if (!isReal) {
      console.warn(`[IntegrationAggregator] WARNING: Downstream Person 3 Intelligence Service (${this.person3Url}) is unreachable. MOCK_MODE is false.`);
      reasons.push(`[P3_SERVICE_UNAVAILABLE] Person 3 Intelligence service is unreachable at ${this.person3Url}; fallback score is non-authoritative.`);
    }

    return {
      ia_score: iaScore,
      geo_score: geoScore,
      ia_hhi: iaHhi,
      geo_within: geoWithin,
      reasons,
      isReal,
    };
  }

  /**
   * Aggregates signals into the canonical 6-dimensional risk assessment.
   */
  public async aggregateProject(project: ProjectEntity): Promise<CanonicalRiskAssessment> {
    const [p2, p3] = await Promise.all([
      this.scoreWithPerson2(project),
      this.scoreWithPerson3(project),
    ]);

    const evidenceScore = project.synthetic_scenario === 'DUPLICATE_PROJECT_PAIR' ? 0.85 : 0.15;

    // Weight composition: 0.25 Financial + 0.20 Timeline + 0.20 Compliance + 0.20 IA + 0.10 Geo + 0.05 Evidence
    const overall = parseFloat(
      (
        p2.financial_score * 0.25 +
        p2.timeline_score * 0.20 +
        p2.compliance_score * 0.20 +
        p3.ia_score * 0.20 +
        p3.geo_score * 0.10 +
        evidenceScore * 0.05
      ).toFixed(2)
    );

    let riskLevel: RiskLevel = 'LOW';
    if (overall >= 0.70) riskLevel = 'CRITICAL';
    else if (overall >= 0.50) riskLevel = 'HIGH';
    else if (overall >= 0.30) riskLevel = 'MEDIUM';

    const combinedReasons = Array.from(new Set([...p2.reasons, ...p3.reasons]));
    if (combinedReasons.length === 0) {
      combinedReasons.push('Standard monitoring parameters within benchmarks');
    }

    const isRealLive = p2.isReal && p3.isReal;
    const isMock = process.env.MOCK_MODE === 'true';

    const metadata: ModelMetadata = {
      model_source: isRealLive
        ? 'person2-risk-service + person3-intelligence-service'
        : isMock
        ? 'person1-mock-sandbox'
        : 'person1-integration-local-engine (DOWNSTREAM_SERVICES_OFFLINE)',
      models: isRealLive ? ['IsolationForest', 'RuleEngine', 'SentenceBERT', 'NetworkX-HHI'] : ['HeuristicRuleBaseline'],
      model_version: isRealLive ? 'v1' : 'HEURISTIC_BASELINE_V1',
      mode: isRealLive ? 'REAL' : 'DEVELOPMENT_FALLBACK',
      warning: isRealLive
        ? undefined
        : isMock
        ? 'Computed under mock sandbox mode.'
        : 'MOCK_MODE is false but downstream P2/P3 services were unavailable. Fallback scores are explicitly non-authoritative.',
      scored_at: new Date().toISOString(),
    };

    return {
      project_id: project.project_id,
      financial_score: parseFloat(p2.financial_score.toFixed(2)),
      timeline_score: parseFloat(p2.timeline_score.toFixed(2)),
      compliance_score: parseFloat(p2.compliance_score.toFixed(2)),
      ia_score: parseFloat(p3.ia_score.toFixed(2)),
      geo_score: parseFloat(p3.geo_score.toFixed(2)),
      evidence_score: parseFloat(evidenceScore.toFixed(2)),
      overall_score: overall,
      risk_level: riskLevel,
      reasons: combinedReasons,
      model_metadata: metadata,
      // Frontend aliases
      financial_risk: parseFloat(p2.financial_score.toFixed(2)),
      timeline_risk: parseFloat(p2.timeline_score.toFixed(2)),
      compliance_risk: parseFloat(p2.compliance_score.toFixed(2)),
      ia_risk: parseFloat(p3.ia_score.toFixed(2)),
      geo_risk: parseFloat(p3.geo_score.toFixed(2)),
      evidence_risk: parseFloat(evidenceScore.toFixed(2)),
      overall_risk: overall,
    };
  }
}
