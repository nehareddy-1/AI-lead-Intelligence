import React, { useState } from 'react';
import { 
  Check, 
  Copy, 
  Phone, 
  Mail, 
  MapPin, 
  Award, 
  Clock, 
  Target, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  HelpCircle, 
  Compass,
  MessageSquare
} from 'lucide-react';
import { ProcessedLead } from '../types/lead';
import { QCReviewCard } from './QCReviewCard';
import { InputOutputComparison } from './InputOutputComparison';
import { QualityEvaluationCard } from './QualityEvaluationCard';
import { LeadExecutionLogs } from './LeadExecutionLogs';

interface LeadDetailsProps {
  lead: ProcessedLead;
  onLeadReviewed?: (leadId: string) => void;
}

export const LeadDetails: React.FC<LeadDetailsProps> = ({
  lead,
  onLeadReviewed,
}) => {
  const [copied, setCopied] = useState(false);
  const [leadTab, setLeadTab] = useState<'result' | 'logs'>('result');

  const handleCopyOutreach = () => {
    navigator.clipboard.writeText(lead.personalizedOutreach);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const b = lead.scoreBreakdown || {
    fit: 18,
    intent: 22,
    careerReadiness: 12,
    urgency: 12,
    buyingSignal: 10,
    dataConfidence: 8,
    total: lead.priorityScore,
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-200/60">
                {lead.id}
              </span>
              <span className="text-xs text-slate-400">&bull;</span>
              <span className="text-xs text-slate-500 font-medium">
                Source: {lead.leadSource || 'Web Form'}
              </span>
              {lead.duplicateStatus === 'Confirmed Duplicate' && (
                <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                  Confirmed Duplicate{lead.duplicateOfLeadId ? ` of ${lead.duplicateOfLeadId}` : ''}
                </span>
              )}
              {lead.aiFallbackUsed && (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  AI Fallback Used
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {lead.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5 font-medium">
              {lead.profile}
            </p>
          </div>

          {/* Badges & Overall Score */}
          <div className="flex items-center gap-3">
            {/* Priority Badge */}
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Priority
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${
                  lead.priority === 'HIGH'
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : lead.priority === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {lead.priority}
              </span>
            </div>

            {/* Score Big Display */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Score
              </div>
              <div className="font-mono text-2xl font-bold text-slate-900">
                {lead.priorityScore}
                <span className="text-xs text-slate-400 font-normal">/100</span>
              </div>
            </div>

            {/* QC Badge */}
            <div className="text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                QC Status
              </div>
              {lead.qcStatus === 'PASS' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PASS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  REVIEW
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contact Info Strip */}
        <div className="pt-3 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600">
          {lead.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">{lead.phone}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{lead.email}</span>
            </div>
          )}
          {lead.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{lead.location}</span>
            </div>
          )}
          {lead.lastContacted && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Contacted: {lead.lastContacted}</span>
            </div>
          )}
        </div>

        {/* Primary Tabs for Selected Lead: [ Result ] [ Logs ] */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setLeadTab('result')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                leadTab === 'result'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Result</span>
            </button>

            <button
              onClick={() => setLeadTab('logs')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                leadTab === 'logs'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Logs</span>
              <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {lead.executionEvents?.length || 6}
              </span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {leadTab === 'result' ? 'Sales intelligence & quality evaluation' : 'Structured component execution history'}
          </span>
        </div>
      </div>

      {leadTab === 'logs' ? (
        <LeadExecutionLogs lead={lead} />
      ) : (
        <>
          {/* QC Review Alert if Flagged */}
          {lead.qcStatus === 'REVIEW' && (
            <QCReviewCard
              qcStatus={lead.qcStatus}
              qcReason={lead.qcReason}
              qcReport={lead.qcReport}
              leadName={lead.name}
            />
          )}

      {/* Next Best Action Card (Prominent CTA for Salesperson) */}
      <div className="bg-linear-to-r from-indigo-50/80 via-white to-indigo-50/40 rounded-2xl border-2 border-indigo-200/90 shadow-2xs p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
            Next Best Action for Salesperson
          </h3>
        </div>
        <p className="text-sm sm:text-base font-semibold text-slate-900 leading-snug pl-9">
          {lead.recommendedNextAction}
        </p>
      </div>

      {/* Personalized Outreach Message Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Personalized Outreach Draft
              </h3>
              <p className="text-[11px] text-slate-500">
                Synthesized based on specific candidate certifications, milestones, and questions
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyOutreach}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition shadow-2xs cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Message</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 font-sans text-xs sm:text-sm text-slate-800 leading-relaxed italic relative">
          "{lead.personalizedOutreach}"
        </div>
      </div>

      {/* 2-Column Synthesis Breakdown: Classification & Enrichment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Classification Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Classification</span>
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-600">
              Confidence: {lead.confidence}%
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-slate-500 font-semibold">Relevant: </span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  lead.relevant === 'YES'
                    ? 'bg-emerald-100 text-emerald-800'
                    : lead.relevant === 'REVIEW'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {lead.relevant}
              </span>
            </div>

            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Reason:</span>
              <p className="text-slate-800 leading-relaxed font-medium">
                {lead.relevanceReason}
              </p>
            </div>

            {lead.evidence && lead.evidence.length > 0 && (
              <div>
                <span className="text-slate-500 font-semibold block mb-1">
                  Evidence Detected:
                </span>
                <ul className="space-y-1 pl-1">
                  {lead.evidence.map((ev, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                      <span>{ev}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Intent & Needs Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Intent & Potential Needs</span>
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block mb-0.5">Intent:</span>
              <p className="text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                "{lead.intent}"
              </p>
            </div>

            {lead.potentialNeeds && lead.potentialNeeds.length > 0 && (
              <div>
                <span className="text-slate-500 font-semibold block mb-1">
                  Potential Needs:
                </span>
                <ul className="space-y-1 pl-1">
                  {lead.potentialNeeds.map((need, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                      <span>{need}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Objections, Missing Information & Opportunity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Objections / Concerns */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Objections / Concerns</span>
          </h4>
          <ul className="text-xs text-slate-700 space-y-1">
            {lead.objections && lead.objections.length > 0 ? (
              lead.objections.map((obj, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500">&bull;</span>
                  <span>{obj}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">None detected</li>
            )}
          </ul>
        </div>

        {/* Missing Information */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span>Missing Information</span>
          </h4>
          <p className="text-[11px] text-slate-500">
            Information the salesperson should actively collect:
          </p>
          <ul className="text-xs text-slate-700 space-y-1">
            {lead.missingInformation && lead.missingInformation.length > 0 ? (
              lead.missingInformation.map((info, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-500">&bull;</span>
                  <span className="font-medium text-slate-800">{info}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">All key fields populated</li>
            )}
          </ul>
        </div>

        {/* Potential Opportunity */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Potential Opportunity</span>
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            {lead.potentialOpportunity || 'Candidate eligible for standard healthcare matching program.'}
          </p>
        </div>
      </div>

      {/* Priority Scoring Explanation with Detailed Factors */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Priority Score Explanation
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic 6-factor weighting (Thresholds: 70–100 High, 50–69 Medium, 0–49 Low)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              TOTAL:
            </span>
            <span className="font-mono text-xl font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg">
              {b.total}/100
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                lead.priority === 'HIGH'
                  ? 'bg-indigo-100 text-indigo-800'
                  : lead.priority === 'MEDIUM'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {lead.priority} PRIORITY
            </span>
          </div>
        </div>

        {/* Horizontal Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Fit */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Fit (Healthcare & Degree)</span>
              <span className="font-mono font-bold text-slate-900">{b.fit}/20</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.fit / 20) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>

          {/* Intent */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Intent (Germany Relocation Motivation)</span>
              <span className="font-mono font-bold text-slate-900">{b.intent}/25</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.intent / 25) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>

          {/* Career Readiness */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Career Readiness (German Level & Experience)</span>
              <span className="font-mono font-bold text-slate-900">{b.careerReadiness}/15</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.careerReadiness / 15) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Urgency (Target Relocation Timeline)</span>
              <span className="font-mono font-bold text-slate-900">{b.urgency}/15</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.urgency / 15) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>

          {/* Buying Signal */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Buying Signal (Contract & Fee Inquiries)</span>
              <span className="font-mono font-bold text-slate-900">{b.buyingSignal}/15</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.buyingSignal / 15) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>

          {/* Data Confidence */}
          <div>
            <div className="flex justify-between font-medium text-slate-700 mb-1">
              <span>Data Confidence (Completeness of Fields)</span>
              <span className="font-mono font-bold text-slate-900">{b.dataConfidence}/10</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${(b.dataConfidence / 10) * 100}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Quality Evaluation Card (Independent Multi-Dimension Audit) */}
      <QualityEvaluationCard evaluatorReport={lead.evaluatorReport} />

      {/* Raw Conversation Source Drawer */}
      {lead.conversation && (
        <div className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold mb-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Raw Inbound Conversation / Note Source:</span>
          </div>
          <p className="text-slate-800 font-mono text-[11px] leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
            "{lead.conversation}"
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
};


// Partial pipeline runs use the existing Result / Logs pattern without synthesizing final AI fields.
export function CleaningLeadDetails({ run, leadId }: { run: import('../../server/types/pipeline').RunRecord; leadId: string }) {
  const [tab, setTab] = useState<'result' | 'logs'>('result');
  const original = run.originalLeads.find(lead => lead.id === leadId)!;
  const result = run.cleanedLeads.find(item => item.lead.id === leadId);
  const events = run.executionEvents.filter(event => event.leadId === leadId);
  const classification = run.classifications.find(item => item.leadId === leadId)?.result;
  const classificationEvent = events.find(event => event.component === 'classification');
  return <div className="space-y-4">
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h2 className="font-bold text-lg">{result?.lead.name || original.name || leadId}</h2>
      <div className="flex gap-2 mt-3">
        <button className={`px-4 py-2 rounded-lg ${tab === 'result' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`} onClick={() => setTab('result')}>Result</button>
        <button className={`px-4 py-2 rounded-lg ${tab === 'logs' ? 'bg-indigo-600 text-white' : 'bg-slate-100'}`} onClick={() => setTab('logs')}>Logs ({events.length})</button>
      </div>
    </div>
    {tab === 'logs' ? <LeadExecutionLogs lead={{ id: leadId, name: original.name, runId: run.runId, executionEvents: events }} /> :
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-bold">Cleaning result</h3>
        <p className="text-sm text-slate-500">Component results and evaluation. Outreach is a draft; nothing has been sent.</p>
        {result ? <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre> :
          <p>{events.find(event => event.component === 'clean' && event.error)?.error?.message || 'Waiting for cleaning.'}</p>}
        <h3 className="font-bold">Classification result</h3>
        {classification ? <div className="space-y-2 text-sm">
          <p><strong>{classification.relevant}</strong> · Confidence {(classification.confidence * 100).toFixed(0)}%</p>
          <p>{classification.reason}</p>
          <p className="font-semibold">Source evidence</p>
          <ul className="list-disc pl-5">{classification.evidence.map((quote, index) => <li key={index}>{quote}</li>)}</ul>
        </div> : <p className="text-sm">{classificationEvent?.error?.message || (classificationEvent?.status === 'running' ? 'Classifying with OpenAI…' : 'Waiting for classification.')}</p>}
        {(['enrichment', 'priority', 'outreach', 'evaluator'] as const).map(component => {
          const event = events.find(item => item.component === component);
          return <div key={component} className="space-y-2">
            <h3 className="font-bold capitalize">{component}{component === 'outreach' ? ' draft' : ' result'}</h3>
            {event?.status === 'success' ? <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(event.output, null, 2)}</pre> :
              <p className="text-sm">{event?.error?.message || (event?.status === 'running' ? 'Processing…' : events.some(item => item.status === 'failed') ? 'Not run: an earlier component failed.' : 'Waiting.')}</p>}
          </div>;
        })}
      </div>}
  </div>;
}
