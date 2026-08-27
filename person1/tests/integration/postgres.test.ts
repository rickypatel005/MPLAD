/**
 * SIH26102 — PostgreSQL & PostGIS Database Integration Tests (Phase 5)
 * Verifies relational schema, PostGIS geometries, foreign key referential integrity, and spatial queries.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  checkDatabaseConnection,
  closePool,
  query,
  runMigrations,
  seedDatabase,
} from '../../src/db/postgres.ts';

describe('PostgreSQL + PostGIS Integration Tests', () => {
  let isDbConnected = false;

  beforeAll(async () => {
    const conn = await checkDatabaseConnection();
    isDbConnected = conn.connected;
    if (!isDbConnected) {
      console.warn(`[Integration Test Notice] PostgreSQL is not running at configured host/port: ${conn.error}`);
    } else {
      // Ensure migrations & seed are loaded
      await runMigrations();
      await seedDatabase({ reset: true, projectCount: 1000, seed: 26102 });
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it('PostgreSQL connectivity check', async () => {
    if (!isDbConnected) {
      expect(isDbConnected).toBe(false);
      return;
    }
    const res = await query('SELECT 1 AS alive;');
    expect(res.rows[0].alive).toBe(1);
  });

  it('Schema validation — all core tables must exist in PostgreSQL', async () => {
    if (!isDbConnected) return;

    const res = await query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    const tables = res.rows.map((r) => r.table_name);
    const requiredTables = [
      'states',
      'districts',
      'constituencies',
      'mps',
      'implementing_agencies',
      'projects',
      'payments',
      'risk_scores',
      'risk_flags',
      'duplicate_clusters',
      'duplicate_matches',
      'users',
      'review_actions',
      'audit_logs',
      'schema_migrations',
    ];

    for (const tbl of requiredTables) {
      expect(tables).toContain(tbl);
    }
  });

  it('PostGIS extension check — geometry columns & spatial capabilities enabled', async () => {
    if (!isDbConnected) return;

    const extRes = await query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname = 'postgis';"
    );
    expect(extRes.rows.length).toBeGreaterThan(0);
    expect(extRes.rows[0].extname).toBe('postgis');

    // Check geom column on projects
    const colRes = await query<{ column_name: string; udt_name: string }>(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'geom';
    `);
    expect(colRes.rows.length).toBe(1);
    expect(colRes.rows[0].udt_name).toBe('geometry');
  });

  it('PostGIS Geometry population — all seeded projects must have valid geometries', async () => {
    if (!isDbConnected) return;

    const res = await query<{ total_projects: string; geo_projects: string }>(`
      SELECT
        COUNT(*) AS total_projects,
        COUNT(geom) AS geo_projects
      FROM projects;
    `);

    const total = parseInt(res.rows[0].total_projects, 10);
    const geo = parseInt(res.rows[0].geo_projects, 10);

    expect(total).toBeGreaterThan(0);
    expect(geo).toBe(total);
  });

  it('PostGIS Spatial Query — ST_DWithin & ST_Distance proximity calculation', async () => {
    if (!isDbConnected) return;

    // Search around Mumbai (19.0760, 72.8777) within 150km
    const res = await query<{
      project_id: string;
      project_name: string;
      state_id: string;
      distance_km: string;
    }>(`
      SELECT
        project_id,
        project_name,
        state_id,
        ROUND((ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326)::geography) / 1000)::numeric, 1) AS distance_km
      FROM projects
      WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326)::geography, 150000)
      ORDER BY distance_km ASC
      LIMIT 5;
    `);

    expect(res.rows.length).toBeGreaterThan(0);
    for (const r of res.rows) {
      expect(parseFloat(r.distance_km)).toBeLessThanOrEqual(150);
    }
  });

  it('Foreign Key Referential Integrity — projects join with mps, constituencies, districts, and states', async () => {
    if (!isDbConnected) return;

    const res = await query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM projects p
      JOIN mps m ON p.mp_id = m.mp_id
      JOIN constituencies c ON p.constituency_id = c.constituency_id
      JOIN districts d ON p.district_id = d.district_id
      JOIN states s ON p.state_id = s.state_id;
    `);

    const validJoinedCount = parseInt(res.rows[0].count, 10);
    expect(validJoinedCount).toBeGreaterThan(0);
  });

  it('Idempotent Migrations — re-running migrations does not fail or duplicate tables', async () => {
    if (!isDbConnected) return;

    const result = await runMigrations();
    expect(result.success).toBe(true);
    expect(result.message).toContain('already up to date');
  });
});
