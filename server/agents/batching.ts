import { ClassificationError } from '../services/openai';

// Wraps a per-lead item schema (which must declare its own `leadId` property, typically an enum
// restricted to this batch's actual lead ids) into the uniform "one call covers many leads"
// envelope every batched AI stage uses: { results: [ <item>, <item>, ... ] }.
export function buildBatchSchema(itemSchema: Record<string, unknown>, leadIds: string[]) {
  return {
    type: 'object', additionalProperties: false,
    properties: {
      results: { type: 'array', minItems: leadIds.length, maxItems: leadIds.length, items: itemSchema },
    },
    required: ['results'],
  };
}

export function leadIdProperty(leadIds: string[]) {
  return { type: 'string', enum: leadIds };
}

// A shared, generous-but-bounded output budget: batching means one response now has to carry
// every lead's structured output, not just one lead's.
export function outputBudget(leadCount: number): number {
  return Math.min(16000, 1200 * Math.max(1, leadCount) + 1200);
}

// Tier 1: the response ENVELOPE must be trustworthy before any individual lead's result is used --
// exactly one entry per requested lead id, no duplicates, no strangers. A failure here can't be
// safely attributed to one lead, so it fails the whole batch's stage (thrown, caught by the caller).
// Tier 2: each entry is independently validated by `validateItem`; a thrown ClassificationError
// there is captured against just that lead's id, so its batch-mates are unaffected.
export function parseBatchOutput<T>(
  raw: string,
  leadIds: string[],
  validateItem: (item: unknown, leadId: string) => T,
): Map<string, T | ClassificationError> {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new ClassificationError('BATCH_ENVELOPE_INVALID', 'Batch response was not valid JSON.', { rawResponseText: raw }); }
  const results = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length !== leadIds.length) {
    throw new ClassificationError('BATCH_ENVELOPE_INVALID', 'Batch response did not contain exactly one result per lead.', { rawResponseText: raw });
  }
  const expected = new Set(leadIds);
  const seen = new Set<string>();
  for (const item of results) {
    const leadId = (item as { leadId?: unknown } | null)?.leadId;
    if (typeof leadId !== 'string' || !expected.has(leadId) || seen.has(leadId)) {
      throw new ClassificationError('BATCH_ENVELOPE_INVALID', 'Batch response leadIds did not exactly match the requested batch.', { rawResponseText: raw });
    }
    seen.add(leadId);
  }
  const outcomes = new Map<string, T | ClassificationError>();
  for (const item of results) {
    const leadId = (item as { leadId: string }).leadId;
    try { outcomes.set(leadId, validateItem(item, leadId)); }
    catch (error) {
      if (error instanceof ClassificationError) {
        outcomes.set(leadId, error.details !== undefined ? error : new ClassificationError(error.code, error.message, item));
      } else {
        outcomes.set(leadId, new ClassificationError('INVALID_OUTPUT', "This lead's batched result failed validation.", item));
      }
    }
  }
  return outcomes;
}
