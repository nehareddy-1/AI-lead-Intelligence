import React from 'react';
import { 
  Users, 
  Target, 
  Flame, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowUpRight, 
  CheckCircle2, 
  PhoneCall, 
  ChevronRight,
  TrendingUp,
  BarChart2,
  Copy
} from 'lucide-react';
import { ProcessedLead } from '../types/lead';

interface DashboardOverviewProps {
  leads: ProcessedLead[];
  onSelectLead: (leadId: string) => void;
  onNavigateToTab: (tab: 'explorer' | 'review' | 'duplicates') => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  leads,
  onSelectLead,
  onNavigateToTab,
}) => {
  const totalLeads = leads.length;
  const relevantLeads = leads.filter((l) => l.relevant === 'YES').length;
  const highPriorityLeads = leads.filter((l) => l.priority === 'HIGH').length;
  const mediumPriorityLeads = leads.filter((l) => l.priority === 'MEDIUM').length;
  const lowPriorityLeads = leads.filter((l) => l.priority === 'LOW').length;
  // Confirmed duplicates have their own dedicated view (see the Confirmed Duplicates tab/tile
  // below) so they no longer inflate this "needs a judgment call" count.
  const reviewLeads = leads.filter((l) => l.qcStatus !== 'PASS' || l.relevant === 'REVIEW').length;
  const duplicateLeads = leads.filter((l) => l.duplicateStatus === 'Confirmed Duplicate').length;

  // Top Sales Opportunities: sorted by priorityScore descending, taking top 6
  const topOpportunities = leads.filter(lead => lead.qcStatus === 'PASS' && lead.relevant === 'YES')
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 6);

  const highPercent = totalLeads > 0 ? Math.round((highPriorityLeads / totalLeads) * 100) : 0;
  const medPercent = totalLeads > 0 ? Math.round((mediumPriorityLeads / totalLeads) * 100) : 0;
  const lowPercent = totalLeads > 0 ? Math.round((lowPriorityLeads / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3.5">
        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Total Leads</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalLeads}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Uploaded dataset</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-1 flex items-center justify-between">
            <span>Relevant Leads</span>
            <Target className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-900">{relevantLeads}</div>
          <p className="text-[11px] text-indigo-600 mt-1 font-medium">Healthcare match</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center justify-between">
            <span>High Priority</span>
            <Flame className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-900">{highPriorityLeads}</div>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">Score &ge; 70</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1 flex items-center justify-between">
            <span>Medium Priority</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{mediumPriorityLeads}</div>
          <p className="text-[11px] text-amber-600 mt-1 font-medium">Score 50–69</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Low Priority</span>
            <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700">{lowPriorityLeads}</div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">Score &lt; 50</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-300 bg-amber-50/30 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1 flex items-center justify-between">
            <span>Needs Review</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{reviewLeads}</div>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">Flagged for human QC</p>
        </div>

        <button
          onClick={() => onNavigateToTab('duplicates')}
          className="text-left bg-white rounded-xl p-4 border border-rose-200 bg-rose-50/30 shadow-2xs hover:border-rose-300 transition cursor-pointer"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 mb-1 flex items-center justify-between">
            <span>Confirmed Duplicates</span>
            <Copy className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-900">{duplicateLeads}</div>
          <p className="text-[11px] text-rose-700 mt-1 font-medium">Exact contact match</p>
        </button>
      </div>

      {/* Priority Distribution Bar Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Priority Score Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic 6-factor weighting (Fit, Intent, Career Readiness, Urgency, Buying Signal, Data Confidence)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-indigo-700">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              HIGH: {highPriorityLeads} ({highPercent}%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              MEDIUM: {mediumPriorityLeads} ({medPercent}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              LOW: {lowPriorityLeads} ({lowPercent}%)
            </span>
          </div>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
          <div
            style={{ width: `${highPercent}%` }}
            className="bg-indigo-600 h-full transition-all duration-500"
            title={`High Priority: ${highPriorityLeads}`}
          />
          <div
            style={{ width: `${medPercent}%` }}
            className="bg-amber-400 h-full transition-all duration-500"
            title={`Medium Priority: ${mediumPriorityLeads}`}
          />
          <div
            style={{ width: `${lowPercent}%` }}
            className="bg-slate-300 h-full transition-all duration-500"
            title={`Low Priority: ${lowPriorityLeads}`}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              70 &ndash; 100
            </span>
            <span>Immediate sales contact &bull; High readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              50 &ndash; 69
            </span>
            <span>Mid-readiness &bull; Language nurture track</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              0 &ndash; 49
            </span>
            <span>Non-relevant or low readiness</span>
          </div>
        </div>
      </div>

      {/* Top Sales Opportunities Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Top Sales Opportunities
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Highest-scoring verified leads ready for immediate consultative outreach
            </p>
          </div>

          <button
            onClick={() => onNavigateToTab('explorer')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer self-start sm:self-center"
          >
            <span>Explore All {totalLeads} Leads</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Relevant</th>
                <th className="py-3 px-4">QC Status</th>
                <th className="py-3 px-4 min-w-[240px]">Next Action</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {topOpportunities.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead.id)}
                  className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        {lead.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-slate-900 font-bold group-hover:text-indigo-600 transition">
                          {lead.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">
                          {lead.education} &bull; {lead.germanLevel || 'German: N/A'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {lead.priorityScore}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">/100</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {lead.priority}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {lead.relevant}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    {lead.qcStatus === 'PASS' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ PASS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                        {lead.qcStatus === 'FAIL' ? '✕ FAIL' : '⚠ REVIEW'}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    <div className="flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-sm" title={lead.recommendedNextAction}>
                        {lead.recommendedNextAction}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLead(lead.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                    >
                      <span>View</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
