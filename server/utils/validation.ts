import { ClassificationError } from '../services/openai';
import type { StartRunRequest } from '../types/pipeline';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

// Evidence provenance, with a narrow, bounded tolerance for the model dropping a stray word from an
// otherwise-verbatim quote (observed in practice: "wants to understand jobs" for source text "wants
// to understand available jobs"). An exact contiguous quote always passes first (the fast, common
// path); the fuzzy fallback below only ever accepts quotes whose words appear, UNREORDERED, within a
// SINGLE source field -- it never reorders words, never spans two fields, and never invents words
// that aren't in the source. It only forgives a small number of skipped words, scaled down for short
// quotes, so this stays "the model paraphrased one connector word," never "the model synthesized a
// new claim." Quotes under 4 words get no tolerance at all -- there's not enough length for "mostly
// the same words" to mean anything, so those still require an exact match.
const words = (s: string) => s.match(/[\p{L}\p{N}]+/gu) ?? [];
function isNearVerbatim(quote: string, source: string): boolean {
  if (source.includes(quote)) return true;
  const quoteTokens = words(quote);
  if (quoteTokens.length < 4) return false;
  const sourceTokens = words(source);
  const maxTotalGap = Math.min(2, Math.floor(quoteTokens.length / 4));
  for (let start = 0; start < sourceTokens.length; start++) {
    if (sourceTokens[start] !== quoteTokens[0]) continue;
    let si = start + 1;
    let totalGap = 0;
    let ok = true;
    for (let qi = 1; qi < quoteTokens.length; qi++) {
      if (sourceTokens[si] === quoteTokens[qi]) { si++; continue; }
      if (sourceTokens[si + 1] === quoteTokens[qi]) { si += 2; totalGap++; continue; }
      ok = false; break;
    }
    if (ok && totalGap <= maxTotalGap) return true;
  }
  return false;
}
// `quote` is raw (un-normalized); `normalizedSources` must already be normalized.
export const isSupportedQuote = (quote: string, normalizedSources: string[]): boolean => {
  const normalized = normalize(quote);
  return normalizedSources.some(source => isNearVerbatim(normalized, source));
};

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
  const sources = Object.entries(original).filter(([key, field]) => key !== 'id' && typeof field === 'string' && field.trim()).map(([, field]) => normalize(field!));
  const evidence = item.evidence as string[];
  if (evidence.some(quote => !isSupportedQuote(quote, sources))) {
    throw new ClassificationError('UNSUPPORTED_EVIDENCE', 'Classification evidence contained text not present in the source lead.');
  }
  // Only a Yes must be backed by cited evidence -- asserting fit out of nowhere is the real risk.
  // A No is allowed to have empty evidence: it can be a well-justified structural call (most
  // notably a duplicate lead, where the prompt deliberately forbids citing text that merely
  // describes the duplicate relationship, and there is often no other genuine fit-evidence to
  // quote). Requiring evidence there would force every honest duplicate "No" back into Review.
  if (evidence.length === 0 && item.relevant === 'Yes') {
    throw new ClassificationError('UNSUPPORTED_DECISION', 'A classification without source evidence cannot be Yes.');
  }
  const { leadId: _leadId, ...rest } = item;
  return rest as unknown as import('../types/pipeline').ClassificationResult;
}
