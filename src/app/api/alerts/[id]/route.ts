import type { AcknowledgeAlertRequest, AlertRow } from '@/types/api';
import { getDataset } from '@/mocks/dataset';
import { badRequest, json, notFound, simulateLatency } from '@/mocks/http';

/**
 * PATCH /api/alerts/{id} — records that a human has picked an item up.
 *
 * The write mutates the in-memory dataset, so an acknowledgement made during a demo stays
 * made: the reviewer's name and the action they recorded are still there when the feed is
 * revisited two screens later. The dataset is rebuilt per server process, so a restart
 * returns everything to its seeded state — which is exactly the behaviour you want before
 * a second run-through.
 *
 * This is the only mutation in the product, and it is a note about human activity rather
 * than a change to any finding. Nothing here can alter a score, clear an anomaly, or
 * delete an alert; an acknowledged item stays in the feed with its evidence intact.
 */

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  await simulateLatency();

  const alertId = Number(params.id);
  if (!Number.isInteger(alertId)) {
    return badRequest(`Alert id must be an integer; received "${params.id}".`);
  }

  const body = await readBody(request);
  if (body === null) {
    return badRequest('Body must be JSON with a non-empty "acknowledged_by".');
  }

  const dataset = getDataset();
  const alert: AlertRow | undefined = dataset.alerts.find((a) => a.alert_id === alertId);
  if (!alert) {
    return notFound(`No alert found with id ${alertId}.`);
  }

  alert.is_acknowledged = true;
  alert.acknowledged_by = body.acknowledged_by;
  alert.acknowledged_at = new Date().toISOString();
  // An empty action is allowed — "seen, nothing done yet" is a real state, and forcing a
  // sentence would only teach reviewers to type "n/a".
  alert.action_taken = body.action_taken.length > 0 ? body.action_taken : null;

  return json(alert);
}

/**
 * Reads and validates the request body without reaching for `any`.
 *
 * Returns null on anything malformed so the caller answers 400 once, rather than throwing
 * a parse error that surfaces to the user as an opaque 500.
 */
async function readBody(request: Request): Promise<AcknowledgeAlertRequest | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  const acknowledgedBy = typeof record.acknowledged_by === 'string' ? record.acknowledged_by.trim() : '';
  if (acknowledgedBy.length === 0) return null;

  const actionTaken = typeof record.action_taken === 'string' ? record.action_taken.trim() : '';
  return { acknowledged_by: acknowledgedBy, action_taken: actionTaken };
}
