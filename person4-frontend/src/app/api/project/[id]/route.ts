import type {
  ComparableProject,
  DuplicatePairRow,
  DuplicatePairSummary,
  DuplicateSideProject,
  ImplementingAgency,
  MPRef,
  ProjectDetailResponse,
} from '@/types/api';
import { getDataset, type Dataset, type IAAggregate, type ProjectRecord } from '@/mocks/dataset';
import { json, notFound, simulateLatency } from '@/mocks/http';
import { distanceLabel, monthsBetween, monthsLabel, pct } from '@/mocks/text';

/**
 * GET /api/project/{id} — everything the Project Investigation screen renders.
 *
 * This is the screen the whole product is judged on, so the response is deliberately
 * complete: the six scored dimensions with their evidence, the cost benchmark, the
 * payment ladder, the timeline with its breaches, the photo record, the peer comparison,
 * any duplicate pair the work belongs to, and the recommended action. One request, no
 * follow-up round trips, because an auditor clicking a row expects a page, not a
 * progressive assembly of six spinners.
 *
 * Nothing here is calculated on demand. Every figure was derived once when the dataset
 * was scored, which is what guarantees the number in the evidence sentence and the number
 * in the dimension bar are the same number.
 */

export const dynamic = 'force-dynamic';

/** Peers shown in the cost comparison table. Five fits the panel without scrolling. */
const COMPARABLE_COUNT = 5;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  await simulateLatency();

  const dataset = getDataset();
  const projectId = decodeURIComponent(params.id).trim();
  const record = dataset.recordById.get(projectId);

  if (!record) {
    return notFound(`No work found with id ${projectId}.`);
  }

  const p = record.project;
  const ia = dataset.iaById.get(p.ia_id);
  const district = dataset.districts.find((d) => d.district_id === p.district_id);
  const state = dataset.states.find((s) => s.state_id === p.state_id);
  const pairs = dataset.pairsByProject.get(projectId) ?? [];

  const body: ProjectDetailResponse = {
    project: p,
    risk_score: record.risk,
    risk_dimensions: record.dimensions,
    implementing_agency: ia
      ? toWireIA(ia)
      : {
          ia_id: p.ia_id,
          ia_name: record.iaName,
          ia_type: 'PRIVATE',
          total_projects: 0,
          completed_projects: 0,
          avg_delay_days: 0,
          risk_score: 0,
          state_id: p.state_id,
        },
    mp: resolveMP(dataset, record),
    district: district ?? {
      district_id: p.district_id,
      district_name: record.districtName,
      state_id: p.state_id,
      state_name: record.stateName,
      lat: record.lat,
      lon: record.lon,
    },
    state: state ?? { state_id: p.state_id, state_name: record.stateName },
    payments: record.payments,
    timeline: record.timeline,
    photos: record.photos,
    cost_benchmark: record.benchmark,
    comparable_projects: comparablesFor(dataset, record),
    duplicate_pairs: pairs.map((pair) => pairSummary(pair, projectId)),
    recommended_action: record.recommendedAction,
    // Drives the "View in Network Graph" cross-link. False means the agency did not meet
    // the graph's inclusion floor, and offering a link to a node that isn't there is the
    // fastest way to break a live demo.
    has_network_relationship: dataset.network.nodeIds.has(p.ia_id),
  };

  return json(body);
}

/**
 * Projects the internal agency aggregate down to the wire shape.
 *
 * The aggregate carries the concentration index and a per-MP work index, neither of which
 * belongs in this response: `hhi` reaches the UI through the agency dimension's evidence
 * sentence and through the network node detail, and the per-MP map is not serialisable.
 */
function toWireIA(ia: IAAggregate): ImplementingAgency {
  return {
    ia_id: ia.ia_id,
    ia_name: ia.ia_name,
    ia_type: ia.ia_type,
    total_projects: ia.total_projects,
    completed_projects: ia.completed_projects,
    avg_delay_days: ia.avg_delay_days,
    risk_score: ia.risk_score,
    state_id: ia.state_id,
  };
}

/** Every work's MP resolves; the fallback exists so the response type needs no null. */
function resolveMP(dataset: Dataset, record: ProjectRecord): MPRef {
  const p = record.project;
  return (
    dataset.mpById.get(p.mp_id) ?? {
      mp_id: p.mp_id,
      mp_name: p.mp_id,
      mp_house: p.mp_house,
      constituency_id: p.constituency_id,
      constituency_name: p.constituency_id,
      state_id: p.state_id,
    }
  );
}

/**
 * Peer works used to benchmark unit cost.
 *
 * Same work type in the same state, because a road in Uttar Pradesh is not comparable to
 * a community hall in Kerala and pretending otherwise would make the benchmark
 * indefensible. Same-district peers sort first — the closest available comparison — and
 * the state pool is only widened when a state has too few works of the type to say
 * anything.
 */
function comparablesFor(dataset: Dataset, record: ProjectRecord): ComparableProject[] {
  const { work_type: workType, state_id: stateId, district_id: districtId } = record.project;
  const selfId = record.project.project_id;

  const sameType = dataset.records.filter(
    (r) => r.project.work_type === workType && r.project.project_id !== selfId,
  );
  const inState = sameType.filter((r) => r.project.state_id === stateId);
  const pool = inState.length >= COMPARABLE_COUNT ? inState : sameType;

  return [...pool]
    .sort((a, b) => {
      const aLocal = a.project.district_id === districtId ? 0 : 1;
      const bLocal = b.project.district_id === districtId ? 0 : 1;
      return (
        aLocal - bLocal ||
        a.unitCost - b.unitCost ||
        a.project.project_id.localeCompare(b.project.project_id)
      );
    })
    .slice(0, COMPARABLE_COUNT)
    .map((r) => ({
      project_id: r.project.project_id,
      district_name: r.districtName,
      work_type: r.project.work_type,
      estimated_cost_lakhs: r.project.estimated_cost_lakhs,
      unit_cost_lakhs: r.unitCost,
      risk_level: r.risk.risk_level,
    }));
}

/**
 * One-line account of why a duplicate pair is worth a second look.
 *
 * Assembled from what the two records actually differ on rather than a fixed sentence, so
 * the note earns its place: two works 800 m apart, recommended three months apart through
 * the same agency by different MPs is a specific claim an officer can go and check. It
 * closes on verification rather than a conclusion, because similarity is evidence that
 * two records may describe one stretch of road — not a finding that they do.
 */
function pairSummary(pair: DuplicatePairRow, projectId: string): DuplicatePairSummary {
  const isA = pair.project_a.project_id === projectId;
  const self: DuplicateSideProject = isA ? pair.project_a : pair.project_b;
  const other: DuplicateSideProject = isA ? pair.project_b : pair.project_a;

  const clauses: string[] = [
    `${pct(pair.similarity_score)} description similarity`,
    `${distanceLabel(pair.geo_distance_km)} apart`,
  ];

  if (other.district_id === self.district_id) clauses.push(`same district (${other.district_name})`);
  if (other.ia_id === self.ia_id) clauses.push(`same implementing agency (${other.ia_name})`);
  if (other.mp_id !== self.mp_id) clauses.push('recommended by a different MP');

  const gap = monthsBetween(other.recommended_date, self.recommended_date);
  if (gap !== 0) {
    clauses.push(`recommended ${monthsLabel(gap)} ${gap > 0 ? 'earlier' : 'later'}`);
  }

  return {
    pair_id: pair.pair_id,
    counterpart_project_id: other.project_id,
    similarity_score: pair.similarity_score,
    geo_distance_km: pair.geo_distance_km,
    detection_method: pair.detection_method,
    note: `${other.project_id}: ${clauses.join('; ')}. Requires verification that the two works are distinct.`,
  };
}
