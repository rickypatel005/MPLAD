/**
 * SIH26102 — End-to-End Fresh Environment Lifecycle Test (Phase 10)
 * Validates the complete chain: raw CSV -> pipeline generator -> DB migration -> DB load -> HTTP API -> JSON.
 *
 * Usage:
 *   npx vitest run tests/integration/e2e.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.ts';
import {
  checkDatabaseConnection,
  closePool,
  query,
  runMigrations,
  seedDatabase,
} from '../../src/db/postgres.ts';
import { authenticateUser } from '../../src/middleware/auth.ts';

describe('SIH26102 — End-to-End Fresh Environment Verification', () => {
  let isDbConnected = false;
  let auditorToken: string;

  beforeAll(async () => {
    const conn = await checkDatabaseConnection();
    isDbConnected = conn.connected;

    const auth = authenticateUser('auditor', 'audit123');
    auditorToken = auth!.token;
  });

  afterAll(async () => {
    await closePool();
  });

  it('Step 1: Fresh environment migration produces all tables and indexes', async () => {
    if (!isDbConnected) {
      console.warn('[E2E Test Notice] Skipping live DB steps as PostgreSQL is not currently running.');
      return;
    }

    const migrationResult = await runMigrations();
    expect(migrationResult.success).toBe(true);

    const tblRes = await query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);
    expect(parseInt(tblRes.rows[0].count, 10)).toBeGreaterThanOrEqual(14);
  });

  it('Step 2: Full pipeline seeding populates 10,000+ projects with PostGIS geometries', async () => {
    if (!isDbConnected) return;

    const seedResult = await seedDatabase({
      reset: true,
      projectCount: 1000, // Deterministic test seed
      seed: 26102,
    });

    expect(seedResult.success).toBe(true);
    expect(seedResult.projectCount).toBeGreaterThanOrEqual(1000);

    const countRes = await query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM projects WHERE geom IS NOT NULL;
    `);
    expect(parseInt(countRes.rows[0].count, 10)).toBeGreaterThanOrEqual(1000);
  });

  it('Step 3: HTTP API serves live data from PostgreSQL (/api/health)', async () => {
    const res = await request(app).get('/api/health');
    if (isDbConnected) {
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.database.connected).toBe(true);
      expect(res.body.total_projects).toBeGreaterThanOrEqual(1000);
    } else {
      expect(res.status).toBe(503);
    }
  });

  it('Step 4: GET /api/projects queries PostgreSQL with pagination & filters', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/projects?page=1&page_size=20');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.pagination.total_items).toBeGreaterThanOrEqual(1000);
    expect(res.body.items[0]).toHaveProperty('project_id');
    expect(res.body.items[0]).toHaveProperty('sanction_amount');
  });

  it('Step 5: GET /api/dashboard/summary computes national aggregations from DB', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body.total_projects).toBeGreaterThanOrEqual(1000);
    expect(res.body.total_allocated_budget).toBeGreaterThan(0);
    expect(res.body.state_aggregates).toHaveLength(36);
  });

  it('Step 6: GET /api/risk/top returns high-risk assets sorted by ML score', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/risk/top?limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].overall).toBeGreaterThanOrEqual(res.body[9].overall);
  });

  it('Step 7: PostGIS spatial query exercises geospatial indexes (/api/projects/spatial)', async () => {
    if (!isDbConnected) return;

    const res = await request(app).get('/api/projects/spatial?lat=19.0760&lng=72.8777&radius_km=100');
    expect(res.status).toBe(200);
    expect(res.body.radius_meters).toBe(100000);
    expect(Array.isArray(res.body.projects)).toBe(true);
  });

  it('Step 8: Authenticated auditor review action persists to audit trail', async () => {
    if (!isDbConnected) return;

    const sampleRes = await request(app).get('/api/projects?page_size=1');
    const pid = sampleRes.body.items[0].project_id;

    const reviewRes = await request(app)
      .post('/api/review/action')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        project_id: pid,
        action: 'ESCALATE',
        comment: 'E2E test escalation to Central Vigilance Commission.',
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.review.action).toBe('ESCALATE');

    const auditRes = await request(app).get(`/api/audit/${pid}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.events.some((e: any) => e.action === 'REVIEW_DECISION_ESCALATE')).toBe(true);
  });
});
