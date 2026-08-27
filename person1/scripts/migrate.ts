/**
 * SIH26102 — PostgreSQL Migration Runner (Phase 5)
 * Connects to PostgreSQL and executes schema.sql DDL against the target database.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 */
import {
  checkDatabaseConnection,
  closePool,
  getMigrationSql,
  getPostgresConfig,
  runMigrations,
} from '../src/db/postgres.ts';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  SIH26102 — PostgreSQL + PostGIS Schema Migration     ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log();

  const config = getPostgresConfig();
  console.log(`[Config] Target Host: ${config.host}:${config.port}, Database: ${config.database}, User: ${config.user}`);

  console.log('[1/3] Verifying database connectivity...');
  const conn = await checkDatabaseConnection();
  if (!conn.connected) {
    throw new Error(`Cannot connect to PostgreSQL at ${config.host}:${config.port}/${config.database}: ${conn.error}`);
  }
  console.log(`  ✓ Connected to PostgreSQL (${conn.version?.split(' ')[0] || '15+'})`);

  console.log('[2/3] Loading schema.sql DDL definition...');
  const migrationSql = getMigrationSql();
  console.log(`  ✓ Loaded schema.sql (${(Buffer.byteLength(migrationSql) / 1024).toFixed(1)} KB)`);

  console.log('[3/3] Executing migrations idempotently...');
  const result = await runMigrations();
  console.log(`  ✓ ${result.message}`);

  console.log();
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Migration completed successfully.');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
