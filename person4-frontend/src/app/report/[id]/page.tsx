'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { useProject, useReport } from '@/lib/api/hooks';
import { RiskBadge } from '@/components/RiskBadge';
import { ScoreMeter } from '@/components/ScoreMeter';
import { ErrorState, BlockSkeleton } from '@/components/states';
import { formatLakhs, formatDate, formatPercent, humanizeEnum } from '@/lib/format';
import { DownloadIcon } from '@/components/icons';

function ReportContent() {
  const params = useParams();
  const projectId = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';

  const { data: projectData, isLoading: isProjectLoading, isError: isProjectError, refetch } = useProject(projectId);
  const { data: reportData, isLoading: isReportLoading } = useReport(projectId, true);

  if (isProjectLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-12">
        <BlockSkeleton height={120} />
        <BlockSkeleton height={300} />
        <BlockSkeleton height={200} />
      </div>
    );
  }

  if (isProjectError || !projectData) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <ErrorState
          title="Report Generation Failed"
          body={`Unable to load audit report dossier for Project ID "${projectId}".`}
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
    cost_benchmark,
    duplicate_pairs,
    recommended_action,
  } = projectData;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 py-8 px-4 sm:px-6 print:bg-white print:p-0">
      {/* Top Action Bar (hidden when printing) */}
      <div className="mx-auto max-w-4xl mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/project/${encodeURIComponent(project.project_id)}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm"
        >
          ← Back to Investigation
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <DownloadIcon size={14} /> Print / Save as PDF
          </button>
        </div>
      </div>


      {/* Formal Audit Document Container */}
      <div className="mx-auto max-w-4xl bg-white border border-slate-200 shadow-lg rounded-xl p-8 sm:p-12 print:border-0 print:shadow-none print:p-0 print:rounded-none font-serif text-slate-900">
        {/* Document Header */}
        <header className="border-b-2 border-slate-900 pb-6 mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-600 font-sans">
              <span>Government of India</span>
              <span>•</span>
              <span>Ministry of Statistics & Programme Implementation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 mt-1">
              MPLADS Vigilance & Risk Audit Dossier
            </h1>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Automated Forensic Intelligence Assessment — Project {project.project_id}
            </p>
          </div>
          <div className="text-right sm:text-right font-sans text-xs">
            <span className="font-bold block text-slate-800">CONFIDENTIAL / AUDIT USE</span>
            <span className="text-slate-500 block">Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
            <span className="font-mono text-[11px] text-slate-400 block">Model: {reportData?.model_version || 'HEURISTIC_BASELINE_V1'}</span>
          </div>
        </header>

        {/* Executive Risk Summary */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-sans mb-3">
            1. Executive Assessment
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col sm:flex-row items-center justify-between gap-6 font-sans">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-3">
                <RiskBadge level={risk_score.risk_level} score={risk_score.overall_risk} size="lg" />
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Overall Composite Risk Rating
                </span>
              </div>
              <p className="text-sm text-slate-800 font-serif leading-relaxed">
                {reportData?.summary || `${project.work_description} exhibits an overall risk score of ${(risk_score.overall_risk * 100).toFixed(0)}% categorized under ${risk_score.risk_level} priority.`}
              </p>
            </div>
            {recommended_action && (
              <div className="bg-amber-100/70 border border-amber-300 rounded-lg p-3.5 sm:max-w-[280px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  Mandated Action
                </span>
                <p className="text-xs font-bold text-amber-950 mt-0.5">{recommended_action.action}</p>
                <p className="text-[11px] text-amber-900 mt-1">
                  Referral: <span className="font-semibold">{recommended_action.refer_to}</span> ({recommended_action.urgency})
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Project Metadata Table */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-sans mb-3">
            2. Project Information & Administrative Profile
          </h2>
          <table className="w-full border-collapse border border-slate-300 font-sans text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="w-1/4 bg-slate-50 p-2.5 font-bold text-slate-700">Project Identifier</td>
                <td className="w-1/4 p-2.5 font-mono font-bold text-slate-900">{project.project_id}</td>
                <td className="w-1/4 bg-slate-50 p-2.5 font-bold text-slate-700">Financial Year</td>
                <td className="w-1/4 p-2.5 font-semibold text-slate-900">FY {project.fy}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Work Category</td>
                <td className="p-2.5 text-slate-900">{project.work_type}</td>
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Sanctioned Outlay</td>
                <td className="p-2.5 font-bold text-slate-900">{formatLakhs(project.estimated_cost_lakhs)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Member of Parliament</td>
                <td className="p-2.5 font-bold text-slate-900">{mp.mp_name} ({mp.constituency_name})</td>
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">District & State</td>
                <td className="p-2.5 text-slate-900">{district.district_name}, {state.state_name}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Implementing Agency</td>
                <td className="p-2.5 font-semibold text-slate-900">{implementing_agency.ia_name}</td>
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Current Status</td>
                <td className="p-2.5 font-bold text-slate-900">{humanizeEnum(project.sanction_status)}</td>
              </tr>
              <tr>
                <td className="bg-slate-50 p-2.5 font-bold text-slate-700">Work Description</td>
                <td colSpan={3} className="p-2.5 text-slate-800 leading-relaxed font-serif text-sm">
                  {project.work_description}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Six-Dimensional Risk Matrix */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-sans mb-3">
            3. Six-Dimensional Risk Breakdown
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-sans">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">1. Financial Risk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.financial_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 25%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.financial_risk * 100}%` }} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">2. Timeline Risk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.timeline_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 20%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.timeline_risk * 100}%` }} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">3. Compliance Risk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.compliance_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 20%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.compliance_risk * 100}%` }} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">4. IA Concentration</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.ia_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 20%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.ia_risk * 100}%` }} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">5. Geospatial Risk</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.geo_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 10%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.geo_risk * 100}%` }} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase">6. Evidence Integrity</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-slate-900">{(risk_score.evidence_risk * 100).toFixed(0)}%</span>
                <span className="text-xs text-slate-500">Weight 5%</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
                <div className="bg-slate-800 h-full" style={{ width: `${risk_score.evidence_risk * 100}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* Identified Anomaly Factors */}
        <section className="mb-8 font-sans">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
            4. Key Findings & Detected Anomalies
          </h2>
          <div className="space-y-2">
            {risk_score.top_risk_factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/40 text-xs">
                <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                  {f.dimension}
                </span>
                <span className="text-slate-800 font-medium flex-1">{f.text}</span>
              </div>
            ))}
            {duplicate_pairs.length > 0 && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-red-200 bg-red-50/40 text-xs text-red-900">
                <span className="font-bold bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-300">
                  DUPLICATE
                </span>
                <span className="font-medium flex-1">{duplicate_pairs[0].note}</span>
              </div>
            )}
          </div>
        </section>

        {/* Auditor Sign-off Area */}
        <section className="border-t-2 border-slate-900 pt-8 mt-12 font-sans">
          <div className="grid grid-cols-2 gap-8 text-xs text-slate-700">
            <div>
              <span className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Auditor Verification & Endorsement
              </span>
              <p className="text-slate-800 mt-6 pt-2 border-t border-slate-300 inline-block w-48 font-semibold">
                Signature / Seal
              </p>
              <p className="text-[11px] text-slate-500">Designation: Senior Vigilance Auditor</p>
            </div>
            <div className="text-right">
              <span className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Statutory Notice
              </span>
              <p className="text-[10px] text-slate-500 leading-normal max-w-xs ml-auto">
                Generated via MPLADS Audit AI (SIH26102). This analytical summary serves as decision support for statutory vigilance proceedings.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading audit report…</div>}>
      <ReportContent />
    </Suspense>
  );
}
