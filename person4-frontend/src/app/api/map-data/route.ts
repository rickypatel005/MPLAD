import type { MapDataResponse, MapProjectMarker } from '@/types/api';
import { getDataset, type ProjectRecord } from '@/mocks/dataset';
import { aggregateByDistrict } from '@/mocks/aggregate';
import { filterProjects, readList, readNumber, readProjectFilter } from '@/mocks/query';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';

/**
 * GET /api/map-data — district aggregates, individual markers, and duplicate links.
 *
 * Two layers travel together because the map switches between them by zoom. District
 * aggregates are always complete: ninety rows covering every work in scope, which is what
 * the zoomed-out view draws. Individual markers are capped, because plotting twelve
 * thousand of them would push megabytes to the browser and freeze Leaflet — the brief
 * forbids exactly that (PRD §6).
 *
 * When the cap bites, markers are chosen worst-first rather than sampled at random. A map
 * that quietly omitted the Critical works while keeping a thousand clean ones would be
 * actively misleading; one showing the most serious findings, with the district layer
 * carrying the totals underneath, is honest at both zoom levels. `coverage.total_projects`
 * against `projects.length` lets the UI say which it is.
 */

export const dynamic = 'force-dynamic';

/** Marker ceiling. Leaflet handles this comfortably; ten times it does not. */
const MAX_MARKERS = 1_200;

/** Duplicate connector lines drawn at once — beyond this the map is unreadable anyway. */
const MAX_DUPLICATE_LINKS = 200;

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();

  const filtered = filterProjects(dataset.records, readProjectFilter(params));

  // Deep-link targets: a specific work, or both ends of a specific pair. These are pinned
  // into the marker set whatever the cap or the filter would otherwise do, because a link
  // from the project page that lands on a map with nothing on it is a dead end.
  const pinned = new Set<string>(readList(params, 'project'));
  const pairId = readNumber(params, 'pair');
  if (pairId !== undefined) {
    const pair = dataset.duplicatePairs.find((p) => p.pair_id === pairId);
    if (pair) {
      pinned.add(pair.project_id_1);
      pinned.add(pair.project_id_2);
    }
  }

  const inScope = new Set(filtered.map((r) => r.project.project_id));
  const marked: ProjectRecord[] = [...filtered];
  for (const id of pinned) {
    if (inScope.has(id)) continue;
    const record = dataset.recordById.get(id);
    if (record) marked.push(record);
  }

  const ordered =
    marked.length <= MAX_MARKERS
      ? marked
      : [...marked]
          .sort(
            (a, b) =>
              Number(pinned.has(b.project.project_id)) - Number(pinned.has(a.project.project_id)) ||
              b.risk.overall_risk - a.risk.overall_risk ||
              a.project.project_id.localeCompare(b.project.project_id),
          )
          .slice(0, MAX_MARKERS);

  const projects: MapProjectMarker[] = ordered.map(toMarker);

  let withGps = 0;
  for (const record of filtered) if (record.locationSource === 'GPS') withGps += 1;

  const plotted = new Set(projects.map((m) => m.project_id));
  const links = dataset.duplicatePairs
    .filter(
      (pair) =>
        pair.pair_id === pairId ||
        (plotted.has(pair.project_id_1) && plotted.has(pair.project_id_2)),
    )
    .sort(
      (a, b) =>
        Number(b.pair_id === pairId) - Number(a.pair_id === pairId) ||
        b.similarity_score - a.similarity_score ||
        a.pair_id - b.pair_id,
    )
    .slice(0, MAX_DUPLICATE_LINKS)
    .flatMap((pair) => {
      const from = dataset.recordById.get(pair.project_id_1);
      const to = dataset.recordById.get(pair.project_id_2);
      if (!from || !to) return [];
      return [
        {
          pair_id: pair.pair_id,
          similarity_score: pair.similarity_score,
          geo_distance_km: pair.geo_distance_km,
          from: { project_id: from.project.project_id, lat: from.lat, lon: from.lon },
          to: { project_id: to.project.project_id, lat: to.lat, lon: to.lon },
        },
      ];
    });

  const body: MapDataResponse = {
    districts: aggregateByDistrict(filtered),
    projects,
    duplicate_links: links,
    coverage: {
      total_projects: filtered.length,
      with_gps: withGps,
      // Stated rather than hidden: roughly a quarter of eSAKSHI records carry no
      // coordinates, and a marker sitting on a district centroid must not be read as a
      // surveyed location (PRD §10).
      district_centroid_fallback: filtered.length - withGps,
    },
  };

  return json(body);
}

function toMarker(record: ProjectRecord): MapProjectMarker {
  return {
    project_id: record.project.project_id,
    lat: record.lat,
    lon: record.lon,
    location_source: record.locationSource,
    risk_level: record.risk.risk_level,
    overall_risk: record.risk.overall_risk,
    work_type: record.project.work_type,
    district_id: record.project.district_id,
    district_name: record.districtName,
    state_name: record.stateName,
    top_reason: record.ranked.top_reason,
  };
}
