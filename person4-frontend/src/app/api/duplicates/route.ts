import type { DuplicatePairRow, DuplicatesResponse, FacetOption } from '@/types/api';
import { getDataset, type Dataset } from '@/mocks/dataset';
import {
  filterDuplicates,
  paginate,
  pageContaining,
  readDuplicateFilter,
  readPagination,
  readNumber,
  readSortField,
  readSortOrder,
  readString,
  sortDuplicates,
} from '@/mocks/query';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';
import { DUPLICATE_SORT_FIELDS } from '@/types/query';

/**
 * GET /api/duplicates — candidate pairs awaiting human verification.
 *
 * Every word on this screen is hedged on purpose. A high similarity score means two
 * records describe the same work in nearly the same words, at nearly the same place. That
 * is grounds for someone to go and look; it is not a finding, and the same asset legitimately
 * appears twice when a road is built in two sanctioned phases. So the endpoint returns
 * candidates with a review status, and the status only changes when a person sets it.
 *
 * A `pair` parameter opens the page that contains it. The duplicates screen is reached by
 * link from a project page, and landing on page one of six with the relevant row four pages
 * away would make the link pointless.
 */

export const dynamic = 'force-dynamic';

/** Similarity at or above this is called out in the counts strip. */
const HIGH_SIMILARITY = 0.85;

/** Separation at or below this reads as "the same place" for review purposes. */
const CLOSE_KM = 2;

const DETECTION_METHOD_LABELS: Record<string, string> = {
  SENTENCE_BERT: 'Description similarity',
  'SENTENCE_BERT + GEO_PROXIMITY': 'Description similarity + location proximity',
  PERCEPTUAL_HASH: 'Photograph similarity',
};

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();

  const filter = readDuplicateFilter(params);
  const filtered = filterDuplicates(dataset.duplicatePairs, filter);

  const sorted: DuplicatePairRow[] = sortDuplicates(
    filtered,
    readSortField(params, DUPLICATE_SORT_FIELDS, 'similarity_score'),
    readSortOrder(params, 'desc'),
  );

  const pagination = readPagination(params);
  const requestedPair = readNumber(params, 'pair');
  // An explicit page wins: if the user has paged away from a deep-linked pair, snapping
  // them back would make the pager feel broken.
  if (requestedPair !== undefined && readString(params, 'page') === undefined) {
    const target = pageContaining(sorted, pagination.pageSize, (p) => p.pair_id === requestedPair);
    if (target !== null) pagination.page = target;
  }

  let pendingReview = 0;
  let highSimilarity = 0;
  let close = 0;
  for (const pair of filtered) {
    if (pair.review_status === 'PENDING_REVIEW') pendingReview += 1;
    if (pair.similarity_score >= HIGH_SIMILARITY) highSimilarity += 1;
    if (pair.geo_distance_km <= CLOSE_KM) close += 1;
  }

  const body: DuplicatesResponse = {
    pairs: paginate(sorted, pagination),
    counts: {
      total_pairs: filtered.length,
      pending_review: pendingReview,
      high_similarity: highSimilarity,
      geographically_close: close,
    },
    facets: {
      detection_methods: methodFacets(filtered),
      states: stateFacets(filtered, stateIdLookup(dataset)),
    },
  };

  return json(body);
}

function methodFacets(pairs: readonly DuplicatePairRow[]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    counts.set(pair.detection_method, (counts.get(pair.detection_method) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: DETECTION_METHOD_LABELS[value] ?? value,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** project_id → state_id, so pair facets can use ids like every other screen's filter. */
function stateIdLookup(dataset: Dataset): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of dataset.duplicatePairs) {
    for (const id of [pair.project_id_1, pair.project_id_2]) {
      if (out.has(id)) continue;
      const record = dataset.recordById.get(id);
      if (record) out.set(id, record.project.state_id);
    }
  }
  return out;
}

/**
 * State facets count a pair under *both* states when it straddles a border.
 *
 * Cross-border pairs are the ones most worth surfacing — the same work described twice
 * either side of a boundary is harder to spot in any single state's own reporting — so
 * filtering by either state has to find them.
 */
function stateFacets(
  pairs: readonly DuplicatePairRow[],
  stateByProject: Map<string, string>,
): FacetOption[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const pair of pairs) {
    const sides = [
      { id: stateByProject.get(pair.project_id_1), label: pair.project_a.state_name },
      { id: stateByProject.get(pair.project_id_2), label: pair.project_b.state_name },
    ];
    const seen = new Set<string>();
    for (const side of sides) {
      const key = side.id ?? side.label;
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { label: side.label, count: 1 });
    }
  }

  return [...counts.entries()]
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
