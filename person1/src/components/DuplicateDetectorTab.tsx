import React, { useState } from 'react';
import { Copy, MapPin, Calendar, Building2, CheckCircle, AlertTriangle, ArrowRight, ExternalLink, Terminal } from 'lucide-react';

interface DuplicateDetectorTabProps {
  onSelectProject: (projectId: string) => void;
}

export const DuplicateDetectorTab: React.FC<DuplicateDetectorTabProps> = ({ onSelectProject }) => {
  const [selectedCluster, setSelectedCluster] = useState<string>('DUP-CLUST-001');

  const clusters = [
    {
      cluster_id: 'DUP-CLUST-001',
      title: 'Multipurpose Community Hall at Rampur Ward 4',
      state: 'Uttar Pradesh (Varanasi)',
      similarity: 0.94,
      total_suspect_amount: 9600000,
      projA: {
        id: 'P10701',
        name: 'Construction of community welfare hall at Rampur Ward 4',
        description: 'Construction of multipurpose community hall and stage at Rampur Ward 4 serving local residents of Varanasi.',
        amount: 4800000,
        sanction_date: '2025-03-12',
        ia: 'Uttar Pradesh PWD Executive Division',
        lat: 25.3184,
        lng: 82.9804,
      },
      projB: {
        id: 'P10702',
        name: 'Construction of multipurpose community hall at Rampur Ward 4',
        description: 'Construction of multipurpose community welfare hall and cultural stage at Rampur Ward 4 in Varanasi.',
        amount: 4800000,
        sanction_date: '2025-03-26',
        ia: 'Uttar Pradesh PWD Executive Division',
        lat: 25.3180,
        lng: 82.9800,
      },
      distance_meters: 44.8,
      date_delta_days: 14,
      reasons: [
        'High semantic text similarity (>94%) across scope descriptions',
        'Physical distance of 44.8m is well within double-billing asset radius (100m)',
        'Sanctioned within 14 days under identical Executive Division',
      ],
    },
  ];

  const current = clusters[0];

  return (
    <div id="duplicate-tab" className="space-y-3">
      {/* Header Info */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded">
            <Copy className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#666]">
                GEO_NLP_DUPLICATE_RADAR
              </span>
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[9px] font-mono font-bold border border-rose-500/30">
                PROBE_CONFIRMED
              </span>
            </div>
            <div className="text-xs font-bold text-white mt-0.5">
              Geospatial Proximity (&lt;100m) & Semantic Cosine Overlap Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-[#111112] border border-[#262626] text-white">
            CLUSTER: <strong className="text-rose-400">{current.cluster_id}</strong>
          </span>
        </div>
      </div>

      {/* Side-by-Side Comparison Card */}
      <div className="bg-[#0E0E0F] border border-[#262626] rounded p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-2.5 font-mono">
          <div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{current.cluster_id}</span>
            <div className="text-xs font-bold text-white font-sans">{current.title}</div>
            <span className="text-[10px] text-[#A1A1AA]">{current.state}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right px-2.5 py-1 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[9px] text-[#666] block uppercase tracking-widest">COSINE_MATCH</span>
              <span className="text-xs font-bold text-rose-400">
                {(current.similarity * 100).toFixed(0)}% MATCH
              </span>
            </div>
            <div className="text-right px-2.5 py-1 bg-[#050505] rounded border border-[#262626]">
              <span className="text-[9px] text-[#666] block uppercase tracking-widest">SUSPECT_VALUE</span>
              <span className="text-xs font-bold text-white">
                ₹{(current.total_suspect_amount / 100000).toFixed(1)} LAKHS
              </span>
            </div>
          </div>
        </div>

        {/* 2 Comparison Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Project A */}
          <div className="bg-[#050505] p-3 rounded border border-[#262626] space-y-2 font-mono">
            <div className="flex items-center justify-between border-b border-[#1A1A1C] pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                <span className="font-bold text-blue-400 text-xs">{current.projA.id}</span>
                <span className="text-[9px] text-[#666]">[PRIMARY_RECORD]</span>
              </div>
              <button
                onClick={() => onSelectProject(current.projA.id)}
                className="px-2 py-0.5 bg-[#1A1A1C] hover:bg-[#262626] text-blue-400 hover:text-white border border-[#262626] rounded text-[10px] uppercase font-bold tracking-tighter transition inline-flex items-center gap-1"
              >
                DOSSIER <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="font-semibold text-white text-xs font-sans">{current.projA.name}</div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">{current.projA.description}</p>

            <div className="pt-2 border-t border-[#1A1A1C] grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-[#666] block uppercase">SANCTION:</span>
                <span className="font-bold text-white">₹{(current.projA.amount / 100000).toFixed(1)} L</span>
              </div>
              <div>
                <span className="text-[#666] block uppercase">DATE:</span>
                <span className="text-[#E0E0E0]">{current.projA.sanction_date}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#666] block uppercase">AGENCY:</span>
                <span className="text-[#E0E0E0] truncate block">{current.projA.ia}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#666] block uppercase">COORDINATES:</span>
                <span className="text-emerald-400">{current.projA.lat}° N, {current.projA.lng}° E</span>
              </div>
            </div>
          </div>

          {/* Project B */}
          <div className="bg-[#050505] p-3 rounded border border-rose-500/30 space-y-2 font-mono">
            <div className="flex items-center justify-between border-b border-[#1A1A1C] pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]"></span>
                <span className="font-bold text-rose-400 text-xs">{current.projB.id}</span>
                <span className="text-[9px] text-rose-300 font-bold">[SUSPECT_DUPLICATE]</span>
              </div>
              <button
                onClick={() => onSelectProject(current.projB.id)}
                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[10px] uppercase font-bold tracking-tighter transition inline-flex items-center gap-1"
              >
                DOSSIER <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="font-semibold text-white text-xs font-sans">{current.projB.name}</div>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed font-sans">{current.projB.description}</p>

            <div className="pt-2 border-t border-[#1A1A1C] grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-[#666] block uppercase">SANCTION:</span>
                <span className="font-bold text-white">₹{(current.projB.amount / 100000).toFixed(1)} L</span>
              </div>
              <div>
                <span className="text-[#666] block uppercase">DATE:</span>
                <span className="text-[#E0E0E0]">{current.projB.sanction_date}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#666] block uppercase">AGENCY:</span>
                <span className="text-[#E0E0E0] truncate block">{current.projB.ia}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#666] block uppercase">COORDINATES:</span>
                <span className="text-emerald-400">{current.projB.lat}° N, {current.projB.lng}° E</span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Match Findings */}
        <div className="p-3 rounded bg-[#050505] border border-[#262626] space-y-1.5 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest">
              AUTOMATED_OVERLAP_FINDINGS_&_SPATIAL_PROOF
            </span>
          </div>
          <ul className="space-y-1 text-xs text-[#E0E0E0] font-sans">
            {current.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-[11px]">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
