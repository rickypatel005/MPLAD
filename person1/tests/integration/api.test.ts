/**
 * SIH26102 — API Integration Tests (Phase 10)
 * Uses supertest to make actual HTTP requests against the Express server backed by PostgreSQL.
 * Tests RBAC security (200/401/403), new query filters, PostGIS spatial queries, and P2/P3 persistence.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import {
  authenticateUser,
  generateToken,
  verifyToken,
} from '../../src/middleware/auth.ts';
import { checkDatabaseConnection, closePool, runMigrations, seedDatabase } from '../../src/db/postgres.ts';

describe('Phase 9 — Authentication & RBAC Token Generation', () => {
  it('should authenticate valid demo user: auditor', () => {
    const result = authenticateUser('auditor', 'audit123');
    expect(result).not.toBeNull();
    expect(result!.token).toBeTruthy();
    expect(result!.user.username).toBe('auditor');
    expect(result!.user.role).toBe('AUDITOR');
    expect(result!.user.display_name).toBe('Shri R. Sharma (CAG)');
  });

  it('should authenticate valid demo user: admin', () => {
    const result = authenticateUser('admin', 'admin123');
    expect(result).not.toBeNull();
    expect(result!.user.role).toBe('ADMIN');
  });

  it('should authenticate valid demo user: reviewer', () => {
    const result = authenticateUser('reviewer', 'review123');
    expect(result).not.toBeNull();
    expect(result!.user.role).toBe('REVIEWER');
  });

  it('should authenticate valid demo user: viewer', () => {
    const result = authenticateUser('viewer', 'view123');
    expect(result).not.toBeNull();
    expect(result!.user.role).toBe('VIEWER');
  });

  it('should reject invalid password', () => {
    const result = authenticateUser('auditor', 'wrongpassword');
    expect(result).toBeNull();
  });

  it('should reject non-existent user', () => {
    const result = authenticateUser('nonexistent', 'password');
    expect(result).toBeNull();
  });

  it('should generate and verify a valid JWT token', () => {
    const token = generateToken({
      user_id: 'USR-002',
      username: 'auditor',
      role: 'AUDITOR',
      display_name: 'Shri R. Sharma',
    });

    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(3);

    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.username).toBe('auditor');
    expect(payload!.role).toBe('AUDITOR');
    expect(payload!.user_id).toBe('USR-002');
  });

  it('should reject a tampered token', () => {
    const token = generateToken({
      user_id: 'USR-002',
      username: 'auditor',
      role: 'AUDITOR',
      display_name: 'Test',
    });

    const parts = token.split('.');
    parts[1] = parts[1] + 'TAMPERED';
    const tamperedToken = parts.join('.');

    const payload = verifyToken(tamperedToken);
    expect(payload).toBeNull();
  });
});

describe('Phase 7, 8 & 9 — Express HTTP Integration & API Endpoints', () => {
  let isDbConnected = false;
  let adminToken: string;
  let auditorToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const conn = await checkDatabaseConnection();
    isDbConnected = conn.connected;

    if (isDbConnected) {
      await runMigrations();
      await seedDatabase({ reset: true, projectCount: 500, seed: 26102 });
    }

    const adminAuth = authenticateUser('admin', 'admin123');
    adminToken = adminAuth!.token;

    const auditorAuth = authenticateUser('auditor', 'audit123');
    auditorToken = auditorAuth!.token;

    const viewerAuth = authenticateUser('viewer', 'view123');
    viewerToken = viewerAuth!.token;
  });

  afterAll(async () => {
    await closePool();
  });

  // 1. Auth Endpoint HTTP
  it('POST /api/auth/login — should return token on valid login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor', password: 'audit123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('AUDITOR');
  });

  it('POST /api/auth/login — should return 401 on invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'auditor', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/auth/me — should return user profile with valid Bearer token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('auditor');
  });

  it('GET /api/auth/me — should return 401 without Bearer token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // 2. Health Endpoint
  it('GET /api/health — should return system and DB health status', async () => {
    const res = await request(app).get('/api/health');
    if (isDbConnected) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database.connected).toBe(true);
      expect(res.body.total_projects).toBeGreaterThan(0);
    } else {
      expect(res.status).toBe(503);
      expect(res.body.database.connected).toBe(false);
    }
  });

  // 3. Projects Endpoints & New Filters (Gap 8)
  it('GET /api/projects — should support pagination and return project list', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/projects?page=1&page_size=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
    expect(res.body.pagination.total_items).toBeGreaterThanOrEqual(500);
  });

  it('GET /api/projects — should filter by district_id (Gap 8)', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const targetDistrict = sampleRes.body.items[0].district_id;

    const res = await request(app).get(`/api/projects?district_id=${targetDistrict}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.district_id).toBe(targetDistrict);
    }
  });

  it('GET /api/projects — should filter by agency (Gap 8)', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const targetIaId = sampleRes.body.items[0].ia_id;

    const res = await request(app).get(`/api/projects?agency=${targetIaId}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.ia_id).toBe(targetIaId);
    }
  });

  it('GET /api/projects — should filter by date_from and date_to (Gap 8)', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/projects?date_from=2024-01-01&date_to=2025-12-31');
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(new Date(item.sanction_date).getTime()).toBeGreaterThanOrEqual(new Date('2024-01-01').getTime());
      expect(new Date(item.sanction_date).getTime()).toBeLessThanOrEqual(new Date('2025-12-31').getTime());
    }
  });

  it('GET /api/projects — should filter by combined parameters (state_id + date_from)', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const stateId = sampleRes.body.items[0].state_id;

    const res = await request(app).get(`/api/projects?state_id=${stateId}&date_from=2023-01-01`);
    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.state_id).toBe(stateId);
    }
  });

  // 4. PostGIS Spatial Query Endpoint (Gap 4)
  it('GET /api/projects/spatial — should return projects within radius via PostGIS', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/projects/spatial?lat=28.6139&lng=77.2090&radius_km=300');
    expect(res.status).toBe(200);
    expect(res.body.center).toEqual({ lat: 28.6139, lng: 77.2090 });
    expect(res.body.radius_meters).toBe(300000);
    expect(Array.isArray(res.body.projects)).toBe(true);

    if (res.body.projects.length > 0) {
      expect(res.body.projects[0]).toHaveProperty('distance_meters');
      expect(res.body.projects[0].distance_meters).toBeLessThanOrEqual(300000);
    }
  });

  it('GET /api/projects/spatial — should return 400 on invalid coordinates', async () => {
    const res = await request(app).get('/api/projects/spatial?lat=invalid&lng=77.2090');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_COORDINATES');
  });

  // 5. Dashboard Endpoints
  it('GET /api/dashboard/summary — should return aggregated dashboard metrics', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.total_projects).toBeGreaterThan(0);
    expect(res.body.status_breakdown).toBeDefined();
    expect(res.body.category_breakdown.length).toBeGreaterThan(0);
    expect(res.body.state_aggregates.length).toBe(36);
  });

  it('GET /api/dashboard/state/:id — should return state-specific dashboard', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/dashboard/state/MH');
    expect(res.status).toBe(200);
    expect(res.body.state).toBeDefined();
    expect(res.body.state.state_id).toBe('MH');
  });

  // 6. Risk Endpoints & P2 Model Integration (Gap 7)
  it('GET /api/risk/top — should return ranked top risk projects', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/risk/top?limit=5');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].overall).toBeGreaterThanOrEqual(res.body[1].overall);
  });

  it('POST /api/risk/scores — should persist risk score into PostgreSQL with AUDITOR role', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const projId = sampleRes.body.items[0].project_id;

    const postRes = await request(app)
      .post('/api/risk/scores')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        project_id: projId,
        overall_score: 0.92,
        risk_level: 'CRITICAL',
        financial_score: 0.95,
        timeline_score: 0.88,
        compliance_score: 0.90,
        model_version: 'TEST_MODEL_V3',
        reasons: ['Severe test financial anomaly detected'],
      });

    expect(postRes.status).toBe(200);

    // Verify it persists and is returned by GET /api/risk/:id
    const getRes = await request(app).get(`/api/risk/${projId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.overall_score).toBe(0.92);
    expect(getRes.body.risk_level).toBe('CRITICAL');
    expect(getRes.body.model_version).toBe('TEST_MODEL_V3');
  });

  it('POST /api/risk/scores — should reject unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/risk/scores')
      .send({ project_id: 'P10001', overall_score: 0.9, risk_level: 'HIGH' });

    expect(res.status).toBe(401);
  });

  it('POST /api/risk/scores — should reject VIEWER role with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/risk/scores')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ project_id: 'P10001', overall_score: 0.9, risk_level: 'HIGH' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 7. Person 3 Duplicate Clusters (Gap 7)
  it('POST /api/duplicates/submit — should persist duplicate cluster into PostgreSQL', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=2');
    const p1 = sampleRes.body.items[0].project_id;
    const p2 = sampleRes.body.items[1].project_id;

    const res = await request(app)
      .post('/api/duplicates/submit')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        primary_project_id: p1,
        suspected_count: 2,
        max_similarity: 0.91,
        total_suspect_amount: 15000000,
        matches: [
          {
            match_project_id: p2,
            match_project_name: 'Overlapping road construction',
            match_description: 'Same road segment',
            overall_similarity: 0.91,
            text_similarity: 0.95,
            geo_distance_meters: 25.0,
            date_proximity_days: 12,
            same_ia: true,
            match_reasons: ['Exact GPS polygon overlap', 'Same implementing agency'],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.cluster_id).toBeTruthy();

    // Verify GET /api/duplicates/:id retrieves it
    const dupRes = await request(app).get(`/api/duplicates/${p1}`);
    expect(dupRes.status).toBe(200);
    expect(dupRes.body.matches.length).toBeGreaterThan(0);
    expect(dupRes.body.matches[0].match_project_id).toBe(p2);
  });

  // 8. Human Review Action & RBAC Security (Gap 5 & Gap 7)
  it('POST /api/review/action — should record review action with AUDITOR role and update audit log', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const projId = sampleRes.body.items[0].project_id;

    const res = await request(app)
      .post('/api/review/action')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        project_id: projId,
        action: 'INVESTIGATE',
        comment: 'Dispatched vigilance officer for on-site physical audit.',
      });

    expect(res.status).toBe(200);
    expect(res.body.review.action).toBe('INVESTIGATE');

    // Verify audit log has the review event
    const auditRes = await request(app).get(`/api/audit/${projId}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.events.some((e: any) => e.action.includes('INVESTIGATE'))).toBe(true);
  });

  it('POST /api/review/action — should reject VIEWER with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/review/action')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        project_id: 'P10001',
        action: 'INVESTIGATE',
      });

    expect(res.status).toBe(403);
  });

  // 9. Feature Extraction & OpenAPI Endpoints
  it('GET /api/features/projects — should return feature vectors for ML models', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/features/projects?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.features).toHaveLength(10);
    expect(res.body.features[0]).toHaveProperty('sanction_amount');
    expect(res.body.features[0]).toHaveProperty('discrepancy_progress');
  });

  it('GET /api/openapi.json — should serve valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/api/projects/spatial']).toBeDefined();
    expect(res.body.paths['/api/projects'].get.parameters.some((p: any) => p.name === 'district_id')).toBe(true);
  });
});
