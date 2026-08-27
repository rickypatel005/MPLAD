import type { DuplicatePairRow } from '@/types/api';
import { getDataset } from '@/mocks/dataset';
import { badRequest, json, notFound, simulateLatency } from '@/mocks/http';

/**
 * PATCH /api/duplicates/{id} — records a reviewer's verdict on a candidate pair.
 *
 * The verdict is the human judgement the whole screen exists to collect. Detection produces
 * candidates; only a person who has looked at the two works can say whether they are one
 * asset recorded twice or two sanctioned phases of the same road. Both outcomes are
 * first-class: "not a duplicate" is a real, useful answer and closes the item just as
 * firmly as a confirmation.
 *
 * Reviewing a pair also acknowledges its alert, so the feed and this screen never disagree
 * about how many candidates are outstanding. Nothing is deleted — a cleared pair keeps its
 * similarity figure and its evidence, and stays auditable.
 */

export const dynamic = 'force-dynamic';

const REVIEW_STATUSES: readonly DuplicatePairRow['review_status'][] = [
  'PENDING_REVIEW',
  'CONFIRMED_DUPLICATE',
  'NOT_A_DUPLICATE',
];

const VERDICT_NOTE: Record<DuplicatePairRow['review_status'], string> = {
  PENDING_REVIEW: 'Returned to the review queue.',
  CONFIRMED_DUPLICATE: 'Confirmed as the same physical asset; referred for recovery.',
  NOT_A_DUPLICATE: 'Verified as two separate works.',
};

interface ReviewBody {
  review_status: DuplicatePairRow['review_status'];
  reviewed_by: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  await simulateLatency();

  const pairId = Number(params.id);
  if (!Number.isInteger(pairId)) {
    return badRequest(`Pair id must be an integer; received "${params.id}".`);
  }

  const body = await readBody(request);
  if (body === null) {
    return badRequest(
      `Body must be JSON with "reviewed_by" and "review_status" set to one of ${REVIEW_STATUSES.join(', ')}.`,
    );
  }

  const dataset = getDataset();
  const pair = dataset.duplicatePairs.find((p) => p.pair_id === pairId);
  if (!pair) {
    return notFound(`No duplicate pair found with id ${pairId}.`);
  }

  pair.review_status = body.review_status;
  pair.reviewed = body.review_status !== 'PENDING_REVIEW';

  const alert = dataset.alerts.find(
    (a) => a.alert_type === 'DUPLICATE_CANDIDATE' && a.project_id === pair.project_id_1,
  );
  if (alert) {
    alert.is_acknowledged = pair.reviewed;
    alert.acknowledged_by = pair.reviewed ? body.reviewed_by : null;
    alert.acknowledged_at = pair.reviewed ? new Date().toISOString() : null;
    alert.action_taken = pair.reviewed ? VERDICT_NOTE[body.review_status] : null;
  }

  return json(pair);
}

async function readBody(request: Request): Promise<ReviewBody | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  const reviewedBy = typeof record.reviewed_by === 'string' ? record.reviewed_by.trim() : '';
  if (reviewedBy.length === 0) return null;

  const status = typeof record.review_status === 'string' ? record.review_status.toUpperCase() : '';
  const match = REVIEW_STATUSES.find((value) => value === status);
  if (match === undefined) return null;

  return { review_status: match, reviewed_by: reviewedBy };
}
