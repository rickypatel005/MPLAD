/**
 * Phase 3, 3A, 3B: Synthetic Project Expansion, Payment Ledger & Anomaly Injector
 */
import {
  AnomalyScenario,
  ConstituencyEntity,
  DistrictEntity,
  DuplicateCluster,
  ImplementingAgencyEntity,
  MPEntity,
  PaymentTransaction,
  ProjectEntity,
  ProjectStatus,
  RiskFlag,
  RiskLevel,
  RiskScore,
  StateEntity,
} from '../types.ts';

// Deterministic PRNG
class SeededRandom {
  private seed: number;

  constructor(seed: number = 26102) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  choice<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  floatBetween(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export const PROJECT_CATEGORIES = [
  'Road & Transport',
  'Bridge & Culvert',
  'Drinking Water Supply',
  'Drainage & Sewerage',
  'Community Hall & Social Asset',
  'School & Educational Infra',
  'Primary Health Centre & Hospital',
  'Public Solar & Street Lighting',
  'Sanitation Complex',
  'Irrigation & Check Dam',
  'Sports & Youth Facility',
];

const TEMPLATES: Record<string, string[]> = {
  'Road & Transport': [
    'Construction and blacktopping of CC road from {loc1} to {loc2} in {constituency}.',
    'Upgradation and widening of rural arterial road connecting {loc1} via {loc2}.',
    'Laying of interlocking paver block road and side drains near {loc1}.',
  ],
  'Bridge & Culvert': [
    'Construction of RCC High Level Bridge across local stream at {loc1}.',
    'Reconstruction of dilapidated Box Culvert and approach link at {loc1}.',
  ],
  'Drinking Water Supply': [
    'Installation of Deep Tube Well, RO Filtration Unit and Overhead Tank at {loc1}.',
    'Laying of drinking water pipeline network with solar-powered pump set in {loc1}.',
  ],
  'Drainage & Sewerage': [
    'Construction of storm water pucca RCC covered drainage system along main bazaar in {loc1}.',
    'Construction of underground drainage network and silt chamber in {loc1}.',
  ],
  'Community Hall & Social Asset': [
    'Construction of multipurpose community welfare hall and cultural stage at {loc1}.',
    'Construction of Dr. B.R. Ambedkar Bhavan and community asset centre in {loc1}.',
  ],
  'School & Educational Infra': [
    'Construction of 4 additional smart classrooms and science laboratory at Govt High School {loc1}.',
    'Construction of boundary wall, mid-day meal shed, and toilet block at Govt Primary School {loc1}.',
  ],
  'Primary Health Centre & Hospital': [
    'Construction of 10-bed Maternity and Child Care wing at Primary Health Centre {loc1}.',
    'Establishment of Ayush Health and Wellness Centre with diagnostic equipment in {loc1}.',
  ],
  'Public Solar & Street Lighting': [
    'Installation of 120 Nos. LED Solar High-Mast street lights in wards of {loc1}.',
    'Solar electrification of public facilities and market junction at {loc1}.',
  ],
  'Sanitation Complex': [
    'Construction of Community Sanitary Complex (CSC) with running water facility at {loc1}.',
    'Construction of public bio-toilets and modern wash facility near bus stand {loc1}.',
  ],
  'Irrigation & Check Dam': [
    'Construction of check dam and water harvesting pond on nullah at {loc1}.',
    'Lift irrigation scheme with pipeline network for marginal farmers in {loc1}.',
  ],
  'Sports & Youth Facility': [
    'Development of rural sports stadium with running track and open gym at {loc1}.',
    'Construction of indoor badminton court and youth club building in {loc1}.',
  ],
};

const VILLAGE_NAMES = [
  'Rampur', 'Kalyanpur', 'Chandpur', 'Shivpur', 'Govindpur', 'Sundarnagar', 'Shanti Nagar',
  'Mohanpur', 'Krishnanagar', 'Gopalpur', 'Devipur', 'Bhimpur', 'Haripur', 'Anandpur',
  'Fatehpur', 'Sultanpur', 'Maharajpur', 'Laxmipur', 'Sitarampur', 'Rajendra Nagar',
  'Gandhi Gram', 'Subhash Nagar', 'Vivekananda Pally', 'Patel Chowk', 'Nehru Nagar',
];

export interface GenerationOutput {
  projects: ProjectEntity[];
  payments: PaymentTransaction[];
  agencies: ImplementingAgencyEntity[];
  duplicateClusters: DuplicateCluster[];
}

export function generateSyntheticDataset(
  mps: MPEntity[],
  states: StateEntity[],
  targetProjectCount: number = 10000,
  seed: number = 26102,
  constituencies: ConstituencyEntity[] = [],
  districts: DistrictEntity[] = []
): GenerationOutput {
  const rng = new SeededRandom(seed);
  const stateMap = new Map<string, StateEntity>();
  states.forEach((s) => stateMap.set(s.state_id, s));

  const constituencyMap = new Map<string, ConstituencyEntity>();
  constituencies.forEach((c) => constituencyMap.set(c.constituency_id, c));

  const districtMap = new Map<string, DistrictEntity>();
  districts.forEach((d) => districtMap.set(d.district_id, d));

  // 1. Generate Implementing Agencies per State
  const agencies: ImplementingAgencyEntity[] = [];
  const agencyTypes: ImplementingAgencyEntity['agency_type'][] = [
    'PWD', 'DRDA', 'MUNICIPAL', 'PHED', 'ZILLA_PARISHAD', 'ELECTRICITY', 'IRRIGATION'
  ];

  let iaCounter = 1;
  const stateAgenciesMap = new Map<string, ImplementingAgencyEntity[]>();

  for (const st of states) {
    const list: ImplementingAgencyEntity[] = [];
    for (const atype of agencyTypes) {
      const iaId = `IA${String(iaCounter++).padStart(3, '0')}`;
      const name = `${st.normalized_name} ${atype} Executive Division`;
      const agency: ImplementingAgencyEntity = {
        ia_id: iaId,
        name: name,
        normalized_name: name,
        agency_type: atype,
        state_id: st.state_id,
        projects_count: 0,
        total_budget_handled: 0,
      };
      agencies.push(agency);
      list.push(agency);
    }
    stateAgenciesMap.set(st.state_id, list);
  }

  const projects: ProjectEntity[] = [];
  const allPayments: PaymentTransaction[] = [];
  let paymentCounter = 1;
  const duplicateClusters: DuplicateCluster[] = [];

  // Fixed demo IDs are available in the 10k dataset. Smaller fixtures must
  // still create a duplicate pair, but it has to reference generated rows.
  const duplicatePairIds = targetProjectCount >= 702
    ? ['P10701', 'P10702'] as const
    : [
        `P${String(10000 + Math.max(1, targetProjectCount - 1))}`,
        `P${String(10000 + Math.max(2, targetProjectCount))}`,
      ] as const;
  const [duplicatePrimaryId, duplicateMatchId] = duplicatePairIds;

  // Determine projects per MP
  const projectsPerMp = Math.ceil(targetProjectCount / Math.max(mps.length, 1));

  let projectIndex = 1;

  for (let mIdx = 0; mIdx < mps.length; mIdx++) {
    const mp = mps[mIdx];
    const st = stateMap.get(mp.state_id) || states[0];
    const stateIas = stateAgenciesMap.get(st.state_id) || agencies.slice(0, 3);

    // Number of projects for this MP (e.g. 16 to 22)
    const countForThisMp = rng.nextInt(Math.max(14, projectsPerMp - 3), projectsPerMp + 3);

    for (let p = 0; p < countForThisMp; p++) {
      if (projects.length >= targetProjectCount) break;

      const projectId = `P${String(10000 + projectIndex++)}`;
      let category = rng.choice(PROJECT_CATEGORIES);
      const loc1 = `${rng.choice(VILLAGE_NAMES)} Ward ${rng.nextInt(1, 15)}`;
      const loc2 = `${rng.choice(VILLAGE_NAMES)} Chowk`;
      const template = rng.choice(TEMPLATES[category] || TEMPLATES['Road & Transport']);
      const description = template
        .replace('{loc1}', loc1)
        .replace('{loc2}', loc2)
        .replace('{constituency}', mp.name);

      const projectName = `${category} - ${loc1}`;

      // Controlled anomaly assignment
      let scenario: AnomalyScenario = 'NORMAL_BENCHMARK';

      // Inject anomalies into specific projects for known repeatable demos
      if (projectId === 'P10342') {
        scenario = 'PAYMENT_PROGRESS_MISMATCH';
      } else if (projectId === 'P10101' || projectId === 'P10245') {
        scenario = 'HIGH_COST_ANOMALY';
      } else if (projectId === 'P10450' || projectId === 'P10612') {
        scenario = 'TIMELINE_DELAY_ANOMALY';
      } else if (projectId === 'P10580') {
        scenario = 'IA_CONCENTRATION_ANOMALY';
      } else if (projectId === duplicatePrimaryId || projectId === duplicateMatchId) {
        scenario = 'DUPLICATE_PROJECT_PAIR';
      } else if (projectId === 'P10880') {
        scenario = 'COMPLIANCE_ANOMALY';
      } else {
        // Statistical background anomalies (~5% of total dataset)
        const randVal = rng.next();
        if (randVal < 0.015) scenario = 'PAYMENT_PROGRESS_MISMATCH';
        else if (randVal < 0.025) scenario = 'HIGH_COST_ANOMALY';
        else if (randVal < 0.035) scenario = 'TIMELINE_DELAY_ANOMALY';
        else if (randVal < 0.042) scenario = 'IA_CONCENTRATION_ANOMALY';
        else if (randVal < 0.050) scenario = 'COMPLIANCE_ANOMALY';
      }

      // Implementing agency
      let ia = rng.choice(stateIas);
      if (scenario === 'IA_CONCENTRATION_ANOMALY') {
        ia = stateIas[0]; // Concentrate in first agency
      }

      // Budget calculations
      let sanctionAmount = Math.round(rng.floatBetween(1500000, 7500000) / 10000) * 10000;
      if (scenario === 'HIGH_COST_ANOMALY') {
        sanctionAmount = Math.round(rng.floatBetween(18000000, 35000000) / 100000) * 100000; // 3x-5x peer benchmark
      }

      // Dates (Strictly: sanctionDate <= startDate <= expectedCompDate)
      const startYear = rng.choice([2024, 2025, 2026]);
      const startMonth = rng.nextInt(1, 12);
      const startDay = rng.nextInt(1, 28);
      const sDateObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
      const sanctionDate = sDateObj.toISOString().split('T')[0];
      
      const stDateObj = new Date(sDateObj.getTime() + rng.nextInt(15, 45) * 86400000);
      const startDate = stDateObj.toISOString().split('T')[0];

      const durationDays = rng.nextInt(180, 420);
      const expDateObj = new Date(stDateObj.getTime() + durationDays * 86400000);
      const expectedCompDate = expDateObj.toISOString().split('T')[0];

      // Status & Progress logic
      let physicalProgress = 0;
      let financialProgress = 0;
      let status: ProjectStatus = 'IN_PROGRESS';
      let actualCompDate: string | null = null;

      if (scenario === 'PAYMENT_PROGRESS_MISMATCH') {
        // High financial payment with low physical ground progress
        financialProgress = rng.nextInt(82, 94);
        physicalProgress = rng.nextInt(15, 28);
        status = 'IN_PROGRESS';
      } else if (scenario === 'TIMELINE_DELAY_ANOMALY') {
        // Severely delayed past expected completion
        physicalProgress = rng.nextInt(25, 45);
        financialProgress = rng.nextInt(40, 60);
        status = 'STALLED';
      } else if (scenario === 'HIGH_COST_ANOMALY') {
        physicalProgress = rng.nextInt(40, 75);
        financialProgress = rng.nextInt(50, 80);
        status = 'IN_PROGRESS';
      } else if (scenario === 'COMPLIANCE_ANOMALY') {
        physicalProgress = rng.nextInt(30, 60);
        financialProgress = rng.nextInt(40, 70);
        status = 'IN_PROGRESS';
      } else if (scenario === 'DUPLICATE_PROJECT_PAIR') {
        physicalProgress = 40;
        financialProgress = 50;
        status = 'IN_PROGRESS';
      } else {
        // Normal distribution
        const pState = rng.choice(['NOT_STARTED', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED']);
        if (pState === 'COMPLETED') {
          physicalProgress = 100;
          financialProgress = 100;
          status = 'COMPLETED';
          actualCompDate = expectedCompDate;
        } else if (pState === 'NOT_STARTED') {
          physicalProgress = 0;
          financialProgress = 0;
          status = 'NOT_STARTED';
        } else {
          physicalProgress = rng.nextInt(20, 85);
          // Correlated financial progress (within +/- 8%)
          financialProgress = Math.max(0, Math.min(100, physicalProgress + rng.nextInt(-6, 8)));
          status = 'IN_PROGRESS';
        }
      }

      // Geo coordinates within state bounding circle (+/- 0.45 deg)
      const latOffset = (rng.next() - 0.5) * 0.9;
      const lngOffset = (rng.next() - 0.5) * 0.9;
      let latitude = parseFloat((st.latitude + latOffset).toFixed(4));
      let longitude = parseFloat((st.longitude + lngOffset).toFixed(4));

      // Handle duplicate scenario overrides
      let overrideDescription = description;
      let overrideName = projectName;
      if (projectId === duplicateMatchId) {
        // Make the generated pair a near duplicate.
        overrideName = 'Construction of multipurpose community hall at Rampur Ward 4';
        overrideDescription = 'Construction of multipurpose community welfare hall and cultural stage at Rampur Ward 4 in Varanasi.';
        category = 'Community Hall & Social Asset';
        latitude = 25.3180;
        longitude = 82.9800;
      } else if (projectId === duplicatePrimaryId) {
        overrideName = 'Construction of community welfare hall at Rampur Ward 4';
        overrideDescription = 'Construction of multipurpose community hall and stage at Rampur Ward 4 serving local residents of Varanasi.';
        category = 'Community Hall & Social Asset';
        latitude = 25.3184; // ~45 meters away
        longitude = 82.9804;
      }

      // Payments generation
      const projectPayments: PaymentTransaction[] = [];
      const totalPaidAmount = Math.round((sanctionAmount * financialProgress) / 100);
      const tranches = financialProgress > 60 ? 4 : financialProgress > 30 ? 2 : financialProgress > 0 ? 1 : 0;

      let cumPaid = 0;
      for (let t = 1; t <= tranches; t++) {
        const isLast = t === tranches;
        const trancheAmount = isLast ? (totalPaidAmount - cumPaid) : Math.round(totalPaidAmount / tranches);
        cumPaid += trancheAmount;
        const payDateObj = new Date(stDateObj.getTime() + t * 30 * 86400000);
        const payDate = payDateObj.toISOString().split('T')[0];

        const payment: PaymentTransaction = {
          payment_id: `PAY${String(paymentCounter++).padStart(6, '0')}`,
          project_id: projectId,
          payment_date: payDate,
          payment_amount: Math.max(0, trancheAmount),
          cumulative_payment: Math.min(sanctionAmount, cumPaid),
          payment_status: scenario === 'PAYMENT_PROGRESS_MISMATCH' && isLast ? 'FLAGGED' : 'PROCESSED',
          milestone_description: `Milestone Tranche ${t}/${tranches} - Inspection Phase`,
          voucher_no: `VCH-${startYear}-${String(rng.nextInt(10000, 99999))}`,
        };
        projectPayments.push(payment);
        allPayments.push(payment);
      }

      // Generate initial baseline seed values (non-authoritative placeholder for dataset generation)
      const { riskScore, flags } = generateSyntheticBaselineSeed(
        projectId,
        scenario,
        sanctionAmount,
        physicalProgress,
        financialProgress,
        status,
        expectedCompDate,
        ia,
        category
      );

      // Resolve canonical geography hierarchy
      const canonicalConst = constituencyMap.get(mp.constituency_id);
      const canonicalDistrict = canonicalConst ? districtMap.get(canonicalConst.district_id) : undefined;
      const districtId = canonicalDistrict?.district_id || (mp.constituency_id ? `D${mp.constituency_id.replace('C', '').padStart(3, '0')}` : 'D001');
      const districtName = canonicalDistrict?.normalized_name || `${st.normalized_name} District`;
      const constituencyId = canonicalConst?.constituency_id || mp.constituency_id || 'C001';
      const constituencyName = canonicalConst?.normalized_name || mp.name || 'General Constituency';

      const project: ProjectEntity = {
        project_id: projectId,
        project_name: overrideName,
        description: overrideDescription,
        category: category,
        state_id: st.state_id,
        state_name: st.normalized_name,
        district_id: districtId,
        district_name: districtName,
        constituency_id: constituencyId,
        constituency_name: constituencyName,
        mp_id: mp.mp_id,
        mp_name: mp.normalized_name,
        ia_id: ia.ia_id,
        ia_name: ia.normalized_name,
        sanction_amount: sanctionAmount,
        sanction_date: sanctionDate,
        start_date: startDate,
        expected_completion_date: expectedCompDate,
        actual_completion_date: actualCompDate,
        physical_progress: physicalProgress,
        financial_progress: financialProgress,
        status: status,
        location: {
          latitude: latitude,
          longitude: longitude,
          address: `${loc1}, ${st.normalized_name}`,
          gps_accuracy_meters: rng.nextInt(3, 12),
        },
        record_source: 'SYNTHETIC',
        synthetic_scenario: scenario,
        source_file: 'Allocated Limit for Honble MPs.csv',
        source_row: mp.source_row,
        synthetic_seed: seed,
        created_at: `${sanctionDate}T09:00:00Z`,
        updated_at: '2026-08-26T18:00:00Z',
        risk_score: riskScore,
        flags: flags,
        payments: projectPayments,
        review_status: 'UNREVIEWED',
        review_count: 0,
      };

      projects.push(project);

      // Update IA aggregations
      ia.projects_count += 1;
      ia.total_budget_handled += sanctionAmount;
    }
  }

  // Calculate HHI index for agencies
  agencies.forEach((ia) => {
    const totalStateBudget = agencies
      .filter((a) => a.state_id === ia.state_id)
      .reduce((sum, a) => sum + a.total_budget_handled, 0);
    const share = totalStateBudget > 0 ? (ia.total_budget_handled / totalStateBudget) * 100 : 0;
    ia.hhi_score = Math.round(share * share);
  });

  // Only create the cluster when both referenced projects were generated.
  const duplicatePrimary = projects.find((p) => p.project_id === duplicatePrimaryId);
  const duplicateMatch = projects.find((p) => p.project_id === duplicateMatchId);
  if (duplicatePrimary && duplicateMatch) {
    duplicateClusters.push({
      cluster_id: 'DUP-CLUST-001',
      primary_project_id: duplicatePrimaryId,
      suspected_count: 2,
      max_similarity: 0.94,
      total_suspect_amount: duplicatePrimary.sanction_amount + duplicateMatch.sanction_amount,
      matches: [
        {
          match_project_id: duplicateMatchId,
          match_project_name: 'Construction of multipurpose community hall at Rampur Ward 4',
          match_description: 'Construction of multipurpose community welfare hall and cultural stage at Rampur Ward 4 in Varanasi.',
          overall_similarity: 0.94,
          text_similarity: 0.96,
          geo_distance_meters: 44.8,
          date_proximity_days: 14,
          same_ia: true,
          match_reasons: [
            'High cosine text similarity (>95%)',
            'Physical distance 44.8m is within asset duplication radius (100m)',
            'Sanctioned within 14 days under identical implementing agency',
          ],
        },
      ],
    });
  }

  return {
    projects,
    payments: allPayments,
    agencies,
    duplicateClusters,
  };
}

/**
 * Non-authoritative synthetic baseline seed generator.
 * NOTE: This is strictly a dataset initialization seed placeholder.
 * Authoritative risk scoring is owned exclusively by Person 2 ML & Person 3 Intelligence services.
 */
function generateSyntheticBaselineSeed(
  projectId: string,
  scenario: AnomalyScenario,
  amount: number,
  physical: number,
  financial: number,
  status: ProjectStatus,
  expectedCompletion: string,
  agency: ImplementingAgencyEntity,
  category: string
): { riskScore: RiskScore; flags: RiskFlag[] } {
  let finScore = 0.15;
  let timeScore = 0.12;
  let compScore = 0.10;
  let iaScore = 0.14;
  let geoScore = 0.08;
  let evidenceScore = 0.10;

  const flags: RiskFlag[] = [];
  const reasons: string[] = [];

  const now = new Date('2026-08-26');
  const expDate = new Date(expectedCompletion);

  // 1. Financial Evaluation
  const diff = financial - physical;
  if (scenario === 'PAYMENT_PROGRESS_MISMATCH' || diff > 40) {
    finScore = 0.88;
    evidenceScore = 0.85;
    flags.push({
      flag_id: `FLG-FIN-${projectId}`,
      project_id: projectId,
      flag_type: 'FINANCIAL',
      severity: 'CRITICAL',
      rule_code: 'R_FIN_002',
      message: `Severe Payment vs Progress divergence: Financial utilization is ${financial}% but physical progress is only ${physical}%.`,
      evidence_json: { financial_progress: financial, physical_progress: physical, delta: diff, threshold: 25 },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Disproportionate financial disbursement (${financial}%) vs physical ground execution (${physical}%)`);
  } else if (diff > 20) {
    finScore = 0.55;
    flags.push({
      flag_id: `FLG-FIN-${projectId}`,
      project_id: projectId,
      flag_type: 'FINANCIAL',
      severity: 'MEDIUM',
      rule_code: 'R_FIN_001',
      message: `Advance payment excess observed (${diff}% gap between finance and physical execution).`,
      evidence_json: { financial_progress: financial, physical_progress: physical, delta: diff },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Advance payment ahead of physical measurement book`);
  }

  // Cost Benchmark Evaluation
  if (scenario === 'HIGH_COST_ANOMALY' || amount > 18000000) {
    finScore = Math.max(finScore, 0.84);
    compScore = Math.max(compScore, 0.70);
    flags.push({
      flag_id: `FLG-COST-${projectId}`,
      project_id: projectId,
      flag_type: 'FINANCIAL',
      severity: 'HIGH',
      rule_code: 'R_COST_003',
      message: `Sanctioned cost of ₹${(amount / 100000).toFixed(1)} Lakhs is 3.2x higher than state CPWD Schedule of Rates benchmark for ${category}.`,
      evidence_json: { sanction_amount: amount, benchmark_amount: amount / 3.2, ratio: 3.2 },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Cost estimate exceeds CPWD/PWD schedule of rates benchmark by >300%`);
  }

  // 2. Timeline Evaluation
  if (scenario === 'TIMELINE_DELAY_ANOMALY' || (expDate < now && status !== 'COMPLETED' && physical < 60)) {
    timeScore = 0.92;
    flags.push({
      flag_id: `FLG-TIME-${projectId}`,
      project_id: projectId,
      flag_type: 'TIMELINE',
      severity: 'HIGH',
      rule_code: 'R_TIME_001',
      message: `Project overdue: Expected completion was ${expectedCompletion}, work is stalled at ${physical}% completion.`,
      evidence_json: { expected_date: expectedCompletion, current_status: status, progress: physical },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Timeline breach: Incomplete work overdue beyond target completion deadline`);
  }

  // 3. IA Concentration Evaluation
  if (scenario === 'IA_CONCENTRATION_ANOMALY') {
    iaScore = 0.85;
    flags.push({
      flag_id: `FLG-IA-${projectId}`,
      project_id: projectId,
      flag_type: 'IA_CONCENTRATION',
      severity: 'HIGH',
      rule_code: 'R_IA_001',
      message: `Single Implementing Agency (${agency.normalized_name}) holds excessive market share in constituency (HHI > 4,200).`,
      evidence_json: { ia_name: agency.normalized_name, market_share_pct: 68, hhi: 4624 },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`High contractor/agency concentration risk detected for ${agency.normalized_name}`);
  }

  // 4. Duplicate Evaluation
  if (scenario === 'DUPLICATE_PROJECT_PAIR') {
    geoScore = 0.90;
    compScore = 0.88;
    evidenceScore = 0.95;
    flags.push({
      flag_id: `FLG-DUP-${projectId}`,
      project_id: projectId,
      flag_type: 'DUPLICATE',
      severity: 'CRITICAL',
      rule_code: 'R_DUP_001',
      message: `Suspected duplicate civic project detected at identical location (44.8m) with 94% text similarity.`,
      evidence_json: { similarity: 0.94, distance_m: 44.8 },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Suspected duplicate asset allocation at identical coordinates within 50m`);
  }

  // 5. Compliance Evaluation
  if (scenario === 'COMPLIANCE_ANOMALY') {
    compScore = 0.85;
    flags.push({
      flag_id: `FLG-COMP-${projectId}`,
      project_id: projectId,
      flag_type: 'COMPLIANCE',
      severity: 'HIGH',
      rule_code: 'R_COMP_004',
      message: `Mandatory District Collectorate administrative sanction & structural audit certificate missing from project file.`,
      evidence_json: { missing_documents: ['Structural Audit Certificate', 'Environmental NOC'] },
      created_at: '2026-08-26T10:00:00Z',
    });
    reasons.push(`Compliance infraction: Missing mandatory statutory clearance and sanction records`);
  }

  // Weighted overall calculation
  const overall = parseFloat(
    (
      finScore * 0.35 +
      timeScore * 0.20 +
      compScore * 0.15 +
      iaScore * 0.15 +
      geoScore * 0.10 +
      evidenceScore * 0.05
    ).toFixed(2)
  );

  let riskLevel: RiskLevel = 'LOW';
  if (overall >= 0.70) riskLevel = 'CRITICAL';
  else if (overall >= 0.50) riskLevel = 'HIGH';
  else if (overall >= 0.30) riskLevel = 'MEDIUM';

  if (reasons.length === 0) {
    reasons.push('All parameters within standard MoSPI/MPLADS audit benchmarks');
  }

  const riskScore: RiskScore = {
    project_id: projectId,
    overall_score: overall,
    risk_level: riskLevel,
    financial_score: parseFloat(finScore.toFixed(2)),
    timeline_score: parseFloat(timeScore.toFixed(2)),
    compliance_score: parseFloat(compScore.toFixed(2)),
    ia_score: parseFloat(iaScore.toFixed(2)),
    geo_score: parseFloat(geoScore.toFixed(2)),
    evidence_score: parseFloat(evidenceScore.toFixed(2)),
    model_version: 'SYNTHETIC_SEED_BASELINE',
    scored_at: '2026-08-26T10:00:00Z',
    reasons: reasons,
    feature_contributions: [
      { feature: 'Financial Utilization Delta', weight: finScore * 0.35, description: 'Discrepancy between measurement book and bank payment' },
      { feature: 'Milestone Time Delay', weight: timeScore * 0.20, description: 'Variance from sanction timeline baseline' },
      { feature: 'Implementing Agency Concentration', weight: iaScore * 0.15, description: 'Constituency IA market dominance index' },
      { feature: 'Regulatory Compliance Index', weight: compScore * 0.15, description: 'Completeness of mandatory statutory clearances' },
      { feature: 'Geospatial Asset Overlap', weight: geoScore * 0.10, description: 'Haversine distance and semantic token similarity' },
    ],
  };

  return { riskScore, flags };
}
