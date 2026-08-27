import type {
  ComplianceMatrixCell,
  ComplianceRule,
  ComplianceSummaryResponse,
  SCSTMandateRow,
  StateComplianceSummary,
} from '@/types/api';
import { getDataset } from '@/mocks/dataset';
import { json, searchParamsOf, simulateLatency } from '@/mocks/http';
import { readList } from '@/mocks/query';
import {
  COMPLIANCE_RULES,
  CRITICAL_SC_SHARE_THRESHOLD,
  SC_MANDATE_SHARE,
  ST_MANDATE_SHARE,
  complianceStatusFor,
} from '@/mocks/taxonomy';
import { round } from '@/mocks/rng';

/**
 * GET /api/compliance-summary — guideline adherence, by rule and by state.
 *
 * Six requirements are assessed, each against the threshold the guidelines imply rather
 * than one uniform bar: the 45-day sanction window is a hard administrative deadline, while
 * the stage-photograph requirement is graded more leniently because eSAKSHI adoption is
 * still uneven and a data-capture gap is not the same failing as an unsanctioned work.
 *
 * Works that have not yet reached the point where a rule applies are excluded from its
 * denominator entirely. A road sanctioned last month cannot have breached a twelve-month
 * completion window, and counting it as a failure would inflate every state's breach count
 * with works that have done nothing wrong.
 *
 * The `national` block stays national whatever filter is applied. It is the reference line
 * the state rows are read against, and silently rescoping it to the selected state would
 * turn every comparison into a tautology.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  await simulateLatency();

  const params = searchParamsOf(request);
  const dataset = getDataset();

  const stateIds = new Set(readList(params, 'state'));
  const ruleIds = new Set(readList(params, 'rule_id').map((v) => v.toUpperCase()));

  const inState = (id: string): boolean => stateIds.size === 0 || stateIds.has(id);
  const inRules = (id: string): boolean => ruleIds.size === 0 || ruleIds.has(id);

  const rules: ComplianceRule[] = COMPLIANCE_RULES.filter((rule) => inRules(rule.rule_id));
  const matrix: ComplianceMatrixCell[] = dataset.complianceMatrix.filter(
    (cell) => inState(cell.state_id) && inRules(cell.rule_id),
  );
  const states: StateComplianceSummary[] = dataset.stateCompliance.filter((s) => inState(s.state_id));
  const scstRows: SCSTMandateRow[] = dataset.scstRows.filter((row) => inState(row.state_id));

  const body: ComplianceSummaryResponse = {
    rules,
    states,
    matrix,
    scst_mandate: {
      sc_mandate_share: SC_MANDATE_SHARE,
      st_mandate_share: ST_MANDATE_SHARE,
      critical_sc_share_threshold: CRITICAL_SC_SHARE_THRESHOLD,
      // Worst first. The members furthest below the mandate are the point of the tracker,
      // and a reviewer should not have to sort a 536-row table to find them.
      rows: [...scstRows].sort(
        (a, b) => a.sc_share - b.sc_share || a.constituency_name.localeCompare(b.constituency_name),
      ),
      // Counted over the rows actually returned, so the headline figure and the visible
      // table can never disagree.
      below_threshold_count: scstRows.filter((row) => row.below_ten_percent_sc).length,
    },
    national: nationalRollup(dataset.complianceMatrix),
  };

  return json(body);
}

/**
 * National figures, weighted by how many works each cell actually assessed.
 *
 * A plain average of thirty state rates would let Sikkim's handful of works count as much
 * as Uttar Pradesh's eighteen hundred. Weighting by the applicable denominator makes the
 * national rate mean what it says: the share of assessed works, countrywide, that met the
 * requirement.
 */
function nationalRollup(
  matrix: readonly ComplianceMatrixCell[],
): ComplianceSummaryResponse['national'] {
  const perRule = new Map<string, { compliant: number; applicable: number }>();
  let compliantTotal = 0;
  let applicableTotal = 0;

  for (const cell of matrix) {
    if (cell.status === 'NO_DATA' || cell.applicable_projects === 0) continue;
    const entry = perRule.get(cell.rule_id) ?? { compliant: 0, applicable: 0 };
    entry.compliant += cell.compliant_projects;
    entry.applicable += cell.applicable_projects;
    perRule.set(cell.rule_id, entry);
    compliantTotal += cell.compliant_projects;
    applicableTotal += cell.applicable_projects;
  }

  let breached = 0;
  for (const [ruleId, entry] of perRule) {
    if (entry.applicable === 0) continue;
    if (complianceStatusFor(entry.compliant / entry.applicable, ruleId) === 'NON_COMPLIANT') {
      breached += 1;
    }
  }

  return {
    overall_compliance_rate: applicableTotal === 0 ? 0 : round(compliantTotal / applicableTotal, 4),
    rules_breached: breached,
    // Assessments, not works: one work contributes to several rules, and calling this
    // "projects" while meaning "rule evaluations" is how dashboards start lying.
    projects_assessed: applicableTotal,
  };
}
