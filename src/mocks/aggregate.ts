import type {
  DistrictRiskAggregate,
  RiskLevel,
  RiskLevelCounts,
  RiskTreemapNode,
  StateRiskAggregate,
} from '@/types/api';
import type { ProjectRecord } from '@/mocks/dataset';
import { DISTRICT_BY_ID, STATE_BY_ID } from '@/mocks/geo';
import { riskLevelFromScore } from '@/lib/risk';
import { round } from '@/mocks/rng';

/**
 * Aggregations the mock API performs server-side.
 *
 * These live here rather than in a component because the brief is explicit that the
 * frontend must not perform aggregation that belongs to the backend (§5). Rolling
 * 12,000 records up to 30 state figures is exactly that kind of work: the real FastAPI
 * service will do it in SQL, so the mock does it before the response leaves the server
 * and the components receive the same small, pre-aggregated payload either way.
 */

export function emptyCounts(): RiskLevelCounts {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
}

export function tallyLevels(records: readonly ProjectRecord[]): RiskLevelCounts {
  const counts = emptyCounts();
  for (const record of records) counts[record.risk.risk_level] += 1;
  return counts;
}

export function meanRisk(records: readonly ProjectRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((total, r) => total + r.risk.overall_risk, 0);
  return round(sum / records.length, 3);
}

export function totalCostLakhs(records: readonly ProjectRecord[]): number {
  return round(
    records.reduce((total, r) => total + r.project.estimated_cost_lakhs, 0),
    2,
  );
}

function groupInto<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/**
 * State-level rollup, used by the choropleth and the state bar chart.
 *
 * The level attached to each state comes from its *mean* score run through the same
 * fixed bands as an individual work, so a state shaded orange means the same thing as a
 * project badged orange. The per-level counts travel alongside, because a mean alone
 * hides the shape of the distribution — a state with two critical works and a hundred
 * clean ones should not read as uniformly moderate.
 */
export function aggregateByState(records: readonly ProjectRecord[]): StateRiskAggregate[] {
  const byState = groupInto(records, (r) => r.project.state_id);
  const out: StateRiskAggregate[] = [];

  for (const [stateId, own] of byState) {
    const mean = meanRisk(own);
    out.push({
      state_id: stateId,
      state_name: STATE_BY_ID[stateId]?.state_name ?? stateId,
      project_count: own.length,
      mean_risk: mean,
      risk_level: riskLevelFromScore(mean),
      counts_by_risk_level: tallyLevels(own),
    });
  }

  return out.sort((a, b) => b.mean_risk - a.mean_risk || a.state_name.localeCompare(b.state_name));
}

/** District-level rollup, used by the map's zoomed-out marker aggregation. */
export function aggregateByDistrict(records: readonly ProjectRecord[]): DistrictRiskAggregate[] {
  const byDistrict = groupInto(records, (r) => r.project.district_id);
  const out: DistrictRiskAggregate[] = [];

  for (const [districtId, own] of byDistrict) {
    const geo = DISTRICT_BY_ID[districtId];
    const first = own[0];
    const mean = meanRisk(own);
    out.push({
      district_id: districtId,
      district_name: geo?.district_name ?? districtId,
      state_id: geo?.state_id ?? first.project.state_id,
      state_name: STATE_BY_ID[geo?.state_id ?? first.project.state_id]?.state_name ?? '',
      lat: geo?.lat ?? first.lat,
      lon: geo?.lon ?? first.lon,
      project_count: own.length,
      mean_risk: mean,
      risk_level: riskLevelFromScore(mean),
      counts_by_risk_level: tallyLevels(own),
    });
  }

  return out.sort(
    (a, b) => b.mean_risk - a.mean_risk || a.district_name.localeCompare(b.district_name),
  );
}

/**
 * Work-type rollup for the treemap.
 *
 * Area is driven by cost and colour by mean risk, so the panel answers "where is the
 * money, and is it going somewhere anomalous" in one glance — which is why total cost
 * travels with every node rather than being derived on the client.
 */
export function aggregateByWorkType(records: readonly ProjectRecord[]): RiskTreemapNode[] {
  const byType = groupInto(records, (r) => r.project.work_type);
  const out: RiskTreemapNode[] = [];

  for (const [workType, own] of byType) {
    const mean = meanRisk(own);
    out.push({
      name: workType,
      project_count: own.length,
      mean_risk: mean,
      risk_level: riskLevelFromScore(mean),
      total_cost_lakhs: totalCostLakhs(own),
    });
  }

  return out.sort((a, b) => b.total_cost_lakhs - a.total_cost_lakhs || a.name.localeCompare(b.name));
}

/**
 * Highest-mean-risk entry, ignoring groups too small to mean anything.
 *
 * Without the floor a single flagged work in Sikkim would top the "highest-risk state"
 * headline — technically the largest mean, but a claim no auditor would stand behind.
 */
export function highestMean<T extends { mean_risk: number; project_count: number }>(
  items: readonly T[],
  minProjects: number,
): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (item.project_count < minProjects) continue;
    if (best === null || item.mean_risk > best.mean_risk) best = item;
  }
  // Everything is below the floor (a narrow filter, say a single district) — fall back
  // to the largest group rather than reporting nothing at all.
  if (best === null && items.length > 0) {
    best = [...items].sort(
      (a, b) => b.project_count - a.project_count || b.mean_risk - a.mean_risk,
    )[0];
  }
  return best;
}

/** Minimum group sizes for the "highest risk" headline figures. */
export const MIN_PROJECTS_FOR_STATE_HEADLINE = 60;
export const MIN_PROJECTS_FOR_DISTRICT_HEADLINE = 15;

/** Level counts as an ordered array, for stacked bars and legends. */
export function countsAsSeries(counts: RiskLevelCounts): { level: RiskLevel; count: number }[] {
  return [
    { level: 'CRITICAL', count: counts.CRITICAL },
    { level: 'HIGH', count: counts.HIGH },
    { level: 'MEDIUM', count: counts.MEDIUM },
    { level: 'LOW', count: counts.LOW },
  ];
}
