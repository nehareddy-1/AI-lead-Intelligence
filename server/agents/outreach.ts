import type { AgentPromptConfig } from '../../src/types/lead';
import type { OriginalLead, CleanedLead, ClassificationResult } from '../types/pipeline';
import type { PriorityResult } from '../pipeline/priority';
import { objectSchema, parseOutput, validateEvidence, SOURCE_CONTRACT, type EnrichmentResult } from './enrichment';
import type { RequestClassification } from '../services/openai';
export const OUTREACH_SCHEMA = objectSchema({ recommendedNextAction: { type: 'string' }, personalizedOutreach: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } });
export interface OutreachResult { recommendedNextAction: string; personalizedOutreach: string; evidence: string[] }
export async function draftOutreach(input: { originalLead: OriginalLead; cleanedLead: CleanedLead; classification: ClassificationResult; enrichment: EnrichmentResult; priority: PriorityResult }, prompt: AgentPromptConfig, model: string, request: RequestClassification, count: () => void) {
  const response = await request({ model, instructions: `${prompt.systemPrompt}\n\n${SOURCE_CONTRACT}\nDraft only; nothing is sent. For Review ask a concise clarification question and do not imply eligibility. For No suggest a respectful closure or fit clarification, not a sales pitch. Respect requests not to be contacted: state that outreach should not be sent. Never promise jobs, visas, admission, eligibility, prices or timelines absent verified source support. Priorities are internal and must not appear in the draft.`, input: JSON.stringify(input), schema: OUTREACH_SCHEMA, schemaName: 'lead_outreach' }, count);
  const result = parseOutput<OutreachResult>(response.text, OUTREACH_SCHEMA);
  validateEvidence(result.evidence, input.originalLead);
  return { result, response };
}
