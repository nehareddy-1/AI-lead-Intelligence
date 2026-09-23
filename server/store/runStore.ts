import { EVALUATION_RULES_VERSION } from '../agents/evaluator';
import { PRIORITY_RULES_VERSION } from '../pipeline/priority';
import { classificationModel } from '../services/openai';
import { randomUUID } from 'node:crypto';
import type { RunRecord, StartRunRequest } from '../types/pipeline';

// This prototype uses in-memory run storage. Run data is lost when the backend process restarts or redeploys.
const runs = new Map<string, RunRecord>();
export function createRun(input: StartRunRequest, phase: RunRecord['phase'] = 'classification'): RunRecord {
  const run: RunRecord = {
    runId: randomUUID(), phase, classificationModel: phase !== 'cleaning' ? classificationModel() : null, classifications: [], enrichments: [], priorities: [], outreaches: [], evaluations: [], evaluationRulesVersion: EVALUATION_RULES_VERSION, priorityRulesVersion: PRIORITY_RULES_VERSION, status: 'waiting', createdAt: new Date().toISOString(),
    startedAt: null, completedAt: null, configurationSnapshot: structuredClone(input.configuration),
    totalLeads: input.leads.length, completedLeads: 0, currentLeadId: null, currentStage: null,
    originalLeads: structuredClone(input.leads), cleanedLeads: [], processedLeads: [],
    executionEvents: [], warnings: [], errors: [], aiInvocationCount: 0,
  };
  runs.set(run.runId, run);
  return structuredClone(run);
}
export function getRun(id: string): RunRecord | undefined {
  const run = runs.get(id);
  return run ? structuredClone(run) : undefined;
}
export function updateRun(id: string, changes: Partial<Omit<RunRecord, 'runId' | 'originalLeads' | 'configurationSnapshot'>>): void {
  const run = runs.get(id);
  if (!run) throw new Error('Run not found');
  Object.assign(run, structuredClone(changes));
}
