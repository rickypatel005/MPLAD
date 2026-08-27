import type { AnalyzeRequest, AnalyzeResponse } from '@/types/api';
import { getDataset, type ProjectRecord } from '@/mocks/dataset';
import { json, simulateLatency } from '@/mocks/http';
import { ELEVATED_RISK_LEVELS } from '@/lib/risk';

/**
 * POST /api/analyze — asks the backend to re-run scoring.
 *
 * The frontend triggers this and reports the outcome. It performs none of the analysis
 * itself: no model runs in the browser, no score is computed client-side, and this handler
 * is a stand-in for a FastAPI endpoint that will drive the real scoring engine (brief §5).
 *
 * `new_alerts` comes back zero, and that is the truthful answer rather than a placeholder.
 * The synthetic dataset is fixed for the life of the server process, so a re-run over the
 * same records finds the same anomalies — which is exactly what an idempotent scoring engine
 * should do. "No new findings since the last run" is a real and reassuring result; inventing
 * a handful of fresh alerts to make the button feel productive would be theatre.
 */

export const dynamic = 'force-dynamic';

/**
 * Throughput used to quote a duration, in works per second.
 *
 * Calibrated against the TRD's expectation that a full national re-score completes inside a
 * few seconds, so the figure the UI reports is in the right order of magnitude rather than
 * an arbitrary number.
 */
const WORKS_PER_SECOND = 2_600;

export async function POST(request: Request): Promise<Response> {
  await simulateLatency();

  const scope = await readScope(request);
  const dataset = getDataset();

  const inScope: ProjectRecord[] = dataset.records.filter((record) => {
    if (scope.state_id !== undefined && record.project.state_id !== scope.state_id) return false;
    if (scope.fy !== undefined && record.project.fy !== scope.fy) return false;
    return true;
  });

  const flagged = inScope.filter((record) =>
    (ELEVATED_RISK_LEVELS as readonly string[]).includes(record.risk.risk_level),
  ).length;

  const duration = Math.max(0.4, Math.round((inScope.length / WORKS_PER_SECOND) * 10) / 10);
  const startedAt = new Date();
  const completedAt = new Date(startedAt.getTime() + duration * 1_000);

  const body: AnalyzeResponse = {
    run_id: `run-${startedAt.getTime().toString(36)}`,
    status: 'COMPLETED',
    projects_analyzed: inScope.length,
    projects_flagged: flagged,
    new_alerts: 0,
    duration_seconds: duration,
    model_version: dataset.model_version,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
  };

  return json(body);
}

/**
 * Optional scope, defaulting to everything.
 *
 * A malformed or absent body is treated as "re-score the lot" rather than rejected: the
 * request carries no required fields, so there is nothing a 400 would usefully tell the
 * caller.
 */
async function readScope(request: Request): Promise<AnalyzeRequest> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null) return {};

  const record = parsed as Record<string, unknown>;
  const stateId = typeof record.state_id === 'string' ? record.state_id.trim() : '';
  const fy = typeof record.fy === 'string' ? record.fy.trim() : '';

  return {
    ...(stateId.length > 0 ? { state_id: stateId } : {}),
    ...(fy.length > 0 ? { fy } : {}),
  };
}
