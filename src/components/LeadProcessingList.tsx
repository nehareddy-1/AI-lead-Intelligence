import React, { useRef, useEffect } from 'react';
import { CheckCircle2, Clock, Loader2, AlertTriangle, Users } from 'lucide-react';
import { RawLead, ProcessedLead } from '../types/lead';

interface LeadProcessingListProps {
  rawLeads: RawLead[];
  processedLeads: ProcessedLead[];
  currentIndex: number;
  onSelectLead?: (leadId: string) => void;
}

export const LeadProcessingList: React.FC<LeadProcessingListProps> = ({
  rawLeads,
  processedLeads,
  currentIndex,
  onSelectLead,
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to keep active processing lead visible
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  const processedMap = new Map<string, ProcessedLead>();
  processedLeads.forEach((p) => processedMap.set(p.id, p));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col h-[520px]">
      <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Lead Queue
          </h3>
        </div>
        <span className="text-[11px] font-mono bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-medium">
          {processedLeads.length} / {rawLeads.length}
        </span>
      </div>

      <div className="p-3 overflow-y-auto space-y-1.5 flex-1 bg-slate-50/20">
        {rawLeads.map((raw, idx) => {
          const isCurrent = idx === currentIndex;
          const isDone = idx < currentIndex;
          const isWaiting = idx > currentIndex;

          const processed = processedMap.get(raw.id);

          let statusIcon = <Clock className="w-3.5 h-3.5 text-slate-400" />;
          let statusText = 'Waiting';
          let itemBg = 'bg-white/60 border-slate-200/60 opacity-60';
          let badgeColor = 'text-slate-400';

          if (isCurrent) {
            statusIcon = <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />;
            statusText = 'Processing';
            itemBg = 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs font-semibold';
            badgeColor = 'text-indigo-700';
          } else if (isDone) {
            if (processed?.qcStatus === 'REVIEW') {
              statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
              statusText = 'Review Flag';
              badgeColor = 'text-amber-700';
            } else {
              statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
              statusText = 'Completed';
              badgeColor = 'text-emerald-700';
            }
            itemBg = 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700';
          }

          return (
            <div
              key={raw.id || idx}
              ref={isCurrent ? activeItemRef : null}
              onClick={() => onSelectLead && onSelectLead(raw.id)}
              className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all duration-150 cursor-pointer ${itemBg}`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="shrink-0">{statusIcon}</span>
                <span className="font-mono text-slate-500 shrink-0 font-medium">
                  {raw.id || `L${String(idx + 1).padStart(3, '0')}`}
                </span>
                <span className="text-slate-300">&mdash;</span>
                <span className="font-medium text-slate-900 truncate">
                  {raw.name}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                {processed && (
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${
                      processed.priority === 'HIGH'
                        ? 'bg-indigo-100 text-indigo-800'
                        : processed.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {processed.priorityScore}
                  </span>
                )}
                <span className={`font-medium ${badgeColor}`}>
                  {statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
