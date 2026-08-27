/**
 * SIH26102 — PostgreSQL + PostGIS Production Database Adapter (Phase 5)
 * Provides connection pooling, schema migrations, batch loading, and PostGIS spatial queries.
 */
import fs from 'fs';
import path from 'path';
import pg, { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { cleanAndNormalizeMasterData, parseRawCsvText } from '../pipeline/ingestAndClean.ts';
import { generateSyntheticDataset } from '../pipeline/syntheticGenerator.ts';
import { runValidationSuite } from '../pipeline/validationSuite.ts';

const { Pool: PgPool } = pg;

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

let poolInstance: Pool | null = null;

export function getPostgresConfig(): PostgresConfig {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '5432', 10),
        database: url.pathname.replace(/^\//, '') || 'mplads_audit',
        user: url.username || 'mplads_admin',
        password: url.password || process.env.POSTGRES_PASSWORD || 'sih26102_secure_pwd',
        ssl: url.searchParams.get('sslmode') === 'require',
      };
    } catch {
      // fallback to environment variables
    }
  }

  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'mplads_audit',
    user: process.env.POSTGRES_USER || 'mplads_admin',
    password: process.env.POSTGRES_PASSWORD || 'sih26102_secure_pwd',
    ssl: process.env.POSTGRES_SSL === 'true',
  };
}

export function getPool(): Pool {
  if (!poolInstance) {
    const config = getPostgresConfig();
    poolInstance = new PgPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: parseInt(process.env.PG_MAX_CONNECTIONS || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err);
    });
  }
  return poolInstance;
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const res = await query<{ version: string }>('SELECT version();');
    return {
      connected: true,
      version: res.rows[0]?.version,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err?.message || 'Database unreachable',
    };
  }
}

/**
 * Migration runner: reads schema.sql and splits into executable DDL statements.
 */
export function getMigrationSql(): string {
  const schemaPath = path.join(process.cwd(), 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema.sql not found at ${schemaPath}`);
  }
  return fs.readFileSync(schemaPath, 'utf-8');
}

/**
 * Executes schema migrations idempotently against PostgreSQL.
 */
export async function runMigrations(): Promise<{
  success: boolean;
  applied: string[];
  message: string;
}> {
  const client = await getClient();
  try {
    await client.query('BEGIN;');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(60) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        checksum VARCHAR(64)
      );
    `);

    // 2. Check if initial schema migration already applied
    const existing = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1;',
      ['001_initial_schema']
    );

    const applied: string[] = [];

    if (existing.rows.length === 0) {
      const ddl = getMigrationSql();
      // Execute the whole DDL bundle
      await client.query(ddl);

      await client.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2);',
        ['001_initial_schema', 'initial_schema_v2.6']
      );
      applied.push('001_initial_schema');
    }

    // Keep already-created developer databases compatible with the current
    // schema. Fresh databases receive these definitions from schema.sql.
    const upgrade = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1;',
      ['002_pipeline_validation_and_roles']
    );
    if (upgrade.rows.length === 0) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS pipeline_runs (
          run_id BIGSERIAL PRIMARY KEY,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          project_count INTEGER NOT NULL,
          payment_count INTEGER NOT NULL,
          checks_run INTEGER NOT NULL,
          checks_passed INTEGER NOT NULL,
          validation_passed BOOLEAN NOT NULL,
          failure_summary JSONB NOT NULL DEFAULT '[]'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_pipeline_runs_completed_at
          ON pipeline_runs (completed_at DESC);
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
        UPDATE users SET role = 'REVIEWER', username = 'reviewer',
          display_name = 'Audit Review Officer'
          WHERE role = 'INVESTIGATOR';
        ALTER TABLE users ADD CONSTRAINT users_role_check
          CHECK (role IN ('ADMIN', 'AUDITOR', 'REVIEWER', 'VIEWER'));
      `);
      await client.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2);',
        ['002_pipeline_validation_and_roles', 'pipeline_validation_and_canonical_roles_v1']
      );
      applied.push('002_pipeline_validation_and_roles');
    }

    await client.query('COMMIT;');

    return {
      success: true,
      applied,
      message:
        applied.length > 0
          ? `Successfully applied ${applied.length} migration(s): ${applied.join(', ')}`
          : 'Database schema is already up to date.',
    };
  } catch (err: any) {
    await client.query('ROLLBACK;');
    throw new Error(`Migration execution failed: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Helper to build parameterized multi-row insert statements
 */
function buildBatchInsert(
  table: string,
  columns: string[],
  rows: any[][],
  conflictClause: string = 'ON CONFLICT DO NOTHING'
): { text: string; values: any[] } {
  if (rows.length === 0) {
    return { text: '', values: [] };
  }

  const values: any[] = [];
  const valueTuples: string[] = [];
  let paramIdx = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const val = row[c];

      if (col === '__ST_POINT__') {
        // Special placeholder for PostGIS Point geometry: lng, lat
        const [lng, lat] = val;
        placeholders.push(`ST_SetSRID(ST_MakePoint($${paramIdx}, $${paramIdx + 1}), 4326)`);
        values.push(lng, lat);
        paramIdx += 2;
      } else {
        placeholders.push(`$${paramIdx}`);
        values.push(val);
        paramIdx += 1;
      }
    }
    valueTuples.push(`(${placeholders.join(', ')})`);
  }

  const cleanCols = columns.map((c) => (c === '__ST_POINT__' ? 'geom' : c)).join(', ');
  const text = `INSERT INTO ${table} (${cleanCols}) VALUES ${valueTuples.join(', ')} ${conflictClause};`;
  return { text, values };
}

/**
 * Seeds the full synthetic dataset into PostgreSQL inside a transaction.
 */
export async function seedDatabase(options?: {
  reset?: boolean;
  projectCount?: number;
  seed?: number;
}): Promise<{
  success: boolean;
  projectCount: number;
  paymentCount: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  const targetCount = options?.projectCount || 10000;
  const targetSeed = options?.seed || 26102;
  const doReset = options?.reset !== false;

  // 1. Generate full dataset in memory
  let csvContent = '';
  const rawPath = path.join(process.cwd(), 'data', 'raw', 'Allocated Limit for Honble MPs.csv');
  if (fs.existsSync(rawPath)) {
    csvContent = fs.readFileSync(rawPath, 'utf-8');
  }
  const rawRecords = parseRawCsvText(csvContent);
  const cleaned = cleanAndNormalizeMasterData(rawRecords);
  const generated = generateSyntheticDataset(
    cleaned.mps,
    cleaned.states,
    targetCount,
    targetSeed,
    cleaned.constituencies,
    cleaned.districts
  );
  const validation = runValidationSuite(
    cleaned.states, cleaned.mps, generated.agencies, generated.projects,
    generated.payments, cleaned.constituencies, cleaned.districts
  );
  if (!validation.all_passed) {
    const failures = validation.results.filter((result) => result.status === 'FAILED');
    throw new Error(`Refusing to seed invalid generated data: ${failures.map((f) => f.check_name).join('; ')}`);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN;');

    if (doReset) {
      // Truncate all tables in FK cascade order
      await client.query(`
        TRUNCATE TABLE
          audit_logs,
          review_actions,
          evidence_items,
          duplicate_matches,
          duplicate_clusters,
          payments,
          risk_flags,
          risk_scores,
          projects,
          implementing_agencies,
          mps,
          constituencies,
          districts,
          states,
          pipeline_runs
        CASCADE;
      `);
    }

    // 1. States (36)
    const stateRows = cleaned.states.map((s) => [
      s.state_id,
      s.name,
      s.normalized_name,
      s.state_type,
      s.total_mps,
      s.total_allocated,
      [s.longitude, s.latitude],
    ]);
    const statesQuery = buildBatchInsert(
      'states',
      ['state_id', 'name', 'normalized_name', 'state_type', 'total_mps', 'total_allocated', '__ST_POINT__'],
      stateRows,
      'ON CONFLICT (state_id) DO UPDATE SET total_mps = EXCLUDED.total_mps, total_allocated = EXCLUDED.total_allocated'
    );
    await client.query(statesQuery.text, statesQuery.values);

    // 2. Districts
    const districtRows = cleaned.districts.map((d) => [
      d.district_id,
      d.state_id,
      d.name,
      d.normalized_name,
    ]);
    const districtsQuery = buildBatchInsert(
      'districts',
      ['district_id', 'state_id', 'name', 'normalized_name'],
      districtRows,
      'ON CONFLICT (district_id) DO NOTHING'
    );
    await client.query(districtsQuery.text, districtsQuery.values);

    // 3. Constituencies
    const constRows = cleaned.constituencies.map((c) => [
      c.constituency_id,
      c.state_id,
      c.district_id,
      c.name,
      c.normalized_name,
    ]);
    const constQuery = buildBatchInsert(
      'constituencies',
      ['constituency_id', 'state_id', 'district_id', 'name', 'normalized_name'],
      constRows,
      'ON CONFLICT (constituency_id) DO NOTHING'
    );
    await client.query(constQuery.text, constQuery.values);

    // 4. MPs
    const mpRows = cleaned.mps.map((m) => [
      m.mp_id,
      m.constituency_id,
      m.state_id,
      m.name,
      m.normalized_name,
      m.allocated_amount ?? null,
      m.allocation_quality_flag ?? null,
      m.source_row,
    ]);
    const mpsQuery = buildBatchInsert(
      'mps',
      ['mp_id', 'constituency_id', 'state_id', 'name', 'normalized_name', 'allocated_amount', 'allocation_quality_flag', 'source_row'],
      mpRows,
      'ON CONFLICT (mp_id) DO NOTHING'
    );
    await client.query(mpsQuery.text, mpsQuery.values);

    // 5. Implementing Agencies
    const iaRows = generated.agencies.map((ia) => [
      ia.ia_id,
      ia.name,
      ia.normalized_name,
      ia.agency_type,
      ia.state_id,
      ia.projects_count,
      ia.total_budget_handled,
      ia.hhi_score || 0,
      ia.average_risk_score || 0.2,
    ]);
    const iaQuery = buildBatchInsert(
      'implementing_agencies',
      ['ia_id', 'name', 'normalized_name', 'agency_type', 'state_id', 'projects_count', 'total_budget_handled', 'hhi_score', 'average_risk_score'],
      iaRows,
      'ON CONFLICT (ia_id) DO NOTHING'
    );
    await client.query(iaQuery.text, iaQuery.values);

    // 6. Projects (Chunked inserts: 500 rows per batch)
    const projectCols = [
      'project_id',
      'project_name',
      'description',
      'category',
      'state_id',
      'state_name',
      'district_id',
      'district_name',
      'constituency_id',
      'constituency_name',
      'mp_id',
      'mp_name',
      'ia_id',
      'ia_name',
      'sanction_amount',
      'sanction_date',
      'start_date',
      'expected_completion_date',
      'actual_completion_date',
      'physical_progress',
      'financial_progress',
      'status',
      '__ST_POINT__',
      'gps_accuracy_meters',
      'address',
      'record_source',
      'synthetic_scenario',
      'source_file',
      'source_row',
      'synthetic_seed',
      'review_status',
      'review_count',
    ];

    const CHUNK_SIZE = 400;
    for (let i = 0; i < generated.projects.length; i += CHUNK_SIZE) {
      const chunk = generated.projects.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map((p) => [
        p.project_id,
        p.project_name,
        p.description || '',
        p.category,
        p.state_id,
        p.state_name,
        p.district_id,
        p.district_name,
        p.constituency_id,
        p.constituency_name,
        p.mp_id,
        p.mp_name,
        p.ia_id,
        p.ia_name,
        p.sanction_amount,
        p.sanction_date,
        p.start_date,
        p.expected_completion_date,
        p.actual_completion_date || null,
        p.physical_progress,
        p.financial_progress,
        p.status,
        [p.location?.longitude || 78.9629, p.location?.latitude || 20.5937],
        p.location?.gps_accuracy_meters || 5,
        p.location?.address || '',
        p.record_source,
        p.synthetic_scenario,
        p.source_file,
        p.source_row,
        p.synthetic_seed,
        p.review_status || 'UNREVIEWED',
        p.review_count || 0,
      ]);

      const q = buildBatchInsert('projects', projectCols, rows, 'ON CONFLICT (project_id) DO NOTHING');
      await client.query(q.text, q.values);
    }

    // 7. Risk Scores (Chunked)
    const riskCols = [
      'project_id',
      'overall_score',
      'risk_level',
      'financial_score',
      'timeline_score',
      'compliance_score',
      'ia_score',
      'geo_score',
      'evidence_score',
      'model_version',
      'scored_at',
      'reasons',
    ];

    const scoredProjects = generated.projects.filter((p) => p.risk_score);
    for (let i = 0; i < scoredProjects.length; i += CHUNK_SIZE) {
      const chunk = scoredProjects.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map((p) => {
        const rs = p.risk_score!;
        return [
          p.project_id,
          rs.overall_score,
          rs.risk_level,
          rs.financial_score,
          rs.timeline_score,
          rs.compliance_score,
          rs.ia_score,
          rs.geo_score,
          rs.evidence_score,
          rs.model_version,
          rs.scored_at,
          rs.reasons || [],
        ];
      });
      const q = buildBatchInsert(
        'risk_scores',
        riskCols,
        rows,
        'ON CONFLICT (project_id) DO UPDATE SET overall_score = EXCLUDED.overall_score, risk_level = EXCLUDED.risk_level'
      );
      await client.query(q.text, q.values);
    }

    // 8. Risk Flags (Chunked)
    const allFlags: any[] = [];
    for (const p of generated.projects) {
      if (p.flags && p.flags.length > 0) {
        for (const f of p.flags) {
          allFlags.push([
            f.flag_id,
            p.project_id,
            f.flag_type,
            f.severity,
            f.rule_code,
            f.message,
            JSON.stringify(f.evidence_json || {}),
          ]);
        }
      }
    }

    for (let i = 0; i < allFlags.length; i += CHUNK_SIZE) {
      const chunk = allFlags.slice(i, i + CHUNK_SIZE);
      const q = buildBatchInsert(
        'risk_flags',
        ['flag_id', 'project_id', 'flag_type', 'severity', 'rule_code', 'message', 'evidence_json'],
        chunk,
        'ON CONFLICT (flag_id) DO NOTHING'
      );
      await client.query(q.text, q.values);
    }

    // 9. Payments (Chunked)
    const paymentCols = [
      'payment_id',
      'project_id',
      'payment_date',
      'payment_amount',
      'cumulative_payment',
      'payment_status',
      'milestone_description',
      'voucher_no',
    ];

    for (let i = 0; i < generated.payments.length; i += CHUNK_SIZE) {
      const chunk = generated.payments.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map((pay) => [
        pay.payment_id,
        pay.project_id,
        pay.payment_date,
        pay.payment_amount,
        pay.cumulative_payment,
        pay.payment_status,
        pay.milestone_description || '',
        pay.voucher_no,
      ]);
      const q = buildBatchInsert('payments', paymentCols, rows, 'ON CONFLICT (payment_id) DO NOTHING');
      await client.query(q.text, q.values);
    }

    // 10. Duplicate Clusters & Matches
    for (const cl of generated.duplicateClusters) {
      await client.query(
        `INSERT INTO duplicate_clusters (cluster_id, primary_project_id, suspected_count, max_similarity, total_suspect_amount)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cluster_id) DO NOTHING;`,
        [cl.cluster_id, cl.primary_project_id, cl.suspected_count, cl.max_similarity, cl.total_suspect_amount]
      );

      for (const m of cl.matches) {
        await client.query(
          `INSERT INTO duplicate_matches (cluster_id, match_project_id, match_project_name, match_description, overall_similarity, text_similarity, geo_distance_meters, date_proximity_days, same_ia, match_reasons)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          [
            cl.cluster_id,
            m.match_project_id,
            m.match_project_name,
            m.match_description || '',
            m.overall_similarity,
            m.text_similarity,
            m.geo_distance_meters,
            m.date_proximity_days,
            m.same_ia,
            m.match_reasons || [],
          ]
        );
      }
    }

    // 11. Initial Audit Logs
    const sampleProjects = ['P10342', 'P10101', 'P10701', 'P10702', 'P10580', 'P10450', 'P10880', 'P10001'];
    for (const pid of sampleProjects) {
      const proj = generated.projects.find((p) => p.project_id === pid);
      if (!proj) continue;

      await client.query(
        `INSERT INTO audit_logs (audit_id, project_id, actor_id, actor_name, action, payload_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (audit_id) DO NOTHING;`,
        [
          `AUD-INIT-${pid}`,
          pid,
          'SYSTEM_PIPELINE',
          'MPLADS Data Pipeline',
          'PROJECT_INGESTED',
          JSON.stringify({
            sanction_amount: proj.sanction_amount,
            state: proj.state_name,
            mp: proj.mp_name,
            scenario: proj.synthetic_scenario,
          }),
          proj.created_at || new Date().toISOString(),
        ]
      );

      if (proj.risk_score && proj.risk_score.risk_level !== 'LOW') {
        await client.query(
          `INSERT INTO audit_logs (audit_id, project_id, actor_id, actor_name, action, payload_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (audit_id) DO NOTHING;`,
          [
            `AUD-RISK-${pid}`,
            pid,
            'RISK_ENGINE_V2',
            'IsoForest ML Scorer',
            'RISK_FLAGS_RAISED',
            JSON.stringify({
              overall_score: proj.risk_score.overall_score,
              risk_level: proj.risk_score.risk_level,
              flags_count: proj.flags?.length || 0,
              top_reason: proj.risk_score.reasons[0],
            }),
            new Date().toISOString(),
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO pipeline_runs
        (project_count, payment_count, checks_run, checks_passed, validation_passed, failure_summary)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [generated.projects.length, generated.payments.length, validation.total_checks,
        validation.passed_checks, validation.all_passed,
        JSON.stringify(validation.results.filter((r) => r.status === 'FAILED'))]
    );

    await client.query('COMMIT;');

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      projectCount: generated.projects.length,
      paymentCount: generated.payments.length,
      durationMs,
    };
  } catch (err: any) {
    await client.query('ROLLBACK;');
    throw new Error(`Database seeding failed: ${err.message}`);
  } finally {
    client.release();
  }
}
