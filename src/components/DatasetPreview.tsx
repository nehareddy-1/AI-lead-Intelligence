import React from 'react';
import { 
  CheckCircle, 
  FileSpreadsheet, 
  Users, 
  Columns, 
  AlertTriangle, 
  Copy, 
  Play, 
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { DatasetValidationSummary } from '../types/lead';

interface DatasetPreviewProps {
  filename: string;
  summary: DatasetValidationSummary;
  onRunAnalysis: () => void;
  onReset: () => void;
}

export const DatasetPreview: React.FC<DatasetPreviewProps> = ({
  filename,
  summary,
  onRunAnalysis,
  onReset,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Upload Success Banner */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Ready for AI Processing
              </span>
              <span className="text-[11px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full font-medium">
                Verified RFC CSV
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>{filename}</span>
            </h2>
          </div>
        </div>

        <button
          onClick={onReset}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Upload Different File</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Leads</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {summary.totalLeads}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Records ready for pipeline
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Columns Detected</span>
            <Columns className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {summary.columnsDetected}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium truncate">
            {summary.columnNames.slice(0, 3).join(', ')}...
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Missing Values</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600">
            {summary.missingFieldsCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Flagged for AI enrichment
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Potential Duplicates</span>
            <Copy className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900">
            {summary.potentialDuplicatesCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Duplicate phones/emails
          </p>
        </div>
      </div>

      {/* Dataset Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Dataset Preview (First {Math.min(6, summary.previewRows.length)} Records)
            </h3>
            <p className="text-xs text-slate-500">
              Raw uncleaned records extracted from CSV
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-md">
            Showing top {Math.min(6, summary.previewRows.length)} of {summary.totalLeads}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Lead ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Education</th>
                <th className="py-3 px-4">Experience</th>
                <th className="py-3 px-4">German Level</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 min-w-[280px]">Conversation / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {summary.previewRows.slice(0, 6).map((lead, idx) => (
                <tr key={lead.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-slate-500">
                    {lead.id || `L${String(idx + 1).padStart(3, '0')}`}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {lead.name}
                  </td>
                  <td className="py-3 px-4">
                    {lead.education || <span className="text-amber-500 font-medium italic">Missing</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lead.experience || <span className="text-slate-400 italic">Not stated</span>}
                  </td>
                  <td className="py-3 px-4">
                    {lead.germanLevel ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {lead.germanLevel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {lead.location || '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600 leading-relaxed">
                    <p className="line-clamp-2" title={lead.conversation}>
                      {lead.conversation || <span className="text-slate-400 italic">No notes</span>}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Action Footer with Prominent CTA */}
        <div className="p-4 sm:p-6 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>
              Next: 6-stage AI workflow (Clean &rarr; Classify &rarr; Enrich &rarr; Prioritize &rarr; Outreach &rarr; QC Review)
            </span>
          </div>

          <button
            onClick={onRunAnalysis}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] transition shadow-md shadow-indigo-200 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Run AI Analysis</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
