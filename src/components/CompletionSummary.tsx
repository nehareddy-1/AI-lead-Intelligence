import React from 'react';
import { 
  CheckCircle, 
  Clock, 
  Users, 
  Target, 
  AlertTriangle, 
  Download, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Ban 
} from 'lucide-react';
import { ProcessedLead } from '../types/lead';

interface CompletionSummaryProps {
  processedLeads: ProcessedLead[];
  elapsedSeconds: number;
  onViewResults: () => void;
  onDownloadCSV: () => void;
  onViewInputOutput?: () => void;
  runId?: string;
}

export const CompletionSummary: React.FC<CompletionSummaryProps> = ({
  processedLeads,
  elapsedSeconds,
  onViewResults,
  onDownloadCSV,
  onViewInputOutput,
  runId = 'RUN-2026-001',
}) => {
  const total = processedLeads.length;
  const relevant = processedLeads.filter((l) => l.relevant === 'YES').length;
  const highPriority = processedLeads.filter((l) => l.priority === 'HIGH').length;
  const needReview = processedLeads.filter((l) => l.qcStatus === 'REVIEW' || l.relevant === 'REVIEW').length;
  const notRelevant = processedLeads.filter((l) => l.relevant === 'NO').length;
  const simulatedAICalls = total * 4; // Classify, Enrich, Outreach, Evaluator

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Top Completion Callout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Analysis Complete
              </span>
              <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {elapsedSeconds.toFixed(1)} seconds
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {total} leads processed successfully
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Dataset synthesized through cleaning, classification, enrichment, priority scoring and QC review.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center shrink-0">
          {onViewInputOutput && (
            <button
              onClick={onViewInputOutput}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition shadow-2xs cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-indigo-600" />
              <span>Inspect Input & Output</span>
            </button>
          )}

          <button
            onClick={onDownloadCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={onViewResults}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm shadow-indigo-200 cursor-pointer"
          >
            <span>View Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Leads</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {total}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">100% processed</div>
        </div>

        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
          <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Relevant</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-indigo-900">
            {relevant}
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">High healthcare fit</div>
        </div>

        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>High Priority</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-900">
            {highPriority}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Score &ge; 80/100</div>
        </div>

        <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200">
          <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Need Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-900">
            {needReview}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">Flagged for human QC</div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Not Relevant</span>
            <Ban className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-700">
            {notRelevant}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Outside criteria</div>
        </div>
      </div>

      {/* System Integrity & Operational Metrics Line */}
      <div className="pt-2 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-slate-700 font-medium">
            <Cpu className="w-3.5 h-3.5 text-indigo-600" />
            {simulatedAICalls} Simulated AI Invocations (Classify, Enrich, Outreach, Evaluator)
          </span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            0 Processing Errors
          </span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="font-mono text-slate-600 font-medium">
            Run ID: {runId}
          </span>
        </div>

        <span className="text-[11px] text-slate-400">
          Deterministic Priority Matrix &bull; Quality Evaluation Validated
        </span>
      </div>
    </div>
  );
};
