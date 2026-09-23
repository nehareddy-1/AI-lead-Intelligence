import React, { useState } from 'react';
import { Copy, Eye, Check, Link2 } from 'lucide-react';
import { ProcessedLead } from '../types/lead';

interface DuplicateQueueProps {
  leads: ProcessedLead[];
  onSelectLeadForReview: (leadId: string) => void;
  onAcknowledgeLead?: (leadId: string) => void;
}

// Confirmed duplicates always come from a deterministic, exact email/phone match in Cleaning --
// never an AI guess -- so this is a lighter-weight confirmation surface than the Review Queue
// (which is reserved for leads needing an actual judgment call). It exists so a run with a lot of
// duplicate submissions doesn't bury genuinely ambiguous leads under an easy "yes, that's a dup" click.
export const DuplicateQueue: React.FC<DuplicateQueueProps> = ({
  leads,
  onSelectLeadForReview,
  onAcknowledgeLead,
}) => {
  const duplicateLeads = leads.filter((l) => l.duplicateStatus === 'Confirmed Duplicate');
  const [acknowledgedIds, setAcknowledgedIds] = useState<Record<string, boolean>>({});

  const handleAcknowledge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAcknowledgeLead) return;
    setAcknowledgedIds((prev) => ({ ...prev, [id]: true }));
    onAcknowledgeLead(id);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
              <Copy className="w-6 h-6 text-rose-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Confirmed Duplicates
                </h2>
                <span className="bg-rose-100 text-rose-800 border border-rose-300 font-mono text-xs font-bold px-2 py-0.5 rounded-full">
                  {duplicateLeads.length} Leads
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                Each of these matched an existing lead's normalized email or phone number exactly --
                a deterministic check, not an AI judgment call. They're excluded from outreach and
                kept here, separate from the Review Queue, for a quick confirmation rather than
                competing with genuinely ambiguous leads for review time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {duplicateLeads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-10 text-center text-sm text-slate-500">
          No confirmed duplicates in this run.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {duplicateLeads.map((lead) => {
            const isAcknowledged = acknowledgedIds[lead.id];

            return (
              <div
                key={lead.id}
                className={`bg-white rounded-2xl border-2 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden ${
                  isAcknowledged
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : 'border-rose-200/80 hover:border-rose-300'
                }`}
              >
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
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      Priority: LOW
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-300">
                      <Link2 className="w-3 h-3 text-rose-600" />
                      <span>
                        Duplicate of {lead.duplicateOfLeadId || 'an existing lead'}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        Match Reason:
                      </span>
                      <p className="text-slate-800 leading-relaxed font-medium">
                        {lead.duplicateReason || 'Matched on normalized contact details.'}
                      </p>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                        Classification:
                      </span>
                      <p className="text-slate-700 leading-relaxed">
                        {lead.relevanceReason}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectLeadForReview(lead.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition shadow-2xs cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>View Lead</span>
                  </button>

                  <button
                    disabled={!onAcknowledgeLead}
                    title={!onAcknowledgeLead ? 'Acknowledgement persistence is not implemented yet' : undefined}
                    onClick={(e) => handleAcknowledge(lead.id, e)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isAcknowledged
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAcknowledged ? 'Acknowledged' : 'Acknowledge'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
