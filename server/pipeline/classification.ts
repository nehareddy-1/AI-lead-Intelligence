import type { AgentPromptConfig } from '../../src/types/lead';
import type { CleanedLead, OriginalLead } from '../types/pipeline';
import type { RequestClassification } from '../services/openai';
import { classificationAgent, classificationInput } from '../agents/classifier';
import { validateClassification } from '../utils/validation';

export async function classifyLead(
  original: OriginalLead, cleaned: CleanedLead, prompt: AgentPromptConfig, model: string,
  request: RequestClassification, onInvocation: () => void,
) {
  const response = await classificationAgent(classificationInput(original, cleaned), prompt, model, request, onInvocation);
  return { result: validateClassification(response.text, original), response };
}
