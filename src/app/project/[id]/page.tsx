'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AnonymizeToggle } from '@/components/AnonymizeToggle';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EvidenceCardGrid, CompositionBreakdown } from '@/components/EvidenceCard';
import { RiskBadge } from '@/components/RiskBadge';
import { ScoreMeter } from '@/components/ScoreMeter';
import { PageHeader } from '@/components/shell/PageHeader';
import { ErrorState, TableSkeleton, CardsSkeleton, BlockSkeleton } from '@/components/states';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { useProject, useReport } from '@/lib/api/hooks';
import { formatLakhs, formatDate, formatCount, formatScore, formatPercent, humanizeEnum, orDash } from '@/lib/format';
import { buildRiskDimensions, dimensionContribution, RISK_DIMENSION_ORDER } from '@/lib/risk';
import { DEEP_LINKS } from '@/lib/nav';
import { ExternalLinkIcon, DownloadIcon, AlertTriangleIcon } from '@/components/icons';

export default function ProjectInvestigationPage() {
  const params = useParams();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';

  const { mpLabel, constituencyLabel } = useAnonymize();
  const { data, isLoading, isError, refetch } = useProject(projectId);

  const [exportRequested, setExportRequested] = useState(false);
  const { data: reportData, isLoading: isReportLoading } = useReport(projectId, exportRequested);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-shell space-y-6 px-6 py-6">
        <CardsSkeleton count={4} />
        <BlockSkeleton height={200} />
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-shell px-6 py-12">
        <ErrorState
          title="Project not found"
          body={`Unable to retrieve audit record for project ID "${projectId}".`}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const {
    project,
    risk_score,
    implementing_agency,
    mp,
    district,
    state,
    payments,
    timeline,
    photos,
    cost_benchmark,
    comparable_projects,
    duplicate_pairs,
    recommended_action,
    has_network_relationship,
  } = data;

  const dimensions = data.risk_dimensions ?? buildRiskDimensions(risk_score);

  // Find top contributor dimension
  const topContributor = RISK_DIMENSION_ORDER.reduce((best, dim) => {
    const contribution = dimensionContribution(risk_score, dim);
    const bestContribution = dimensionContribution(risk_score, best);
    return contribution > bestContribution ? dim : best;
  }, RISK_DIMENSION_ORDER[0]);

  const handleExportPDF = () => {
    setExportRequested(true);
    if (typeof window !== 'undefined') {
      setTimeout(() => window.print(), 500);
    }
  };

  return (
    <Suspense>
      <PageHeader
        title="Project Investigation"
        description="Full evidence pack across all six risk dimensions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: project.project_id },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <AnonymizeToggle />
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isReportLoading}
              className="btn-secondary"
            >
              <DownloadIcon size={14} />
              {isReportLoading ? 'Generating…' : 'Export Report'}
            </button>
          </div>
        }
      >
        {/* Risk banner inside page header */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <RiskBadge level={risk_score.risk_level} score={risk_score.overall_risk} size="lg" />
          <span className="text-body-sm text-ink-muted">{risk_score.explanation_text}</span>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20">
        {/* Project Metadata Card */}
        <div className="panel px-5 py-4">
          <div className="space-y-1 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="tabular eyebrow rounded-control bg-gov-50 px-2 py-0.5 text-gov-700 border border-gov-200">
                {project.project_id}
              </span>
              <span className="eyebrow text-ink-muted">FY {project.fy}</span>
              <span className="eyebrow">{project.work_type}</span>
              {project.is_sc_area && (
                <span className="eyebrow rounded-control bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5">
                  SC Area
                </span>
              )}
              {project.is_st_area && (
                <span className="eyebrow rounded-control bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5">
                  ST Area
                </span>
              )}
            </div>
            <h2 className="text-section font-semibold text-ink">{project.work_description}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
            <div>
              <span className="eyebrow">Member of Parliament</span>
              <p className="mt-0.5 text-body-sm font-semibold text-ink">{mpLabel(mp)}</p>
              <p className="text-caption text-ink-muted">{constituencyLabel(mp)} ({humanizeEnum(mp.mp_house)})</p>
            </div>
            <div>
              <span className="eyebrow">Implementing Agency</span>
              <p className="mt-0.5 text-body-sm font-semibold text-ink">{implementing_agency.ia_name}</p>
              <p className="text-caption text-ink-muted">Type: {humanizeEnum(implementing_agency.ia_type)}</p>
              {has_network_relationship && (
                <Link
                  href={DEEP_LINKS.networkForIA(implementing_agency.ia_id)}
                  className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-gov-600 hover:underline"
                >
                  View in Network Graph <ExternalLinkIcon size={11} />
                </Link>
              )}
            </div>
            <div>
              <span className="eyebrow">Location</span>
              <p className="mt-0.5 text-body-sm font-semibold text-ink">
                {district.district_name}, {state.state_name}
              </p>
              <p className="tabular text-caption text-ink-muted">
                Cost: {formatLakhs(project.estimated_cost_lakhs)}
              </p>
            </div>
            <div>
              <span className="eyebrow">Status & Sanction Date</span>
              <p className="mt-0.5 text-body-sm font-semibold text-ink">{humanizeEnum(project.sanction_status)}</p>
              <p className="text-caption text-ink-muted">{project.sanction_date ? formatDate(project.sanction_date) : 'Pending'}</p>
            </div>
          </div>
        </div>

        {/* Recommended Action Banner */}
        {recommended_action && (
          <div className="panel flex items-start gap-3 border-risk-high-border bg-risk-high-surface px-4 py-3">
            <AlertTriangleIcon size={18} className="shrink-0 mt-0.5 text-risk-high-text" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body-sm font-bold text-ink">{recommended_action.action}</h3>
                <span className="eyebrow text-risk-high-text">
                  Refer to: {recommended_action.refer_to}
                </span>
              </div>
              <p className="text-caption text-ink-muted">{recommended_action.rationale}</p>
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicate_pairs.length > 0 && (
          <div className="panel flex items-center justify-between border-risk-critical-border bg-risk-critical-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangleIcon size={18} className="text-risk-critical-text" />
              <div>
                <p className="text-body-sm font-bold text-risk-critical-text">
                  Duplicate Work Flagged — {formatPercent(duplicate_pairs[0].similarity_score)} Similarity
                </p>
                <p className="text-caption text-ink-muted">{duplicate_pairs[0].note}</p>
              </div>
            </div>
            <Link href={DEEP_LINKS.duplicatePair(duplicate_pairs[0].pair_id)} className="btn-primary text-caption">
              Compare Side-by-Side
            </Link>
          </div>
        )}

        {/* Six Risk Dimension Cards */}
        <section aria-label="Risk dimension evidence">
          <div className="mb-3">
            <h2 className="text-section font-semibold text-ink">Six Risk Dimensions</h2>
            <p className="text-caption text-ink-muted">
              Every dimension score is derived from verifiable eSAKSHI data indicators.
            </p>
          </div>

          <EvidenceCardGrid
            details={dimensions}
            topContributor={topContributor}
            actions={
              has_network_relationship
                ? {
                    IA: (
                      <Link
                        href={DEEP_LINKS.networkForIA(implementing_agency.ia_id)}
                        className="inline-flex items-center gap-1 text-caption font-medium text-gov-600 hover:underline"
                      >
                        View agency concentration in Network Graph <ExternalLinkIcon size={11} />
                      </Link>
                    ),
                  }
                : undefined
            }
          />
        </section>

        {/* Composition Breakdown */}
        <CompositionBreakdown details={dimensions} overallRisk={risk_score.overall_risk} />

        {/* Cost Benchmark & Peer Comparison */}
        {cost_benchmark && (
          <section className="panel" aria-label="Cost benchmark">
            <div className="panel-header">
              <h3 className="panel-title">State Cost Benchmark Comparison</h3>
              <span className="tabular eyebrow text-risk-critical-text">
                {cost_benchmark.ratio.toFixed(1)}× benchmark (Z-score {cost_benchmark.z_score >= 0 ? '+' : ''}{cost_benchmark.z_score.toFixed(1)})
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 px-4 py-3">
              <div className="rounded-card border border-line bg-surface-sunken p-3">
                <span className="eyebrow">Project Unit Cost</span>
                <p className="tabular mt-1 text-body-sm font-semibold text-ink">₹{cost_benchmark.project_unit_cost.toFixed(1)}L/{cost_benchmark.unit}</p>
              </div>
              <div className="rounded-card border border-line bg-surface-sunken p-3">
                <span className="eyebrow">State Average ({cost_benchmark.state_id})</span>
                <p className="tabular mt-1 text-body-sm font-semibold text-ink">₹{cost_benchmark.benchmark_unit_cost.toFixed(1)}L/{cost_benchmark.unit}</p>
              </div>
              <div className="rounded-card border border-line bg-surface-sunken p-3">
                <span className="eyebrow">Source</span>
                <p className="mt-1 text-body-sm font-medium text-ink">{cost_benchmark.source}</p>
              </div>
            </div>

            {comparable_projects.length > 0 && (
              <div className="px-4 pb-4">
                <h4 className="eyebrow mb-2">Peer works in same category</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Project ID</th>
                      <th scope="col">District</th>
                      <th scope="col">Outlay</th>
                      <th scope="col">Unit Cost</th>
                      <th scope="col">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparable_projects.map((peer) => (
                      <tr key={peer.project_id}>
                        <td>
                          <Link href={`/project/${encodeURIComponent(peer.project_id)}`} className="tabular font-medium text-gov-700 hover:underline">
                            {peer.project_id}
                          </Link>
                        </td>
                        <td>{peer.district_name}</td>
                        <td className="tabular">{formatLakhs(peer.estimated_cost_lakhs)}</td>
                        <td className="tabular">{peer.unit_cost_lakhs ? `₹${peer.unit_cost_lakhs.toFixed(1)}L` : '—'}</td>
                        <td><RiskBadge level={peer.risk_level} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Timeline & Payments */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Timeline */}
          <section className="panel" aria-label="Execution timeline">
            <div className="panel-header">
              <h3 className="panel-title">Guideline Execution Timeline</h3>
            </div>
            <div className="space-y-0 px-4 py-3">
              {timeline.map((evt, idx) => (
                <div key={evt.key} className="flex items-start gap-3 pb-3">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-meta font-bold border ${
                      evt.status === 'COMPLETE' ? 'bg-risk-low-surface border-risk-low-border text-risk-low-text'
                        : evt.status === 'BREACH' || evt.status === 'OVERDUE' ? 'bg-risk-critical-surface border-risk-critical-border text-risk-critical-text'
                        : 'bg-surface-sunken border-line text-ink-muted'
                    }`}>
                      {idx + 1}
                    </div>
                    {idx < timeline.length - 1 && <div className="my-1 h-6 w-px bg-line" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm font-semibold text-ink">{evt.label}</span>
                      <span className="tabular text-caption text-ink-muted">{evt.date ? formatDate(evt.date) : '—'}</span>
                    </div>
                    {evt.detail && <p className="text-caption text-ink-muted mt-0.5">{evt.detail}</p>}
                    {evt.breach && (
                      <p className="mt-1 rounded-control bg-risk-critical-surface border border-risk-critical-border px-2 py-1 text-caption font-medium text-risk-critical-text">
                        Rule breach: {evt.breach.text}{evt.breach.days_over != null ? ` (${evt.breach.days_over} days overdue)` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Payments & Photos */}
          <section className="panel" aria-label="Payments and photos">
            <div className="panel-header">
              <h3 className="panel-title">Payment Releases & Stage Photos</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Date</th>
                  <th scope="col">Photo</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pmt, i) => (
                  <tr key={i}>
                    <td className="font-medium">{pmt.stage}</td>
                    <td className="tabular">{formatLakhs(pmt.amount_lakhs)}</td>
                    <td className="tabular">{pmt.paid_date ? formatDate(pmt.paid_date) : '—'}</td>
                    <td>
                      {pmt.photo_required ? (
                        pmt.photo_present
                          ? <span className="text-risk-low-text font-semibold">Uploaded</span>
                          : <span className="text-risk-critical-text font-semibold">Missing</span>
                      ) : (
                        <span className="text-ink-muted">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {photos.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <h4 className="eyebrow mb-2">Photo Verification Record</h4>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((ph) => (
                    <div key={ph.photo_id} className="rounded-control border border-line bg-surface-sunken p-2 text-caption">
                      <div className="flex items-center justify-between font-medium">
                        <span>{ph.stage}</span>
                        <span className="text-ink-muted">{ph.uploaded_at ? formatDate(ph.uploaded_at) : ''}</span>
                      </div>
                      {ph.similar_to_project_id && (
                        <p className="mt-1 font-semibold text-risk-critical-text">
                          Perceptual match: {ph.similar_to_project_id}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Disclaimer */}
        <DisclaimerFooter variant="panel" />
      </div>
    </Suspense>
  );
}
