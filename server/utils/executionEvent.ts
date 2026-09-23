import { randomUUID } from 'node:crypto';
import type { ExecutionEvent } from '../../src/types/lead';
import type { CleaningResult, OriginalLead } from '../types/pipeline';

export function cleaningEvent(runId: string, input: OriginalLead, startedAt: string, start: number, output?: CleaningResult): ExecutionEvent {
  const durationMs = performance.now() - start;
  return {
    id: randomUUID(), runId, leadId: input.id, leadName: input.name || undefined,
    component: 'clean', componentName: 'Cleaning Engine', componentType: 'deterministic',
    input: structuredClone(input), output: output ? structuredClone(output) : {},
    startedAt, completedAt: new Date().toISOString(), durationMs,
    durationFormatted: `${durationMs.toFixed(3)} ms`, status: output ? 'success' : 'failed',
    error: output ? null : { type: 'CLEANING_ERROR', message: 'Cleaning could not complete for this record.' },
    model: null, promptVersion: null, validation: output?.validation,
    summary: output ? 'Deterministic cleaning completed.' : 'Cleaning failed; other records continue.',
  };
}
