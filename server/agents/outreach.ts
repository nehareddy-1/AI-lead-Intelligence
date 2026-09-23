import type { AgentPromptConfig } from '../../src/types/lead';
import type { OriginalLead, CleanedLead, ClassificationResult } from '../types/pipeline';
import type { PriorityResult } from '../pipeline/priority';
import { objectSchema, validateSchema, validateEvidence, SOURCE_CONTRACT, BATCH_CONTRACT, type EnrichmentResult } from './enrichment';
import { buildBatchSchema, leadIdProperty, outputBudget, parseBatchOutput } from './batching';
import type { RequestClassification } from '../services/openai';

export const OUTREACH_FIELDS = { recommendedNextAction: { type: 'string' }, personalizedOutreach: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } };
export const OUTREACH_SCHEMA = objectSchema(OUTREACH_FIELDS);
export const outreachItemSchema = (leadIds: string[]) => objectSchema({ leadId: leadIdProperty(leadIds), ...OUTREACH_FIELDS });
export interface OutreachResult { recommendedNextAction: string; personalizedOutreach: string; evidence: string[] }

// One OpenAI call covers every lead in `entries`. Returns the shared response plus a per-lead
// outcome map (result or an error isolated to that one lead) via the shared two-tier validator.
export async function draftOutreachBatch(
  entries: { original: OriginalLead; cleaned: CleanedLead; classification: ClassificationResult; enrichment: EnrichmentResult; priority: PriorityResult }[],
  prompt: AgentPromptConfig, model: string, request: RequestClassification, count: () => void,
) {
  const leadIds = entries.map(entry => entry.original.id);
  const itemSchema = outreachItemSchema(leadIds);
  const input = { leads: entries.map(({ original, cleaned, classification, enrichment, priority }) => ({ leadId: original.id, originalLead: original, cleanedLead: cleaned, classification, enrichment, priority })) };
  const response = await request({
    model, instructions: `${prompt.systemPrompt}\n\n${SOURCE_CONTRACT}\n${BATCH_CONTRACT}\nDraft only; nothing is sent. For Review ask a concise clarification question and do not imply eligibility. For No suggest a respectful closure or fit clarification, not a sales pitch. Respect requests not to be contacted: state that outreach should not be sent. Never promise jobs, visas, admission, eligibility, prices or timelines absent verified source support. Priorities are internal and must not appear in the draft.`,
    input: JSON.stringify(input), schema: buildBatchSchema(itemSchema, leadIds),
    schemaName: 'lead_outreach', maxOutputTokens: outputBudget(entries.length),
  }, count);
  const originalById = new Map(entries.map(entry => [entry.original.id, entry.original]));
  const validateItem = (item: unknown, leadId: string): OutreachResult => {
    validateSchema(item, itemSchema);
    const { leadId: _leadId, ...rest } = item as OutreachResult & { leadId: string };
    validateEvidence(rest.evidence, originalById.get(leadId)!);
    return rest;
  };
  const outcomes = parseBatchOutput<OutreachResult>(response.text, leadIds, validateItem);
  return { outcomes, response };
}
