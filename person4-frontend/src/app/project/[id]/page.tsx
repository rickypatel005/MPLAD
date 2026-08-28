'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { AnonymizeToggle } from '@/components/AnonymizeToggle';
import { DisclaimerFooter } from '@/components/DisclaimerFooter';
import { EvidenceCardGrid, CompositionBreakdown } from '@/components/EvidenceCard';
import { RiskBadge } from '@/components/RiskBadge';
import { ScoreMeter } from '@/components/ScoreMeter';
import { PageHeader } from '@/components/shell/PageHeader';
import { ErrorState, TableSkeleton, CardsSkeleton, BlockSkeleton } from '@/components/states';
import { useAnonymize } from '@/components/providers/AnonymizeProvider';
import { useProject, useReport } from '@/lib/api/hooks';
import { apiPost } from '@/lib/api/client';
import { formatLakhs, formatDate, formatCount, formatScore, formatPercent, humanizeEnum, orDash } from '@/lib/format';
import { buildRiskDimensions, dimensionContribution, RISK_DIMENSION_ORDER } from '@/lib/risk';
import { DEEP_LINKS } from '@/lib/nav';
import { ExternalLinkIcon, DownloadIcon, AlertTriangleIcon, CheckIcon, RefreshIcon } from '@/components/icons';

export default function ProjectInvestigationPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';

  const { mpLabel, constituencyLabel } = useAnonymize();
  const { data, isLoading, isError, refetch } = useProject(projectId);

  // Review action interactive state
  const [selectedAction, setSelectedAction] = useState<'ACKNOWLEDGE' | 'INVESTIGATE' | 'ESCALATE' | 'DISMISS' | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ success: boolean; message: string } | null>(null);

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
  const auditLogs = (data as any).audit_trail || (data as any).audit_logs || [];
  const reviewActions = (data as any).review_actions || [];

  // Find top contributor dimension
  const topContributor = RISK_DIMENSION_ORDER.reduce((best, dim) => {
    const contribution = dimensionContribution(risk_score, dim);
    const bestContribution = dimensionContribution(risk_score, best);
    return contribution > bestContribution ? dim : best;
  }, RISK_DIMENSION_ORDER[0]);

  const handleReviewActionSubmit = async (action: 'ACKNOWLEDGE' | 'INVESTIGATE' | 'ESCALATE' | 'DISMISS') => {
    setIsSubmitting(true);
    setActionFeedback(null);
    try {
      await apiPost('/review/action', {
        project_id: project.project_id,
        action,
        comment: actionComment || `Action ${action} initiated from Project Investigation HUD`,
        reviewer_name: 'Senior Vigilance Officer',
        reviewer_role: 'AUDITOR',
      });
      setActionFeedback({
        success: true,
        message: `Decision '${action}' recorded in central audit trail.`,
      });
      setSelectedAction(null);
      setActionComment('');
      // Refresh project payload live
      await refetch();
    } catch (err: any) {
      setActionFeedback({
        success: false,
        message: err?.message || `Failed to submit review action '${action}'.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Suspense>
      <PageHeader
        title="Project Investigation"
        description="Full evidence pack across all six risk dimensions with human auditor review actions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: project.project_id },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <AnonymizeToggle />
            <Link
              href={`/report/${encodeURIComponent(project.project_id)}`}
              className="btn-secondary flex items-center gap-1.5"
            >
              <DownloadIcon size={14} />
              Formal Audit Report
            </Link>
          </div>
        }
      >
        {/* Risk banner inside page header */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <RiskBadge level={risk_score.risk_level} score={risk_score.overall_risk} size="lg" />
          <span className="text-body-sm text-ink-muted">{risk_score.explanation_text}</span>
        </div>
      </PageHeader>

      <div className="mx-auto max-w-shell space-y-6 px-6 py-6 pb-20 font-sans">
        {/* Auditor Review Actions Panel */}
        <div className="panel p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md border-0 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Auditor Governance Action
              </span>
              <h3 className="text-base font-bold text-white font-sans mt-0.5">
                Record Regulatory Decision for {project.project_id}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleReviewActionSubmit('ACKNOWLEDGE')}
                disabled={isSubmitting}
                className="rounded-lg bg-slate-700/80 hover:bg-slate-700 text-white px-3.5 py-1.5 text-xs font-semibold border border-slate-600 transition-all"
              >
                Acknowledge
              </button>
              <button
                type="button"
                onClick={() => handleReviewActionSubmit('INVESTIGATE')}
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all"
              >
                Investigate
              </button>
              <button
                type="button"
                onClick={() => handleReviewActionSubmit('ESCALATE')}
                disabled={isSubmitting}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all"
              >
                Escalate
              </button>
              <button
                type="button"
                onClick={() => handleReviewActionSubmit('DISMISS')}
                disabled={isSubmitting}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-1.5 text-xs font-semibold border border-slate-700 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Feedback or Active Comment Input */}
          <div className="mt-3 flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              placeholder="Optional auditor note or inspection reference (e.g., 'Deputing District Vigilance Officer')..."
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              className="flex-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
            {actionFeedback && (
              <div className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                actionFeedback.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                <span>{actionFeedback.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Project Metadata Card */}
        <div className="panel p-6 bg-white shadow-sm">
          <div className="space-y-2 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300">
                {project.project_id}
              </span>
              <span className="eyebrow text-slate-500">FY {project.fy}</span>
              <span className="eyebrow text-slate-700 font-bold">{project.work_type}</span>
              {project.is_sc_area && (
                <span className="eyebrow rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5">
                  SC Area
                </span>
              )}
              {project.is_st_area && (
                <span className="eyebrow rounded-full bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5">
                  ST Area
                </span>
              )}
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 leading-snug">{project.work_description}</h2>
          </div>

          <div className="grid grid-cols-2 gap-5 border-t border-slate-200 pt-5 sm:grid-cols-4 font-sans">
            <div>
              <span className="eyebrow">Member of Parliament</span>
              <p className="mt-1 text-sm font-bold text-slate-900">{mpLabel(mp)}</p>
              <p className="text-xs text-slate-500 font-medium">{constituencyLabel(mp)} ({humanizeEnum(mp.mp_house)})</p>
            </div>
            <div>
              <span className="eyebrow">Implementing Agency</span>
              <p className="mt-1 text-sm font-bold text-slate-900">{implementing_agency.ia_name}</p>
              <p className="text-xs text-slate-500 font-medium">Type: {humanizeEnum(implementing_agency.ia_type)}</p>
              {has_network_relationship && (
                <Link
                  href={DEEP_LINKS.networkForIA(implementing_agency.ia_id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
                >
                  View in Network Graph <ExternalLinkIcon size={12} />
                </Link>
              )}
            </div>
            <div>
              <span className="eyebrow">Location & Cost</span>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {district.district_name}, {state.state_name}
              </p>
              <p className="font-mono text-xs font-semibold text-slate-600">
                Outlay: {formatLakhs(project.estimated_cost_lakhs)}
              </p>
            </div>
            <div>
              <span className="eyebrow">Status & Sanction Date</span>
              <p className="mt-1 text-sm font-bold text-slate-900">{humanizeEnum(project.sanction_status)}</p>
              <p className="text-xs text-slate-500 font-medium">{project.sanction_date ? formatDate(project.sanction_date) : 'Pending'}</p>
            </div>
          </div>
        </div>

        {/* Recommended Action Banner */}
        {recommended_action && (
          <div className="panel flex items-start gap-3.5 border-amber-300 bg-amber-50/90 p-4 shadow-sm">
            <AlertTriangleIcon size={20} className="shrink-0 mt-0.5 text-amber-700" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-amber-950 font-sans">{recommended_action.action}</h3>
                <span className="eyebrow text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-400">
                  Refer to: {recommended_action.refer_to}
                </span>
              </div>
              <p className="text-xs font-medium text-amber-900/90 mt-1 leading-relaxed">{recommended_action.rationale}</p>
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicate_pairs.length > 0 && (
          <div className="panel flex items-center justify-between border-red-300 bg-red-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangleIcon size={20} className="text-red-700 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-900 font-sans">
                  Duplicate Work Flagged &mdash; {formatPercent(duplicate_pairs[0].similarity_score)} Similarity
                </p>
                <p className="text-xs font-medium text-red-800/90 mt-0.5">{duplicate_pairs[0].note}</p>
              </div>
            </div>
            <Link href={DEEP_LINKS.duplicatePair(duplicate_pairs[0].pair_id)} className="btn-primary h-9 text-xs">
              Compare Side-by-Side
            </Link>
          </div>
        )}

        {/* Six Risk Dimension Cards */}
        <section aria-label="Risk dimension evidence">
          <div className="mb-3">
            <h2 className="text-section font-semibold text-ink">Six Risk Dimensions</h2>
            <p className="text-caption text-ink-muted">
              Every dimension score is derived from verifiable eSAKSHI data indicators, ML anomaly signals, and geospatial verification.
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

        {/* Audit Log & Governance Trail */}
        {auditLogs.length > 0 && (
          <section className="panel" aria-label="Audit history">
            <div className="panel-header">
              <h3 className="panel-title">Audit Trail & Governance History</h3>
              <span className="eyebrow text-slate-500">{auditLogs.length} Events Logged</span>
            </div>
            <div className="divide-y divide-slate-100 px-5 py-2">
              {auditLogs.map((log: any, i: number) => (
                <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{log.action_type || log.event_type}</span>
                    <span className="text-slate-500 ml-2 font-medium">by {log.actor_name || log.performed_by}</span>
                    {log.notes && <p className="text-slate-600 mt-0.5">{log.notes}</p>}
                  </div>
                  <span className="font-mono text-slate-400 text-[11px]">{formatDate(log.timestamp || log.created_at)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <DisclaimerFooter variant="panel" />
      </div>
    </Suspense>
  );
}
