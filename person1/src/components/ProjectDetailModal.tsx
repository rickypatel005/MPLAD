import React, { useState, useEffect } from 'react';
import {
  AuditLog,
  EvidenceDossier,
  PaymentTransaction,
  ProjectEntity,
  ReviewAction,
  ReviewActionType,
  UserRole,
} from '../types.ts';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  MapPin,
  Building,
  CheckCircle,
  Clock,
  Sparkles,
  Send,
  Download,
  Layers,
  History,
  Copy,
  Scale,
  Terminal,
} from 'lucide-react';

interface ProjectDetailModalProps {
  projectId: string | null;
  onClose: () => void;
  activeRole: UserRole;
  onReviewSubmitted?: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  projectId,
  onClose,
  activeRole,
  onReviewSubmitted,
}) => {
  const [dossier, setDossier] = useState<EvidenceDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'risk' | 'evidence' | 'ai' | 'review' | 'audit'>('overview');
  
  // Review form state
  const [actionType, setActionType] = useState<ReviewActionType>('INVESTIGATE');
  const [reviewerComment, setReviewerComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const fetchDossier = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/evidence/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setDossier(data);
        }
      } catch (err) {
        console.error('Failed to load project dossier:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDossier();
    setAiAnalysis(null);
    setReviewMessage(null);
    setReviewerComment('');
  }, [projectId]);

  if (!projectId) return null;

  const p = dossier?.project_summary;

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setSubmittingReview(true);
    setReviewMessage(null);

    try {
      const res = await fetch('/api/review/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          action: actionType,
          reviewer_id: `USR-${activeRole}-01`,
          reviewer_name: `Officer (${activeRole})`,
          reviewer_role: activeRole,
          comment: reviewerComment || `Review action ${actionType} recorded by ${activeRole}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReviewMessage(`Decision '${actionType}' recorded in audit log.`);
        // Reload dossier to show updated reviews & audit log
        const refreshRes = await fetch(`/api/evidence/${projectId}`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setDossier(refreshData);
        }
        if (onReviewSubmitted) onReviewSubmitted();
      }
    } catch (err) {
      console.error('Review submit failed:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleRunAiAudit = async () => {
    if (!projectId) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });
      const data = await res.json();
      if (data.analysis_text) {
        setAiAnalysis(data.analysis_text);
      } else if (data.summary) {
        setAiAnalysis(data.summary);
      }
    } catch (err) {
      console.error('AI analysis request failed:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#0A0A0B] border border-[#262626] rounded w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-3.5 bg-[#0E0E0F] border-b border-[#262626] flex items-start justify-between gap-4 font-mono">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-blue-400">{projectId}</span>
              <span className="text-[#555]">•</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-[#1A1A1C] text-[#A1A1AA] border border-[#262626]">
                {p?.category || 'Civic Infrastructure'}
              </span>
              {p?.risk_score && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    p.risk_score.risk_level === 'CRITICAL'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : p.risk_score.risk_level === 'HIGH'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  RISK: {p.risk_score.risk_level} ({p.risk_score.overall_score})
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-white mt-1 font-sans">{p?.project_name || 'Loading project dossier...'}</h2>
            <p className="text-[11px] text-[#A1A1AA] mt-0.5 font-sans">
              {p?.constituency_name}, {p?.state_name} • MP: {p?.mp_name} • Agency: {p?.ia_name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1C] border border-[#262626] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-[#0A0A0B] border-b border-[#262626] px-3.5 flex overflow-x-auto no-scrollbar gap-1 font-mono text-[10px]">
          {[
            { id: 'overview', label: 'OVERVIEW & FINANCIALS', icon: FileText },
            { id: 'payments', label: `DISBURSEMENTS (${p?.payments?.length || 0})`, icon: DollarSign },
            { id: 'risk', label: 'RISK VECTOR & FLAGS', icon: ShieldAlert },
            { id: 'evidence', label: `EVIDENCE PACK (${dossier?.evidence_items?.length || 0})`, icon: Scale },
            { id: 'ai', label: 'AI FORENSIC AUDITOR', icon: Sparkles },
            { id: 'review', label: 'HUMAN REVIEW DECISION', icon: CheckCircle },
            { id: 'audit', label: `AUDIT TRAIL (${dossier?.audit_chronology?.length || 0})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 py-2 px-2.5 font-bold border-b-2 transition whitespace-nowrap uppercase tracking-tighter ${
                  isActive
                    ? 'border-white text-white bg-[#141416]'
                    : 'border-transparent text-[#666] hover:text-[#A1A1AA]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs text-[#E0E0E0] space-y-4 bg-[#0E0E0F]">
          {loading ? (
            <div className="p-12 text-center text-[#666] font-mono text-xs">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mx-auto mb-2.5"></div>
              FETCHING_DOSSIER_RECORDS...
            </div>
          ) : !p ? (
            <div className="text-center p-8 text-[#666] font-mono text-xs">PROJECT_NOT_FOUND</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & FINANCIALS */}
              {activeTab === 'overview' && (
                <div className="space-y-3 font-mono">
                  {/* Financial & Progress Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="bg-[#050505] p-3 rounded border border-[#262626]">
                      <span className="text-[10px] text-[#666] uppercase">SANCTIONED_BUDGET</span>
                      <div className="text-base font-bold text-white mt-0.5">
                        ₹{p.sanction_amount.toLocaleString('en-IN')}
                      </div>
                      <span className="text-[9px] text-[#555]">₹{(p.sanction_amount / 100000).toFixed(1)} LAKHS</span>
                    </div>

                    <div className="bg-[#050505] p-3 rounded border border-[#262626]">
                      <span className="text-[10px] text-[#666] uppercase">FINANCIAL_UTILIZATION</span>
                      <div className="text-base font-bold text-blue-400 mt-0.5">
                        {p.financial_progress}% PAID
                      </div>
                      <span className="text-[9px] text-[#555]">
                        ₹{((p.sanction_amount * p.financial_progress) / 100).toLocaleString('en-IN')} DISBURSED
                      </span>
                    </div>

                    <div className="bg-[#050505] p-3 rounded border border-[#262626]">
                      <span className="text-[10px] text-[#666] uppercase">GROUND_PROGRESS</span>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">
                        {p.physical_progress}% BUILT
                      </div>
                      <span className="text-[9px] text-[#555]">STATUS: {p.status}</span>
                    </div>
                  </div>

                  {/* Physical vs Financial Progress Gap Alert */}
                  {p.financial_progress - p.physical_progress > 20 && (
                    <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 font-sans">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-rose-400 font-mono">
                          CRITICAL_PAYMENT_PROGRESS_GAP_DETECTED
                        </div>
                        <p className="text-[11px] text-rose-200 mt-0.5">
                          Financial disbursement ({p.financial_progress}%) exceeds physical ground completion ({p.physical_progress}%) by +{p.financial_progress - p.physical_progress} percentage points. Potential unauthorized advance release or unrecorded works.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Project Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="bg-[#050505] p-3 rounded border border-[#262626] space-y-1.5">
                      <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block mb-1">
                        ADMINISTRATIVE_LINEAGE
                      </span>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">STATE / UT:</span>
                        <span className="text-white font-sans">{p.state_name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">CONSTITUENCY:</span>
                        <span className="text-white font-sans">{p.constituency_name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">HON'BLE MP:</span>
                        <span className="text-white font-sans">{p.mp_name}</span>
                      </div>
                      <div className="flex justify-between py-1 text-[11px]">
                        <span className="text-[#666]">AGENCY:</span>
                        <span className="text-white font-sans truncate max-w-[200px]">{p.ia_name}</span>
                      </div>
                    </div>

                    <div className="bg-[#050505] p-3 rounded border border-[#262626] space-y-1.5">
                      <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block mb-1">
                        TIMELINE_&_PROVENANCE
                      </span>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">SANCTION_DATE:</span>
                        <span className="text-white">{p.sanction_date}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">TARGET_DATE:</span>
                        <span className="text-white">{p.expected_completion_date}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#1A1A1C] text-[11px]">
                        <span className="text-[#666]">SOURCE:</span>
                        <span className="text-blue-400">{p.record_source} (SEED: {p.synthetic_seed})</span>
                      </div>
                      <div className="flex justify-between py-1 text-[11px]">
                        <span className="text-[#666]">COORDINATES:</span>
                        <span className="text-emerald-400">
                          {p.location.latitude}° N, {p.location.longitude}° E
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Full Description */}
                  <div className="bg-[#050505] p-3 rounded border border-[#262626]">
                    <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block mb-1">
                      OFFICIAL_SCOPE_DESCRIPTION
                    </span>
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">{p.description}</p>
                  </div>
                </div>
              )}

              {/* TAB 2: PAYMENTS */}
              {activeTab === 'payments' && (
                <div className="space-y-3 font-mono">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest">
                      DISBURSEMENT_LEDGER
                    </span>
                    <span className="text-[#A1A1AA]">
                      TOTAL_DISBURSED: ₹{((p.sanction_amount * p.financial_progress) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {(!p.payments || p.payments.length === 0) ? (
                    <div className="p-6 text-center bg-[#050505] rounded border border-[#262626] text-[#666]">
                      NO_PAYMENTS_RECORDED
                    </div>
                  ) : (
                    <div className="bg-[#050505] rounded border border-[#262626] overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#111112] text-[#A1A1AA] uppercase tracking-wider text-[9px] border-b border-[#262626]">
                          <tr>
                            <th className="py-2 px-3">VOUCHER_NO</th>
                            <th className="py-2 px-3">DATE</th>
                            <th className="py-2 px-3">TRANCHE_DESCRIPTION</th>
                            <th className="py-2 px-3">AMOUNT</th>
                            <th className="py-2 px-3">CUMULATIVE</th>
                            <th className="py-2 px-3">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A1C] text-[11px]">
                          {p.payments.map((pay) => (
                            <tr key={pay.payment_id} className="hover:bg-[#141416]">
                              <td className="py-2 px-3 font-bold text-blue-400">{pay.voucher_no}</td>
                              <td className="py-2 px-3 text-[#A1A1AA]">{pay.payment_date}</td>
                              <td className="py-2 px-3 font-sans text-white">{pay.milestone_description}</td>
                              <td className="py-2 px-3 text-emerald-400 font-bold">
                                ₹{pay.payment_amount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-white">
                                ₹{pay.cumulative_payment.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 font-sans">
                                {pay.payment_status === 'FLAGGED' ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                    FLAGGED
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-[#1A1A1C] text-[#A1A1AA] border border-[#262626]">
                                    CLEARED
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: RISK VECTOR & FLAGS */}
              {activeTab === 'risk' && (
                <div className="space-y-3 font-mono">
                  {/* Dimension Scores */}
                  {p.risk_score && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { label: 'FINANCIAL', val: p.risk_score.financial_score, weight: '35%' },
                        { label: 'TIMELINE', val: p.risk_score.timeline_score, weight: '20%' },
                        { label: 'IA_CAPTURE', val: p.risk_score.ia_score, weight: '15%' },
                        { label: 'COMPLIANCE', val: p.risk_score.compliance_score, weight: '15%' },
                        { label: 'GEO_OVERLAP', val: p.risk_score.geo_score, weight: '10%' },
                        { label: 'EVIDENCE', val: p.risk_score.evidence_score, weight: '5%' },
                      ].map((dim, idx) => (
                        <div key={idx} className="bg-[#050505] p-2.5 rounded border border-[#262626] text-center">
                          <span className="text-[9px] text-[#666] uppercase">{dim.label}</span>
                          <div
                            className={`text-base font-bold mt-0.5 ${
                              dim.val >= 0.7 ? 'text-rose-400' : dim.val >= 0.4 ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {dim.val.toFixed(2)}
                          </div>
                          <span className="text-[8px] text-[#555]">WT: {dim.weight}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Triggered Flags */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">
                      TRIGGERED_ANOMALY_FLAGS ({p.flags?.length || 0})
                    </span>

                    {(!p.flags || p.flags.length === 0) ? (
                      <div className="p-3 rounded bg-[#050505] border border-[#262626] text-[#666]">
                        NO_RISK_FLAGS_TRIGGERED
                      </div>
                    ) : (
                      p.flags.map((flg) => (
                        <div
                          key={flg.flag_id}
                          className="p-3 rounded bg-[#050505] border border-[#262626] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.2 rounded font-bold text-[9px] bg-[#1A1A1C] text-blue-400 border border-[#262626]">
                                {flg.rule_code}
                              </span>
                              <span className="font-bold text-white text-[11px] font-sans">{flg.flag_type}</span>
                            </div>
                            <span
                              className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                                flg.severity === 'CRITICAL'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {flg.severity}
                            </span>
                          </div>
                          <p className="text-[#A1A1AA] text-[11px] font-sans">{flg.message}</p>
                          <pre className="p-2 bg-[#0A0A0B] rounded font-mono text-[9px] text-[#888] overflow-x-auto border border-[#1A1A1C]">
                            {JSON.stringify(flg.evidence_json, null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: EVIDENCE & INFRACTIONS */}
              {activeTab === 'evidence' && (
                <div className="space-y-3 font-mono">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">
                    STRUCTURED_EVIDENCE_DOSSIER
                  </span>

                  {dossier?.evidence_items.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded bg-[#050505] border border-[#262626] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs font-sans">{ev.title}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            ev.severity === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : ev.severity === 'ALERT'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-[#1A1A1C] text-[#A1A1AA] border border-[#262626]'
                          }`}
                        >
                          {ev.severity}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] p-2 bg-[#0A0A0B] rounded border border-[#1A1A1C]">
                        <div>
                          <span className="text-[#666] block uppercase">OBSERVED:</span>
                          <span className="font-bold text-blue-400">{ev.observed_value}</span>
                        </div>
                        <div>
                          <span className="text-[#666] block uppercase">BENCHMARK:</span>
                          <span className="text-[#E0E0E0]">{ev.benchmark_value}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#A1A1AA] font-sans">{ev.delta_description}</p>
                    </div>
                  ))}

                  {/* Regulatory Infractions */}
                  {dossier?.regulatory_infractions && dossier.regulatory_infractions.length > 0 && (
                    <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 space-y-1 font-sans">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest font-mono block">
                        POTENTIAL_GFR_&_MANDATE_INFRACTIONS
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-200">
                        {dossier.regulatory_infractions.map((inf, i) => (
                          <li key={i}>{inf}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: AI FORENSIC AUDITOR (GEMINI) */}
              {activeTab === 'ai' && (
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">
                        GEMINI_AI_FORENSIC_AGENT
                      </span>
                      <p className="text-[11px] text-[#A1A1AA] font-sans">
                        Real-time statutory analysis & vigilance inquiry synthesis
                      </p>
                    </div>

                    <button
                      onClick={handleRunAiAudit}
                      disabled={loadingAi}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded text-xs font-bold uppercase tracking-tighter transition disabled:opacity-50"
                    >
                      <Sparkles className={`w-3 h-3 ${loadingAi ? 'animate-spin' : ''}`} />
                      {loadingAi ? 'SYNTHESIZING...' : 'EXECUTE_AI_AUDIT'}
                    </button>
                  </div>

                  {aiAnalysis ? (
                    <div className="p-3.5 rounded bg-[#050505] border border-[#262626] space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs border-b border-[#1A1A1C] pb-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        AI_FORENSIC_INVESTIGATION_BRIEF
                      </div>
                      <div className="text-[#E0E0E0] leading-relaxed text-xs whitespace-pre-wrap font-sans">
                        {aiAnalysis}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-[#050505] rounded border border-[#262626] text-[#666] space-y-2">
                      <Sparkles className="w-6 h-6 text-blue-400 mx-auto" />
                      <p className="text-xs">Click "EXECUTE_AI_AUDIT" to generate instant Gemini forensic insights.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: HUMAN REVIEW CONSOLE */}
              {activeTab === 'review' && (
                <div className="space-y-3 font-mono">
                  {/* Current Status */}
                  <div className="bg-[#050505] p-3 rounded border border-[#262626] flex items-center justify-between">
                    <div>
                      <span className="text-[#666] text-[10px] uppercase block">CURRENT_GOVERNANCE_STATUS:</span>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {p.review_status === 'UNREVIEWED' ? 'PENDING_AUDITOR_ACTION' : p.review_status}
                      </div>
                    </div>
                    <span className="text-[10px] text-[#888]">
                      REVIEWS_REGISTERED: {dossier?.review_decisions.length || 0}
                    </span>
                  </div>

                  {/* Submission Form */}
                  <form onSubmit={handleReviewSubmit} className="bg-[#050505] p-3.5 rounded border border-[#262626] space-y-3">
                    <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">
                      SUBMIT_OFFICER_GOVERNANCE_DECISION
                    </span>

                    {reviewMessage && (
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-xs">
                        {reviewMessage}
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] text-[#A1A1AA] uppercase font-bold mb-1">
                        ACTION_CODE
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(['INVESTIGATE', 'ESCALATE', 'ACKNOWLEDGE', 'DISMISS'] as ReviewActionType[]).map((act) => (
                          <button
                            type="button"
                            key={act}
                            onClick={() => setActionType(act)}
                            className={`py-1.5 px-2 rounded text-[10px] font-bold border transition ${
                              actionType === act
                                ? 'bg-white text-black border-white'
                                : 'bg-[#0A0A0B] border-[#262626] text-[#A1A1AA] hover:text-white'
                            }`}
                          >
                            {act}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#A1A1AA] uppercase font-bold mb-1 font-mono">
                        VIGILANCE_NOTES
                      </label>
                      <textarea
                        rows={3}
                        value={reviewerComment}
                        onChange={(e) => setReviewerComment(e.target.value)}
                        placeholder="Enter justification, statutory orders, or directive..."
                        className="w-full bg-[#0A0A0B] border border-[#262626] rounded p-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-emerald-500 font-sans"
                        required
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase tracking-tighter rounded text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" />
                      {submittingReview ? 'RECORDING...' : 'COMMIT_AUDIT_DECISION'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 7: AUDIT CHRONOLOGY */}
              {activeTab === 'audit' && (
                <div className="space-y-3 font-mono">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">
                    IMMUTABLE_AUDIT_LOG_CHRONOLOGY
                  </span>

                  {(!dossier?.audit_chronology || dossier.audit_chronology.length === 0) ? (
                    <div className="p-6 text-center bg-[#050505] rounded border border-[#262626] text-[#666]">
                      NO_AUDIT_RECORDS
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dossier.audit_chronology.map((aud) => (
                        <div
                          key={aud.audit_id}
                          className="p-2.5 rounded bg-[#050505] border border-[#262626] flex items-start gap-2.5"
                        >
                          <div className="p-1 rounded bg-[#0A0A0B] border border-[#262626] text-blue-400 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 space-y-0.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{aud.action}</span>
                              <span className="text-[10px] text-[#666]">{aud.created_at}</span>
                            </div>
                            <div className="text-[10px] text-blue-400">
                              ACTOR: {aud.actor_name} ({aud.actor_id})
                            </div>
                            <pre className="p-1.5 bg-[#0A0A0B] rounded text-[9px] text-[#888] overflow-x-auto mt-1 border border-[#1A1A1C]">
                              {JSON.stringify(aud.payload_json, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0E0E0F] border-t border-[#262626] flex items-center justify-between text-xs font-mono">
          <span className="text-[#666] text-[10px]">DOSSIER_VER_2.6 • MoSPI_COMPLIANCE_MODE</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-[#1A1A1C] hover:bg-[#262626] text-white border border-[#262626] rounded transition font-bold uppercase tracking-tighter text-[10px]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
