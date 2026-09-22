import React from 'react';
import { Sparkles, ShieldCheck, RefreshCw, FileText, ArrowRight, Sliders } from 'lucide-react';
import { AppState } from '../types/lead';

interface AppHeaderProps {
  appState: AppState;
  onReset: () => void;
  onLoadSample: () => void;
  onOpenConfig?: () => void;
  hasData: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  appState,
  onReset,
  onLoadSample,
  onOpenConfig,
  hasData,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Title and Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                AI Lead Intelligence
              </h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                B2C Pipeline
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Turn messy B2C leads into qualified, prioritized and actionable sales opportunities.
            </p>
          </div>
        </div>

        {/* System Status and Quick Actions */}
        <div className="flex items-center gap-3 self-end md:self-center">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-3 py-1.5 rounded-full text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>System Ready</span>
          </div>

          {onOpenConfig && (
            <button
              onClick={onOpenConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
              title="Configure AI component prompts, evaluator weights, and thresholds"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>Agent Configuration</span>
            </button>
          )}

          {!hasData && (
            <button
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Load 30 Sample Leads</span>
              <ArrowRight className="w-3 h-3 text-indigo-500" />
            </button>
          )}

          {hasData && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Reset workflow and upload new CSV"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>New Dataset</span>
            </button>
          )}
        </div>
      </div>

      {/* Secondary Description Strip */}
      <div className="bg-slate-50/80 border-t border-slate-100 px-4 sm:px-6 lg:px-8 py-1.5 text-[11px] text-slate-500 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-2">
          <span>AI-assisted lead qualification, enrichment, prioritization and outreach.</span>
          <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Deterministic integrity &bull; Model interpretability &bull; Human QC
          </span>
        </div>
      </div>
    </header>
  );
};
