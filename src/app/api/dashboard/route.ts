import type { DashboardKPIs, DashboardResponse, RankedProject } from '@/types/api';
import { getDataset } from '@/mocks/dataset';
import {
  MIN_PROJECTS_FOR_DISTRICT_HEADLINE,
  MIN_PROJECTS_FOR_STATE_HEADLINE,
  aggregateByDistrict,
  aggregateByState,
  aggregateByWorkType,
  highestMean,
  meanRisk,
  tallyLevels,
  totalCostLakhs,
} from '@/mocks/aggregate';
import {
  facetsOf,
  filterProjects,
  isEmptyProjectFilter,
  paginate,
  readPagination,
  readProjectFilter,
  readSortField,
  readSortOrder,
  sortProjects,
} from '@/mocks/query';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';
import { DEFAULT_PROJECT_SORT, PROJECT_SORT_FIELDS } from '@/types/query';
import { RISK_LEVELS, riskMeta } from '@/lib/risk';

/**
 * GET /api/dashboard — the aggregated risk picture plus one page of ranked works.
 *
 * Everything the Risk Dashboard needs arrives in a single response: KPI headline
 * figures, the state rollup behind the choropleth, the work-type treemap, the Top-10
 * panel, one page of the ranked table, and the facet counts for the filter controls.
 * One request rather than six, because the demo's first screen has to be complete
 * inside a second and six parallel requests would each pay the same filter cost.
 *
 * Filters apply to every section at once. That is the point of the screen: narrowing to
 * Uttar Pradesh should move the KPIs, the treemap and the table together, so what the
 * headline claims and what the table shows can never diverge.
 */

export const dynamic = 'force-dynamic';

/** Size of the Top-10 panel — fixed, and always risk-ordered whatever the table sort. */
const TOP_PROJECT_COUNT = 10;

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();

  const filter = readProjectFilter(params);
  const filtered = filterProjects(dataset.records, filter);

  const sortBy = readSortField(params, PROJECT_SORT_FIELDS, DEFAULT_PROJECT_SORT.sort_by);
  const order = readSortOrder(params, DEFAULT_PROJECT_SORT.order);
  const pagination = readPagination(params);

  // The unfiltered default view is the demo's opening screen, so it reuses the list
  // sorted once at startup instead of re-sorting twelve thousand records per request.
  const usePrecomputed =
    isEmptyProjectFilter(filter) &&
    sortBy === DEFAULT_PROJECT_SORT.sort_by &&
    order === DEFAULT_PROJECT_SORT.order;

  const rows: RankedProject[] = usePrecomputed
    ? dataset.rankedDesc
    : sortProjects(filtered, sortBy, order).map((r) => r.ranked);

  const projects = paginate(rows, pagination);

  // Independent of the table's sort: the Top-10 panel is a severity list, so re-sorting
  // the table by cost must not silently change what it claims are the worst works.
  const topProjects = usePrecomputed
    ? dataset.rankedDesc.slice(0, TOP_PROJECT_COUNT)
    : [...filtered]
        .sort(
          (a, b) =>
            b.risk.overall_risk - a.risk.overall_risk ||
            a.project.project_id.localeCompare(b.project.project_id),
        )
        .slice(0, TOP_PROJECT_COUNT)
        .map((r) => r.ranked);

  const stateRisk = aggregateByState(filtered);
  const districtRisk = aggregateByDistrict(filtered);
  const topState = highestMean(stateRisk, MIN_PROJECTS_FOR_STATE_HEADLINE);
  const topDistrict = highestMean(districtRisk, MIN_PROJECTS_FOR_DISTRICT_HEADLINE);

  const kpis: DashboardKPIs = {
    total_projects_analyzed: filtered.length,
    counts_by_risk_level: tallyLevels(filtered),
    mean_overall_risk: meanRisk(filtered),
    top_risk_state: topState
      ? {
          state_id: topState.state_id,
          state_name: topState.state_name,
          mean_risk: topState.mean_risk,
        }
      : null,
    top_risk_district: topDistrict
      ? {
          district_id: topDistrict.district_id,
          district_name: topDistrict.district_name,
          state_name: topDistrict.state_name,
          mean_risk: topDistrict.mean_risk,
        }
      : null,
    total_estimated_cost_lakhs: totalCostLakhs(filtered),
    last_scored_at: dataset.scored_at,
    model_version: dataset.model_version,
  };

  const body: DashboardResponse = {
    kpis,
    state_risk: stateRisk,
    work_type_risk: aggregateByWorkType(filtered),
    top_projects: topProjects,
    projects,
    facets: {
      // Facets are counted over the filtered set, so an option reading zero explains
      // why a combination came back empty instead of leaving the user guessing.
      states: facetsOf(
        filtered,
        (r) => r.project.state_id,
        (id) => dataset.states.find((s) => s.state_id === id)?.state_name ?? id,
        'label',
      ),
      work_types: facetsOf(
        filtered,
        (r) => r.project.work_type,
        (value) => value,
        'label',
      ),
      // Risk levels are listed in full, in severity order, even at zero: a missing
      // "Critical" option would read as "no critical works exist" rather than "none
      // match your filter".
      risk_levels: [...RISK_LEVELS]
        .reverse()
        .map((level) => ({
          value: level,
          label: riskMeta(level).label,
          count: kpis.counts_by_risk_level[level],
        })),
    },
  };

  return json(body);
}
