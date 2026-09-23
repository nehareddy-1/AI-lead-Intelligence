import { ClassificationError } from '../services/openai';
import type { StartRunRequest } from '../types/pipeline';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function validateRunRequest(value: unknown): asserts value is StartRunRequest {
  if (!record(value) || !Array.isArray(value.leads) || value.leads.length < 1 || value.leads.length > 100) {
    throw new Error('Provide between 1 and 100 lead records.');
  }
  const ids = new Set<string>();
  for (const lead of value.leads) {
    if (!record(lead) || typeof lead.id !== 'string' || !lead.id.trim() || ids.has(lead.id)) {
      throw new Error('Every lead must have a unique, non-empty string ID.');
    }
    if (Object.entries(lead).some(([key, field]) => ['__proto__', 'constructor', 'prototype'].includes(key) || (field !== null && typeof field !== 'string'))) {
      throw new Error('Lead fields must be strings or null.');
    }
    ids.add(lead.id);
  }
  const config = value.configuration;
  if (!record(config) || !record(config.prompts) || !record(config.evaluatorWeights) || !record(config.thresholds)) {
    throw new Error('Provide prompts, evaluator weights, and thresholds.');
  }
  for (const key of ['classification', 'enrichment', 'outreach', 'evaluator']) {
    const prompt = config.prompts[key];
    if (!record(prompt) || prompt.id !== key || typeof prompt.name !== 'string' || typeof prompt.shortDesc !== 'string' || typeof prompt.systemPrompt !== 'string' || !prompt.systemPrompt.trim() || prompt.systemPrompt.length > 50000 || typeof prompt.version !== 'string' || !prompt.version.trim()) {
      throw new Error('Each agent requires prompt text, version, and metadata.');
    }
  }
  const keys = ['factual_grounding', 'intent_understanding', 'completeness', 'internal_consistency', 'outreach_alignment', 'uncertainty_handling'];
  const configuredWeights = config.evaluatorWeights;
  const weights = keys.map(key => configuredWeights[key]);
  if (weights.some(w => !finite(w) || w < 0 || w > 100) || Math.abs((weights as number[]).reduce((a, b) => a + b, 0) - 100) > 0.000001) {
    throw new Error('Evaluator weights must be non-negative numbers totaling 100.');
  }
  const { passThreshold, reviewThreshold } = config.thresholds;
  if (!finite(passThreshold) || !finite(reviewThreshold) || reviewThreshold < 0 || passThreshold > 100 || reviewThreshold >= passThreshold) {
    throw new Error('Thresholds must satisfy 0 <= review < pass <= 100.');
  }
  const { batchSize } = config;
  if (!finite(batchSize) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new Error('Batch size must be a whole number between 1 and 50.');
  }
}

// Validate one already-parsed batch entry independently of provider schema enforcement
// (including evidence provenance against THAT SAME lead's own original data). Envelope-level
// JSON parsing and leadId/count integrity are handled once, up front, by parseBatchOutput
// (server/agents/batching.ts); this is the per-lead (tier 2) check that runs against each entry.
export function validateClassificationItem(item: unknown, original: import('../types/pipeline').OriginalLead): import('../types/pipeline').ClassificationResult {
  if (!record(item) || Object.keys(item).sort().join(',') !== 'confidence,evidence,leadId,reason,relevant' ||
      typeof item.leadId !== 'string' || !item.leadId.trim() ||
      !['Yes', 'No', 'Review'].includes(String(item.relevant)) ||
      typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 2000 ||
      !finite(item.confidence) || item.confidence < 0 || item.confidence > 1 ||
      !Array.isArray(item.evidence) || item.evidence.length > 20 ||
      item.evidence.some(entry => typeof entry !== 'string' || !entry.trim() || entry.length > 2000)) {
    throw new ClassificationError('INVALID_CLASSIFICATION', 'Classification response did not match the required fields and value ranges.');
  }
  const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const sources = Object.entries(original).filter(([key, field]) => key !== 'id' && typeof field === 'string' && field.trim()).map(([, field]) => normalize(field!));
  const evidence = item.evidence as string[];
  if (evidence.some(quote => !sources.some(source => source.includes(normalize(quote))))) {
    throw new ClassificationError('UNSUPPORTED_EVIDENCE', 'Classification evidence contained text not present in the source lead.');
  }
  if (evidence.length === 0 && item.relevant !== 'Review') {
    throw new ClassificationError('UNSUPPORTED_DECISION', 'A classification without source evidence must be Review.');
  }
  const { leadId: _leadId, ...rest } = item;
  return rest as unknown as import('../types/pipeline').ClassificationResult;
}
