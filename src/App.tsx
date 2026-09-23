import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  BarChart3, 
  Users, 
  ShieldAlert, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  FileSpreadsheet, 
  Sparkles,
  Layers,
  ArrowRight,
  Database,
  Copy
} from 'lucide-react';
import { 
  AppState, 
  RawLead, 
  ProcessedLead, 
  StructuredAgentLog, 
  DatasetValidationSummary, 
  PipelineStageKey, 
  StepState,
  AgentConfigurationState,
  RunConfigurationSnapshot
} from './types/lead';
import { SAMPLE_RAW_CSV } from './data/sampleLeads';
import { parseCSV, analyzeDataset, generateProcessedCSV, triggerDownload } from './services/csvParser';
import { startRun, fetchRun, eventToActivity, pipelineCSV, fetchConfiguration } from './services/runs';
import type { RunRecord } from '../server/types/pipeline';
import { DEFAULT_AGENT_CONFIGURATION } from './data/defaultConfig';

import { AppHeader } from './components/AppHeader';
import { UploadZone } from './components/UploadZone';
import { DatasetPreview } from './components/DatasetPreview';
import { PipelineStatus } from './components/PipelineStatus';
import { ProcessingProgress } from './components/ProcessingProgress';
import { AgentActivityLog } from './components/AgentActivityLog';
import { LeadProcessingList } from './components/LeadProcessingList';
import { CompletionSummary } from './components/CompletionSummary';
import { DashboardOverview } from './components/DashboardOverview';
import { LeadExplorer } from './components/LeadExplorer';
import { ReviewQueue } from './components/ReviewQueue';
import { DuplicateQueue } from './components/DuplicateQueue';
import { InputOutputAuditView } from './components/InputOutputAuditView';
import { AgentConfigurationModal } from './components/AgentConfigurationModal';

export default function App() {
  const [configurationReady, setConfigurationReady] = useState(false);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appState, setAppState] = useState<AppState>('EMPTY');
  const [filename, setFilename] = useState<string>('sample_b2c_leads.csv');
  const [rawLeads, setRawLeads] = useState<RawLead[]>([]);
  const [processedLeads, setProcessedLeads] = useState<ProcessedLead[]>([]);
  const [validationSummary, setValidationSummary] = useState<DatasetValidationSummary | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Processing Execution State
  const [currentLeadIndex, setCurrentLeadIndex] = useState<number>(0);
  const [currentLead, setCurrentLead] = useState<ProcessedLead | null>(null);
  const [currentStage, setCurrentStage] = useState<PipelineStageKey>('CLEAN');
  const [stageStates, setStageStates] = useState<Record<PipelineStageKey, StepState>>({
    CLEAN: 'waiting',
    CLASSIFY: 'waiting',
    ENRICH: 'waiting',
    PRIORITIZE: 'waiting',
    OUTREACH: 'waiting',
    EVALUATE: 'waiting',
  });
  const [agentLogs, setAgentLogs] = useState<StructuredAgentLog[]>([]);
  const [speed, setSpeed] = useState<'normal' | 'fast' | 'instant'>('normal');
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Results Dashboard Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'explorer' | 'review' | 'duplicates' | 'audit'>('overview');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Agent Configuration & Run Trace State
  const [agentConfig, setAgentConfig] = useState<AgentConfigurationState>(DEFAULT_AGENT_CONFIGURATION);
  const [configurationDefaults, setConfigurationDefaults] = useState(DEFAULT_AGENT_CONFIGURATION);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [currentRunId, setCurrentRunId] = useState<string>('RUN-2026-001');
  const [runConfigSnapshot, setRunConfigSnapshot] = useState<RunConfigurationSnapshot | null>(null);

  // Server defaults initialize the editor once; later edits remain runtime configuration.
  useEffect(() => {
    const controller = new AbortController();
    fetchConfiguration(controller.signal).then(config => {
      if (!controller.signal.aborted) { setAgentConfig(config); setConfigurationDefaults(config); setConfigurationReady(true); }
    }).catch(() => {
      if (!controller.signal.aborted) setRunError('Start the backend and reload this page to load Classification configuration.');
    });
    return () => controller.abort();
  }, []);

  // Animation & Timer references
  const timerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const speedRef = useRef<'normal' | 'fast' | 'instant'>('normal');
  speedRef.current = speed;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      requestRef.current?.abort();
      if (pollRef.current) clearTimeout(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Loading the Sample Dataset
  const handleLoadSample = () => {
    const parsed = parseCSV(SAMPLE_RAW_CSV);
    if (parsed.error) {
      setValidationError(parsed.error);
      setAppState('VALIDATION_ERROR');
      return;
    }

    const { missingCount, duplicateCount } = analyzeDataset(parsed.rows);
    setFilename('sample_b2c_germany_healthcare_leads.csv');
    setRawLeads(parsed.rows);
    setValidationSummary({
      totalLeads: parsed.rows.length,
      columnsDetected: parsed.headers.length,
      columnNames: parsed.headers,
      missingFieldsCount: missingCount,
      potentialDuplicatesCount: duplicateCount,
      previewRows: parsed.rows,
    });
    setValidationError(null);
    setAppState('UPLOADED');
  };

  // Handle Real File Upload
  const handleFileUpload = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.error) {
        setValidationError(parsed.error);
        setAppState('VALIDATION_ERROR');
        return;
      }

      if (parsed.rows.length === 0) {
        setValidationError('The uploaded CSV does not contain any lead rows.');
        setAppState('VALIDATION_ERROR');
        return;
      }

      const { missingCount, duplicateCount } = analyzeDataset(parsed.rows);
      setRawLeads(parsed.rows);
      setValidationSummary({
        totalLeads: parsed.rows.length,
        columnsDetected: parsed.headers.length,
        columnNames: parsed.headers,
        missingFieldsCount: missingCount,
        potentialDuplicatesCount: duplicateCount,
        previewRows: parsed.rows,
      });
      setValidationError(null);
      setAppState('UPLOADED');
    };

    reader.onerror = () => {
      setValidationError('Failed to read the uploaded file.');
      setAppState('VALIDATION_ERROR');
    };

    reader.readAsText(file);
  };

  // Reset entire application workflow
  const handleReset = () => {
    requestRef.current?.abort();
    if (pollRef.current) clearTimeout(pollRef.current);
    setRun(null);
    setRunError(null);
    if (timerRef.current) clearInterval(timerRef.current);
    isProcessingRef.current = false;
    setAppState('EMPTY');
    setRawLeads([]);
    setProcessedLeads([]);
    setValidationSummary(null);
    setValidationError(null);
    setCurrentLeadIndex(0);
    setCurrentLead(null);
    setAgentLogs([]);
    setElapsedTime(0);
    setActiveTab('overview');
    setSelectedLeadId(null);
    setStageStates({
      CLEAN: 'waiting',
      CLASSIFY: 'waiting',
      ENRICH: 'waiting',
      PRIORITIZE: 'waiting',
      OUTREACH: 'waiting',
      EVALUATE: 'waiting',
    });
  };

  // Backend state is authoritative. No simulation timers or mock lead generation.
  const handleRunAnalysis = async () => {
    if (!rawLeads.length) return;
    if (!configurationReady) { setRunError('Classification configuration is not loaded. Start the backend and reload.'); return; }
    requestRef.current?.abort();
    if (pollRef.current) clearTimeout(pollRef.current);
    const controller = new AbortController();
    requestRef.current = controller;
    setRun(null);
    setRunError(null);
    setAppState('PROCESSING');
    const applyRun = (next: RunRecord) => {
      if (controller.signal.aborted) return;
      setRun(next);
      setProcessedLeads(next.processedLeads);
      setCurrentRunId(next.runId);
      setAgentLogs(next.executionEvents.map(eventToActivity));
      setCurrentLeadIndex(next.completedLeads);
      setCurrentStage(next.currentStage || 'CLEAN');
      const visibleLeadId = next.currentLeadId || next.originalLeads.at(-1)?.id;
      const leadEvents = next.executionEvents.filter(event => event.leadId === visibleLeadId);
      const stateFor = (component: 'clean' | 'classification' | 'enrichment' | 'priority' | 'outreach' | 'evaluator'): StepState => {
        const event = leadEvents.find(item => item.component === component);
        if (!event) return next.currentStage === ({ clean: 'CLEAN', classification: 'CLASSIFY', enrichment: 'ENRICH', priority: 'PRIORITIZE', outreach: 'OUTREACH', evaluator: 'EVALUATE' } as const)[component] ? 'running' : 'waiting';
        return event.status === 'success' ? 'completed' : event.status;
      };
      setStageStates({ CLEAN: stateFor('clean'), CLASSIFY: stateFor('classification'), ENRICH: stateFor('enrichment'), PRIORITIZE: stateFor('priority'), OUTREACH: stateFor('outreach'), EVALUATE: stateFor('evaluator') });
      if (next.status !== 'waiting' && next.status !== 'running') setAppState(next.status === 'failed' ? 'FAILED' : next.status === 'PARTIAL_FAILURE' ? 'PARTIAL_FAILURE' : 'COMPLETE');
    };
    const poll = async (id: string) => {
      try {
        const next = await fetchRun(id, controller.signal);
        applyRun(next);
        if (!controller.signal.aborted && ['waiting', 'running'].includes(next.status)) pollRef.current = setTimeout(() => { void poll(id); }, 600);
      } catch (error) {
        if (!controller.signal.aborted) { setRunError(error instanceof Error ? error.message : 'Unable to load run.'); setAppState('FAILED'); }
      }
    };
    try {
      const next = await startRun(rawLeads, agentConfig, controller.signal);
      applyRun(next);
      if (!controller.signal.aborted) await poll(next.runId);
    } catch (error) {
      if (!controller.signal.aborted) { setRunError(error instanceof Error ? error.message : 'Unable to start run.'); setAppState('FAILED'); }
    }
  };
  const handleSkipToEnd = () => {}; // Disabled for actual backend runs.

  // Download Processed Dataset
  const handleDownloadResults = () => {
    if (run) { triggerDownload(`classified_leads_${run.runId}.csv`, pipelineCSV(run)); return; }
    if (processedLeads.length === 0) return;
    const csvContent = generateProcessedCSV(processedLeads);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerDownload(`processed_leads_ai_intelligence_${dateStr}.csv`, csvContent);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Application Header */}
      <AppHeader
        appState={appState}
        onReset={handleReset}
        onLoadSample={handleLoadSample}
        onOpenConfig={() => configurationReady ? setIsConfigModalOpen(true) : setRunError('Start the backend and reload to load agent configuration.')}
        hasData={rawLeads.length > 0}
      />

      {/* Persistent Action Bar if Completed */}
      {(appState === 'COMPLETE' || processedLeads.length > 0) && (
        <div className="bg-white border-b border-slate-200 sticky top-[73px] z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
            {/* Dashboard Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('overview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('explorer')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'explorer'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Lead Explorer</span>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                  {processedLeads.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('review')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'review'
                    ? 'bg-amber-100 text-amber-900 shadow-2xs'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Review Queue</span>
                <span className="font-mono text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                  {processedLeads.filter((l) => l.qcStatus !== 'PASS' || l.relevant === 'REVIEW').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('duplicates')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'duplicates'
                    ? 'bg-rose-100 text-rose-900 shadow-2xs'
                    : 'text-slate-600 hover:text-rose-800'
                }`}
              >
                <Copy className="w-3.5 h-3.5 text-rose-600" />
                <span>Confirmed Duplicates</span>
                <span className="font-mono text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded-full font-bold">
                  {processedLeads.filter((l) => l.duplicateStatus === 'Confirmed Duplicate').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Input & Output Audit</span>
              </button>
            </div>

            {/* Right Action: Download Results Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownloadResults}
                disabled={appState === 'PROCESSING'}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs ${
                  appState === 'PROCESSING'
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                }`}
                title={appState === 'PROCESSING' ? 'Available after analysis completes' : 'Download fully synthesized CSV'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Results</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {runError && <div role="alert" className="bg-rose-50 text-rose-800 border border-rose-200 rounded-xl p-4 mb-4">{runError} <button onClick={handleReset} className="underline ml-3">Back to upload</button></div>}
        {run && <div className="space-y-6">
          <ProcessingProgress backendMode runStatus={run.status} currentIndex={run.completedLeads} totalLeads={run.totalLeads} currentLead={run.currentLeadId ? { id: run.currentLeadId, name: run.originalLeads.find(lead => lead.id === run.currentLeadId)?.name || run.currentLeadId } : null} currentBatch={run.currentBatch} stageProgress={run.stageProgress} speed="normal" onSpeedChange={() => {}} onSkipToEnd={handleSkipToEnd} />
          <PipelineStatus currentStage={currentStage} stageStates={stageStates} />
          <AgentActivityLog logs={agentLogs} activeLeadId={selectedLeadId || undefined} />
        </div>}
        {/* STATE 1: EMPTY or VALIDATION_ERROR */}
        {(appState === 'EMPTY' || appState === 'VALIDATION_ERROR') && (
          <UploadZone
            onFileUpload={handleFileUpload}
            onLoadSample={handleLoadSample}
            error={validationError}
          />
        )}

        {/* STATE 2: UPLOADED / DATASET PREVIEW */}
        {appState === 'UPLOADED' && validationSummary && (
          <DatasetPreview
            filename={filename}
            summary={validationSummary}
            onRunAnalysis={handleRunAnalysis}
            onReset={handleReset}
          />
        )}

        {/* STATE 3: PROCESSING (Live Execution Screen) */}
        {appState === 'PROCESSING' && !run && (
          <div className="space-y-6">
            {/* Progress & Speed Bar */}
            <ProcessingProgress
              backendMode
              currentIndex={currentLeadIndex}
              totalLeads={rawLeads.length}
              currentLead={currentLead}
              speed={speed}
              onSpeedChange={setSpeed}
              onSkipToEnd={handleSkipToEnd}
            />

            {/* Pipeline Status Visualization */}
            <PipelineStatus
              currentStage={currentStage}
              stageStates={stageStates}
            />

            {/* 2-Column Processing Workspace: Agent Activity Log + Lead Processing List */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Agent Activity Console (8 cols on lg) */}
              <div className="lg:col-span-8">
                <AgentActivityLog
                  logs={agentLogs}
                  activeLeadName={currentLead?.name}
                  activeLeadId={currentLead?.id}
                />
              </div>

              {/* Lead Processing Compact List (4 cols on lg) */}
              <div className="lg:col-span-4">
                <LeadProcessingList
                  rawLeads={rawLeads}
                  processedLeads={processedLeads}
                  currentIndex={currentLeadIndex - 1}
                  onSelectLead={(id) => {
                    const found = processedLeads.find((p) => p.id === id);
                    if (found) setCurrentLead(found);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STATE 4: COMPLETE (Results Dashboard) */}
        {(appState === 'COMPLETE' || appState === 'PARTIAL_FAILURE') && processedLeads.length > 0 && (
          <div className="space-y-8">
            {/* Completion Metric Callout */}
            <CompletionSummary
              processedLeads={processedLeads}
              elapsedSeconds={run?.startedAt && run.completedAt ? (Date.parse(run.completedAt) - Date.parse(run.startedAt)) / 1000 : elapsedTime}
              aiInvocationCount={run?.aiInvocationCount}
              processingErrors={run?.errors.length}
              aiFallbackCount={run?.aiFallbacks?.length ?? 0}
              onViewResults={() => setActiveTab('overview')}
              onDownloadCSV={handleDownloadResults}
              onViewInputOutput={() => setActiveTab('audit')}
              runId={currentRunId}
            />

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <DashboardOverview
                leads={processedLeads}
                onSelectLead={(leadId) => {
                  setSelectedLeadId(leadId);
                  setActiveTab('explorer');
                }}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {/* TAB 2: LEAD EXPLORER */}
            {activeTab === 'explorer' && (
              <LeadExplorer
                leads={processedLeads}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
              />
            )}

            {/* TAB 3: REVIEW QUEUE */}
            {activeTab === 'review' && (
              <ReviewQueue
                leads={processedLeads}
                onSelectLeadForReview={(leadId) => {
                  setSelectedLeadId(leadId);
                  setActiveTab('explorer');
                }}
                onApproveLead={run ? undefined : (leadId) => {
                  setProcessedLeads((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, qcStatus: 'PASS', reviewedByHuman: true } : l))
                  );
                }}
              />
            )}

            {/* TAB 4: CONFIRMED DUPLICATES */}
            {activeTab === 'duplicates' && (
              <DuplicateQueue
                leads={processedLeads}
                onSelectLeadForReview={(leadId) => {
                  setSelectedLeadId(leadId);
                  setActiveTab('explorer');
                }}
                onAcknowledgeLead={run ? undefined : (leadId) => {
                  setProcessedLeads((prev) =>
                    prev.map((l) => (l.id === leadId ? { ...l, reviewedByHuman: true } : l))
                  );
                }}
              />
            )}

            {/* TAB 5: INPUT & OUTPUT AUDIT */}
            {activeTab === 'audit' && (
              <InputOutputAuditView
                leads={processedLeads}
                agentLogs={agentLogs}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">AI Lead Intelligence</span>
            <span>&bull;</span>
            <span>B2C Sales Pipeline & Quality Control</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Deterministic Scoring</span>
            <span>&bull;</span>
            <span>RFC 4180 CSV Compliant</span>
            <span>&bull;</span>
            <span>Zero Unverified Promises</span>
          </div>
        </div>
      </footer>

      {/* Agent Configuration Modal */}
      <AgentConfigurationModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={agentConfig}
        defaults={configurationDefaults}
        onSaveConfig={(updated) => setAgentConfig(updated)}
      />
    </div>
  );
}
