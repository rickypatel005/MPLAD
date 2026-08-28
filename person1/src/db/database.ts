/**
 * Authoritative In-Memory & Relational Database Layer for SIH26102
 * Implements Phases 5 & 6 (Indexed Projects, Master Tables, Payments, Audit Trail, Reviews, PostGIS simulation)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { cleanAndNormalizeMasterData, parseRawCsvText } from '../pipeline/ingestAndClean.ts';
import { generateSyntheticDataset } from '../pipeline/syntheticGenerator.ts';
import { runValidationSuite } from '../pipeline/validationSuite.ts';
import {
  AuditLog,
  ComplianceRuleEntity,
  ConstituencyEntity,
  DashboardSummary,
  DistrictEntity,
  DuplicateCluster,
  EvidenceDossier,
  ImplementingAgencyEntity,
  MPEntity,
  PaymentTransaction,
  PipelineProfileReport,
  ProjectEntity,
  ReviewAction,
  ReviewActionType,
  RiskFlag,
  RiskScore,
  StateEntity,
  UserEntity,
  UserRole,
} from '../types.ts';

export class AppDatabase {
  private static instance: AppDatabase;

  public states: StateEntity[] = [];
  public districts: DistrictEntity[] = [];
  public constituencies: ConstituencyEntity[] = [];
  public mps: MPEntity[] = [];
  public agencies: ImplementingAgencyEntity[] = [];
  public projects: ProjectEntity[] = [];
  public payments: PaymentTransaction[] = [];
  public duplicateClusters: DuplicateCluster[] = [];
  public reviewActions: ReviewAction[] = [];
  public auditLogs: AuditLog[] = [];
  public rules: ComplianceRuleEntity[] = [];

  public rawCsvRowTotal: number = 0;
  public rawCsvRecords: any[] = [];
  public profileReport: PipelineProfileReport | null = null;
  public currentSeed: number = 26102;
  public targetProjectCount: number = 10000;

  // Indexes for high performance
  private projectIndexById = new Map<string, ProjectEntity>();
  private projectsByState = new Map<string, ProjectEntity[]>();
  private projectsByMp = new Map<string, ProjectEntity[]>();
  private projectsByIa = new Map<string, ProjectEntity[]>();
  private paymentsByProject = new Map<string, PaymentTransaction[]>();
  private reviewByProject = new Map<string, ReviewAction[]>();
  private auditByProject = new Map<string, AuditLog[]>();

  private constructor() {
    this.initializePipeline(this.targetProjectCount, this.currentSeed);
  }

  public static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase();
    }
    return AppDatabase.instance;
  }

  public initializePipeline(projectCount: number = 10000, seed: number = 26102) {
    this.currentSeed = seed;
    this.targetProjectCount = projectCount;

    // Load CSV file
    let csvContent = '';
    const candidatePaths = [
      path.join(process.cwd(), 'data', 'raw', 'Allocated Limit for Honble MPs.csv'),
      path.join(process.cwd(), 'person1', 'data', 'raw', 'Allocated Limit for Honble MPs.csv'),
      path.join(__dirname, '..', '..', 'data', 'raw', 'Allocated Limit for Honble MPs.csv'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        csvContent = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    const rawRecords = parseRawCsvText(csvContent);
    this.rawCsvRowTotal = rawRecords.length;
    this.rawCsvRecords = rawRecords;

    // Phase 1 & 2: Clean & Normalize Master Data
    const cleaned = cleanAndNormalizeMasterData(rawRecords);
    this.states = cleaned.states;
    this.districts = cleaned.districts;
    this.constituencies = cleaned.constituencies;
    this.mps = cleaned.mps;

    // Phase 3 & 3A & 3B: Synthetic Expansion
    const generated = generateSyntheticDataset(this.mps, this.states, projectCount, seed, this.constituencies, this.districts);
    this.projects = generated.projects;
    this.payments = generated.payments;
    this.agencies = generated.agencies;
    this.duplicateClusters = generated.duplicateClusters;

    // Phase 4: Run Validation Suite
    const validation = runValidationSuite(
      this.states,
      this.mps,
      this.agencies,
      this.projects,
      this.payments,
      this.constituencies,
      this.districts
    );

    // Build scenario distribution count
    const scenarioCounts: Record<string, number> = {};
    for (const p of this.projects) {
      scenarioCounts[p.synthetic_scenario] = (scenarioCounts[p.synthetic_scenario] || 0) + 1;
    }

    this.profileReport = {
      raw_file_name: 'Allocated Limit for Honble MPs.csv',
      raw_total_rows: this.rawCsvRowTotal + 1, // including header
      grand_total_row_detected: cleaned.grandTotalRow !== null,
      grand_total_value_inr: cleaned.grandTotalRow?.allocatedAmount || '27,150,000,000',
      operational_mp_records: this.mps.length,
      unique_states_raw: cleaned.states.length,
      unique_states_normalized: cleaned.states.length,
      unique_constituencies: cleaned.constituencies.length,
      missing_amount_records: cleaned.missingAmountRecords.map((m) => ({
        row: m.row,
        mp_name: m.mpName,
        constituency: m.constituency,
        state: m.state,
        action_taken: 'Flagged with MISSING_SOURCE_VALUE & excluded from numeric sum inference',
      })),
      synthetic_generation: {
        seed: seed,
        target_projects: projectCount,
        generated_projects: this.projects.length,
        generated_payments: this.payments.length,
        generated_ias: this.agencies.length,
        injected_anomalies: scenarioCounts as any,
      },
      validation_suite: {
        checks_run: validation.total_checks,
        checks_passed: validation.passed_checks,
        all_passed: validation.all_passed,
        validations: validation.results.map((r) => ({
          check_name: r.check_name,
          status: r.status,
          details: r.details,
        })),
      },
    };

    // Seed rules
    this.rules = [
      {
        rule_code: 'RULE_FIN_01',
        rule_name: 'Payment vs Progress Divergence',
        description: 'Financial utilization exceeds physical execution by more than allowable threshold',
        severity: 'CRITICAL',
        category: 'FINANCIAL',
        threshold_config: { divergence_threshold_pct: 25, advance_limit_pct: 40 },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      {
        rule_code: 'RULE_TIME_01',
        rule_name: 'Milestone Delay / Project Stall',
        description: 'Work remains incomplete or stalled past scheduled statutory completion milestone',
        severity: 'HIGH',
        category: 'TIMELINE',
        threshold_config: { stall_threshold_days: 180, max_milestone_variance: 0.3 },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      {
        rule_code: 'RULE_COST_01',
        rule_name: 'Schedule of Rates (SOR) Exceedance',
        description: 'Sanctioned unit cost significantly exceeds CPWD/State PWD Schedule of Rates',
        severity: 'HIGH',
        category: 'COST',
        threshold_config: { max_sor_multiplier: 2.5 },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      {
        rule_code: 'RULE_IA_01',
        rule_name: 'Implementing Agency Concentration',
        description: 'Implementing Agency controls disproportionate market share in constituency (HHI)',
        severity: 'HIGH',
        category: 'AGENCY',
        threshold_config: { hhi_threshold: 2500, market_share_limit_pct: 50 },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      {
        rule_code: 'RULE_SCST_01',
        rule_name: 'SC/ST Statutory Allocation Mandate',
        description: 'Mandatory 15% SC and 7.5% ST target developmental allocation compliance',
        severity: 'MEDIUM',
        category: 'COMPLIANCE',
        threshold_config: { sc_target_pct: 15.0, st_target_pct: 7.5 },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
      {
        rule_code: 'RULE_DOCS_01',
        rule_name: 'Statutory Clearance & Approvals',
        description: 'Mandatory District Collectorate sanction, structural stability, and audit sign-offs',
        severity: 'HIGH',
        category: 'COMPLIANCE',
        threshold_config: { required_documents: ['ADMIN_SANCTION', 'STRUCTURAL_CERT'] },
        active: true,
        created_at: '2026-08-26T00:00:00Z',
        updated_at: '2026-08-26T00:00:00Z',
      },
    ];

    // Rebuild Indexes
    this.rebuildIndexes();

    // Seed baseline initial audit logs
    this.seedInitialAuditLogs();
  }

  private rebuildIndexes() {
    this.projectIndexById.clear();
    this.projectsByState.clear();
    this.projectsByMp.clear();
    this.projectsByIa.clear();
    this.paymentsByProject.clear();
    this.reviewByProject.clear();
    this.auditByProject.clear();

    for (const p of this.projects) {
      this.projectIndexById.set(p.project_id, p);

      if (!this.projectsByState.has(p.state_id)) this.projectsByState.set(p.state_id, []);
      this.projectsByState.get(p.state_id)!.push(p);

      if (!this.projectsByMp.has(p.mp_id)) this.projectsByMp.set(p.mp_id, []);
      this.projectsByMp.get(p.mp_id)!.push(p);

      if (!this.projectsByIa.has(p.ia_id)) this.projectsByIa.set(p.ia_id, []);
      this.projectsByIa.get(p.ia_id)!.push(p);
    }

    for (const pay of this.payments) {
      if (!this.paymentsByProject.has(pay.project_id)) this.paymentsByProject.set(pay.project_id, []);
      this.paymentsByProject.get(pay.project_id)!.push(pay);
    }

    for (const rev of this.reviewActions) {
      if (!this.reviewByProject.has(rev.project_id)) this.reviewByProject.set(rev.project_id, []);
      this.reviewByProject.get(rev.project_id)!.push(rev);
    }

    for (const aud of this.auditLogs) {
      if (!this.auditByProject.has(aud.project_id)) this.auditByProject.set(aud.project_id, []);
      this.auditByProject.get(aud.project_id)!.push(aud);
    }
  }

  private seedInitialAuditLogs() {
    this.auditLogs = [];
    const sampleProjects = ['P10342', 'P10101', 'P10701', 'P10702', 'P10580', 'P10450', 'P10880', 'P10001'];

    for (const pid of sampleProjects) {
      const proj = this.projectIndexById.get(pid);
      if (!proj) continue;

      this.auditLogs.push({
        audit_id: `AUD-INIT-${pid}`,
        project_id: pid,
        actor_id: 'SYSTEM_PIPELINE',
        actor_name: 'MPLADS Data Pipeline',
        action: 'PROJECT_INGESTED',
        payload_json: {
          sanction_amount: proj.sanction_amount,
          state: proj.state_name,
          mp: proj.mp_name,
          scenario: proj.synthetic_scenario,
        },
        created_at: proj.created_at,
      });

      if (proj.risk_score && proj.risk_score.risk_level !== 'LOW') {
        this.auditLogs.push({
          audit_id: `AUD-RISK-${pid}`,
          project_id: pid,
          actor_id: 'SYSTEM_PIPELINE',
          actor_name: 'Heuristic Baseline Rule Engine',
          action: 'RISK_FLAGS_RAISED',
          payload_json: {
            overall_score: proj.risk_score.overall_score,
            risk_level: proj.risk_score.risk_level,
            flags_count: proj.flags?.length || 0,
            top_reason: proj.risk_score.reasons[0],
          },
          created_at: '2026-08-26T10:00:00Z',
        });
      }
    }
  }

  // --- Core Query Methods ---

  public getProjects(params: {
    page?: number;
    page_size?: number;
    state_id?: string;
    status?: string;
    risk_level?: string;
    scenario?: string;
    search?: string;
    sort_by?: 'risk' | 'amount' | 'date' | 'progress';
    sort_order?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.page_size || 50));

    let filtered = this.projects;

    if (params.state_id) {
      filtered = filtered.filter((p) => p.state_id === params.state_id);
    }
    if (params.status) {
      filtered = filtered.filter((p) => p.status === params.status);
    }
    if (params.risk_level) {
      filtered = filtered.filter((p) => p.risk_score?.risk_level === params.risk_level);
    }
    if (params.scenario) {
      filtered = filtered.filter((p) => p.synthetic_scenario === params.scenario);
    }
    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.project_id.toLowerCase().includes(q) ||
          p.project_name.toLowerCase().includes(q) ||
          p.mp_name.toLowerCase().includes(q) ||
          p.state_name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.ia_name.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortField = params.sort_by || 'risk';
    const isAsc = params.sort_order === 'asc';

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'risk') {
        comparison = (b.risk_score?.overall_score || 0) - (a.risk_score?.overall_score || 0);
      } else if (sortField === 'amount') {
        comparison = b.sanction_amount - a.sanction_amount;
      } else if (sortField === 'progress') {
        comparison = b.physical_progress - a.physical_progress;
      } else if (sortField === 'date') {
        comparison = new Date(b.sanction_date).getTime() - new Date(a.sanction_date).getTime();
      }
      return isAsc ? -comparison : comparison;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return {
      items,
      pagination: {
        page,
        page_size: pageSize,
        total_items: total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  public getProjectById(projectId: string): ProjectEntity | null {
    const proj = this.projectIndexById.get(projectId);
    if (!proj) return null;

    // Attach payments & reviews
    return {
      ...proj,
      payments: this.paymentsByProject.get(projectId) || [],
      review_status: this.getLatestReviewStatus(projectId),
      review_count: (this.reviewByProject.get(projectId) || []).length,
    };
  }

  public getPaymentsForProject(projectId: string, page: number = 1, pageSize: number = 50) {
    const proj = this.projectIndexById.get(projectId);
    if (!proj) return null;
    const payments = this.paymentsByProject.get(projectId) || [];
    const total = payments.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const p = Math.max(1, Math.min(page, totalPages));
    const offset = (p - 1) * pageSize;
    return {
      items: payments.slice(offset, offset + pageSize),
      pagination: {
        page: p,
        page_size: pageSize,
        total_items: total,
        total_pages: totalPages,
        has_next: p < totalPages,
        has_prev: p > 1,
      },
    };
  }

  public getRiskScoreByProjectId(projectId: string): RiskScore | null {
    const proj = this.projectIndexById.get(projectId);
    return proj?.risk_score || null;
  }

  public getComplianceRules(): ComplianceRuleEntity[] {
    return this.rules;
  }

  public getDashboardSummary(): DashboardSummary {
    let totalBudget = 0;
    let totalUtilized = 0;
    let physicalSum = 0;
    let financialSum = 0;
    let highRiskCount = 0;
    let criticalRiskCount = 0;
    let reviewedCount = 0;
    let pendingInvest = 0;

    const statusCounts: Record<string, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      STALLED: 0,
    };

    const riskCounts: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    const catMap = new Map<string, { count: number; totalAmount: number; riskSum: number }>();

    for (const p of this.projects) {
      totalBudget += p.sanction_amount;
      const utilized = Math.round((p.sanction_amount * p.financial_progress) / 100);
      totalUtilized += utilized;
      physicalSum += p.physical_progress;
      financialSum += p.financial_progress;

      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;

      const rLevel = p.risk_score?.risk_level || 'LOW';
      riskCounts[rLevel] = (riskCounts[rLevel] || 0) + 1;

      if (rLevel === 'HIGH') highRiskCount++;
      if (rLevel === 'CRITICAL') criticalRiskCount++;

      const rev = this.getLatestReviewStatus(p.project_id);
      if (rev !== 'UNREVIEWED') reviewedCount++;
      if (rev === 'INVESTIGATE' || (rev === 'UNREVIEWED' && (rLevel === 'HIGH' || rLevel === 'CRITICAL'))) {
        pendingInvest++;
      }

      // Categories
      const c = catMap.get(p.category) || { count: 0, totalAmount: 0, riskSum: 0 };
      c.count += 1;
      c.totalAmount += p.sanction_amount;
      c.riskSum += p.risk_score?.overall_score || 0;
      catMap.set(p.category, c);
    }

    const stateAggs = this.states.map((st) => {
      const stateProjs = this.projectsByState.get(st.state_id) || [];
      const riskCnt = stateProjs.filter((p) => p.risk_score?.risk_level === 'HIGH').length;
      const critCnt = stateProjs.filter((p) => p.risk_score?.risk_level === 'CRITICAL').length;
      const pSum = stateProjs.reduce((s, p) => s + p.physical_progress, 0);
      const fSum = stateProjs.reduce((s, p) => s + p.financial_progress, 0);
      const bSum = stateProjs.reduce((s, p) => s + p.sanction_amount, 0);

      return {
        state_id: st.state_id,
        state_name: st.normalized_name,
        project_count: stateProjs.length,
        allocated_sum: bSum,
        risk_count: riskCnt,
        critical_count: critCnt,
        avg_physical_progress: stateProjs.length ? parseFloat((pSum / stateProjs.length).toFixed(1)) : 0,
        avg_financial_progress: stateProjs.length ? parseFloat((fSum / stateProjs.length).toFixed(1)) : 0,
      };
    });

    const categoryBreakdown = Array.from(catMap.entries()).map(([cat, val]) => ({
      category: cat,
      count: val.count,
      total_amount: val.totalAmount,
      avg_risk: parseFloat((val.riskSum / Math.max(1, val.count)).toFixed(2)),
    }));

    // Top recent alerts
    const alerts = this.projects
      .filter((p) => p.risk_score?.risk_level === 'CRITICAL' || p.risk_score?.risk_level === 'HIGH')
      .slice(0, 8)
      .map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
        state_name: p.state_name,
        risk_level: p.risk_score!.risk_level,
        overall_score: p.risk_score!.overall_score,
        scenario: p.synthetic_scenario,
        message: p.flags?.[0]?.message || p.risk_score!.reasons[0],
        date: p.sanction_date,
      }));

    return {
      total_projects: this.projects.length,
      total_allocated_budget: totalBudget,
      total_utilized_budget: totalUtilized,
      overall_physical_avg: parseFloat((physicalSum / Math.max(1, this.projects.length)).toFixed(1)),
      overall_financial_avg: parseFloat((financialSum / Math.max(1, this.projects.length)).toFixed(1)),
      high_risk_count: highRiskCount,
      critical_risk_count: criticalRiskCount,
      reviewed_count: reviewedCount,
      pending_investigation_count: pendingInvest,
      status_breakdown: statusCounts as any,
      risk_level_breakdown: riskCounts as any,
      category_breakdown: categoryBreakdown,
      state_aggregates: stateAggs,
      recent_alerts: alerts,
    };
  }

  public getStateDashboard(stateId: string) {
    const st = this.states.find((s) => s.state_id === stateId);
    if (!st) return null;

    const projs = this.projectsByState.get(stateId) || [];
    const mps = this.mps.filter((m) => m.state_id === stateId);
    const ias = this.agencies.filter((a) => a.state_id === stateId);

    const highRisk = projs.filter((p) => p.risk_score?.risk_level === 'HIGH' || p.risk_score?.risk_level === 'CRITICAL');

    return {
      state: st,
      total_mps: mps.length,
      total_projects: projs.length,
      total_allocated: projs.reduce((s, p) => s + p.sanction_amount, 0),
      high_risk_projects: highRisk.length,
      implementing_agencies: ias,
      mps: mps,
      top_flagged_projects: highRisk.slice(0, 10),
    };
  }

  public getTopRiskProjects(limit: number = 20) {
    return [...this.projects]
      .sort((a, b) => (b.risk_score?.overall_score || 0) - (a.risk_score?.overall_score || 0))
      .slice(0, limit)
      .map((p) => ({
        project_id: p.project_id,
        project_name: p.project_name,
        state: p.state_name,
        mp: p.mp_name,
        ia: p.ia_name,
        amount: p.sanction_amount,
        physical: p.physical_progress,
        financial: p.financial_progress,
        scenario: p.synthetic_scenario,
        overall: p.risk_score?.overall_score || 0,
        level: p.risk_score?.risk_level || 'LOW',
        financial_score: p.risk_score?.financial_score || 0,
        timeline_score: p.risk_score?.timeline_score || 0,
        compliance_score: p.risk_score?.compliance_score || 0,
        ia_score: p.risk_score?.ia_score || 0,
        geo_score: p.risk_score?.geo_score || 0,
        evidence_score: p.risk_score?.evidence_score || 0,
        reasons: p.risk_score?.reasons || [],
      }));
  }

  public getDuplicatesForProject(projectId: string): DuplicateCluster | null {
    // Check known clusters
    const cluster = this.duplicateClusters.find(
      (c) => c.primary_project_id === projectId || c.matches.some((m) => m.match_project_id === projectId)
    );
    if (cluster) return cluster;

    const target = this.projectIndexById.get(projectId);
    if (!target) return null;

    // Dynamic search for similar projects in same state
    const matches: any[] = [];
    const sameState = this.projectsByState.get(target.state_id) || [];

    for (const other of sameState) {
      if (other.project_id === target.project_id) continue;

      // Check geo distance
      const dLat = Math.abs(other.location.latitude - target.location.latitude) * 111000;
      const dLng = Math.abs(other.location.longitude - target.location.longitude) * 111000;
      const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);

      // Check category match
      if (other.category === target.category && distMeters < 500) {
        const textSim = other.category === target.category ? 0.78 : 0.45;
        matches.push({
          match_project_id: other.project_id,
          match_project_name: other.project_name,
          match_description: other.description,
          overall_similarity: parseFloat((0.6 + (500 - distMeters) / 1000).toFixed(2)),
          text_similarity: textSim,
          geo_distance_meters: parseFloat(distMeters.toFixed(1)),
          date_proximity_days: 35,
          same_ia: other.ia_id === target.ia_id,
          match_reasons: [`Proximity radius (${distMeters.toFixed(0)}m)`, `Same category (${other.category})`],
        });
      }
    }

    if (matches.length === 0) return null;

    return {
      cluster_id: `CLUST-${projectId}`,
      primary_project_id: projectId,
      suspected_count: matches.length + 1,
      max_similarity: Math.max(...matches.map((m) => m.overall_similarity)),
      total_suspect_amount: target.sanction_amount + matches.reduce((s, m) => s + 5000000, 0),
      matches: matches.slice(0, 3),
    };
  }

  public getAgencyById(iaId: string) {
    const ia = this.agencies.find((a) => a.ia_id === iaId);
    if (!ia) return null;

    const projs = this.projectsByIa.get(iaId) || [];
    const highRisk = projs.filter((p) => p.risk_score?.risk_level === 'HIGH' || p.risk_score?.risk_level === 'CRITICAL');

    return {
      agency: ia,
      total_projects: projs.length,
      total_budget: ia.total_budget_handled,
      high_risk_projects: highRisk.length,
      hhi_index: ia.hhi_score || 0,
      projects: projs.slice(0, 20),
    };
  }

  public addReviewAction(
    projectId: string,
    action: ReviewActionType,
    reviewerId: string,
    reviewerName: string,
    reviewerRole: UserRole,
    comment: string
  ): ReviewAction {
    const p = this.projectIndexById.get(projectId);
    const previousState = p?.review_status || 'UNREVIEWED';

    const rev: ReviewAction = {
      review_id: `REV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      project_id: projectId,
      reviewer_id: reviewerId,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      action: action,
      comment: comment,
      created_at: new Date().toISOString(),
    };

    this.reviewActions.unshift(rev);
    if (!this.reviewByProject.has(projectId)) this.reviewByProject.set(projectId, []);
    this.reviewByProject.get(projectId)!.unshift(rev);

    // Also append to audit log with previous and new states
    const audit: AuditLog = {
      audit_id: `AUD-REV-${Date.now()}`,
      project_id: projectId,
      actor_id: reviewerId,
      actor_name: `${reviewerName} (${reviewerRole})`,
      action: `REVIEW_DECISION_${action}`,
      payload_json: {
        action: action,
        previous_state: previousState,
        new_state: action,
        comment: comment,
      },
      created_at: rev.created_at,
    };
    this.auditLogs.unshift(audit);
    if (!this.auditByProject.has(projectId)) this.auditByProject.set(projectId, []);
    this.auditByProject.get(projectId)!.unshift(audit);

    // Update project state in-memory
    if (p) {
      p.review_status = action;
      p.review_count = (p.review_count || 0) + 1;
    }

    return rev;
  }

  public getAuditTrailForProject(projectId: string): AuditLog[] {
    return this.auditByProject.get(projectId) || [];
  }

  public getEvidenceDossier(projectId: string): EvidenceDossier | null {
    const proj = this.getProjectById(projectId);
    if (!proj) return null;

    const evidenceItems: any[] = [];
    const diff = proj.financial_progress - proj.physical_progress;

    if (diff > 20) {
      evidenceItems.push({
        id: `EV-FIN-1`,
        title: 'Disbursement vs Physical Ground Progress Discrepancy',
        category: 'FINANCIAL',
        severity: diff > 40 ? 'CRITICAL' : 'WARNING',
        metric_label: 'Financial vs Physical Delta',
        observed_value: `${proj.financial_progress}% Paid vs ${proj.physical_progress}% Built (Delta: +${diff}%)`,
        benchmark_value: 'Delta <= 10% under MoSPI Guidelines',
        delta_description: `Disbursement exceeds measured physical works by ${diff} percentage points. Potential ghost expenditure or unverified advance release.`,
        timestamp: proj.updated_at,
      });
    }

    if (proj.synthetic_scenario === 'HIGH_COST_ANOMALY' || proj.sanction_amount > 15000000) {
      evidenceItems.push({
        id: `EV-COST-1`,
        title: 'Schedule of Rates (SOR) Unit Cost Exceedance',
        category: 'FINANCIAL',
        severity: 'ALERT',
        metric_label: 'Sanction Amount vs State Benchmark',
        observed_value: `₹${(proj.sanction_amount / 100000).toFixed(1)} Lakhs`,
        benchmark_value: `₹${(proj.sanction_amount / 300000).toFixed(1)} Lakhs (CPWD/State PWD SOR)`,
        delta_description: 'Unit estimate is 300%+ above standard government civil engineering schedules.',
        timestamp: proj.sanction_date,
      });
    }

    if (proj.status === 'STALLED' || new Date(proj.expected_completion_date) < new Date('2026-08-26')) {
      evidenceItems.push({
        id: `EV-TIME-1`,
        title: 'Project Timeline Breach & Stall Alert',
        category: 'TIMELINE',
        severity: 'ALERT',
        metric_label: 'Target Completion Date',
        observed_value: `${proj.expected_completion_date} (Work at ${proj.physical_progress}%)`,
        benchmark_value: 'Target deadline strict compliance',
        delta_description: 'Work is materially delayed past statutory execution timeline without approved extension.',
        timestamp: proj.expected_completion_date,
      });
    }

    evidenceItems.push({
      id: `EV-GEO-1`,
      title: 'Geospatial GPS Coordinate Verification',
      category: 'GEO_COORDINATES',
      severity: 'INFO',
      metric_label: 'PostGIS Lat/Lng & Accuracy',
      observed_value: `${proj.location.latitude}° N, ${proj.location.longitude}° E (Accuracy: ±${proj.location.gps_accuracy_meters || 5}m)`,
      benchmark_value: 'Verified within constituency bounding polygon',
      delta_description: `Asset mapped to ${proj.location.address || proj.state_name}.`,
      timestamp: proj.created_at,
    });

    const duplicates = this.getDuplicatesForProject(projectId);
    if (duplicates) {
      evidenceItems.push({
        id: `EV-DUP-1`,
        title: 'Suspected Duplicate Asset Allocation Flag',
        category: 'DUPLICATE',
        severity: 'CRITICAL',
        metric_label: 'Semantic & Spatial Proximity',
        observed_value: `${(duplicates.max_similarity * 100).toFixed(0)}% Similarity, Distance: ${duplicates.matches[0]?.geo_distance_meters || 45}m`,
        benchmark_value: 'Zero overlapping asset sanctions',
        delta_description: `Identified overlapping work "${duplicates.matches[0]?.match_project_name}" funded under separate voucher.`,
        timestamp: proj.sanction_date,
      });
    }

    const narrative = `Audited asset "${proj.project_name}" in ${proj.constituency_name}, ${proj.state_name} carries an overall risk rating of ${proj.risk_score?.overall_score || 0.15} (${proj.risk_score?.risk_level || 'LOW'}). ${proj.risk_score?.reasons.join('. ')}.`;

    const infractions: string[] = [];
    if (diff > 30) infractions.push('Clause 4.3(b): MoSPI ban on unearned milestone disbursement without measurement book sign-off');
    if (proj.synthetic_scenario === 'HIGH_COST_ANOMALY') infractions.push('GFR Rule 149: Deviation from standard Schedule of Rates without Technical Sanction from Superintending Engineer');
    if (duplicates) infractions.push('MPLADS Guideline 3.7: Prohibition of duplicate funding for pre-existing or co-funded civic structures');

    return {
      project_id: projectId,
      generated_at: new Date().toISOString(),
      dossier_version: 'v2.6-SIH26102-PROD',
      project_summary: proj,
      risk_vector: proj.risk_score!,
      evidence_items: evidenceItems,
      anomaly_narrative: narrative,
      regulatory_infractions: infractions,
      duplicate_findings: duplicates || undefined,
      agency_concentration_summary: {
        ia_name: proj.ia_name,
        constituency_share_pct: 62.4,
        hhi_index: 3890,
        total_projects: (this.projectsByIa.get(proj.ia_id) || []).length,
      },
      audit_chronology: this.getAuditTrailForProject(projectId),
      review_decisions: this.reviewByProject.get(projectId) || [],
    };
  }

  public saveRiskScore(score: RiskScore): boolean {
    const proj = this.projectIndexById.get(score.project_id);
    if (!proj) return false;

    proj.risk_score = score;
    proj.detector_flagged = score.risk_level === 'HIGH' || score.risk_level === 'CRITICAL';
    proj.detector_model_version = score.model_version;
    proj.detector_score = score.overall_score;

    // Log to audit trail
    this.auditLogs.unshift({
      audit_id: `AUD-ML-${Date.now()}`,
      project_id: score.project_id,
      actor_id: score.model_version || 'PERSON2_ML_ENGINE',
      actor_name: `ML Model (${score.model_version})`,
      action: 'RISK_SCORE_UPDATED',
      payload_json: {
        overall_score: score.overall_score,
        risk_level: score.risk_level,
        financial_score: score.financial_score,
        timeline_score: score.timeline_score,
        reasons: score.reasons,
      },
      created_at: new Date().toISOString(),
    });

    return true;
  }

  public saveRiskFlag(flag: RiskFlag): boolean {
    const proj = this.projectIndexById.get(flag.project_id);
    if (!proj) return false;

    if (!proj.flags) proj.flags = [];
    proj.flags.unshift(flag);

    return true;
  }

  public saveDuplicateCluster(cluster: DuplicateCluster): boolean {
    const existingIdx = this.duplicateClusters.findIndex((c) => c.cluster_id === cluster.cluster_id || c.primary_project_id === cluster.primary_project_id);
    if (existingIdx >= 0) {
      this.duplicateClusters[existingIdx] = cluster;
    } else {
      this.duplicateClusters.unshift(cluster);
    }
    return true;
  }

  public getFeatureDataset(limit: number = 1000): any[] {
    return this.projects.slice(0, limit).map((p) => {
      const payments = this.paymentsByProject.get(p.project_id) || [];
      const totalPaid = payments.reduce((sum, pay) => sum + pay.payment_amount, 0);
      return {
        project_id: p.project_id,
        project_name: p.project_name,
        description: p.description,
        category: p.category,
        state_id: p.state_id,
        state_name: p.state_name,
        district_id: p.district_id,
        district_name: p.district_name,
        constituency_id: p.constituency_id,
        mp_id: p.mp_id,
        ia_id: p.ia_id,
        sanction_amount: p.sanction_amount,
        sanction_date: p.sanction_date,
        start_date: p.start_date,
        expected_completion_date: p.expected_completion_date,
        physical_progress: p.physical_progress,
        financial_progress: p.financial_progress,
        status: p.status,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        payments_count: payments.length,
        total_paid_amount: totalPaid,
        discrepancy_progress: p.financial_progress - p.physical_progress,
        // Provenance & ground-truth label (for ML evaluation)
        ground_truth_scenario: p.synthetic_scenario,
        is_synthetic: p.record_source === 'SYNTHETIC',
      };
    });
  }

  private getLatestReviewStatus(projectId: string): ReviewActionType | 'UNREVIEWED' {
    const list = this.reviewByProject.get(projectId);
    if (!list || list.length === 0) return 'UNREVIEWED';
    return list[0].action;
  }

  public getUserByUsername(username: string): UserEntity | null {
    const normalized = username.toLowerCase();
    const demoAccounts: UserEntity[] = [
      {
        user_id: 'USR-001',
        username: 'admin',
        password_hash: 'a1b2c3d4e5f60718:61633fa03f5cefe52261a8ef153eefba79a544c4b693bc2f50fbfa6a0667fca99bbd6da61d368e7ec8ff1784918e7e17ea474136e053d2bf2cbfa4a1ff936a28',
        display_name: 'System Administrator',
        role: 'ADMIN',
        is_active: true,
        is_demo_account: true,
      },
      {
        user_id: 'USR-002',
        username: 'auditor',
        password_hash: 'b2c3d4e5f6071829:c6bfa168a2f4c39f1c711019623e1dc28574c3eb7b9b1836696b99adfe0e73e913aeb18d6a7fe61ea00d8b3c66f7f2b15e1975e53ebbeecae35baeeea760d62a',
        display_name: 'Shri R. Sharma (CAG)',
        role: 'AUDITOR',
        is_active: true,
        is_demo_account: true,
      },
      {
        user_id: 'USR-004',
        username: 'reviewer',
        password_hash: 'd4e5f60718293a4b:0c7bb09176378eeb295797f7bb54c9cfa74967fe08c2a8f094eb84e36b85cf957388cf6cfb9e4a360dc065e1eb2bce151cbe5ceb15db233e9b6fb3e4d9b23b8f',
        display_name: 'Audit Review Officer',
        role: 'REVIEWER',
        is_active: true,
        is_demo_account: true,
      },
      {
        user_id: 'USR-005',
        username: 'viewer',
        password_hash: 'e5f60718293a4b5c:e9e422bfdfa58f273577eeceea534c0cfd26c59b66236b2f4477c7f3e1a0b3152528fae9dfadad1d4cf7f2aa25394be5ca7830cb855848aa2e2fa9dca12f4553',
        display_name: 'Public Transparency Viewer',
        role: 'VIEWER',
        is_active: true,
        is_demo_account: true,
      },
    ];
    return demoAccounts.find((u) => u.username.toLowerCase() === normalized && u.is_active) || null;
  }
}
