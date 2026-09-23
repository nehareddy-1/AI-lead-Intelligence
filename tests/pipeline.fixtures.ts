import { DIMENSIONS } from '../server/agents/evaluator';
import type { EnrichmentResult } from '../server/agents/enrichment';
import type { RequestClassification } from '../server/services/openai';

export const enrichment: EnrichmentResult = {
  profile: 'Unknown', intent: 'Unknown', potentialNeeds: [], objections: [], missingInformation: ['Career intent'], potentialOpportunity: 'Unknown', recommendedNextAction: 'Clarify career intent.', evidence: [],
  signals: { intent: { value: 'unknown', evidence: [] }, urgency: { value: 'unknown', evidence: [] }, buyingSignal: { value: 'unknown', evidence: [] } },
};
export const outreach = { recommendedNextAction: 'Clarify interest.', personalizedOutreach: 'Could you tell us about your career goals?', evidence: [] };
export const evaluation = { metrics: Object.fromEntries(DIMENSIONS.map(key => [key, { score: 95, issues: [] }])), hardFlags: [], evaluationSummary: 'Source-grounded outputs.' };
export const classification = { relevant: 'Review', reason: 'Insufficient source information.', confidence: 0.2, evidence: [] };

// Every batched stage sends `{ leads: [{ leadId, ... }, ...] }` and expects back exactly one
// `{ leadId, ...fields }` result per lead, wrapped in `{ results: [...] }`. This fixture mirrors
// that shape for every stage regardless of how many leads are in the request, so it's a valid
// mock for a batch of 1 lead or a batch of many.
export const fixtureRequest: RequestClassification = async (request, count) => {
  count();
  const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
  const leadIds = body.leads.map(lead => lead.leadId);
  const item = request.schemaName === 'lead_evaluator' ? evaluation
    : request.schemaName === 'lead_enrichment' ? enrichment
    : request.schemaName === 'lead_outreach' ? outreach
    : classification;
  return { model: 'test-model', text: JSON.stringify({ results: leadIds.map(leadId => ({ leadId, ...item })) }) };
};
