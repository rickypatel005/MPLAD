import type { DuplicatePairRow, ReportResponse } from '@/types/api';
import { getDataset, type IAAggregate, type ProjectRecord } from '@/mocks/dataset';
import { json, notFound, simulateLatency } from '@/mocks/http';
import { DISCLAIMER_TEXT } from '@/lib/copy';
import { dimensionMeta, riskMeta } from '@/lib/risk';
import {
  formatDate,
  formatLakhs,
  formatRatio,
  formatScore,
  formatSimilarity,
  formatUnitCost,
  formatZScore,
  humanizeEnum,
} from '@/lib/format';
import { distanceLabel, pct, worksLabel } from '@/mocks/text';

/**
 * GET /api/report/{id} — the case file behind one flagged work, as structured text.
 *
 * Returned as headings and lines rather than a rendered PDF because the frontend does the
 * rendering: the real backend may hand back a PDF stream instead, and `getReport` in the API
 * client already handles both. Either way this payload is the content, so the two paths can
 * never drift into saying different things about the same work.
 *
 * The disclaimer travels *inside* the payload rather than being added by whatever renders it.
 * A document that leaves the building must carry the line that says what it is — an
 * AI-generated flag for human review, not a determination — and the only way to guarantee
 * that is to make it part of the content rather than part of the template.
 *
 * Every line pairs a figure with what it is measured against. "Unit cost ₹18.4 L/km" alone
 * is not evidence of anything; "₹18.4 L/km against a state benchmark of ₹4.1 L/km" is
 * something an officer can act on or dismiss on the spot.
 */

export const dynamic = 'force-dynamic';

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

  const ia = dataset.iaById.get(record.project.ia_id);
  const mpName = dataset.mpById.get(record.project.mp_id)?.mp_name ?? record.project.mp_id;
  const constituency =
    dataset.mpById.get(record.project.mp_id)?.constituency_name ?? record.project.constituency_id;

  const body: ReportResponse = {
    project_id: record.project.project_id,
    generated_at: new Date().toISOString(),
    model_version: record.risk.model_version,
    disclaimer: DISCLAIMER_TEXT,
    summary: summaryOf(record),
    sections: [
      identification(record, mpName, constituency),
      assessment(record),
      benchmark(record),
      timeline(record),
      evidence(record),
      compliance(record),
      ...duplicates(record, dataset.pairsByProject.get(projectId) ?? []),
      ...agency(ia),
      action(record),
    ],
    // Null because nothing server-side renders a PDF in the mock. The frontend's export
    // path produces the file from this payload; when the FastAPI service starts rendering
    // its own, this field carries the link and the client prefers it.
    pdf_url: null,
  };

  return json(body);
}

function summaryOf(record: ProjectRecord): string {
  const meta = riskMeta(record.risk.risk_level);
  return `${record.project.project_id} — ${record.project.work_type} in ${record.districtName}, ${record.stateName}, estimated ${formatLakhs(record.project.estimated_cost_lakhs)} — is flagged ${meta.label.toUpperCase()} for review. ${record.risk.explanation_text}`;
}

function identification(
  record: ProjectRecord,
  mpName: string,
  constituency: string,
): ReportResponse['sections'][number] {
  const p = record.project;
  const areas: string[] = [];
  if (p.is_sc_area) areas.push('SC area');
  if (p.is_st_area) areas.push('ST area');
  if (p.is_calamity) areas.push('calamity-affected');

  return {
    heading: 'Work identification',
    lines: [
      `Work ID: ${p.project_id}`,
      `Description: ${p.work_description}`,
      `Category: ${p.work_type}`,
      `Location: ${record.districtName}, ${record.stateName} (${record.locationSource === 'GPS' ? 'GPS coordinates on record' : 'district centroid — no GPS on record'})`,
      `Recommended by: ${mpName}, ${constituency} (${humanizeEnum(p.mp_house)})`,
      `Implementing agency: ${record.iaName} (${p.ia_id})`,
      `Financial year: ${p.fy}`,
      `Estimated cost: ${formatLakhs(p.estimated_cost_lakhs)}`,
      `Recommended: ${formatDate(p.recommended_date)}; sanctioned: ${formatDate(p.sanction_date)} (${humanizeEnum(p.sanction_status)})`,
      `Completion recorded: ${formatDate(p.completion_date)}`,
      areas.length > 0 ? `Special area designation: ${areas.join(', ')}` : 'Special area designation: none',
    ],
  };
}

/**
 * The scored assessment, dimension by dimension.
 *
 * Weights are printed alongside each score because a reader is entitled to know how the
 * overall figure was arrived at. A composite that cannot be taken apart is not
 * explainable, and an unexplainable flag is one no officer can defend acting on.
 */
function assessment(record: ProjectRecord): ReportResponse['sections'][number] {
  const lines = [
    `Overall: ${riskMeta(record.risk.risk_level).label.toUpperCase()} — ${formatScore(record.risk.overall_risk)} of 1.00, weighted across six dimensions.`,
    record.risk.explanation_text,
    `Scored ${formatDate(record.risk.scored_at.slice(0, 10))} by model ${record.risk.model_version}.`,
    '',
  ];

  for (const dimension of record.dimensions) {
    const meta = dimensionMeta(dimension.dimension);
    lines.push(
      `${meta.label} — ${riskMeta(dimension.severity).label} (${formatScore(dimension.score)}, weight ${pct(meta.weight)}): ${dimension.evidence}`,
    );
  }

  return { heading: 'Risk assessment', lines };
}

function benchmark(record: ProjectRecord): ReportResponse['sections'][number] {
  const b = record.benchmark;
  return {
    heading: 'Cost benchmark',
    lines: [
      `Unit cost on record: ${formatUnitCost(b.project_unit_cost, b.unit)}`,
      `Benchmark for ${b.work_type} in ${record.stateName}, ${b.fy}: ${formatUnitCost(b.benchmark_unit_cost, b.unit)}`,
      `Ratio to benchmark: ${formatRatio(b.ratio)}; standard deviations from the mean: ${formatZScore(b.z_score)}`,
      `Quantity recorded: ${record.quantity} ${b.unit}`,
      `Benchmark source: ${b.source}`,
    ],
  };
}

function timeline(record: ProjectRecord): ReportResponse['sections'][number] {
  return {
    heading: 'Timeline',
    lines: record.timeline.map((event) => {
      const date = event.date === null ? 'no date on record' : formatDate(event.date);
      const breach = event.breach === null ? '' : ` Breach: ${event.breach.text}`;
      return `${event.label} — ${humanizeEnum(event.status)} (${date}). ${event.detail}${breach}`;
    }),
  };
}

function evidence(record: ProjectRecord): ReportResponse['sections'][number] {
  const lines = record.payments.map(
    (payment) =>
      `${payment.stage} — ${formatLakhs(payment.amount_lakhs ?? 0)} paid ${formatDate(payment.paid_date)} (${pct(payment.share_of_sanctioned ?? 0)} of sanctioned; reported progress ${pct(payment.reported_progress ?? 0)}). ${payment.note}`,
  );

  lines.push('');
  lines.push(
    `Stage photographs: ${record.photos.length} of ${record.requiredPhotos} required uploaded.`,
  );
  for (const photo of record.photos) {
    lines.push(
      `${photo.stage} — uploaded ${formatDate(photo.uploaded_at)}${
        photo.similar_to_project_id === null
          ? ''
          : `; visually similar to a photograph filed under ${photo.similar_to_project_id}`
      }`,
    );
  }

  return { heading: 'Payments and photographic evidence', lines };
}

function compliance(record: ProjectRecord): ReportResponse['sections'][number] {
  return {
    heading: 'Guideline compliance',
    lines: record.ruleOutcomes.map((outcome) => {
      const verdict =
        outcome.compliant === null ? 'Not yet applicable' : outcome.compliant ? 'Met' : 'Not met';
      return `${outcome.rule_id} — ${verdict}: ${outcome.evidence}`;
    }),
  };
}

function duplicates(
  record: ProjectRecord,
  pairs: readonly DuplicatePairRow[],
): ReportResponse['sections'][number][] {
  if (pairs.length === 0) return [];

  return [
    {
      heading: 'Duplicate candidates',
      lines: [
        ...pairs.map((pair) => {
          const counterpart =
            pair.project_a.project_id === record.project.project_id
              ? pair.project_b.project_id
              : pair.project_a.project_id;
          return `Pair ${pair.pair_id}: description similarity ${formatSimilarity(pair.similarity_score)} against ${counterpart}, sites ${distanceLabel(pair.geo_distance_km)} apart (${pair.detection_method}).`;
        }),
        '',
        'Similarity indicates the two records may describe one asset. Sanctioned works are sometimes legitimately recorded in phases, so each pair requires physical verification before any conclusion is drawn.',
      ],
    },
  ];
}

function agency(ia: IAAggregate | undefined): ReportResponse['sections'][number][] {
  if (!ia) return [];

  const completionRate = ia.total_projects === 0 ? 0 : ia.completed_projects / ia.total_projects;
  const lines = [
    `${ia.ia_name} (${ia.ia_id}), ${humanizeEnum(ia.ia_type)}`,
    `Portfolio: ${worksLabel(ia.total_projects)}, of which ${ia.completed_projects} are recorded complete (${pct(completionRate)}).`,
    `Average overrun beyond the completion window across its portfolio: ${ia.avg_delay_days} days.`,
    `Concentration index across the constituencies it serves: ${ia.hhi.toFixed(2)} of a possible 1.00.`,
  ];

  if (ia.dominantMpId !== null && ia.total_projects > 0) {
    lines.push(
      `Largest single relationship: ${ia.dominantMpProjects} of ${ia.total_projects} works (${pct(ia.dominantMpProjects / ia.total_projects)}) for one member.`,
    );
  }

  return [{ heading: 'Implementing agency', lines }];
}

function action(record: ProjectRecord): ReportResponse['sections'][number] {
  const a = record.recommendedAction;
  return {
    heading: 'Recommended action',
    lines: [
      `${a.action} — refer to ${a.refer_to} (${riskMeta(a.urgency).label} urgency).`,
      a.rationale,
      '',
      DISCLAIMER_TEXT,
    ],
  };
}
