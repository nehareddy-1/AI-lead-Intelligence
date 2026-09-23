import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Eye, 
  Check, 
  Sparkles, 
  HelpCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { ProcessedLead } from '../types/lead';

interface ReviewQueueProps {
  leads: ProcessedLead[];
  onSelectLeadForReview: (leadId: string) => void;
  onApproveLead?: (leadId: string) => void;
}

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  leads,
  onSelectLeadForReview,
  onApproveLead,
}) => {
  // Flagged leads are those needing an actual judgment call: a failed/uncertain QC decision, or an
  // uncertain Classification verdict. Confirmed duplicates have their own dedicated queue (see
  // DuplicateQueue) so they don't compete with these for review attention.
  const flaggedLeads = leads.filter(
    (l) => l.qcStatus === 'FAIL' || l.qcStatus === 'REVIEW' || l.relevant === 'REVIEW'
  );

  const [approvedIds, setApprovedIds] = useState<Record<string, boolean>>({});

  const handleApprove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onApproveLead) return;
    setApprovedIds((prev) => ({ ...prev, [id]: true }));
    if (onApproveLead) onApproveLead(id);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Human Review Queue
                </h2>
                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                  {flaggedLeads.length} Items Flagged
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                AI identified uncertainty or potential data-quality issues that should be reviewed before sales outreach. The system never hallucinates missing qualifications or makes unverified legal guarantees.
              </p>
            </div>
          </div>

          <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 text-xs text-amber-900 self-start sm:self-center shrink-0">
            <span className="font-bold block mb-0.5">Zero-Hallucination Policy:</span>
            <span>Human verification required before CRM dispatch</span>
          </div>
        </div>
      </div>

      {/* Review Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {flaggedLeads.map((lead) => {
          const isApproved = approvedIds[lead.id];
          const rep = lead.qcReport;

          return (
            <div
              key={lead.id}
              className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden ${
                isApproved
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-amber-300/80 hover:border-amber-400'
              }`}
            >
              {/* Card Top Strip */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {lead.id}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <h3 className="font-bold text-base text-slate-900 truncate">
                      {lead.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        lead.priority === 'HIGH'
                          ? 'bg-indigo-100 text-indigo-800'
                          : lead.priority === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {lead.priority} &bull; {lead.priorityScore}
                    </span>
                  </div>
                </div>

                {/* Issue Category Pill & Evaluator Score */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>{rep?.issueDetected || lead.qcReason || 'Review Required'}</span>
                  </span>

                  {lead.evaluatorReport && (
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      Evaluator Quality: {lead.evaluatorReport.weightedScore}%
                    </span>
                  )}
                </div>

                {/* Issue Details Box */}
                <div className="space-y-2 text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  {rep?.sourceData && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        Source Fact:
                      </span>
                      <p className="font-mono text-[11px] text-slate-800 truncate">
                        {rep.sourceData}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                      AI Guardrail Trigger:
                    </span>
                    <p className="text-slate-800 leading-relaxed font-medium">
                      {rep?.problem || lead.qcReason}
                    </p>
                  </div>

                  {rep?.recommendedFix && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        Recommended Fix:
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {rep.recommendedFix}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 pt-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectLeadForReview(lead.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition shadow-2xs cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Review Lead</span>
                </button>

                <button
                  disabled={!onApproveLead}
                  title={!onApproveLead ? "Approval persistence is not implemented yet" : undefined}
                  onClick={(e) => handleApprove(lead.id, e)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isApproved
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isApproved ? 'Approved' : 'Approve'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
