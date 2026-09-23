import type { AgentPromptConfig } from '../../src/types/lead';
import type { CleanedLead, ClassificationResult, OriginalLead } from '../types/pipeline';
import type { RequestClassification } from '../services/openai';
import { classificationAgent } from '../agents/classifier';
import { validateClassificationItem } from '../utils/validation';
import { parseBatchOutput } from '../agents/batching';

// One OpenAI call covers every lead in `entries`. Returns the shared response (for
// model/requestId/usage bookkeeping) plus a per-lead outcome map: each entry is either this
// lead's validated ClassificationResult, or a ClassificationError isolated to just that lead
// (a whole-envelope problem instead throws, caught by the caller -- see parseBatchOutput).
export async function classifyBatch(
  entries: { original: OriginalLead; cleaned: CleanedLead }[], prompt: AgentPromptConfig, model: string,
  request: RequestClassification, onInvocation: () => void,
) {
  const leadIds = entries.map(entry => entry.original.id);
  const originalById = new Map(entries.map(entry => [entry.original.id, entry.original]));
  const response = await classificationAgent(entries, prompt, model, request, onInvocation);
  const outcomes = parseBatchOutput<ClassificationResult>(
    response.text, leadIds,
    (item, leadId) => validateClassificationItem(item, originalById.get(leadId)!),
  );
  return { outcomes, response };
}
