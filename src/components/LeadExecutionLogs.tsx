import React, { useState } from 'react';
import { 
  Terminal, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Cpu, 
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ProcessedLead, ExecutionEvent } from '../types/lead';
import { ExecutionLogCard } from './ExecutionLogCard';

interface LeadExecutionLogsProps {
  lead: { id: string; name?: string | null; runId?: string; executionEvents?: ExecutionEvent[] };
}

export const LeadExecutionLogs: React.FC<LeadExecutionLogsProps> = ({ lead }) => {
  const events = lead.executionEvents || [];

  const successfulCount = events.filter((e) => e.status === 'success').length;
  const reviewCount = events.filter((e) => e.status === 'review').length;
  const failedCount = events.filter((e) => e.status === 'failed').length;

  const totalDurationMs = events.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);
  const totalDurationSec = (totalDurationMs / 1000).toFixed(6);
  const runningCount = events.filter(event => event.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Top Execution Summary Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded">
              RUN TRACE
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-300 font-mono">
              Run ID: {lead.runId || 'RUN-2026-001'}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
            Execution Trace &bull; {lead.name} ({lead.id})
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Structured input and output from each processing component for this lead. Observable telemetry without hidden reasoning tokens.
          </p>
        </div>

        {/* Metrics Pill */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Components</div>
            <div className="font-mono text-lg font-bold text-indigo-300">{events.length}</div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Duration</div>
            <div className="font-mono text-lg font-bold text-emerald-400">{totalDurationSec}s</div>
          </div>
        </div>
      </div>

      {/* Execution Summary Strip */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <span className="font-bold text-slate-900 uppercase tracking-wider">Execution Summary:</span>
          <span className="text-slate-400">&bull;</span>
          <span>{events.length} Components · {runningCount} Running</span>
          <span className="text-slate-400">&bull;</span>
          <span className="text-emerald-700 font-semibold">{successfulCount} Successful</span>
          <span className="text-slate-400">&bull;</span>
          <span className={reviewCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
            {reviewCount} Review
          </span>
          <span className="text-slate-400">&bull;</span>
          <span className={failedCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}>
            {failedCount} Failed
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Total Duration: {totalDurationSec}s</span>
          <span className="text-slate-300">|</span>
          <span>Run ID: {lead.runId || 'RUN-2026-001'}</span>
        </div>
      </div>

      {/* Ordered Component Cards Trace */}
      <div className="space-y-3.5">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Component Pipeline Execution Order (1 to {events.length})
          </span>
          <span className="text-[11px] font-normal text-slate-400">
            Click any component to inspect structured inputs and outputs
          </span>
        </div>

        {events.length > 0 ? (
          events.map((event, index) => (
            <ExecutionLogCard 
              key={event.id || `${lead.id}-${event.component}`} 
              event={event}
              defaultExpanded={index === 0 || event.status === 'review' || event.status === 'failed'}
            />
          ))
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            No execution events recorded for this lead.
          </div>
        )}
      </div>
    </div>
  );
};
