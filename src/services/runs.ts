import type { AgentConfigurationState, RawLead, StructuredAgentLog, ExecutionEvent } from '../types/lead';
import type { RunRecord } from '../../server/types/pipeline';

async function readResponse(response: Response): Promise<RunRecord> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to load run.');
  return body as RunRecord;
}
export function startRun(leads: RawLead[], configuration: AgentConfigurationState, signal: AbortSignal) {
  return fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leads, configuration }), signal }).then(readResponse);
}
export function fetchRun(runId: string, signal: AbortSignal) {
  return fetch(`/api/runs/${encodeURIComponent(runId)}`, { signal }).then(readResponse);
}
// Both log surfaces derive from the SAME server event, never a second execution.
export function eventToActivity(event: ExecutionEvent): StructuredAgentLog {
  return { id: event.id, timestamp: event.completedAt || event.startedAt, stage: ({ clean: 'CLEAN', classification: 'CLASSIFY', enrichment: 'ENRICH', priority: 'PRIORITIZE', outreach: 'OUTREACH', evaluator: 'EVALUATE' } as const)[event.component], leadId: event.leadId,
    leadName: event.leadName || event.leadId, status: event.status === 'running' || event.status === 'waiting' ? 'running' : event.status === 'failed' ? 'error' : event.status === 'review' ? 'warning' : 'success',
    stageTitle: event.componentName, duration: event.durationFormatted, input: event.input,
    output: event.error ? { error: event.error } : event.output, summary: event.summary || '' };
}
export function pipelineCSV(run: RunRecord): string {
  const headers = ['Lead ID', 'Name', 'Email', 'Phone', 'Location', 'Education', 'Experience', 'German Level', 'Conversation', 'Duplicate Status', 'Duplicate Of', 'Duplicate Reason', 'Missing Fields', 'Invalid Fields', 'Warnings', 'Execution Status', 'Error', 'Relevant', 'Classification Reason', 'Confidence', 'Evidence', 'Profile', 'Intent', 'Needs', 'Objections', 'Missing Information', 'Opportunity', 'Priority Score', 'Priority', 'Score Breakdown', 'Priority Rules', 'Next Action', 'Outreach Draft', 'Quality Decision', 'Evaluation Score', 'Evaluation Metrics', 'Evaluation Issues', 'Evaluation Rules'];
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    // Spreadsheet-safe output while original values remain available in the logs.
    return `"${(/^[=+@\-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
  };
  const rows = run.originalLeads.map(original => {
    const result = run.cleanedLeads.find(item => item.lead.id === original.id);
    const event = run.executionEvents.filter(item => item.leadId === original.id).at(-1);
    const classification = run.classifications.find(item => item.leadId === original.id)?.result;
    const enrichment = run.enrichments.find(item => item.leadId === original.id)?.result;
    const priority = run.priorities.find(item => item.leadId === original.id)?.result;
    const outreach = run.outreaches.find(item => item.leadId === original.id)?.result;
    const evaluation = run.evaluations.find(item => item.leadId === original.id)?.result;
    const lead = result?.lead;
    return [original.id, lead?.name, lead?.email, lead?.phone, lead?.location, lead?.education, lead?.experience,
      lead?.germanLevel, lead?.conversation, result?.duplicateStatus, result?.duplicateOfLeadId, result?.duplicateReason,
      result?.validation.missingFields.join('; '), result?.validation.invalidFields.join('; '), result?.validation.warnings.join('; '), event?.status, event?.error?.message, classification?.relevant, classification?.reason, classification?.confidence, classification?.evidence.join('; '), enrichment?.profile, enrichment?.intent, enrichment?.potentialNeeds.join('; '), enrichment?.objections.join('; '), enrichment?.missingInformation.join('; '), enrichment?.potentialOpportunity, priority?.priorityScore, priority?.priority, priority ? JSON.stringify(priority.scoreBreakdown) : '', priority?.rulesVersion, outreach?.recommendedNextAction, outreach?.personalizedOutreach, evaluation?.finalDecision, evaluation?.weightedScore, evaluation ? JSON.stringify(evaluation.metrics) : '', evaluation?.allIssues.concat(evaluation.hardFlagsTriggered).join('; '), evaluation?.rulesVersion].map(escape).join(',');
  });
  return [headers.join(','), ...rows].join('\r\n');
}


export async function fetchConfiguration(signal: AbortSignal): Promise<AgentConfigurationState> {
  const response = await fetch('/api/configuration', { signal });
  if (!response.ok) throw new Error('Unable to load agent configuration from the backend.');
  return response.json();
}
