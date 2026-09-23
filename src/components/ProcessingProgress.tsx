import React from 'react';
import { Loader2, Zap, FastForward, CheckCircle2, UserCheck } from 'lucide-react';
import { ProcessedLead } from '../types/lead';

interface ProcessingProgressProps {
  currentIndex: number;
  totalLeads: number;
  currentLead: Pick<ProcessedLead, 'id' | 'name' | 'education' | 'germanLevel'> | null;
  backendMode?: boolean;
  runStatus?: string;
  speed: 'normal' | 'fast' | 'instant';
  onSpeedChange: (speed: 'normal' | 'fast' | 'instant') => void;
  onSkipToEnd: () => void;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  backendMode = false,
  runStatus = 'running',
  currentIndex,
  totalLeads,
  currentLead,
  speed,
  onSpeedChange,
  onSkipToEnd,
}) => {
  const percent = totalLeads > 0 ? Math.round((currentIndex / totalLeads) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* State and Progress Numbers */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <Loader2 className={`w-3.5 h-3.5 ${runStatus === 'running' ? 'animate-spin' : ''}`} />
              {backendMode ? `Pipeline: ${runStatus}` : 'AI Analysis Running'}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {backendMode ? 'Processing through Evaluator' : 'Autonomous Pipeline'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Processing {Math.min(currentIndex, totalLeads)} / {totalLeads} leads
          </h2>
        </div>

        {/* Speed and Skip Controls for Interview & Demo */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-medium text-slate-600">
            <button
              disabled={backendMode}
              onClick={() => onSpeedChange('normal')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                speed === 'normal'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
            >
              1x Normal
            </button>
            <button
              disabled={backendMode}
              onClick={() => onSpeedChange('fast')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                speed === 'fast'
                  ? 'bg-white text-indigo-700 font-semibold shadow-2xs'
                  : 'hover:text-slate-900'
              }`}
            >
              3x Fast
            </button>
          </div>

          <button
            disabled={backendMode}
            onClick={onSkipToEnd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 transition cursor-pointer"
            title={backendMode ? "Backend runs have no simulated speed or instant completion" : "Complete all leads immediately"}
          >
            <FastForward className="w-3.5 h-3.5 text-indigo-600" />
            <span>Instant</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
          <span>Overall Workflow Progress</span>
          <span className="font-mono text-indigo-600">{percent}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
          <div
            className="h-full bg-linear-to-r from-indigo-500 to-indigo-600 transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Current Lead Callout */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Current Lead:</span>
          {currentLead ? (
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              <span className="font-mono text-indigo-600">{currentLead.id}</span>
              <span>&mdash;</span>
              <span>{currentLead.name}</span>
            </span>
          ) : (
            <span className="text-slate-400 italic">{backendMode ? 'No lead currently running' : 'Initializing leads...'}</span>
          )}
        </div>

        {currentLead && !backendMode && (
          <div className="text-slate-500 flex items-center gap-3">
            <span>
              Education: <strong className="text-slate-700">{currentLead.education || 'N/A'}</strong>
            </span>
            <span>&bull;</span>
            <span>
              German Level: <strong className="text-slate-700">{currentLead.germanLevel || 'Missing'}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
