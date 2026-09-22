import React, { useState } from 'react';
import { 
  Terminal, 
  Columns, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sparkles,
  ArrowRight,
  Database,
  Cpu,
  Layers
} from 'lucide-react';
import { ProcessedLead, StructuredAgentLog } from '../types/lead';
import { InputOutputComparison } from './InputOutputComparison';
import { AgentActivityLog } from './AgentActivityLog';

interface InputOutputAuditViewProps {
  leads: ProcessedLead[];
  agentLogs: StructuredAgentLog[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
}

export const InputOutputAuditView: React.FC<InputOutputAuditViewProps> = ({
  leads,
  agentLogs,
  selectedLeadId,
  onSelectLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFormat, setViewFormat] = useState<'comparison' | 'logs'>('comparison');

  const filteredLeads = leads.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q) || (l.education || '').toLowerCase().includes(q);
  });

  const activeLead = leads.find((l) => l.id === selectedLeadId) || leads[0];

  return (
    <div className="space-y-6">
      {/* Top Banner and Lead Picker */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Input & Output Pipeline Audit
              </h2>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                Post-Run Verification
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Audit the raw ingested data received from the CSV versus the finalized structured outputs produced by each AI agent.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewFormat('comparison')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'comparison'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Input vs Output (Side-by-Side)</span>
            </button>

            <button
              onClick={() => setViewFormat('logs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewFormat === 'logs'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Agent Execution Logs</span>
            </button>
          </div>
        </div>

        {/* Lead Selector Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Horizontal scroll of lead pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 flex-1 no-scrollbar">
            {filteredLeads.map((lead) => {
              const isSelected = activeLead?.id === lead.id;
              return (
                <button
                  key={lead.id}
                  onClick={() => onSelectLead(lead.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-80">{lead.id}</span>
                  <span>{lead.name}</span>
                  {lead.qcStatus === 'REVIEW' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeLead ? (
        viewFormat === 'comparison' ? (
          <InputOutputComparison lead={activeLead} />
        ) : (
          <AgentActivityLog
            logs={agentLogs}
            activeLeadId={activeLead.id}
            activeLeadName={activeLead.name}
          />
        )
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          No lead selected for audit.
        </div>
      )}
    </div>
  );
};
