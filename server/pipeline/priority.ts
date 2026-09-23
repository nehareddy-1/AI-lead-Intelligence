import type { ScoreBreakdown, PriorityLevel } from '../../src/types/lead';
import type { CleaningResult, ClassificationResult } from '../types/pipeline';
import type { EnrichmentResult } from '../agents/enrichment';
export const PRIORITY_RULES_VERSION = 'priority-v1';
export interface PriorityResult { priority: PriorityLevel; priorityScore: number; scoreBreakdown: ScoreBreakdown; rulesVersion: string; reasons: string[] }
export function prioritizeLead(cleaned: CleaningResult, classification: ClassificationResult, enrichment: EnrichmentResult): PriorityResult {
  const valid = (field: string) => Boolean(cleaned.lead[field]) && !cleaned.validation.invalidFields.includes(field);
  const parts = {
    fit: { Yes: 20, Review: 10, No: 0 }[classification.relevant],
    intent: { explicit: 25, exploratory: 12, unknown: 0 }[enrichment.signals.intent.value],
    careerReadiness: ({ C2: 15, C1: 15, B2: 15, B1: 12, A2: 8, A1: 4 } as Record<string, number>)[cleaned.lead.germanLevel || ''] || 0,
    urgency: { immediate: 15, planned: 8, unknown: 0 }[enrichment.signals.urgency.value],
    buyingSignal: { commitment: 15, inquiry: 8, unknown: 0 }[enrichment.signals.buyingSignal.value],
    dataConfidence: (valid('phone') ? 3 : 0) + (valid('email') ? 3 : 0) + (valid('education') ? 2 : 0) + (/^(A[12]|B[12]|C[12])$/.test(cleaned.lead.germanLevel || '') ? 2 : 0),
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  let priority: PriorityLevel = total >= 70 ? 'HIGH' : total >= 50 ? 'MEDIUM' : 'LOW';
  const reasons = Object.entries(parts).map(([key, value]) => `${key}: ${value}`);
  if (classification.relevant === 'No') { priority = 'LOW'; reasons.push('Non-relevant lead: priority limited to LOW.'); }
  if ((classification.relevant === 'Review' || cleaned.duplicateStatus === 'Duplicate') && priority === 'HIGH') { priority = 'MEDIUM'; reasons.push('Unverified fit or duplicate: priority limited to MEDIUM.'); }
  return { priority, priorityScore: total, scoreBreakdown: { ...parts, total }, rulesVersion: PRIORITY_RULES_VERSION, reasons };
}
