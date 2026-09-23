import React, { useState } from 'react';
import { 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Activity,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { StructuredAgentLog } from '../types/lead';

interface AgentActivityLogProps {
  logs: StructuredAgentLog[];
  activeLeadName?: string;
  activeLeadId?: string;
}

export const AgentActivityLog: React.FC<AgentActivityLogProps> = ({
  logs,
  activeLeadName,
  activeLeadId,
}) => {
  // Track collapsed status of logs; by default, latest are expanded, earlier can be toggled
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [filterToCurrentLead, setFilterToCurrentLead] = useState(true);

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    logs.forEach((l) => (next[l.id] = true));
    setCollapsedMap(next);
  };

  const expandAll = () => {
    setCollapsedMap({});
  };

  // Filter logs if user desires to focus on active lead or see all stream
  const displayedLogs = filterToCurrentLead && activeLeadId
    ? logs.filter((l) => l.leadId === activeLeadId)
    : logs;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[520px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Agent Activity
          </h3>
          <span className="text-[11px] font-mono bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded">
            Structured Log Stream
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {activeLeadId && (
            <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterToCurrentLead}
                onChange={(e) => setFilterToCurrentLead(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-[11px]">Current lead only</span>
            </label>
          )}

          <div className="h-3 w-px bg-slate-200 mx-1"></div>

          <button
            onClick={expandAll}
            className="text-[11px] text-slate-500 hover:text-indigo-600 transition cursor-pointer"
          >
            Expand all
          </button>
          <span>&bull;</span>
          <button
            onClick={collapseAll}
            className="text-[11px] text-slate-500 hover:text-indigo-600 transition cursor-pointer"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-indigo-50/40 border-b border-indigo-100/60 px-5 py-1.5 text-[11px] text-slate-500 flex items-center justify-between">
        <span>No raw model chain-of-thought. Auditable inputs, outputs, evidence & validation decisions.</span>
        <span className="font-mono text-indigo-700 text-[10px]">
          {displayedLogs.length} events logged
        </span>
      </div>

      {/* Logs Scroll Container */}
      <div className="p-4 overflow-y-auto space-y-3 font-mono text-xs flex-1 bg-slate-50/30">
        {displayedLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 font-sans text-sm">
            <Activity className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
            <p>Waiting for agent pipeline execution to begin...</p>
          </div>
        ) : (
          displayedLogs.map((log) => {
            const isCollapsed = collapsedMap[log.id];

            let statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
            let statusBorder = 'border-slate-200 hover:border-slate-300';
            let headerBg = 'bg-white';

            if (log.status === 'warning') {
              statusIcon = <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
              statusBorder = 'border-amber-200 bg-amber-50/20';
            } else if (log.status === 'error') {
              statusIcon = <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />;
              statusBorder = 'border-rose-300 bg-rose-50/20';
            } else if (log.status === 'running') {
              statusIcon = <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping shrink-0" />;
              statusBorder = 'border-indigo-300 bg-indigo-50/20 ring-1 ring-indigo-400/30';
            }

            return (
              <div
                key={log.id}
                className={`rounded-xl border transition-all duration-150 ${statusBorder} shadow-2xs overflow-hidden`}
              >
                {/* Log Header / Summary Bar */}
                <div
                  onClick={() => toggleCollapse(log.id)}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer select-none ${headerBg}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-[11px] text-slate-600 font-medium">{log.timestamp}</span>
                    {statusIcon}
                    <span className="font-bold text-slate-900 text-xs tracking-tight">
                      {log.stageTitle}
                    </span>
                    <span className="text-slate-400 font-sans text-xs hidden sm:inline">|</span>
                    <span className="text-slate-600 font-sans text-xs truncate font-medium">
                      Lead: <strong className="text-slate-800">{log.leadId} &mdash; {log.leadName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0 font-sans">
                    {log.duration && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-mono">
                        {log.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Collapsible Structured Details */}
                {!isCollapsed && (
                  <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 space-y-3 font-sans text-xs">
                    {/* Input Block */}
                    {log.input && Object.keys(log.input).length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                          INPUT
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 font-mono text-[11px] text-slate-700 space-y-1">
                          {Object.entries(log.input).map(([key, val]) => (
                            <div key={key} className="flex flex-wrap gap-1">
                              <span className="text-slate-600 font-semibold">{key}:</span>
                              <span className="text-slate-800 break-all">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Output Block */}
                    {log.output && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                          OUTPUT
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 font-mono text-[11px] text-slate-800 space-y-1">
                          {Object.entries(log.output).map(([key, val]) => (
                            <div key={key} className="flex flex-wrap gap-1 items-start">
                              <span className="text-indigo-600 font-semibold">{key}:</span>
                              <div className="text-slate-800">
                                {Array.isArray(val) ? (
                                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                                    {val.map((item, i) => (
                                      <li key={i}>{String(item)}</li>
                                    ))}
                                  </ul>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence & Reasoning Callout */}
                    {log.details?.evidence && log.details.evidence.length > 0 && (
                      <div className="bg-indigo-50/50 rounded-lg p-2 border border-indigo-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block mb-1">
                          Source Evidence
                        </span>
                        <ul className="space-y-0.5 text-slate-700 text-xs">
                          {log.details.evidence.map((ev, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/50">
                      Summary: {log.summary}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
