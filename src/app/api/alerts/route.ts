import type { AlertRow, AlertsResponse, RiskLevelCounts } from '@/types/api';
import { getDataset } from '@/mocks/dataset';
import { emptyCounts } from '@/mocks/aggregate';
import {
  facetsOf,
  filterAlerts,
  paginate,
  readAlertFilter,
  readPagination,
  readSortField,
  readSortOrder,
  readString,
  sortAlerts,
} from '@/mocks/query';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';
import { ALERT_SORT_FIELDS } from '@/types/query';
import { alertTypeLabel } from '@/mocks/taxonomy';

/**
 * GET /api/alerts — the triage queue.
 *
 * With no sort requested the feed keeps the order the dataset was built in: severity
 * first, then unacknowledged ahead of handled, then score. That is a work queue rather
 * than a chronological log, which is what an officer opening this screen actually needs —
 * the oldest unhandled Critical item should not be six pages down because something
 * Medium arrived this morning.
 *
 * `unacknowledged_count` is deliberately counted over the *filtered* set. A badge reading
 * "312 outstanding" while the visible table holds four rows is the kind of mismatch that
 * makes a reviewer distrust the whole screen.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();

  const filter = readAlertFilter(params);
  const filtered = filterAlerts(dataset.alerts, filter);

  // Absent `sort_by` means "leave the triage order alone" — distinguishable only by
  // reading the raw parameter, since the sort readers substitute a default.
  const requestedSort = readString(params, 'sort_by');
  const rows: AlertRow[] =
    requestedSort === undefined
      ? filtered
      : sortAlerts(
          filtered,
          readSortField(params, ALERT_SORT_FIELDS, 'created_at'),
          readSortOrder(params, 'desc'),
        );

  const counts: RiskLevelCounts = emptyCounts();
  let unacknowledged = 0;
  for (const alert of filtered) {
    counts[alert.alert_level] += 1;
    if (!alert.is_acknowledged) unacknowledged += 1;
  }

  const body: AlertsResponse = {
    alerts: paginate(rows, readPagination(params)),
    counts_by_level: counts,
    unacknowledged_count: unacknowledged,
    facets: {
      alert_types: facetsOf(filtered, (a) => a.alert_type, alertTypeLabel),
      states: facetsOf(
        filtered,
        (a) => a.state_id,
        (id) => dataset.states.find((s) => s.state_id === id)?.state_name ?? id,
        'label',
      ),
      // MPs are faceted by count, not name: the useful question on this screen is which
      // members have the most outstanding items, and there are 536 of them.
      mps: facetsOf(
        filtered,
        (a) => a.mp_id,
        (id) => {
          const mp = dataset.mpById.get(id);
          return mp ? `${mp.mp_name} — ${mp.constituency_name}` : id;
        },
      ),
    },
  };

  return json(body);
}
