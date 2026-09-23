import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  Cpu, 
  FileText,
  ShieldAlert
} from 'lucide-react';
import { ExecutionEvent } from '../types/lead';

interface ExecutionLogCardProps {
  event: ExecutionEvent;
  defaultExpanded?: boolean;
}

export const ExecutionLogCard: React.FC<ExecutionLogCardProps> = ({ 
  event, 
  defaultExpanded = false 
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [copiedInput, setCopiedInput] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);

  const handleCopyInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(event.input, null, 2));
    setCopiedInput(true);
    setTimeout(() => setCopiedInput(false), 2000);
  };

  const handleCopyOutput = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(event.output || event.error, null, 2));
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const isSuccess = event.status === 'success';
  const isReview = event.status === 'review';
  const isFailed = event.status === 'failed';

  return (
    <div 
      className={`rounded-2xl border transition shadow-2xs overflow-hidden ${
        isFailed
          ? 'bg-rose-50/20 border-rose-200'
          : isReview
          ? 'bg-amber-50/20 border-amber-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Clickable Header Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none bg-slate-50/60 hover:bg-slate-100/60 transition"
      >
        {/* Left: Status Icon & Title */}
        <div className="flex items-center gap-3">
          {isSuccess && (
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          )}
          {isReview && (
            <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          )}
          {isFailed && (
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {event.componentName}
              </h4>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : isReview
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : isFailed ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-blue-50 text-blue-900 border-blue-300'
                }`}
              >
                {isSuccess ? '✓ SUCCESS' : isReview ? '⚠ REVIEW' : isFailed ? '✕ FAILED' : event.status.toUpperCase()}
              </span>
            </div>

            {event.summary && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-xl">
                {event.summary}
              </p>
            )}
          </div>
        </div>

        {/* Right: Metadata (Duration, Model/Engine, Prompt Version, Expand Toggle) */}
        <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
          {event.componentType === 'deterministic' ? (
            <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded font-semibold">
              Engine: Deterministic
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                {event.model || 'Unavailable'}
              </span>
              <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                Prompt {event.promptVersion || 'v1'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{event.durationFormatted}</span>
          </div>

          <div className="text-slate-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Body: Structured Observable Input and Output */}
      {expanded && (
        <div className="p-5 border-t border-slate-200/80 bg-white space-y-4 text-xs">
          {/* INPUT Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Input
              </span>
              <button
                onClick={handleCopyInput}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Copy input JSON"
              >
                {copiedInput ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56">
              {JSON.stringify(event.input, null, 2)}
            </pre>
          </div>

          {/* OUTPUT or ERROR Section */}
          {event.error ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Error
              </div>
              <pre className="p-3.5 bg-rose-950 text-rose-200 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto">
                {JSON.stringify(event.error, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  Structured Output
                </span>
                <button
                  onClick={handleCopyOutput}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  title="Copy output JSON"
                >
                  {copiedOutput ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72">
                {JSON.stringify(event.output, null, 2)}
              </pre>
            </div>
          )}

          {event.responseValidation && <p className="text-xs text-slate-500">
            Response validation: {event.responseValidation.valid ? 'Valid schema and source evidence' : event.responseValidation.issues.join(', ')}
          </p>}
          {/* Execution Trace Note */}
          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
            <span>Observable execution telemetry</span>
            <span>Duration: {event.durationFormatted}</span>
          </div>
        </div>
      )}
    </div>
  );
};
