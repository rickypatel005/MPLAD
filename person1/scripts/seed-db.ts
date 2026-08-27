/**
 * SIH26102 — PostgreSQL Database Seeder (Phase 5 & 8)
 * Generates the full synthetic dataset (10,000+ projects) and inserts into PostgreSQL via batched queries.
 *
 * Usage:
 *   npx tsx scripts/seed-db.ts [--reset] [--count=10000] [--seed=26102]
 */
import {
  checkDatabaseConnection,
  closePool,
  getPostgresConfig,
  query,
  seedDatabase,
} from '../src/db/postgres.ts';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  SIH26102 — PostgreSQL Database Seeder (Full 10k+)    ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log();

  const config = getPostgresConfig();
  console.log(`[Config] Target Host: ${config.host}:${config.port}, Database: ${config.database}, User: ${config.user}`);

  console.log('[1/4] Checking database connection...');
  const conn = await checkDatabaseConnection();
  if (!conn.connected) {
    throw new Error(`Cannot connect to PostgreSQL at ${config.host}:${config.port}: ${conn.error}`);
  }
  console.log(`  ✓ PostgreSQL connection verified (${conn.version?.split(' ')[0] || '15+'})`);

  // Parse CLI args
  const args = process.argv.slice(2);
  const reset = !args.includes('--no-reset');
  const countArg = args.find((a) => a.startsWith('--count='));
  const projectCount = countArg ? parseInt(countArg.split('=')[1], 10) : 10000;
  const seedArg = args.find((a) => a.startsWith('--seed='));
  const seed = seedArg ? parseInt(seedArg.split('=')[1], 10) : 26102;

  console.log(`[2/4] Generating & seeding dataset (${projectCount} projects, seed: ${seed}, reset: ${reset})...`);
  const result = await seedDatabase({
    reset,
    projectCount,
    seed,
  });

  console.log(`  ✓ Inserted ${result.projectCount} projects and ${result.paymentCount} payments in ${(result.durationMs / 1000).toFixed(2)}s`);

  console.log('[3/4] Verifying database integrity and counts...');
  const countRes = await query<{
    projects_count: string;
    geo_projects_count: string;
    payments_count: string;
    mps_count: string;
    states_count: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM projects) AS projects_count,
      (SELECT COUNT(*) FROM projects WHERE geom IS NOT NULL) AS geo_projects_count,
      (SELECT COUNT(*) FROM payments) AS payments_count,
      (SELECT COUNT(*) FROM mps) AS mps_count,
      (SELECT COUNT(*) FROM states) AS states_count;
  `);

  const counts = countRes.rows[0];
  console.log(`  ✓ Total Projects in DB:       ${counts.projects_count}`);
  console.log(`  ✓ Projects with PostGIS Geom: ${counts.geo_projects_count}`);
  console.log(`  ✓ Total Payments in DB:       ${counts.payments_count}`);
  console.log(`  ✓ Total MPs in DB:            ${counts.mps_count}`);
  console.log(`  ✓ Total States in DB:         ${counts.states_count}`);

  console.log('[4/4] Verifying PostGIS spatial index & geometry consistency...');
  const spatialRes = await query<{ project_id: string; project_name: string; distance_meters: string }>(`
    SELECT project_id, project_name,
           ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography)::numeric, 1) AS distance_meters
    FROM projects
    WHERE geom IS NOT NULL
    ORDER BY distance_meters ASC
    LIMIT 1;
  `);

  if (spatialRes.rows.length > 0) {
    const closest = spatialRes.rows[0];
    console.log(`  ✓ PostGIS verification: Nearest project to New Delhi is ${closest.project_id} (${closest.project_name}) at ${(parseFloat(closest.distance_meters) / 1000).toFixed(1)} km`);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Database seeding completed successfully.');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
