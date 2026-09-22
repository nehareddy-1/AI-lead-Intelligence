import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { QCReport, QCStatus } from '../types/lead';

interface QCReviewCardProps {
  qcStatus: QCStatus;
  qcReason?: string;
  qcReport?: QCReport;
  leadName?: string;
  compact?: boolean;
}

export const QCReviewCard: React.FC<QCReviewCardProps> = ({
  qcStatus,
  qcReason,
  qcReport,
  leadName,
  compact = false,
}) => {
  if (qcStatus === 'PASS') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                QC Verification Passed
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                PASS
              </span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              {qcReason || 'All synthesized claims and outreach messages verified against original source record. Zero unsupported promises or hallucinations detected.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (qcStatus === 'FAIL') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Critical QC Failure
              </span>
              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-300">
                FAIL
              </span>
            </div>
            <p className="text-xs text-rose-900 leading-relaxed">
              {qcReason || 'Major contradiction or fabricated qualifications detected.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // REVIEW status (Amber)
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <span>⚠ HUMAN REVIEW REQUIRED</span>
              {leadName && (
                <span className="text-slate-700 font-semibold normal-case">
                  &bull; {leadName}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-amber-800 font-medium">
              Autonomous AI guardrails flagged potential discrepancy or ambiguity.
            </p>
          </div>
        </div>

        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-md shrink-0">
          REVIEW
        </span>
      </div>

      <div className="space-y-3 text-xs bg-white/80 rounded-xl p-4 border border-amber-200/80">
        {/* Issue Detected */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
            Issue Detected:
          </span>
          <p className="text-slate-900 font-semibold">
            {qcReport?.issueDetected || qcReason || 'Missing or ambiguous qualification requires human confirmation.'}
          </p>
        </div>

        {/* Source Data */}
        {qcReport?.sourceData && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-0.5">
              Source Data:
            </span>
            <div className="bg-slate-100 font-mono text-[11px] text-slate-800 px-2.5 py-1.5 rounded border border-slate-200">
              {qcReport.sourceData}
            </div>
          </div>
        )}

        {/* Problem */}
        {qcReport?.problem && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
              Problem:
            </span>
            <p className="text-amber-950 font-medium leading-relaxed">
              {qcReport.problem}
            </p>
          </div>
        )}

        {/* Recommended Fix */}
        {qcReport?.recommendedFix && (
          <div className="bg-amber-100/60 rounded-lg p-3 border border-amber-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
              Recommended Fix:
            </span>
            <p className="text-amber-950 font-medium leading-relaxed">
              {qcReport.recommendedFix}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
