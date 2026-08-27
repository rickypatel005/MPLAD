/**
 * SIH26102 — Database Layer Unit Tests (Phase 10)
 * Tests for: AppDatabase singleton, queries, review actions, audit logging
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { AppDatabase } from '../../src/db/database.ts';

let db: AppDatabase;

beforeAll(() => {
  db = AppDatabase.getInstance();
});

// ─────────────────────────────────────────────
// Phase 5: Database Initialization
// ─────────────────────────────────────────────

describe('Phase 5 — Database Initialization & Indexing', () => {
  it('should initialize as a singleton', () => {
    const db2 = AppDatabase.getInstance();
    expect(db).toBe(db2); // Same instance
  });

  it('should load all 36 states', () => {
    expect(db.states.length).toBe(36);
  });

  it('should load 543 MPs', () => {
    expect(db.mps.length).toBe(543);
  });

  it('should generate 10,000+ projects', () => {
    expect(db.projects.length).toBeGreaterThanOrEqual(10000);
  });

  it('should generate payments', () => {
    expect(db.payments.length).toBeGreaterThan(0);
  });

  it('should generate implementing agencies', () => {
    expect(db.agencies.length).toBeGreaterThan(0);
  });

  it('should generate a pipeline profile report', () => {
    expect(db.profileReport).not.toBeNull();
    expect(db.profileReport!.raw_file_name).toBe('Allocated Limit for Honble MPs.csv');
    expect(db.profileReport!.validation_suite.all_passed).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Phase 7.1: Project Queries
// ─────────────────────────────────────────────

describe('Phase 7.1 — Project Queries', () => {
  it('should paginate projects correctly', () => {
    const result = db.getProjects({ page: 1, page_size: 25 });
    expect(result.items.length).toBe(25);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.page_size).toBe(25);
    expect(result.pagination.total_items).toBeGreaterThanOrEqual(10000);
    expect(result.pagination.has_next).toBe(true);
    expect(result.pagination.has_prev).toBe(false);
  });

  it('should filter by state_id', () => {
    const result = db.getProjects({ page: 1, page_size: 50, state_id: 'ST34' });
    for (const item of result.items) {
      expect(item.state_id).toBe('ST34');
    }
  });

  it('should filter by status', () => {
    const result = db.getProjects({ page: 1, page_size: 50, status: 'STALLED' });
    for (const item of result.items) {
      expect(item.status).toBe('STALLED');
    }
  });

  it('should filter by risk_level', () => {
    const result = db.getProjects({ page: 1, page_size: 50, risk_level: 'CRITICAL' });
    for (const item of result.items) {
      expect(item.risk_score?.risk_level).toBe('CRITICAL');
    }
  });

  it('should search by text across multiple fields', () => {
    const result = db.getProjects({ page: 1, page_size: 50, search: 'Road' });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('should retrieve a specific project by ID', () => {
    const project = db.getProjectById('P10342');
    expect(project).not.toBeNull();
    expect(project!.project_id).toBe('P10342');
    expect(project!.synthetic_scenario).toBe('PAYMENT_PROGRESS_MISMATCH');
  });

  it('should return null for non-existent project', () => {
    const project = db.getProjectById('P99999');
    expect(project).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Phase 7.2: Dashboard Summary
// ─────────────────────────────────────────────

describe('Phase 7.2 — Dashboard Summary', () => {
  it('should return a complete dashboard summary', () => {
    const summary = db.getDashboardSummary();
    expect(summary.total_projects).toBeGreaterThanOrEqual(10000);
    expect(summary.total_allocated_budget).toBeGreaterThan(0);
    expect(summary.total_utilized_budget).toBeGreaterThan(0);
    expect(summary.overall_physical_avg).toBeGreaterThanOrEqual(0);
    expect(summary.overall_financial_avg).toBeGreaterThanOrEqual(0);
  });

  it('should include status breakdown', () => {
    const summary = db.getDashboardSummary();
    expect(summary.status_breakdown).toHaveProperty('NOT_STARTED');
    expect(summary.status_breakdown).toHaveProperty('IN_PROGRESS');
    expect(summary.status_breakdown).toHaveProperty('COMPLETED');
    expect(summary.status_breakdown).toHaveProperty('STALLED');
  });

  it('should include risk level breakdown', () => {
    const summary = db.getDashboardSummary();
    expect(summary.risk_level_breakdown).toHaveProperty('LOW');
    expect(summary.risk_level_breakdown).toHaveProperty('MEDIUM');
    expect(summary.risk_level_breakdown).toHaveProperty('HIGH');
    expect(summary.risk_level_breakdown).toHaveProperty('CRITICAL');
  });

  it('should include state aggregates for all 36 states', () => {
    const summary = db.getDashboardSummary();
    expect(summary.state_aggregates.length).toBe(36);
  });

  it('should return state-level dashboard for a valid state', () => {
    const stateData = db.getStateDashboard('ST34');
    expect(stateData).not.toBeNull();
    expect(stateData!.state.state_id).toBe('ST34');
    expect(stateData!.total_projects).toBeGreaterThan(0);
  });

  it('should return null for invalid state', () => {
    const stateData = db.getStateDashboard('ST99');
    expect(stateData).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Phase 7.3: Risk Queries
// ─────────────────────────────────────────────

describe('Phase 7.3 — Risk Queries', () => {
  it('should return top risk projects sorted by overall_score descending', () => {
    const top = db.getTopRiskProjects(10);
    expect(top.length).toBe(10);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].overall).toBeGreaterThanOrEqual(top[i].overall);
    }
  });
});

// ─────────────────────────────────────────────
// Phase 7.4: Duplicate Detection
// ─────────────────────────────────────────────

describe('Phase 7.4 — Duplicate Detection', () => {
  it('should find duplicates for P10701', () => {
    const dups = db.getDuplicatesForProject('P10701');
    expect(dups).not.toBeNull();
    expect(dups!.matches.length).toBeGreaterThan(0);
    expect(dups!.max_similarity).toBeGreaterThan(0.9);
  });

  it('should find duplicates for P10702 (reverse lookup)', () => {
    const dups = db.getDuplicatesForProject('P10702');
    expect(dups).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// Phase 7.5: Agency Queries
// ─────────────────────────────────────────────

describe('Phase 7.5 — Agency Queries', () => {
  it('should return agency data for a valid IA ID', () => {
    const ia = db.agencies[0];
    const data = db.getAgencyById(ia.ia_id);
    expect(data).not.toBeNull();
    expect(data!.agency.ia_id).toBe(ia.ia_id);
  });

  it('should return null for invalid IA ID', () => {
    const data = db.getAgencyById('IA999');
    expect(data).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Phase 7.6 & 7.7: Review Actions & Audit Trail
// ─────────────────────────────────────────────

describe('Phase 7.6/7.7 — Review Actions & Audit Trail', () => {
  it('should add a review action and return the record', () => {
    const review = db.addReviewAction(
      'P10342',
      'INVESTIGATE',
      'USR-002',
      'Test Auditor',
      'AUDITOR',
      'Dispatching DVO for physical audit.'
    );

    expect(review).toBeDefined();
    expect(review.project_id).toBe('P10342');
    expect(review.action).toBe('INVESTIGATE');
    expect(review.reviewer_name).toBe('Test Auditor');
  });

  it('should update the project review_status after review action', () => {
    const project = db.getProjectById('P10342');
    expect(project).not.toBeNull();
    expect(project!.review_status).toBe('INVESTIGATE');
    expect(project!.review_count).toBeGreaterThanOrEqual(1);
  });

  it('should create an audit log entry for the review action', () => {
    const auditLogs = db.getAuditTrailForProject('P10342');
    expect(auditLogs.length).toBeGreaterThan(0);

    const reviewLog = auditLogs.find((l) => l.action.includes('REVIEW_DECISION'));
    expect(reviewLog).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// Phase 7.8: Evidence Dossier
// ─────────────────────────────────────────────

describe('Phase 7.8 — Evidence Dossier', () => {
  it('should generate an evidence dossier for P10342', () => {
    const dossier = db.getEvidenceDossier('P10342');
    expect(dossier).not.toBeNull();
    expect(dossier!.project_id).toBe('P10342');
    expect(dossier!.evidence_items.length).toBeGreaterThan(0);
    expect(dossier!.risk_vector).toBeDefined();
    expect(dossier!.anomaly_narrative).toBeTruthy();
  });

  it('should include regulatory infractions for payment mismatch project', () => {
    const dossier = db.getEvidenceDossier('P10342');
    expect(dossier!.regulatory_infractions.length).toBeGreaterThan(0);
  });

  it('should include duplicate findings for P10701', () => {
    const dossier = db.getEvidenceDossier('P10701');
    expect(dossier).not.toBeNull();
    expect(dossier!.duplicate_findings).toBeDefined();
  });

  it('should return null for non-existent project', () => {
    const dossier = db.getEvidenceDossier('P99999');
    expect(dossier).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Phase 8: Person 2 (Risk/ML) & Person 3 (NLP/Geo) Integration Boundaries
// ─────────────────────────────────────────────

describe('Phase 8 — Person 2 & Person 3 Integration Contracts', () => {
  it('should extract feature-ready dataset for P2/P3 models', () => {
    const features = db.getFeatureDataset(100);
    expect(features.length).toBe(100);
    const sample = features[0];
    expect(sample).toHaveProperty('project_id');
    expect(sample).toHaveProperty('sanction_amount');
    expect(sample).toHaveProperty('physical_progress');
    expect(sample).toHaveProperty('financial_progress');
    expect(sample).toHaveProperty('discrepancy_progress');
    expect(sample).toHaveProperty('latitude');
    expect(sample).toHaveProperty('longitude');
  });

  it('should persist Person 2 ML risk score output and update project state', () => {
    const saved = db.saveRiskScore({
      project_id: 'P10001',
      overall_score: 0.92,
      risk_level: 'CRITICAL',
      financial_score: 0.95,
      timeline_score: 0.85,
      compliance_score: 0.70,
      ia_score: 0.80,
      geo_score: 0.50,
      evidence_score: 0.90,
      model_version: 'TEST_ISOFOREST_V2.0',
      scored_at: new Date().toISOString(),
      reasons: ['Unit testing ML risk score injection'],
    });

    expect(saved).toBe(true);
    const proj = db.getProjectById('P10001');
    expect(proj).not.toBeNull();
    expect(proj!.risk_score?.overall_score).toBe(0.92);
    expect(proj!.detector_model_version).toBe('TEST_ISOFOREST_V2.0');
    expect(proj!.detector_flagged).toBe(true);
  });

  it('should persist Person 2 anomaly risk flag', () => {
    const saved = db.saveRiskFlag({
      flag_id: 'FLAG-TEST-001',
      project_id: 'P10001',
      flag_type: 'FINANCIAL',
      severity: 'CRITICAL',
      rule_code: 'TEST_RULE_99',
      message: 'Severe disbursement discrepancy detected by ML',
      evidence_json: { test: true },
      created_at: new Date().toISOString(),
    });

    expect(saved).toBe(true);
    const proj = db.getProjectById('P10001');
    expect(proj?.flags?.some((f) => f.flag_id === 'FLAG-TEST-001')).toBe(true);
  });

  it('should persist Person 3 duplicate cluster output', () => {
    const saved = db.saveDuplicateCluster({
      cluster_id: 'CLUST-TEST-999',
      primary_project_id: 'P10001',
      suspected_count: 2,
      max_similarity: 0.96,
      total_suspect_amount: 10000000,
      matches: [
        {
          match_project_id: 'P10002',
          match_project_name: 'Near duplicate project test',
          match_description: 'Near duplicate description',
          overall_similarity: 0.96,
          text_similarity: 0.98,
          geo_distance_meters: 35.5,
          date_proximity_days: 10,
          same_ia: true,
          match_reasons: ['Text match', 'Geo proximity'],
        },
      ],
    });

    expect(saved).toBe(true);
    const dups = db.getDuplicatesForProject('P10001');
    expect(dups).not.toBeNull();
    expect(dups!.cluster_id).toBe('CLUST-TEST-999');
  });
});
