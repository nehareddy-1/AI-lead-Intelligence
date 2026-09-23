import { DIMENSIONS } from '../server/agents/evaluator';
import type { EnrichmentResult } from '../server/agents/enrichment';
import type { RequestClassification } from '../server/services/openai';
export const enrichment: EnrichmentResult = {
  profile: 'Unknown', intent: 'Unknown', potentialNeeds: [], objections: [], missingInformation: ['Career intent'], potentialOpportunity: 'Unknown', recommendedNextAction: 'Clarify career intent.', evidence: [],
  signals: { intent: { value: 'unknown', evidence: [] }, urgency: { value: 'unknown', evidence: [] }, buyingSignal: { value: 'unknown', evidence: [] } },
};
export const outreach = { recommendedNextAction: 'Clarify interest.', personalizedOutreach: 'Could you tell us about your career goals?', evidence: [] };
export const evaluation = { metrics: Object.fromEntries(DIMENSIONS.map(key => [key, { score: 95, issues: [] }])), hardFlags: [], evaluationSummary: 'Source-grounded outputs.' };
export const fixtureRequest: RequestClassification = async (request, count) => {
  count();
  return { model: 'test-model', text: JSON.stringify(request.schemaName === 'lead_evaluator' ? evaluation : request.schemaName === 'lead_enrichment' ? enrichment : request.schemaName === 'lead_outreach' ? outreach : { relevant: 'Review', reason: 'Insufficient source information.', confidence: 0.2, evidence: [] }) };
};
