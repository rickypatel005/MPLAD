/**
 * SIH26102 — Frontend-Compatible Route Handlers
 *
 * Express Router that exposes the exact endpoints Person 4's frontend calls
 * (defined in person4-frontend/src/lib/api/endpoints.ts), backed by the
 * FrontendDataStore singleton.
 *
 * Routes:
 *   GET  /api/dashboard           - Dashboard KPIs, ranked projects, facets
 *   GET  /api/project/:id         - Full project investigation payload
 *   GET  /api/alerts              - Paginated alert feed with facets
 *   PATCH /api/alerts/:id         - Acknowledge an alert
 *   GET  /api/network             - IA↔MP bipartite graph
 *   GET  /api/map-data            - District aggregates + project markers
 *   GET  /api/duplicates          - Paginated duplicate pairs
 *   PATCH /api/duplicates/:id     - Review verdict on a duplicate pair
 *   GET  /api/compliance-summary  - Compliance matrix + SC/ST mandate
 *   GET  /api/report/:id          - Structured report payload
 *   POST /api/analyze             - Re-run scoring (mock)
 */

import { Router, type Request, type Response } from 'express';
import { AppDatabase } from '../db/database.ts';
import { IntegrationAggregator } from '../services/integrationAggregator.ts';
import {
  FrontendDataStore,
  type FERankedProject,
  type FEAlertRow,
  type FEDuplicatePairRow,
  type FEFacetOption,
  type FERiskLevel,
  type FERiskLevelCounts,
  type FEStateRiskAggregate,
  type FERiskTreemapNode,
  type FEDashboardKPIs,
  type FEDashboardResponse,
  type FEAlertsResponse,
  type FENetworkResponse,
  type FENetworkNode,
  type FENetworkEdge,
  type FENetworkNodeDetail,
  type FEDuplicatesResponse,
  type FEMapDataResponse,
  type FEComplianceSummaryResponse,
  type FEAnalyzeResponse,
  type FEReportResponse,
} from '../db/frontendData.ts';

const router = Router();


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function intParam(val: unknown, fallback: number, min = 1, max = 10000): number {
  const n = typeof val === 'string' ? parseInt(val, 10) : fallback;
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function strParam(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function round(n: number, dp: number = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function riskLevelFor(score: number): FERiskLevel {
  if (score >= 0.75) return 'CRITICAL';
  if (score >= 0.5) return 'HIGH';
  if (score >= 0.25) return 'MEDIUM';
  return 'LOW';
}

function tallyLevels(levels: FERiskLevel[]): FERiskLevelCounts {
  const c: FERiskLevelCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const l of levels) c[l]++;
  return c;
}

function buildFacets(items: { value: string; label?: string }[]): FEFacetOption[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const item of items) {
    const entry = counts.get(item.value);
    if (entry) entry.count++;
    else counts.set(item.value, { label: item.label || item.value, count: 1 });
  }
  return Array.from(counts.entries())
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count);
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.max(1, Math.min(page, totalPages));
  const offset = (p - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page: { page: p, page_size: pageSize, total_items: total, total_pages: totalPages },
  };
}

function matchesDateRange(dateStr: string, range: string): boolean {
  if (!range || !range.includes(':')) return true;
  const [from, to] = range.split(':');
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function matchesSearch(rec: FERankedProject, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    rec.project_id.toLowerCase().includes(lower) ||
    rec.work_description.toLowerCase().includes(lower) ||
    rec.work_type.toLowerCase().includes(lower) ||
    rec.district_name.toLowerCase().includes(lower) ||
    rec.state_name.toLowerCase().includes(lower)
  );
}

// ─────────────────────────────────────────────
// GET /api/dashboard
// ─────────────────────────────────────────────

router.get('/api/dashboard', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  // Query params
  const page = intParam(req.query.page, 1);
  const pageSize = intParam(req.query.page_size, 25, 1, 200);
  const sortBy = strParam(req.query.sort_by) || 'overall_risk';
  const order = strParam(req.query.order) || 'desc';
  const stateFilter = strParam(req.query.state);
  const districtFilter = strParam(req.query.district);
  const riskLevelFilter = strParam(req.query.risk_level) as FERiskLevel | undefined;
  const workTypeFilter = strParam(req.query.work_type);
  const dateRange = strParam(req.query.date_range);
  const q = strParam(req.query.q);
  const iaFilter = strParam(req.query.ia);
  const fyFilter = strParam(req.query.fy);

  // Filter ranked projects
  let filtered = store.rankedDesc.filter(r => {
    if (stateFilter && r.state_id !== stateFilter) return false;
    if (districtFilter && r.district_id !== districtFilter) return false;
    if (riskLevelFilter && r.risk_level !== riskLevelFilter) return false;
    if (workTypeFilter && r.work_type !== workTypeFilter) return false;
    if (iaFilter && r.ia_id !== iaFilter) return false;
    if (fyFilter && r.fy !== fyFilter) return false;
    if (dateRange && !matchesDateRange(r.recommended_date, dateRange)) return false;
    if (q && !matchesSearch(r, q)) return false;
    return true;
  });

  // Sort
  const sortedItems = [...filtered];
  const dir = order === 'asc' ? 1 : -1;
  sortedItems.sort((a, b) => {
    const aVal = (a as any)[sortBy];
    const bVal = (b as any)[sortBy];
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
    return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
  });

  // KPIs from filtered set
  const levels = filtered.map(r => r.risk_level);
  const totalCost = filtered.reduce((s, r) => s + r.estimated_cost_lakhs, 0);
  const meanRisk = filtered.length > 0
    ? round(filtered.reduce((s, r) => s + r.overall_risk, 0) / filtered.length, 3)
    : 0;

  // Top risk state
  const stateAgg = new Map<string, { sum: number; count: number; name: string }>();
  for (const r of filtered) {
    const entry = stateAgg.get(r.state_id);
    if (entry) { entry.sum += r.overall_risk; entry.count++; }
    else stateAgg.set(r.state_id, { sum: r.overall_risk, count: 1, name: r.state_name });
  }
  let topRiskState: FEDashboardKPIs['top_risk_state'] = null;
  let maxStateMean = 0;
  for (const [stateId, data] of stateAgg) {
    const m = data.sum / data.count;
    if (m > maxStateMean) {
      maxStateMean = m;
      topRiskState = { state_id: stateId, state_name: data.name, mean_risk: round(m, 3) };
    }
  }

  // Top risk district
  const distAgg = new Map<string, { sum: number; count: number; distName: string; stateName: string }>();
  for (const r of filtered) {
    const entry = distAgg.get(r.district_id);
    if (entry) { entry.sum += r.overall_risk; entry.count++; }
    else distAgg.set(r.district_id, { sum: r.overall_risk, count: 1, distName: r.district_name, stateName: r.state_name });
  }
  let topRiskDistrict: FEDashboardKPIs['top_risk_district'] = null;
  let maxDistMean = 0;
  for (const [distId, data] of distAgg) {
    const m = data.sum / data.count;
    if (m > maxDistMean) {
      maxDistMean = m;
      topRiskDistrict = { district_id: distId, district_name: data.distName, state_name: data.stateName, mean_risk: round(m, 3) };
    }
  }

  const kpis: FEDashboardKPIs = {
    total_projects_analyzed: filtered.length,
    counts_by_risk_level: tallyLevels(levels),
    mean_overall_risk: meanRisk,
    top_risk_state: topRiskState,
    top_risk_district: topRiskDistrict,
    total_estimated_cost_lakhs: round(totalCost, 2),
    last_scored_at: store.scoredAt,
    model_version: store.modelVersion,
  };

  // State risk aggregates
  const stateRisk: FEStateRiskAggregate[] = [];
  for (const [stateId, data] of stateAgg) {
    const m = round(data.sum / data.count, 3);
    const stateLevels = filtered.filter(r => r.state_id === stateId).map(r => r.risk_level);
    stateRisk.push({
      state_id: stateId,
      state_name: data.name,
      project_count: data.count,
      mean_risk: m,
      risk_level: riskLevelFor(m),
      counts_by_risk_level: tallyLevels(stateLevels),
    });
  }

  // Work type treemap
  const workAgg = new Map<string, { count: number; riskSum: number; costSum: number }>();
  for (const r of filtered) {
    const entry = workAgg.get(r.work_type);
    if (entry) { entry.count++; entry.riskSum += r.overall_risk; entry.costSum += r.estimated_cost_lakhs; }
    else workAgg.set(r.work_type, { count: 1, riskSum: r.overall_risk, costSum: r.estimated_cost_lakhs });
  }
  const workTypeRisk: FERiskTreemapNode[] = Array.from(workAgg.entries()).map(([name, data]) => {
    const m = round(data.riskSum / data.count, 3);
    return {
      name,
      project_count: data.count,
      mean_risk: m,
      risk_level: riskLevelFor(m),
      total_cost_lakhs: round(data.costSum, 2),
    };
  });

  // Top 10 highest risk from filtered
  const topProjects = [...filtered]
    .sort((a, b) => b.overall_risk - a.overall_risk)
    .slice(0, 10);

  // Facets from filtered set
  const facets = {
    states: buildFacets(filtered.map(r => ({ value: r.state_id, label: r.state_name }))),
    work_types: buildFacets(filtered.map(r => ({ value: r.work_type }))),
    risk_levels: buildFacets(filtered.map(r => ({ value: r.risk_level }))),
  };

  const response: FEDashboardResponse = {
    kpis,
    state_risk: stateRisk,
    work_type_risk: workTypeRisk,
    top_projects: topProjects,
    projects: paginate(sortedItems, page, pageSize),
    facets,
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// GET /api/project/:id
// ─────────────────────────────────────────────

router.get('/api/project/:id', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();
  const db = AppDatabase.getInstance();
  const detail = store.getProjectDetail(req.params.id);

  if (!detail) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Project ${req.params.id} not found.` },
    });
  }

  const auditTrail = db.getAuditTrailForProject(req.params.id);
  const reviews = db.reviewActions.filter(r => r.project_id === req.params.id);

  res.json({
    ...detail,
    audit_trail: auditTrail,
    audit_logs: auditTrail,
    review_actions: reviews,
    latest_review: reviews.length > 0 ? reviews[reviews.length - 1] : null,
  });
});


// ─────────────────────────────────────────────
// GET /api/alerts
// ─────────────────────────────────────────────

router.get('/api/alerts', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  const page = intParam(req.query.page, 1);
  const pageSize = intParam(req.query.page_size, 25, 1, 200);
  const sortBy = strParam(req.query.sort_by) || 'created_at';
  const order = strParam(req.query.order) || 'desc';
  const stateFilter = strParam(req.query.state);
  const riskLevelFilter = strParam(req.query.risk_level) as FERiskLevel | undefined;
  const workTypeFilter = strParam(req.query.work_type);
  const alertTypeFilter = strParam(req.query.alert_type);
  const acknowledgedFilter = strParam(req.query.acknowledged);
  const projectFilter = strParam(req.query.project);
  const dateRange = strParam(req.query.date_range);
  const q = strParam(req.query.q);
  const districtFilter = strParam(req.query.district);

  let filtered = store.alerts.filter(a => {
    if (stateFilter && a.state_id !== stateFilter) return false;
    if (riskLevelFilter && a.alert_level !== riskLevelFilter) return false;
    if (workTypeFilter && a.project_work_type !== workTypeFilter) return false;
    if (alertTypeFilter && a.alert_type !== alertTypeFilter) return false;
    if (districtFilter && a.district_name !== districtFilter) return false;
    if (projectFilter && a.project_id !== projectFilter) return false;
    if (acknowledgedFilter === 'true' && !a.is_acknowledged) return false;
    if (acknowledgedFilter === 'false' && a.is_acknowledged) return false;
    if (dateRange && !matchesDateRange(a.created_at.slice(0, 10), dateRange)) return false;
    if (q) {
      const lower = q.toLowerCase();
      if (!a.project_id.toLowerCase().includes(lower) &&
          !a.alert_message.toLowerCase().includes(lower) &&
          !a.district_name.toLowerCase().includes(lower)) return false;
    }
    return true;
  });

  // Sort
  const sortedAlerts = [...filtered];
  const dir = order === 'asc' ? 1 : -1;
  sortedAlerts.sort((a, b) => {
    if (sortBy === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    if (sortBy === 'alert_level') {
      const levelOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return ((levelOrder[a.alert_level] || 0) - (levelOrder[b.alert_level] || 0)) * dir;
    }
    if (sortBy === 'overall_risk') return (a.overall_risk - b.overall_risk) * dir;
    return 0;
  });

  // Counts by level (from all alerts, not just filtered)
  const countsByLevel = tallyLevels(store.alerts.map(a => a.alert_level));
  const unacknowledgedCount = store.alerts.filter(a => !a.is_acknowledged).length;

  // Facets from filtered
  const facets = {
    alert_types: buildFacets(filtered.map(a => ({ value: a.alert_type }))),
    states: buildFacets(filtered.map(a => ({ value: a.state_id, label: a.state_name }))),
    mps: buildFacets(filtered.map(a => ({ value: a.mp_id }))),
  };

  const response: FEAlertsResponse = {
    alerts: paginate(sortedAlerts, page, pageSize),
    counts_by_level: countsByLevel,
    unacknowledged_count: unacknowledgedCount,
    facets,
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// PATCH /api/alerts/:id
// ─────────────────────────────────────────────

router.patch('/api/alerts/:id', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();
  const alertId = parseInt(req.params.id, 10);

  const alert = store.alerts.find(a => a.alert_id === alertId);
  if (!alert) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Alert ${alertId} not found.` },
    });
  }

  const { acknowledged_by, action_taken } = req.body || {};
  alert.is_acknowledged = true;
  alert.acknowledged_by = acknowledged_by || 'System User';
  alert.action_taken = action_taken || 'ACKNOWLEDGE';
  alert.acknowledged_at = new Date().toISOString();

  res.json(alert);
});

// ─────────────────────────────────────────────
// GET /api/network
// ─────────────────────────────────────────────

router.get('/api/network', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  const stateFilter = strParam(req.query.state);
  const focusNode = strParam(req.query.focus);
  const minWeight = intParam(req.query.min_weight, 1, 0, 1000);
  const limit = intParam(req.query.limit, 500, 1, 2000);

  let { nodes, edges, node_details } = store.network;

  // Filter by state
  if (stateFilter) {
    nodes = nodes.filter(n => n.state_id === stateFilter);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) || nodeIds.has(e.target));
    // Re-include any nodes referenced by edges
    for (const e of edges) {
      if (!nodeIds.has(e.source)) {
        const n = store.network.nodes.find(n => n.id === e.source);
        if (n) { nodes.push(n); nodeIds.add(n.id); }
      }
      if (!nodeIds.has(e.target)) {
        const n = store.network.nodes.find(n => n.id === e.target);
        if (n) { nodes.push(n); nodeIds.add(n.id); }
      }
    }
    node_details = node_details.filter(d => nodeIds.has(d.node_id));
  }

  // Filter by min weight
  if (minWeight > 1) {
    edges = edges.filter(e => e.weight >= minWeight);
    const referencedIds = new Set<string>();
    for (const e of edges) { referencedIds.add(e.source); referencedIds.add(e.target); }
    nodes = nodes.filter(n => referencedIds.has(n.id));
    node_details = node_details.filter(d => referencedIds.has(d.node_id));
  }

  // Limit node count (keep highest-risk nodes)
  if (nodes.length > limit) {
    nodes = [...nodes].sort((a, b) => (b.risk || 0) - (a.risk || 0)).slice(0, limit);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    node_details = node_details.filter(d => nodeIds.has(d.node_id));
  }

  // If focus node requested, ensure it's included
  if (focusNode) {
    const nodeIds = new Set(nodes.map(n => n.id));
    if (!nodeIds.has(focusNode)) {
      const n = store.network.nodes.find(n => n.id === focusNode);
      if (n) nodes.push(n);
      const d = store.network.node_details.find(d => d.node_id === focusNode);
      if (d) node_details.push(d);
    }
  }

  const response: FENetworkResponse = {
    nodes,
    edges,
    node_details: node_details,
    legend: {
      max_edge_weight: edges.reduce((max, e) => Math.max(max, e.weight), 0),
      max_project_count: nodes.reduce((max, n) => Math.max(max, n.project_count || 0), 0),
      hhi_concentration_threshold: store.network.legend.hhi_concentration_threshold,
    },
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// GET /api/map-data
// ─────────────────────────────────────────────

router.get('/api/map-data', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  const stateFilter = strParam(req.query.state);
  const districtFilter = strParam(req.query.district);
  const riskLevelFilter = strParam(req.query.risk_level) as FERiskLevel | undefined;
  const workTypeFilter = strParam(req.query.work_type);
  const projectFilter = strParam(req.query.project);

  let { districts, projects, duplicate_links, coverage } = store.mapData;

  // Apply filters
  if (stateFilter || districtFilter || riskLevelFilter || workTypeFilter || projectFilter) {
    projects = projects.filter(p => {
      if (stateFilter && !p.state_name.includes(stateFilter) && p.district_id && !store.districts.find(d => d.district_id === p.district_id && d.state_id === stateFilter)) return false;
      if (districtFilter && p.district_id !== districtFilter) return false;
      if (riskLevelFilter && p.risk_level !== riskLevelFilter) return false;
      if (workTypeFilter && p.work_type !== workTypeFilter) return false;
      if (projectFilter && p.project_id !== projectFilter) return false;
      return true;
    });

    if (stateFilter) {
      districts = districts.filter(d => d.state_id === stateFilter);
    }
    if (districtFilter) {
      districts = districts.filter(d => d.district_id === districtFilter);
    }

    // Filter duplicate links to only include visible projects
    const visibleIds = new Set(projects.map(p => p.project_id));
    duplicate_links = duplicate_links.filter(l =>
      visibleIds.has(l.from.project_id) || visibleIds.has(l.to.project_id)
    );

    coverage = {
      total_projects: projects.length,
      with_gps: projects.filter(p => p.location_source === 'GPS').length,
      district_centroid_fallback: projects.filter(p => p.location_source === 'DISTRICT_CENTROID').length,
    };
  }

  const response: FEMapDataResponse = { districts, projects, duplicate_links, coverage };
  res.json(response);
});

// ─────────────────────────────────────────────
// GET /api/duplicates
// ─────────────────────────────────────────────

router.get('/api/duplicates', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  const page = intParam(req.query.page, 1);
  const pageSize = intParam(req.query.page_size, 25, 1, 200);
  const sortBy = strParam(req.query.sort_by) || 'similarity_score';
  const order = strParam(req.query.order) || 'desc';
  const stateFilter = strParam(req.query.state);
  const minSimilarity = req.query.min_similarity ? parseFloat(String(req.query.min_similarity)) : undefined;
  const maxDistanceKm = req.query.max_distance_km ? parseFloat(String(req.query.max_distance_km)) : undefined;
  const methodFilter = strParam(req.query.detection_method);
  const reviewStatusFilter = strParam(req.query.review_status);
  const pairFilter = req.query.pair ? parseInt(String(req.query.pair), 10) : undefined;

  let filtered = store.duplicatePairs.filter(p => {
    if (stateFilter && p.project_a.state_name !== stateFilter && p.project_b.state_name !== stateFilter) {
      // Also try state_id matching via district lookup
      const aStateId = store.districts.find(d => d.district_id === p.project_a.district_id)?.state_id;
      const bStateId = store.districts.find(d => d.district_id === p.project_b.district_id)?.state_id;
      if (aStateId !== stateFilter && bStateId !== stateFilter) return false;
    }
    if (minSimilarity !== undefined && p.similarity_score < minSimilarity) return false;
    if (maxDistanceKm !== undefined && p.geo_distance_km > maxDistanceKm) return false;
    if (methodFilter && p.detection_method !== methodFilter) return false;
    if (reviewStatusFilter && p.review_status !== reviewStatusFilter) return false;
    if (pairFilter !== undefined && p.pair_id !== pairFilter) return false;
    return true;
  });

  // Sort
  const sortedPairs = [...filtered];
  const dir = order === 'asc' ? 1 : -1;
  sortedPairs.sort((a, b) => {
    const aVal = (a as any)[sortBy];
    const bVal = (b as any)[sortBy];
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir;
    return String(aVal ?? '').localeCompare(String(bVal ?? '')) * dir;
  });

  // Counts
  const allPairs = store.duplicatePairs;
  const counts = {
    total_pairs: allPairs.length,
    pending_review: allPairs.filter(p => p.review_status === 'PENDING_REVIEW').length,
    high_similarity: allPairs.filter(p => p.similarity_score >= 0.85).length,
    geographically_close: allPairs.filter(p => p.geo_distance_km <= 2).length,
  };

  // Facets from filtered
  const facets = {
    detection_methods: buildFacets(filtered.map(p => ({ value: p.detection_method }))),
    states: buildFacets([
      ...filtered.map(p => ({ value: p.project_a.state_name })),
      ...filtered.map(p => ({ value: p.project_b.state_name })),
    ]),
  };

  const response: FEDuplicatesResponse = {
    pairs: paginate(sortedPairs, page, pageSize),
    counts,
    facets,
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// PATCH /api/duplicates/:id
// ─────────────────────────────────────────────

router.patch('/api/duplicates/:id', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();
  const pairId = parseInt(req.params.id, 10);

  const pair = store.duplicatePairs.find(p => p.pair_id === pairId);
  if (!pair) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Duplicate pair ${pairId} not found.` },
    });
  }

  const { review_status, reviewed_by } = req.body || {};
  if (review_status) {
    pair.review_status = review_status;
    pair.reviewed = review_status !== 'PENDING_REVIEW';
  }

  res.json(pair);
});

// ─────────────────────────────────────────────
// GET /api/compliance-summary
// ─────────────────────────────────────────────

router.get('/api/compliance-summary', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();

  const stateFilter = strParam(req.query.state);
  const ruleFilter = strParam(req.query.rule_id);

  let { rules, states, matrix, scst_mandate, national } = store.compliance;

  // Apply state filter
  if (stateFilter) {
    states = states.filter(s => s.state_id === stateFilter);
    matrix = matrix.filter(c => c.state_id === stateFilter);
    scst_mandate = {
      ...scst_mandate,
      rows: scst_mandate.rows.filter(r => r.state_id === stateFilter),
      below_threshold_count: scst_mandate.rows.filter(r => r.state_id === stateFilter && r.below_ten_percent_sc).length,
    };
  }

  // Apply rule filter
  if (ruleFilter) {
    rules = rules.filter(r => r.rule_id === ruleFilter);
    matrix = matrix.filter(c => c.rule_id === ruleFilter);
  }

  const response: FEComplianceSummaryResponse = {
    rules,
    states,
    matrix,
    scst_mandate,
    national,
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// GET /api/report/:id
// ─────────────────────────────────────────────

router.get('/api/report/:id', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();
  const report = store.getReport(req.params.id);

  if (!report) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: `Project ${req.params.id} not found for report generation.` },
    });
  }

  res.json(report);
});

// ─────────────────────────────────────────────
// POST /api/analyze
// ─────────────────────────────────────────────

router.post('/api/analyze', (req: Request, res: Response) => {
  const store = FrontendDataStore.getInstance();
  const startedAt = new Date();

  // Re-initialize the data store to simulate re-scoring
  try {
    store.initialize();
  } catch (err) {
    // In case re-initialization fails, return error
    return res.status(500).json({
      error: { code: 'ANALYSIS_FAILED', message: 'Re-scoring failed.' },
    });
  }

  const completedAt = new Date();
  const durationSeconds = round((completedAt.getTime() - startedAt.getTime()) / 1000, 2);

  const highOrCritical = store.records.filter(r =>
    r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL'
  ).length;

  const response: FEAnalyzeResponse = {
    run_id: `RUN-${Date.now()}`,
    status: 'COMPLETED',
    projects_analyzed: store.records.length,
    projects_flagged: highOrCritical,
    new_alerts: store.alerts.length,
    duration_seconds: durationSeconds,
    model_version: store.modelVersion,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  };

  res.json(response);
});

// ─────────────────────────────────────────────
// GET /api/projects/:id/duplicates
// ─────────────────────────────────────────────

router.get('/api/projects/:id/duplicates', async (req: Request, res: Response) => {
  const aggregator = IntegrationAggregator.getInstance();
  const p3Res = await (aggregator as any).fetchJson(`${aggregator.person3Url}/projects/${req.params.id}/duplicates`);
  if (p3Res) return res.json(p3Res);

  const store = FrontendDataStore.getInstance();
  const pairs = store.duplicatePairs.filter(p => p.project_id_1 === req.params.id || p.project_id_2 === req.params.id);
  res.json({
    project_id: req.params.id,
    found: pairs.length > 0,
    duplicate_count: pairs.length,
    matches: pairs.map(p => ({
      target_project_id: req.params.id,
      counterpart_project_id: p.project_id_1 === req.params.id ? p.project_id_2 : p.project_id_1,
      similarity_score: p.similarity_score,
      geo_distance_km: p.geo_distance_km,
      same_agency: p.project_a.ia_id === p.project_b.ia_id,
      duplicate_probability: p.similarity_score,
      reasons: p.shared_attributes,
    })),
  });
});

// ─────────────────────────────────────────────
// GET /api/projects/:id/network
// ─────────────────────────────────────────────

router.get('/api/projects/:id/network', async (req: Request, res: Response) => {
  const aggregator = IntegrationAggregator.getInstance();
  const p3Res = await (aggregator as any).fetchJson(`${aggregator.person3Url}/projects/${req.params.id}/network`);
  if (p3Res) return res.json(p3Res);

  const store = FrontendDataStore.getInstance();
  const detail = store.getProjectDetail(req.params.id);
  const iaId = detail?.implementing_agency.ia_id || 'IA_DEFAULT';
  const nodeDetail = store.network.node_details.find(d => d.node_id === iaId);
  res.json({
    project_id: req.params.id,
    ia_id: iaId,
    metrics: {
      target_ia: iaId,
      ia_name: detail?.implementing_agency.ia_name || iaId,
      total_projects: detail?.implementing_agency.total_projects || 1,
      degree_centrality: 0.35,
      hhi_concentration_index: nodeDetail?.hhi || 0.45,
      ia_risk_score: detail?.implementing_agency.risk_score || 0.30,
      is_high_concentration: (nodeDetail?.hhi || 0) > 0.50,
    },
    graph: {
      nodes: store.network.nodes.filter(n => n.id === iaId || store.network.edges.some(e => (e.source === iaId && e.target === n.id) || (e.target === iaId && e.source === n.id))),
      edges: store.network.edges.filter(e => e.source === iaId || e.target === iaId),
    },
  });
});

// ─────────────────────────────────────────────
// GET /api/projects/:id/geo
// ─────────────────────────────────────────────

router.get('/api/projects/:id/geo', async (req: Request, res: Response) => {
  const aggregator = IntegrationAggregator.getInstance();
  const p3Res = await (aggregator as any).fetchJson(`${aggregator.person3Url}/projects/${req.params.id}/geo`);
  if (p3Res) return res.json(p3Res);

  const store = FrontendDataStore.getInstance();
  const detail = store.getProjectDetail(req.params.id);
  const hasGps = !!(detail?.project.work_lat && detail?.project.work_lon);
  res.json({
    project_id: req.params.id,
    location: {
      latitude: detail?.project.work_lat || 20.5937,
      longitude: detail?.project.work_lon || 78.9629,
    },
    constituency_id: detail?.project.constituency_id || 'C001',
    is_within_bounds: hasGps,
    geo_score: hasGps ? 0.0 : 0.4,
    confidence: 0.85,
    boundary_source: 'SYNTHETIC_CLUSTER_BUFFER_ESTIMATE',
    warning: 'Constituency boundary is estimated from civic project cluster convex hulls.',
  });
});

export default router;

