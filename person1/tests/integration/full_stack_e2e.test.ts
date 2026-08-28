/**
 * SIH26102 — End-to-End Full Stack Multi-Service Integration Test Suite
 *
 * Verifies the complete unified contract across:
 * - Person 1: Master Store, Database, Derived Views, RBAC & API Endpoints
 * - Person 2: Risk Scoring & Isolation Forest ML Integration
 * - Person 3: Sentence-BERT Duplicates, Tripartite IA Graph HHI, Geo Boundary
 * - Person 4: Frontend Contract & Investigation Payload Compatibility
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import { AppDatabase } from '../../src/db/database.ts';
import { FrontendDataStore } from '../../src/db/frontendData.ts';
import { IntegrationAggregator } from '../../src/services/integrationAggregator.ts';
import { generateToken } from '../../src/middleware/auth.ts';

describe('SIH26102 — Full Stack End-to-End Integration Verification', () => {
  let auditorToken: string;
  let adminToken: string;
  let viewerToken: string;
  let sampleProjectId: string;

  beforeAll(() => {
    // Initialize in-memory data store
    AppDatabase.getInstance();
    const store = FrontendDataStore.getInstance();
    store.initialize();

    // Ensure sample project is available
    expect(store.records.length).toBeGreaterThan(0);
    sampleProjectId = store.records[0].p1.project_id;

    // Generate tokens for RBAC testing
    auditorToken = generateToken({
      user_id: 'USR-002',
      username: 'auditor',
      role: 'AUDITOR',
      display_name: 'Shri R. Sharma (CAG)',
    });

    adminToken = generateToken({
      user_id: 'USR-001',
      username: 'admin',
      role: 'ADMIN',
      display_name: 'Dr. V. Rao (MoSPI Admin)',
    });

    viewerToken = generateToken({
      user_id: 'USR-003',
      username: 'viewer',
      role: 'VIEWER',
      display_name: 'Public Viewer',
    });
  });

  // ─────────────────────────────────────────────
  // 1. Health & Central API Gateway
  // ─────────────────────────────────────────────
  describe('1. Central API Gateway & OpenAPI', () => {
    it('GET /health — returns 200/503 and status payload', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('version');
    });

    it('GET /api/health — returns 200/503 and database metadata', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('database');
    });

    it('GET /api/openapi.json — serves valid OpenAPI 3.0 document', async () => {
      const res = await request(app).get('/api/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toMatch(/^3\.0\./);
      expect(res.body.info).toHaveProperty('title');
    });
  });

  // ─────────────────────────────────────────────
  // 2. Person 4 Frontend Contract Endpoints
  // ─────────────────────────────────────────────
  describe('2. Frontend Unified API Endpoints', () => {
    it('GET /api/dashboard — returns KPIs, ranked projects and facets', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('kpis');
      expect(res.body).toHaveProperty('top_projects');
      expect(res.body).toHaveProperty('projects');
      expect(res.body).toHaveProperty('facets');
      expect(res.body.kpis).toHaveProperty('total_projects_analyzed');
      expect(res.body.kpis).toHaveProperty('counts_by_risk_level');
    });

    it('GET /api/projects — returns paginated, filterable projects', async () => {
      const res = await request(app).get('/api/projects?page=1&page_size=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('GET /api/project/:id — returns canonical 6-dimension investigation payload', async () => {
      const res = await request(app).get(`/api/project/${sampleProjectId}`);
      expect(res.status).toBe(200);
      const data = res.body;

      // Project entity
      expect(data).toHaveProperty('project');
      expect(data.project.project_id).toBe(sampleProjectId);

      // Canonical 6-dimensional risk score
      expect(data).toHaveProperty('risk_score');
      const rs = data.risk_score;
      expect(rs).toHaveProperty('financial_risk');
      expect(rs).toHaveProperty('timeline_risk');
      expect(rs).toHaveProperty('compliance_risk');
      expect(rs).toHaveProperty('ia_risk');
      expect(rs).toHaveProperty('geo_risk');
      expect(rs).toHaveProperty('evidence_risk');
      expect(rs).toHaveProperty('overall_risk');
      expect(rs).toHaveProperty('risk_level');

      // Evidence details & audit trail
      expect(data).toHaveProperty('risk_dimensions');
      expect(data.risk_dimensions).toHaveLength(6);
      expect(data).toHaveProperty('payments');
      expect(data).toHaveProperty('timeline');
      expect(data).toHaveProperty('implementing_agency');
      expect(data).toHaveProperty('mp');
      expect(data).toHaveProperty('district');
    });

    it('GET /api/alerts — returns paginated alert feed with risk levels', async () => {
      const res = await request(app).get('/api/alerts?page=1&page_size=20');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('alerts');
      expect(res.body).toHaveProperty('counts_by_level');
      expect(res.body.alerts.items.length).toBeGreaterThan(0);
      const firstAlert = res.body.alerts.items[0];
      expect(firstAlert).toHaveProperty('alert_id');
      expect(firstAlert).toHaveProperty('alert_level');
      expect(firstAlert).toHaveProperty('alert_message');
    });

    it('GET /api/network — returns tripartite MP-IA-District graph with HHI thresholds', async () => {
      const res = await request(app).get('/api/network');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('nodes');
      expect(res.body).toHaveProperty('edges');
      expect(res.body).toHaveProperty('node_details');
      expect(res.body).toHaveProperty('legend');
      expect(res.body.legend).toHaveProperty('hhi_concentration_threshold');
      expect(res.body.nodes.length).toBeGreaterThan(0);
    });

    it('GET /api/duplicates — returns duplicate pairs with similarity and distance', async () => {
      const res = await request(app).get('/api/duplicates?page=1&page_size=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pairs');
      expect(res.body).toHaveProperty('counts');
      expect(res.body.pairs.items.length).toBeGreaterThan(0);
      const firstPair = res.body.pairs.items[0];
      expect(firstPair).toHaveProperty('similarity_score');
      expect(firstPair).toHaveProperty('geo_distance_km');
      expect(firstPair).toHaveProperty('project_a');
      expect(firstPair).toHaveProperty('project_b');
    });

    it('GET /api/map-data — returns district aggregates and project markers', async () => {
      const res = await request(app).get('/api/map-data');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('districts');
      expect(res.body).toHaveProperty('projects');
      expect(res.body).toHaveProperty('coverage');
      expect(res.body.districts.length).toBeGreaterThan(0);
      expect(res.body.projects.length).toBeGreaterThan(0);
    });

    it('GET /api/compliance-summary — returns 6 guideline rules and SC/ST mandate', async () => {
      const res = await request(app).get('/api/compliance-summary');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rules');
      expect(res.body).toHaveProperty('states');
      expect(res.body).toHaveProperty('scst_mandate');
      expect(res.body.rules).toHaveLength(6);
      expect(res.body.scst_mandate).toHaveProperty('sc_mandate_share', 0.15);
      expect(res.body.scst_mandate).toHaveProperty('st_mandate_share', 0.075);
    });

    it('GET /api/report/:id — returns formal structured audit report dossier', async () => {
      const res = await request(app).get(`/api/report/${sampleProjectId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('project_id', sampleProjectId);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('disclaimer');
      expect(res.body).toHaveProperty('sections');
      expect(res.body.sections.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─────────────────────────────────────────────
  // 3. Auditor Review Actions & Governance
  // ─────────────────────────────────────────────
  describe('3. Auditor Governance & Review Actions', () => {
    it('POST /api/review/action — allows AUDITOR to record an ESCALATE review action', async () => {
      const res = await request(app)
        .post('/api/review/action')
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({
          project_id: sampleProjectId,
          action: 'ESCALATE',
          comment: 'Escalating to District Collector due to significant physical-financial progress gap.',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('review');
      expect(res.body.review).toHaveProperty('action', 'ESCALATE');
      expect(res.body.review).toHaveProperty('project_id', sampleProjectId);
    });

    it('POST /api/review/action — rejects unauthorized VIEWER role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/review/action')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          project_id: sampleProjectId,
          action: 'DISMISS',
          comment: 'Unauthorized dismissal attempt',
        });

      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────
  // 4. Central Risk Aggregator & Model Truthfulness
  // ─────────────────────────────────────────────
  describe('4. Central Aggregator & Model Truthfulness', () => {
    it('IntegrationAggregator — synthesizes 6 risk dimensions and enforces truthful metadata', async () => {
      const db = AppDatabase.getInstance();
      const project = db.projects[0];
      const aggregator = IntegrationAggregator.getInstance();

      const canonical = await aggregator.aggregateProject(project);

      // Verify canonical dimensions
      expect(canonical.project_id).toBe(project.project_id);
      expect(canonical.financial_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.timeline_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.compliance_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.ia_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.geo_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.evidence_score).toBeGreaterThanOrEqual(0.0);
      expect(canonical.overall_score).toBeGreaterThanOrEqual(0.0);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(canonical.risk_level);

      // Verify truthful model metadata (No fake XGBoost/SHAP)
      expect(canonical.model_metadata.model_version).not.toContain('v2.6-Ensemble-IsoForest-XGB');
      expect(canonical.model_metadata.models).not.toContain('XGBoost');
      expect(['REAL', 'DEVELOPMENT_FALLBACK']).toContain(canonical.model_metadata.mode);
    });
  });
});
