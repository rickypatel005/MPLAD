import React, { useState, useEffect } from 'react';
import { AnomalyScenario, DashboardSummary, DataProfileReport, StateEntity, UserRole } from './types.ts';
import { Header } from './components/Header.tsx';
import { DemoPresetBar } from './components/DemoPresetBar.tsx';
import { DashboardTab } from './components/DashboardTab.tsx';
import { ProjectsTab } from './components/ProjectsTab.tsx';
import { DuplicateDetectorTab } from './components/DuplicateDetectorTab.tsx';
import { AgencyNetworkTab } from './components/AgencyNetworkTab.tsx';
import { PipelineConsoleTab } from './components/PipelineConsoleTab.tsx';
import { ProjectDetailModal } from './components/ProjectDetailModal.tsx';
import { MASTER_STATES } from './data/masterLocations.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeRole, setActiveRole] = useState<UserRole>('AUDITOR');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [pipelineReport, setPipelineReport] = useState<DataProfileReport | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Initial Data Fetch
  const fetchDashboardData = async () => {
    try {
      const [summaryRes, pipelineRes] = await Promise.all([
        fetch('/api/dashboard/summary'),
        fetch('/api/pipeline/status'),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      if (pipelineRes.ok) {
        const pipeData = await pipelineRes.json();
        setPipelineReport(pipeData);
      }
    } catch (err) {
      console.error('Failed to load initial application state:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefreshPipeline = async (count = 10000, seed = 26102) => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_count: count, seed }),
      });
      if (res.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Pipeline re-generation failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleSelectStateFromDashboard = (stateId: string) => {
    setSelectedStateFilter(stateId);
    setActiveTab('projects');
  };

  const handleFilterScenario = (scenario: AnomalyScenario) => {
    setActiveTab('projects');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans selection:bg-zinc-700 selection:text-white">
      {/* 1. Header & Tab Navigation */}
      <Header
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        totalProjects={summary?.total_projects || 10000}
        onRefreshPipeline={() => handleRefreshPipeline(10000, 26102)}
        isRefreshing={isRefreshing}
      />

      {/* 2. Demo Presets Quick Selector */}
      <DemoPresetBar
        onSelectProject={handleSelectProject}
        onFilterScenario={handleFilterScenario}
      />

      {/* 3. Main Workspace Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-4 lg:px-6 py-3.5">
        {activeTab === 'dashboard' && (
          <DashboardTab
            summary={summary}
            onSelectProject={handleSelectProject}
            onSelectState={handleSelectStateFromDashboard}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsTab
            states={MASTER_STATES}
            onSelectProject={handleSelectProject}
            selectedStateFilter={selectedStateFilter}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicateDetectorTab onSelectProject={handleSelectProject} />
        )}

        {activeTab === 'agencies' && (
          <AgencyNetworkTab
            states={MASTER_STATES}
            onSelectProject={handleSelectProject}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineConsoleTab
            report={pipelineReport}
            onRefreshPipeline={handleRefreshPipeline}
            isRefreshing={isRefreshing}
          />
        )}
      </main>

      {/* 4. Forensic Project Dossier & Review Modal */}
      {selectedProjectId && (
        <ProjectDetailModal
          projectId={selectedProjectId}
          onClose={() => setSelectedProjectId(null)}
          activeRole={activeRole}
          onReviewSubmitted={() => {
            fetchDashboardData();
          }}
        />
      )}

      {/* 5. Minimal App Footer */}
      <footer className="bg-[#0E0E0F] border-t border-[#262626] py-2.5 text-center text-xs text-[#666] font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <span className="text-[10px] tracking-tight">
            SIH26102 • MPLADS_AUDIT_INTELLIGENCE_SYSTEM [CORE_ACTIVE]
          </span>
          <span className="text-[10px] text-[#555]">
            MoSPI_COMPLIANCE • GFR_2017_ENGINE • HIGH_DENSITY_HUD
          </span>
        </div>
      </footer>
    </div>
  );
}
