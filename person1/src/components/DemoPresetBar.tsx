import React from 'react';
import { AnomalyScenario } from '../types.ts';
import { AlertTriangle, Copy, DollarSign, Clock, Building2, ShieldAlert, CheckCircle2, Terminal } from 'lucide-react';

interface DemoPresetBarProps {
  onSelectProject: (projectId: string) => void;
  onFilterScenario: (scenario: AnomalyScenario) => void;
}

export const DemoPresetBar: React.FC<DemoPresetBarProps> = ({ onSelectProject, onFilterScenario }) => {
  const presets = [
    {
      id: 'P10342',
      code: 'SCN_01',
      label: 'Payment Divergence',
      tag: '88% Paid / 22% Physical',
      icon: DollarSign,
      scenario: 'PAYMENT_PROGRESS_MISMATCH' as AnomalyScenario,
      color: 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20',
      tagColor: 'text-rose-300',
    },
    {
      id: 'P10101',
      code: 'SCN_02',
      label: 'Cost Escalation',
      tag: '3.2x CPWD SOR',
      icon: AlertTriangle,
      scenario: 'HIGH_COST_ANOMALY' as AnomalyScenario,
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20',
      tagColor: 'text-amber-300',
    },
    {
      id: 'P10450',
      code: 'SCN_03',
      label: 'Timeline Stalled',
      tag: '+14 Mo Overdue',
      icon: Clock,
      scenario: 'TIMELINE_DELAY_ANOMALY' as AnomalyScenario,
      color: 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20',
      tagColor: 'text-orange-300',
    },
    {
      id: 'P10580',
      code: 'SCN_04',
      label: 'Agency Monopoly',
      tag: 'HHI >4000 Dominance',
      icon: Building2,
      scenario: 'IA_CONCENTRATION_ANOMALY' as AnomalyScenario,
      color: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20',
      tagColor: 'text-purple-300',
    },
    {
      id: 'P10701',
      code: 'SCN_05',
      label: 'Duplicate Pair',
      tag: '44.8m / 94% Match',
      icon: Copy,
      scenario: 'DUPLICATE_PROJECT_PAIR' as AnomalyScenario,
      color: 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
      tagColor: 'text-red-300',
    },
    {
      id: 'P10880',
      code: 'SCN_06',
      label: 'No Tech Sanction',
      tag: 'GFR Violation',
      icon: ShieldAlert,
      scenario: 'COMPLIANCE_ANOMALY' as AnomalyScenario,
      color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20',
      tagColor: 'text-indigo-300',
    },
    {
      id: 'P10001',
      code: 'SCN_07',
      label: 'Clean Benchmark',
      tag: '100% Compliant',
      icon: CheckCircle2,
      scenario: 'NORMAL_BENCHMARK' as AnomalyScenario,
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
      tagColor: 'text-emerald-300',
    },
  ];

  return (
    <div id="demo-presets-container" className="bg-[#0E0E0F] border-b border-[#262626] px-4 py-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 max-w-[1700px] mx-auto">
        <div className="flex items-center gap-2 shrink-0">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#A1A1AA]">
            INJECTED_ANOMALY_PROBES
          </span>
          <span className="text-[9px] font-mono text-[#666] hidden xl:inline">
            [SELECT PRESET FOR INSTANT FORENSIC DOSSIER]
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {presets.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                id={`demo-preset-${preset.id}`}
                onClick={() => onSelectProject(preset.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium border transition shrink-0 ${preset.color}`}
                title={`Inspect Project ${preset.id}: ${preset.label}`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="font-bold">{preset.id}</span>
                <span className="text-[10px] text-[#A1A1AA] hidden sm:inline">{preset.label}</span>
                <span className={`text-[9px] px-1 py-0.2 rounded bg-black/40 ${preset.tagColor} border border-white/5 font-mono`}>
                  {preset.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
