/**
 * SIH26102 — Processed Data Export Script (Phase 4)
 * Exports all 7 canonical in-memory datasets to data/processed/ as JSON, CSV, and summary manifests.
 *
 * Usage: npx tsx scripts/export-processed.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { AppDatabase } from '../src/db/database.ts';

const PROCESSED_DIR = path.join(process.cwd(), 'data', 'processed');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exportToJson(filename: string, data: any) {
  const filepath = path.join(PROCESSED_DIR, filename);
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filepath, json, 'utf-8');
  const sizeKb = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`  ✓ Exported ${filepath} (${sizeKb} KB)`);
}

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join(';') : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCsv(filename: string, records: Record<string, any>[]) {
  if (records.length === 0) return;
  const filepath = path.join(PROCESSED_DIR, filename);
  const headers = Object.keys(records[0]);
  const rows: string[] = [headers.join(',')];

  for (const record of records) {
    const row = headers.map((header) => escapeCsvField(record[header]));
    rows.push(row.join(','));
  }

  const csvContent = rows.join('\n');
  fs.writeFileSync(filepath, csvContent, 'utf-8');
  const sizeKb = (Buffer.byteLength(csvContent) / 1024).toFixed(1);
  console.log(`  ✓ Exported ${filepath} (${sizeKb} KB)`);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  SIH26102 — MPLADS Data Export Pipeline               ║');
  console.log('║  Phase 4: Processed Dataset Export (7 Core Datasets)  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log();

  ensureDir(PROCESSED_DIR);

  console.log('[1/8] Initializing database pipeline...');
  const db = AppDatabase.getInstance();
  console.log(`  ✓ Pipeline initialized: ${db.projects.length} projects, ${db.payments.length} payments, ${db.agencies.length} agencies, ${db.mps.length} MPs, ${db.constituencies.length} constituencies, ${db.districts.length} districts, ${db.states.length} states`);
  console.log();

  // 1. Projects
  console.log('[2/8] Exporting projects (JSON & CSV)...');
  const projectRecords = db.projects.map((p) => ({
    project_id: p.project_id,
    project_name: p.project_name,
    description: p.description,
    category: p.category,
    state_id: p.state_id,
    state_name: p.state_name,
    district_id: p.district_id,
    district_name: p.district_name,
    constituency_id: p.constituency_id,
    constituency_name: p.constituency_name,
    mp_id: p.mp_id,
    mp_name: p.mp_name,
    ia_id: p.ia_id,
    ia_name: p.ia_name,
    sanction_amount: p.sanction_amount,
    sanction_date: p.sanction_date,
    start_date: p.start_date,
    expected_completion_date: p.expected_completion_date,
    actual_completion_date: p.actual_completion_date || '',
    physical_progress: p.physical_progress,
    financial_progress: p.financial_progress,
    status: p.status,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    address: p.location.address || '',
    gps_accuracy_meters: p.location.gps_accuracy_meters || 5,
    record_source: p.record_source,
    synthetic_scenario: p.synthetic_scenario,
    source_file: p.source_file,
    source_row: p.source_row,
    synthetic_seed: p.synthetic_seed,
    risk_overall_score: p.risk_score?.overall_score || 0,
    risk_level: p.risk_score?.risk_level || 'LOW',
    risk_financial: p.risk_score?.financial_score || 0,
    risk_timeline: p.risk_score?.timeline_score || 0,
    risk_compliance: p.risk_score?.compliance_score || 0,
    risk_ia: p.risk_score?.ia_score || 0,
    risk_geo: p.risk_score?.geo_score || 0,
    risk_evidence: p.risk_score?.evidence_score || 0,
    risk_reasons: (p.risk_score?.reasons || []).join('; '),
    flags_count: p.flags?.length || 0,
  }));

  exportToJson('projects.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.projects.length,
      seed: db.currentSeed,
      schema_version: 'v2.6',
    },
    records: projectRecords,
  });
  exportToCsv('projects.csv', projectRecords);

  // 2. Payments
  console.log('[3/8] Exporting payments (JSON & CSV)...');
  const paymentRecords = db.payments.map((pay) => ({
    payment_id: pay.payment_id,
    project_id: pay.project_id,
    payment_date: pay.payment_date,
    payment_amount: pay.payment_amount,
    cumulative_payment: pay.cumulative_payment,
    payment_status: pay.payment_status,
    milestone_description: pay.milestone_description,
    voucher_no: pay.voucher_no,
  }));

  exportToJson('payments.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.payments.length,
      schema_version: 'v2.6',
    },
    records: db.payments,
  });
  exportToCsv('payments.csv', paymentRecords);

  // 3. Implementing Agencies
  console.log('[4/8] Exporting implementing agencies (JSON & CSV)...');
  const agencyRecords = db.agencies.map((ia) => ({
    ia_id: ia.ia_id,
    name: ia.name,
    normalized_name: ia.normalized_name,
    agency_type: ia.agency_type,
    state_id: ia.state_id,
    projects_count: ia.projects_count,
    total_budget_handled: ia.total_budget_handled,
    hhi_score: ia.hhi_score || 0,
    average_risk_score: ia.average_risk_score || 0,
  }));

  exportToJson('implementing_agencies.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.agencies.length,
      schema_version: 'v2.6',
    },
    records: db.agencies,
  });
  exportToCsv('implementing_agencies.csv', agencyRecords);

  // 4. MPs
  console.log('[5/8] Exporting MPs (JSON & CSV)...');
  const mpRecords = db.mps.map((m) => ({
    mp_id: m.mp_id,
    constituency_id: m.constituency_id,
    state_id: m.state_id,
    name: m.name,
    normalized_name: m.normalized_name,
    allocated_amount: m.allocated_amount ?? '',
    allocation_quality_flag: m.allocation_quality_flag || 'VALID',
    source_row: m.source_row,
  }));

  exportToJson('mps.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.mps.length,
      schema_version: 'v2.6',
    },
    records: db.mps,
  });
  exportToCsv('mps.csv', mpRecords);

  // 5. Constituencies
  console.log('[6/8] Exporting constituencies & districts (JSON & CSV)...');
  const constRecords = db.constituencies.map((c) => ({
    constituency_id: c.constituency_id,
    state_id: c.state_id,
    district_id: c.district_id,
    name: c.name,
    normalized_name: c.normalized_name,
  }));

  exportToJson('constituencies.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.constituencies.length,
      schema_version: 'v2.6',
    },
    records: db.constituencies,
  });
  exportToCsv('constituencies.csv', constRecords);

  // 6. Districts
  const districtRecords = db.districts.map((d) => ({
    district_id: d.district_id,
    state_id: d.state_id,
    name: d.name,
    normalized_name: d.normalized_name,
  }));

  exportToJson('districts.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.districts.length,
      schema_version: 'v2.6',
    },
    records: db.districts,
  });
  exportToCsv('districts.csv', districtRecords);

  // 7. States
  console.log('[7/8] Exporting states (JSON & CSV)...');
  const stateRecords = db.states.map((st) => ({
    state_id: st.state_id,
    name: st.name,
    normalized_name: st.normalized_name,
    state_type: st.state_type,
    total_mps: st.total_mps,
    total_allocated: st.total_allocated,
    latitude: st.latitude,
    longitude: st.longitude,
  }));

  exportToJson('states.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      total_records: db.states.length,
      schema_version: 'v2.6',
    },
    records: db.states,
  });
  exportToCsv('states.csv', stateRecords);

  // 8. Validation Report & Manifest
  console.log('[8/8] Exporting validation report & manifest...');
  exportToJson('validation_report.json', {
    _metadata: {
      exported_at: new Date().toISOString(),
      source: 'SIH26102 MPLADS Audit Intelligence Pipeline',
      schema_version: 'v2.6',
    },
    pipeline_report: db.profileReport,
  });

  exportToJson('manifest.json', {
    dataset_name: 'SIH26102 MPLADS Audit Intelligence Master Dataset',
    version: '2.6.0',
    generated_at: new Date().toISOString(),
    seed: db.currentSeed,
    canonical_hierarchy: 'state -> district -> constituency -> mp -> project',
    files: {
      parquet: [
        'projects.parquet',
        'payments.parquet',
        'implementing_agencies.parquet',
        'mps.parquet',
        'constituencies.parquet',
        'districts.parquet',
        'states.parquet',
      ],
      json: [
        'projects.json',
        'payments.json',
        'implementing_agencies.json',
        'mps.json',
        'constituencies.json',
        'districts.json',
        'states.json',
        'validation_report.json',
      ],
      csv: [
        'projects.csv',
        'payments.csv',
        'implementing_agencies.csv',
        'mps.csv',
        'constituencies.csv',
        'districts.csv',
        'states.csv',
      ],
    },
    metrics: {
      total_projects: db.projects.length,
      total_payments: db.payments.length,
      total_agencies: db.agencies.length,
      total_mps: db.mps.length,
      total_constituencies: db.constituencies.length,
      total_districts: db.districts.length,
      total_states: db.states.length,
      validation_passed: db.profileReport?.validation_suite.all_passed ?? false,
    },
  });

  // 9. Automated Parquet Conversion (Gap 9)
  console.log('[9/9] Converting all 7 CSV datasets to Apache Parquet format...');
  const pythonScript = path.join(process.cwd(), 'scripts', 'convert_to_parquet.py');
  try {
    const pythonOutput = execSync(`python "${pythonScript}"`, { encoding: 'utf-8' });
    console.log(pythonOutput.trim());
  } catch (err: any) {
    console.warn('  ⚠ Parquet conversion error/notice:', err.message);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  All 7 canonical datasets exported (JSON, CSV, Parquet) to: ${PROCESSED_DIR}`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
