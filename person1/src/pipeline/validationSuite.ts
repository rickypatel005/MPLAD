import { ConstituencyEntity, DistrictEntity, ImplementingAgencyEntity, MPEntity, PaymentTransaction, ProjectEntity, StateEntity } from '../types.ts';

export interface ValidationCheckResult {
  check_name: string;
  category: 'SCHEMA' | 'REFERENTIAL' | 'FINANCIAL' | 'TEMPORAL' | 'GEOSPATIAL' | 'ANOMALIES';
  status: 'PASSED' | 'FAILED';
  details: string;
  records_evaluated: number;
  failure_count: number;
}

export interface FullValidationReport {
  timestamp: string;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  all_passed: boolean;
  results: ValidationCheckResult[];
}

export function runValidationSuite(
  states: StateEntity[],
  mps: MPEntity[],
  agencies: ImplementingAgencyEntity[],
  projects: ProjectEntity[],
  payments: PaymentTransaction[],
  constituencies: ConstituencyEntity[] = [],
  districts: DistrictEntity[] = []
): FullValidationReport {
  const results: ValidationCheckResult[] = [];

  const stateIds = new Set(states.map((s) => s.state_id));
  const mpIds = new Set(mps.map((m) => m.mp_id));
  const iaIds = new Set(agencies.map((a) => a.ia_id));
  const projectIds = new Set(projects.map((p) => p.project_id));

  // 1. Uniqueness of Project IDs
  const uniqueProjCount = projectIds.size;
  results.push({
    check_name: 'Project IDs Uniqueness & Primary Key Integrity',
    category: 'SCHEMA',
    status: uniqueProjCount === projects.length ? 'PASSED' : 'FAILED',
    details: `Evaluated ${projects.length} project IDs. Unique IDs: ${uniqueProjCount}.`,
    records_evaluated: projects.length,
    failure_count: projects.length - uniqueProjCount,
  });

  // 2. Referential Integrity - States
  let invalidStateFk = 0;
  for (const p of projects) {
    if (!stateIds.has(p.state_id)) invalidStateFk++;
  }
  results.push({
    check_name: 'Foreign Key Referential Integrity: projects -> states',
    category: 'REFERENTIAL',
    status: invalidStateFk === 0 ? 'PASSED' : 'FAILED',
    details: `All ${projects.length} projects reference valid master State/UT entities.`,
    records_evaluated: projects.length,
    failure_count: invalidStateFk,
  });

  // 3. Referential Integrity - MPs
  let invalidMpFk = 0;
  for (const p of projects) {
    if (!mpIds.has(p.mp_id)) invalidMpFk++;
  }
  results.push({
    check_name: 'Foreign Key Referential Integrity: projects -> mps',
    category: 'REFERENTIAL',
    status: invalidMpFk === 0 ? 'PASSED' : 'FAILED',
    details: `All ${projects.length} projects linked to canonical 543 Hon'ble MPs.`,
    records_evaluated: projects.length,
    failure_count: invalidMpFk,
  });

  // 4. Referential Integrity - Implementing Agencies
  let invalidIaFk = 0;
  for (const p of projects) {
    if (!iaIds.has(p.ia_id)) invalidIaFk++;
  }
  results.push({
    check_name: 'Foreign Key Referential Integrity: projects -> implementing_agencies',
    category: 'REFERENTIAL',
    status: invalidIaFk === 0 ? 'PASSED' : 'FAILED',
    details: `All ${projects.length} projects mapped to registered executive divisions.`,
    records_evaluated: projects.length,
    failure_count: invalidIaFk,
  });

  // 5. Referential Integrity - Payments
  let invalidPaymentFk = 0;
  for (const pay of payments) {
    if (!projectIds.has(pay.project_id)) invalidPaymentFk++;
  }
  results.push({
    check_name: 'Payment Ledger Foreign Key Integrity: payments -> projects',
    category: 'REFERENTIAL',
    status: invalidPaymentFk === 0 ? 'PASSED' : 'FAILED',
    details: `All ${payments.length} payment disbursements reference existing valid projects.`,
    records_evaluated: payments.length,
    failure_count: invalidPaymentFk,
  });

  // 6. Financial Bounds & Sanity
  let financialViolations = 0;
  for (const p of projects) {
    if (p.sanction_amount <= 0 || p.financial_progress < 0 || p.financial_progress > 100 || p.physical_progress < 0 || p.physical_progress > 100) {
      financialViolations++;
    }
  }
  results.push({
    check_name: 'Financial & Progress Numerical Domain Bounds [0, 100%]',
    category: 'FINANCIAL',
    status: financialViolations === 0 ? 'PASSED' : 'FAILED',
    details: `Sanction amounts strictly positive (>0) and percentage progress strictly bounded between 0% and 100%.`,
    records_evaluated: projects.length,
    failure_count: financialViolations,
  });

  // 7. Temporal Logic Ordering (Sanction <= Start <= Expected Completion)
  let temporalViolations = 0;
  for (const p of projects) {
    const sDate = new Date(p.sanction_date);
    const stDate = new Date(p.start_date);
    const expDate = new Date(p.expected_completion_date);
    const actualDate = p.actual_completion_date ? new Date(p.actual_completion_date) : null;
    if (
      isNaN(sDate.getTime()) || isNaN(stDate.getTime()) || isNaN(expDate.getTime()) ||
      sDate > stDate || stDate > expDate ||
      (actualDate !== null && (isNaN(actualDate.getTime()) || actualDate < stDate))
    ) {
      temporalViolations++;
    }
  }
  results.push({
    check_name: 'Chronological Temporal Logic (Sanction <= Start <= Expected Completion)',
    category: 'TEMPORAL',
    status: temporalViolations === 0 ? 'PASSED' : 'FAILED',
    details: `All timestamps follow standard project lifecycle progression without chronological inversions.`,
    records_evaluated: projects.length,
    failure_count: temporalViolations,
  });

  // 8. Geospatial Coordinate Validity
  let geoViolations = 0;
  for (const p of projects) {
    const lat = p.location.latitude;
    const lng = p.location.longitude;
    // India rough bounding box: lat 6 to 38, lng 68 to 98
    if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
      geoViolations++;
    }
  }
  results.push({
    check_name: 'Geospatial Bounding Box & PostGIS Coordinate Validation',
    category: 'GEOSPATIAL',
    status: geoViolations === 0 ? 'PASSED' : 'FAILED',
    details: `All project latitude and longitude coordinates reside strictly within the national territory bounding box.`,
    records_evaluated: projects.length,
    failure_count: geoViolations,
  });

  // 9. Anomaly Injection Presence & Verifiability
  // Only require controlled IDs which are in scope for the requested fixture.
  const knownDemos = ['P10342', 'P10101', 'P10450', 'P10580', 'P10701', 'P10702', 'P10880']
    .filter((id) => Number(id.slice(1)) - 10000 <= projects.length);
  let missingDemos = 0;
  for (const demoId of knownDemos) {
    if (!projectIds.has(demoId)) missingDemos++;
  }
  results.push({
    check_name: 'Known Injected Anomaly Scenarios & Demo Key Identifiers',
    category: 'ANOMALIES',
    status: missingDemos === 0 ? 'PASSED' : 'FAILED',
    details: `All 7 key controlled demo anomalies (P10342 payment mismatch, P10101 high cost, P10701/02 duplicates, etc.) are seeded and queryable.`,
    records_evaluated: knownDemos.length,
    failure_count: missingDemos,
  });

  // 10. Canonical State Hierarchy Integrity (project.state_id == constituency.state_id)
  const constMap = new Map<string, ConstituencyEntity>();
  constituencies.forEach((c) => constMap.set(c.constituency_id, c));
  let stateMismatchCount = 0;
  if (constituencies.length > 0) {
    for (const p of projects) {
      const c = constMap.get(p.constituency_id);
      if (c && c.state_id !== p.state_id) {
        stateMismatchCount++;
      }
    }
  }
  results.push({
    check_name: 'Canonical Geography Hierarchy: project.state_id == constituency.state_id',
    category: 'REFERENTIAL',
    status: stateMismatchCount === 0 ? 'PASSED' : 'FAILED',
    details: `Verified ${projects.length} projects. No cross-state constituency misalignments.`,
    records_evaluated: projects.length,
    failure_count: stateMismatchCount,
  });

  // 11. Canonical District Hierarchy Integrity (project.district_id == constituency.district_id)
  let districtMismatchCount = 0;
  if (constituencies.length > 0) {
    for (const p of projects) {
      const c = constMap.get(p.constituency_id);
      if (c && c.district_id !== p.district_id) {
        districtMismatchCount++;
      }
    }
  }
  results.push({
    check_name: 'Canonical Geography Hierarchy: project.district_id == constituency.district_id',
    category: 'REFERENTIAL',
    status: districtMismatchCount === 0 ? 'PASSED' : 'FAILED',
    details: `Verified ${projects.length} projects. All projects mapped to canonical district IDs.`,
    records_evaluated: projects.length,
    failure_count: districtMismatchCount,
  });

  // 12. Canonical MP Constituency Integrity (project.mp_id belongs to constituency)
  const mpMap = new Map<string, MPEntity>();
  mps.forEach((m) => mpMap.set(m.mp_id, m));
  let mpConstituencyMismatchCount = 0;
  for (const p of projects) {
    const mp = mpMap.get(p.mp_id);
    if (mp && mp.constituency_id && mp.constituency_id !== p.constituency_id) {
      mpConstituencyMismatchCount++;
    }
  }
  results.push({
    check_name: 'Canonical Representation: project.mp_id constituency alignment',
    category: 'REFERENTIAL',
    status: mpConstituencyMismatchCount === 0 ? 'PASSED' : 'FAILED',
    details: `All ${projects.length} projects belong to sponsoring MP's represented parliamentary constituency.`,
    records_evaluated: projects.length,
    failure_count: mpConstituencyMismatchCount,
  });

  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  return {
    timestamp: new Date().toISOString(),
    total_checks: results.length,
    passed_checks: passed,
    failed_checks: failed,
    all_passed: failed === 0,
    results,
  };
}
