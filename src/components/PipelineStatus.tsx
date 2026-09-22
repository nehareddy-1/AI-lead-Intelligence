import React from 'react';
import { 
  Sparkles, 
  Check, 
  Clock, 
  AlertTriangle, 
  X, 
  Database, 
  Target, 
  UserCheck, 
  BarChart3, 
  Send, 
  ShieldAlert 
} from 'lucide-react';
import { PipelineStageKey, StepState } from '../types/lead';

interface PipelineStatusProps {
  currentStage: PipelineStageKey;
  stageStates: Record<PipelineStageKey, StepState>;
}

interface StageDefinition {
  key: PipelineStageKey;
  name: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StageDefinition[] = [
  {
    key: 'CLEAN',
    name: 'Clean',
    shortDesc: 'Validation & Dups',
    icon: Database,
  },
  {
    key: 'CLASSIFY',
    name: 'Classify',
    shortDesc: 'Intent & Fit',
    icon: Target,
  },
  {
    key: 'ENRICH',
    name: 'Enrich',
    shortDesc: 'Needs & Profile',
    icon: UserCheck,
  },
  {
    key: 'PRIORITIZE',
    name: 'Prioritize',
    shortDesc: 'Scoring Matrix',
    icon: BarChart3,
  },
  {
    key: 'OUTREACH',
    name: 'Outreach',
    shortDesc: 'Personalized Draft',
    icon: Send,
  },
  {
    key: 'EVALUATE',
    name: 'Evaluator',
    shortDesc: 'Quality & Audit',
    icon: ShieldAlert,
  },
];

export const PipelineStatus: React.FC<PipelineStatusProps> = ({
  currentStage,
  stageStates,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Pipeline Workflow Engine
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
          6 Specialized Autonomous Components
        </span>
      </div>

      {/* Horizontal Pipeline on Desktop, Vertical on Mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {STAGES.map((stage, idx) => {
          const state = stageStates[stage.key] || 'waiting';
          const isActive = currentStage === stage.key && state === 'running';
          const Icon = stage.icon;

          let badgeBg = 'bg-slate-100 text-slate-500 border-slate-200';
          let statusLabel = '○ Waiting';
          let statusColor = 'text-slate-400';

          if (state === 'completed') {
            badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            statusLabel = '✓ Completed';
            statusColor = 'text-emerald-600';
          } else if (state === 'running') {
            badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-500/20';
            statusLabel = '● Running';
            statusColor = 'text-indigo-600';
          } else if (state === 'review') {
            badgeBg = 'bg-amber-50 text-amber-800 border-amber-300';
            statusLabel = '⚠ Review';
            statusColor = 'text-amber-600';
          } else if (state === 'failed') {
            badgeBg = 'bg-rose-50 text-rose-700 border-rose-300';
            statusLabel = '✕ Failed';
            statusColor = 'text-rose-600';
          }

          return (
            <div
              key={stage.key}
              className={`relative rounded-xl p-3 border transition-all duration-200 ${badgeBg} ${
                isActive ? 'shadow-xs scale-[1.02]' : ''
              }`}
            >
              {/* Connector arrow indicator on desktop */}
              {idx < STAGES.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 pointer-events-none">
                  &rarr;
                </div>
              )}

              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                      state === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : state === 'running'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-tight text-slate-900">
                    {stage.name}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 truncate mb-1">
                {stage.shortDesc}
              </div>

              <div className={`text-[10px] font-semibold tracking-wide flex items-center gap-1 ${statusColor}`}>
                {state === 'running' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping inline-block"></span>
                )}
                <span>{statusLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
