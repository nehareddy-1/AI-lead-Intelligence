import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  CheckCircle2, 
  ShieldAlert, 
  XCircle, 
  Users,
  Flame,
  ArrowUpDown
} from 'lucide-react';
import { ProcessedLead, PriorityLevel, QCStatus } from '../types/lead';
import { LeadDetails } from './LeadDetails';

interface LeadExplorerProps {
  leads: ProcessedLead[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
}

export const LeadExplorer: React.FC<LeadExplorerProps> = ({
  leads,
  selectedLeadId,
  onSelectLead,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | PriorityLevel>('ALL');
  const [relevanceFilter, setRelevanceFilter] = useState<'ALL' | 'YES' | 'REVIEW' | 'NO'>('ALL');
  const [qcFilter, setQcFilter] = useState<'ALL' | QCStatus>('ALL');
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name'>('score_desc');

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = lead.name.toLowerCase().includes(q);
          const matchId = lead.id.toLowerCase().includes(q);
          const matchEdu = (lead.education || '').toLowerCase().includes(q);
          const matchConv = (lead.conversation || '').toLowerCase().includes(q);
          const matchLoc = (lead.location || '').toLowerCase().includes(q);
          if (!matchName && !matchId && !matchEdu && !matchConv && !matchLoc) {
            return false;
          }
        }

        // Priority filter
        if (priorityFilter !== 'ALL' && lead.priority !== priorityFilter) {
          return false;
        }

        // Relevance filter
        if (relevanceFilter !== 'ALL' && lead.relevant !== relevanceFilter) {
          return false;
        }

        // QC filter
        if (qcFilter !== 'ALL' && lead.qcStatus !== qcFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') return b.priorityScore - a.priorityScore;
        if (sortBy === 'score_asc') return a.priorityScore - b.priorityScore;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [leads, searchQuery, priorityFilter, relevanceFilter, qcFilter, sortBy]);

  // Determine currently selected lead
  const currentLead = useMemo(() => {
    if (selectedLeadId) {
      const found = leads.find((l) => l.id === selectedLeadId);
      if (found) return found;
    }
    return filteredLeads[0] || leads[0] || null;
  }, [leads, selectedLeadId, filteredLeads]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Filters & Lead List (5 cols on lg) */}
      <div className="lg:col-span-5 space-y-4">
        {/* Search & Quick Filters Container */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, education, notes..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Groups */}
          <div className="space-y-2.5 text-xs pt-1 border-t border-slate-100">
            {/* Priority Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-semibold w-16">Priority:</span>
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    priorityFilter === p
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Relevance Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-semibold w-16">Relevance:</span>
              {(['ALL', 'YES', 'REVIEW', 'NO'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRelevanceFilter(r)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    relevanceFilter === r
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r === 'YES' ? 'Relevant' : r === 'REVIEW' ? 'Review' : r === 'NO' ? 'Not Rel.' : 'All'}
                </button>
              ))}
            </div>

            {/* QC Status Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 text-[11px] font-semibold w-16">QC Status:</span>
              {(['ALL', 'PASS', 'REVIEW'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQcFilter(q)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    qcFilter === q
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Count & Sort Header */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-800">{filteredLeads.length}</strong> of {leads.length} leads
            </span>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 focus:outline-none"
            >
              <option value="score_desc">Score (High &rarr; Low)</option>
              <option value="score_asc">Score (Low &rarr; High)</option>
              <option value="name">Name (A &rarr; Z)</option>
            </select>
          </div>
        </div>

        {/* Filtered Lead List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden max-h-[680px] overflow-y-auto divide-y divide-slate-100">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No leads match the selected criteria.
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = currentLead?.id === lead.id;

              return (
                <div
                  key={lead.id}
                  onClick={() => onSelectLead(lead.id)}
                  className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-50/70 border-l-4 border-indigo-600 pl-3'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {lead.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {lead.id}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {lead.education || 'No degree'} &bull; {lead.germanLevel || 'German: N/A'}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1.5">
                      {lead.duplicateStatus === 'Potential Duplicate' && (
                        <span className="text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">
                          Duplicate
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 truncate">
                        {lead.recommendedNextAction.slice(0, 42)}...
                      </span>
                    </div>
                  </div>

                  {/* Right score and badges */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-base font-bold text-slate-900">
                        {lead.priorityScore}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          lead.priority === 'HIGH'
                            ? 'bg-indigo-100 text-indigo-800'
                            : lead.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {lead.priority}
                      </span>
                    </div>

                    <div>
                      {lead.qcStatus === 'PASS' ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ PASS
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300">
                          ⚠ REVIEW
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Full Lead Details Panel (7 cols on lg) */}
      <div className="lg:col-span-7">
        {currentLead ? (
          <LeadDetails lead={currentLead} />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            Select a lead from the list to view comprehensive AI qualification, scoring breakdown, and outreach drafts.
          </div>
        )}
      </div>
    </div>
  );
};
