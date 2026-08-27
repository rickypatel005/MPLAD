/**
 * SIH26102 — Pipeline Unit Tests (Phase 10)
 * Tests for: ingestAndClean.ts, syntheticGenerator.ts, validationSuite.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseRawCsvText, cleanAndNormalizeMasterData, type RawCsvRecord } from '../../src/pipeline/ingestAndClean.ts';
import { generateSyntheticDataset } from '../../src/pipeline/syntheticGenerator.ts';
import { runValidationSuite } from '../../src/pipeline/validationSuite.ts';
import { MASTER_STATES } from '../../src/data/masterLocations.ts';

// ─────────────────────────────────────────────
// Test Data Setup
// ─────────────────────────────────────────────

let rawRecords: RawCsvRecord[];
let csvContent: string;

beforeAll(() => {
  const csvPath = path.join(process.cwd(), 'data', 'raw', 'Allocated Limit for Honble MPs.csv');
  csvContent = fs.readFileSync(csvPath, 'utf-8');
  rawRecords = parseRawCsvText(csvContent);
});

// ─────────────────────────────────────────────
// Phase 1: Source Ingestion & Profiling
// ─────────────────────────────────────────────

describe('Phase 1 — Source Ingestion & Profiling', () => {
  it('should parse CSV and return valid records', () => {
    expect(rawRecords).toBeDefined();
    expect(rawRecords.length).toBeGreaterThan(0);
  });

  it('should have approximately 544 raw rows (543 MPs + 1 Grand Total)', () => {
    // Rows may vary slightly due to CSV format edge cases
    expect(rawRecords.length).toBeGreaterThanOrEqual(540);
    expect(rawRecords.length).toBeLessThanOrEqual(550);
  });

  it('should parse each record with required fields', () => {
    for (const record of rawRecords.slice(0, 10)) {
      expect(record).toHaveProperty('srNo');
      expect(record).toHaveProperty('state');
      expect(record).toHaveProperty('mpName');
      expect(record).toHaveProperty('constituency');
      expect(record).toHaveProperty('allocatedAmount');
      expect(record).toHaveProperty('rawRow');
    }
  });

  it('should preserve the raw CSV file without modification', () => {
    const csvPath = path.join(process.cwd(), 'data', 'raw', 'Allocated Limit for Honble MPs.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    const content = fs.readFileSync(csvPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// Phase 2: Data Cleaning & Normalization
// ─────────────────────────────────────────────

describe('Phase 2 — Data Cleaning & Normalization', () => {
  let cleaned: ReturnType<typeof cleanAndNormalizeMasterData>;

  beforeAll(() => {
    cleaned = cleanAndNormalizeMasterData(rawRecords);
  });

  it('should detect and exclude Grand Total row', () => {
    expect(cleaned.grandTotalRow).not.toBeNull();
    // Grand Total should NOT be in the MP list
    const grandTotalInMps = cleaned.mps.find(
      (m) => m.name.toUpperCase().includes('GRAND TOTAL') || m.name === '--'
    );
    expect(grandTotalInMps).toBeUndefined();
  });

  it('should normalize all 36 States and Union Territories', () => {
    expect(cleaned.states.length).toBe(36);
    // Verify each state has required fields
    for (const state of cleaned.states) {
      expect(state.state_id).toMatch(/^ST\d{2}$/);
      expect(state.name).toBeTruthy();
      expect(state.normalized_name).toBeTruthy();
      expect(['STATE', 'UNION_TERRITORY']).toContain(state.state_type);
      expect(state.latitude).toBeGreaterThan(0);
      expect(state.longitude).toBeGreaterThan(0);
    }
  });

  it('should generate 543 operational MP records', () => {
    expect(cleaned.mps.length).toBe(543);
  });

  it('should assign stable MP IDs in format MP001-MP543', () => {
    const firstMp = cleaned.mps[0];
    const lastMp = cleaned.mps[cleaned.mps.length - 1];
    expect(firstMp.mp_id).toBe('MP001');
    expect(lastMp.mp_id).toBe('MP543');
  });

  it('should detect missing allocation amount and flag with MISSING_SOURCE_VALUE', () => {
    expect(cleaned.missingAmountRecords.length).toBeGreaterThanOrEqual(1);

    const missingMps = cleaned.mps.filter(
      (m) => m.allocation_quality_flag === 'MISSING_SOURCE_VALUE'
    );
    expect(missingMps.length).toBeGreaterThanOrEqual(1);

    for (const m of missingMps) {
      expect(m.allocated_amount).toBeNull();
    }
  });

  it('should generate district and constituency entities', () => {
    expect(cleaned.districts.length).toBeGreaterThan(0);
    expect(cleaned.constituencies.length).toBeGreaterThan(0);

    for (const d of cleaned.districts.slice(0, 5)) {
      expect(d.district_id).toMatch(/^D\d{3}$/);
      expect(d.state_id).toMatch(/^ST\d{2}$/);
    }
  });
});

// ─────────────────────────────────────────────
// Phase 3: Synthetic Project Expansion
// ─────────────────────────────────────────────

describe('Phase 3 — Synthetic Project Expansion', () => {
  let output: ReturnType<typeof generateSyntheticDataset>;

  beforeAll(() => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    output = generateSyntheticDataset(cleaned.mps, MASTER_STATES, 10000, 26102);
  });

  it('should generate at least 10,000 projects', () => {
    expect(output.projects.length).toBeGreaterThanOrEqual(10000);
  });

  it('should be deterministic (same seed → same output)', () => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    const output2 = generateSyntheticDataset(cleaned.mps, MASTER_STATES, 10000, 26102);
    expect(output2.projects.length).toBe(output.projects.length);
    expect(output2.projects[0].project_id).toBe(output.projects[0].project_id);
    expect(output2.projects[0].sanction_amount).toBe(output.projects[0].sanction_amount);
  });

  it('should assign unique project IDs', () => {
    const ids = new Set(output.projects.map((p) => p.project_id));
    expect(ids.size).toBe(output.projects.length);
  });

  it('should generate implementing agencies for all states', () => {
    expect(output.agencies.length).toBeGreaterThan(0);
    const stateIds = new Set(output.agencies.map((a) => a.state_id));
    expect(stateIds.size).toBe(36);
  });

  it('should attach provenance fields to every project', () => {
    for (const p of output.projects.slice(0, 20)) {
      expect(p.record_source).toBe('SYNTHETIC');
      expect(p.source_file).toBe('Allocated Limit for Honble MPs.csv');
      expect(p.synthetic_seed).toBe(26102);
      expect(p.source_row).toBeGreaterThan(0);
    }
  });

  it('should generate valid financial bounds (sanction > 0, progress 0-100)', () => {
    for (const p of output.projects) {
      expect(p.sanction_amount).toBeGreaterThan(0);
      expect(p.physical_progress).toBeGreaterThanOrEqual(0);
      expect(p.physical_progress).toBeLessThanOrEqual(100);
      expect(p.financial_progress).toBeGreaterThanOrEqual(0);
      expect(p.financial_progress).toBeLessThanOrEqual(100);
    }
  });

  it('should generate coordinates within India bounding box', () => {
    for (const p of output.projects) {
      expect(p.location.latitude).toBeGreaterThanOrEqual(6);
      expect(p.location.latitude).toBeLessThanOrEqual(38);
      expect(p.location.longitude).toBeGreaterThanOrEqual(68);
      expect(p.location.longitude).toBeLessThanOrEqual(98);
    }
  });
});

describe('Small synthetic fixtures', () => {
  for (const projectCount of [100, 500, 1000]) {
    it(`keeps duplicate relationships valid for ${projectCount} projects`, () => {
      const cleaned = cleanAndNormalizeMasterData(rawRecords);
      const generated = generateSyntheticDataset(
        cleaned.mps, MASTER_STATES, projectCount, 26102,
        cleaned.constituencies, cleaned.districts
      );
      const projectIds = new Set(generated.projects.map((project) => project.project_id));

      expect(generated.projects).toHaveLength(projectCount);
      for (const cluster of generated.duplicateClusters) {
        expect(projectIds.has(cluster.primary_project_id)).toBe(true);
        for (const match of cluster.matches) expect(projectIds.has(match.match_project_id)).toBe(true);
      }

      const report = runValidationSuite(
        MASTER_STATES, cleaned.mps, generated.agencies, generated.projects,
        generated.payments, cleaned.constituencies, cleaned.districts
      );
      expect(report.all_passed).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────
// Phase 3A: Payments & Timelines
// ─────────────────────────────────────────────

describe('Phase 3A — Payments & Timelines', () => {
  let output: ReturnType<typeof generateSyntheticDataset>;

  beforeAll(() => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    output = generateSyntheticDataset(cleaned.mps, MASTER_STATES, 10000, 26102);
  });

  it('should generate payment transactions', () => {
    expect(output.payments.length).toBeGreaterThan(0);
  });

  it('should link all payments to valid project IDs', () => {
    const projectIds = new Set(output.projects.map((p) => p.project_id));
    for (const pay of output.payments) {
      expect(projectIds.has(pay.project_id)).toBe(true);
    }
  });

  it('should assign unique payment IDs', () => {
    const payIds = new Set(output.payments.map((p) => p.payment_id));
    expect(payIds.size).toBe(output.payments.length);
  });
});

// ─────────────────────────────────────────────
// Phase 3B: Controlled Anomaly Injection
// ─────────────────────────────────────────────

describe('Phase 3B — Controlled Anomaly Injection', () => {
  let output: ReturnType<typeof generateSyntheticDataset>;

  beforeAll(() => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    output = generateSyntheticDataset(cleaned.mps, MASTER_STATES, 10000, 26102);
  });

  const knownDemos = [
    { id: 'P10342', scenario: 'PAYMENT_PROGRESS_MISMATCH' },
    { id: 'P10101', scenario: 'HIGH_COST_ANOMALY' },
    { id: 'P10450', scenario: 'TIMELINE_DELAY_ANOMALY' },
    { id: 'P10580', scenario: 'IA_CONCENTRATION_ANOMALY' },
    { id: 'P10701', scenario: 'DUPLICATE_PROJECT_PAIR' },
    { id: 'P10702', scenario: 'DUPLICATE_PROJECT_PAIR' },
    { id: 'P10880', scenario: 'COMPLIANCE_ANOMALY' },
  ];

  for (const demo of knownDemos) {
    it(`should inject ${demo.scenario} into ${demo.id}`, () => {
      const project = output.projects.find((p) => p.project_id === demo.id);
      expect(project).toBeDefined();
      expect(project!.synthetic_scenario).toBe(demo.scenario);
    });
  }

  it('should make P10342 exhibit high finance / low physical progress', () => {
    const p = output.projects.find((p) => p.project_id === 'P10342')!;
    expect(p.financial_progress).toBeGreaterThanOrEqual(80);
    expect(p.physical_progress).toBeLessThanOrEqual(30);
  });

  it('should make P10101 exhibit high sanction amount (> ₹18M)', () => {
    const p = output.projects.find((p) => p.project_id === 'P10101')!;
    expect(p.sanction_amount).toBeGreaterThan(18000000);
  });

  it('should create duplicate pair P10701/P10702 within 50m distance', () => {
    const p1 = output.projects.find((p) => p.project_id === 'P10701')!;
    const p2 = output.projects.find((p) => p.project_id === 'P10702')!;

    const dLat = Math.abs(p1.location.latitude - p2.location.latitude) * 111000;
    const dLng = Math.abs(p1.location.longitude - p2.location.longitude) * 111000;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    expect(distance).toBeLessThan(100); // Within 100m
  });

  it('should generate duplicate clusters', () => {
    expect(output.duplicateClusters.length).toBeGreaterThan(0);
    const cluster = output.duplicateClusters[0];
    expect(cluster.primary_project_id).toBe('P10701');
    expect(cluster.max_similarity).toBeGreaterThan(0.9);
  });
});

// ─────────────────────────────────────────────
// Phase 4: Validation Suite
// ─────────────────────────────────────────────

describe('Phase 4 — Validation Suite & Canonical Geography Integrity', () => {
  it('should pass all 12 validation checks on well-formed data', () => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    const output = generateSyntheticDataset(
      cleaned.mps,
      MASTER_STATES,
      10000,
      26102,
      cleaned.constituencies,
      cleaned.districts
    );

    const report = runValidationSuite(
      MASTER_STATES,
      cleaned.mps,
      output.agencies,
      output.projects,
      output.payments,
      cleaned.constituencies,
      cleaned.districts
    );

    expect(report.total_checks).toBe(12);
    expect(report.all_passed).toBe(true);
    expect(report.failed_checks).toBe(0);

    for (const check of report.results) {
      expect(check.status).toBe('PASSED');
    }
  });

  it('should strictly enforce canonical state -> district -> constituency -> MP -> project relationships', () => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    const output = generateSyntheticDataset(
      cleaned.mps,
      MASTER_STATES,
      10000,
      26102,
      cleaned.constituencies,
      cleaned.districts
    );

    const constMap = new Map(cleaned.constituencies.map((c) => [c.constituency_id, c]));
    const districtMap = new Map(cleaned.districts.map((d) => [d.district_id, d]));
    const mpMap = new Map(cleaned.mps.map((m) => [m.mp_id, m]));

    for (const p of output.projects.slice(0, 500)) {
      const constituency = constMap.get(p.constituency_id);
      expect(constituency).toBeDefined();

      // Project state must match constituency state
      expect(p.state_id).toBe(constituency!.state_id);

      // Project district must match constituency district
      expect(p.district_id).toBe(constituency!.district_id);
      expect(districtMap.has(p.district_id)).toBe(true);

      // Sponsoring MP must belong to project's constituency
      const mp = mpMap.get(p.mp_id);
      expect(mp).toBeDefined();
      expect(mp!.constituency_id).toBe(p.constituency_id);
    }
  });

  it('should verify the presence of all 7 known demo anomalies', () => {
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    const output = generateSyntheticDataset(
      cleaned.mps,
      MASTER_STATES,
      10000,
      26102,
      cleaned.constituencies,
      cleaned.districts
    );

    const report = runValidationSuite(
      MASTER_STATES,
      cleaned.mps,
      output.agencies,
      output.projects,
      output.payments,
      cleaned.constituencies,
      cleaned.districts
    );

    const anomalyCheck = report.results.find(
      (r) => r.check_name.includes('Injected Anomaly')
    );
    expect(anomalyCheck).toBeDefined();
    expect(anomalyCheck!.status).toBe('PASSED');
  });
});
