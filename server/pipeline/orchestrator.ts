import { evaluateLead } from '../agents/evaluator';
import { enrichLead } from '../agents/enrichment';
import { draftOutreach } from '../agents/outreach';
import { prioritizeLead } from './priority';
import { randomUUID } from 'node:crypto';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import type { ExecutionEvent } from '../../src/types/lead';
import { cleanLead } from './cleaning';
import { classifyLead } from './classification';
import { classificationInput } from '../agents/classifier';
import { ClassificationError, createOpenAIRequest, requireOpenAIKey, type RequestClassification } from '../services/openai';
import { getRun, updateRun } from '../store/runStore';
import { cleaningEvent } from '../utils/executionEvent';

// Sequential per lead: Cleaning -> Classification -> Enrichment -> Priority -> Outreach -> STOP. No fabricated later-stage results.
export async function runPipeline(runId: string, request?: RequestClassification, cleaner: typeof cleanLead = cleanLead): Promise<void> {
  const run = getRun(runId);
  if (!run || run.status !== 'waiting') return;
  updateRun(runId, { status: 'running', startedAt: new Date().toISOString() });
  for (const original of run.originalLeads) {
    updateRun(runId, { currentLeadId: original.id, currentStage: 'CLEAN' });
    const cleanStartedAt = new Date().toISOString();
    const cleanStart = performance.now();
    let cleaned;
    try {
      cleaned = cleaner(structuredClone(original), structuredClone(run.cleanedLeads));
      run.cleanedLeads.push(cleaned);
      run.executionEvents.push(cleaningEvent(runId, original, cleanStartedAt, cleanStart, cleaned));
      run.warnings.push(...cleaned.validation.warnings.map(message => ({ leadId: original.id, message })));
    } catch {
      const event = cleaningEvent(runId, original, cleanStartedAt, cleanStart);
      run.executionEvents.push(event);
      run.errors.push({ leadId: original.id, ...event.error! });
    }
    updateRun(runId, { cleanedLeads: run.cleanedLeads, executionEvents: run.executionEvents, warnings: run.warnings, errors: run.errors });

    if (cleaned && run.phase !== 'cleaning') {
      const startedAt = new Date().toISOString();
      const start = performance.now();
      const event: ExecutionEvent = {
        id: randomUUID(), runId, leadId: original.id, leadName: cleaned.lead.name || undefined,
        component: 'classification', componentName: 'Classification Agent', componentType: 'ai',
        input: classificationInput(original, cleaned.lead), output: {},
        promptVersion: run.configurationSnapshot.prompts.classification.version,
        model: run.classificationModel, startedAt, completedAt: '', durationMs: 0,
        durationFormatted: 'Running', status: 'running', error: null,
      };
      run.executionEvents.push(event);
      updateRun(runId, { currentStage: 'CLASSIFY', executionEvents: run.executionEvents });
      try {
        const invoke = request || createOpenAIRequest(requireOpenAIKey());
        const { result, response } = await classifyLead(
          original, cleaned.lead, run.configurationSnapshot.prompts.classification,
          run.classificationModel!, invoke, () => {
            run.aiInvocationCount++;
            updateRun(runId, { aiInvocationCount: run.aiInvocationCount });
          },
        );
        run.classifications.push({ leadId: original.id, result });
        event.output = { ...result };
        event.status = result.relevant === 'Review' ? 'review' : 'success';
        event.model = response.model;
        event.requestId = response.requestId;
        event.usage = response.usage;
        event.responseValidation = { valid: true, issues: [] };
        event.summary = result.reason;
        event.evidence = result.evidence;
      } catch (error) {
        const safe = error instanceof ClassificationError ? error : new ClassificationError('CLASSIFICATION_ERROR', 'Classification could not complete for this record.');
        event.status = 'failed';
        event.error = { type: safe.code, message: safe.message };
        event.responseValidation = { valid: false, issues: [safe.code] };
        run.errors.push({ leadId: original.id, ...event.error });
      }
      event.durationMs = performance.now() - start;
      event.durationFormatted = `${event.durationMs.toFixed(3)} ms`;
      event.completedAt = new Date().toISOString();
    }
    const classification = run.classifications.find(item => item.leadId === original.id)?.result;
    if (cleaned && classification && (run.phase === 'outreach' || run.phase === 'evaluation')) {
      const source = cleaned;
      const count = () => { run.aiInvocationCount++; updateRun(runId, { aiInvocationCount: run.aiInvocationCount }); };
      const invoke = request || createOpenAIRequest(requireOpenAIKey());
      const stage = async <T extends object>(component: 'enrichment' | 'priority' | 'outreach' | 'evaluator', input: Record<string, unknown>, work: () => Promise<{ result: T; response?: import('../services/openai').AIResponse }>): Promise<T | undefined> => {
        const ai = component !== 'priority';
        const event: ExecutionEvent = {
          id: randomUUID(), runId, leadId: original.id, leadName: source.lead.name || undefined,
          component, componentName: { enrichment: 'Enrichment Agent', priority: 'Priority Engine', outreach: 'Outreach Agent', evaluator: 'Evaluator Agent' }[component],
          componentType: ai ? 'ai' : 'deterministic', input, output: {},
          promptVersion: ai ? run.configurationSnapshot.prompts[component as 'enrichment' | 'outreach' | 'evaluator'].version : null,
          model: ai ? run.classificationModel : null, startedAt: new Date().toISOString(), completedAt: '', durationMs: 0, durationFormatted: 'Running', status: 'running', error: null,
        };
        const start = performance.now();
        run.executionEvents.push(event);
        updateRun(runId, { currentStage: { enrichment: 'ENRICH', priority: 'PRIORITIZE', outreach: 'OUTREACH', evaluator: 'EVALUATE' }[component] as 'ENRICH' | 'PRIORITIZE' | 'OUTREACH' | 'EVALUATE', executionEvents: run.executionEvents });
        try {
          const { result, response } = await work();
          event.output = { ...result }; event.status = 'success';
          if (response) { event.model = response.model; event.requestId = response.requestId; event.usage = response.usage; event.responseValidation = { valid: true, issues: [] }; }
          return result;
        } catch (error) {
          const safe = error instanceof ClassificationError ? error : new ClassificationError('STAGE_ERROR', 'This component could not complete for this record.');
          event.status = 'failed'; event.error = { type: safe.code, message: safe.message };
          if (ai) event.responseValidation = { valid: false, issues: [safe.code] };
          run.errors.push({ leadId: original.id, ...event.error });
        } finally {
          event.durationMs = performance.now() - start; event.durationFormatted = `${event.durationMs.toFixed(3)} ms`; event.completedAt = new Date().toISOString();
          updateRun(runId, { executionEvents: run.executionEvents, errors: run.errors });
        }
      };
      const enrichment = await stage('enrichment', { originalLead: original, cleanedLead: cleaned.lead, classification }, () => enrichLead(original, source.lead, classification, run.configurationSnapshot.prompts.enrichment, run.classificationModel!, invoke, count));
      if (enrichment) {
        run.enrichments.push({ leadId: original.id, result: enrichment });
        updateRun(runId, { enrichments: run.enrichments });
        const priority = await stage('priority', { cleaned, classification, enrichment, rulesVersion: run.priorityRulesVersion }, async () => ({ result: prioritizeLead(source, classification, enrichment) }));
        if (priority) {
          run.priorities.push({ leadId: original.id, result: priority });
          updateRun(runId, { priorities: run.priorities });
          const input = { originalLead: original, cleanedLead: cleaned.lead, classification, enrichment, priority };
          const outreach = await stage('outreach', input, () => draftOutreach(input, run.configurationSnapshot.prompts.outreach, run.classificationModel!, invoke, count));
          if (outreach) { run.outreaches.push({ leadId: original.id, result: outreach }); updateRun(runId, { outreaches: run.outreaches }); }
          if (outreach && run.phase === 'evaluation') {
            const evaluationInput = { originalLead: original, cleaned: source, classification, enrichment, priority, outreach };
            const evaluation = await stage('evaluator', { ...evaluationInput, weights: run.configurationSnapshot.evaluatorWeights, thresholds: run.configurationSnapshot.thresholds, rulesVersion: run.evaluationRulesVersion }, () => evaluateLead(evaluationInput, run.configurationSnapshot, run.classificationModel!, invoke, count));
            if (evaluation) {
              run.evaluations.push({ leadId: original.id, result: evaluation });
              const rawFields = Object.fromEntries(Object.entries(source.lead).filter(([, value]) => value !== null)) as Record<string, string>;
              run.processedLeads.push({ ...rawFields, id: original.id, name: source.lead.name || original.id,
                duplicateStatus: source.duplicateStatus === 'Duplicate' ? 'Potential Duplicate' : 'None', isDuplicate: source.duplicateStatus === 'Duplicate',
                relevant: classification.relevant.toUpperCase() as 'YES' | 'NO' | 'REVIEW', confidence: Math.round(classification.confidence * 100), relevanceReason: classification.reason, evidence: classification.evidence,
                profile: enrichment.profile, intent: enrichment.intent, potentialNeeds: enrichment.potentialNeeds, objections: enrichment.objections, missingInformation: enrichment.missingInformation, potentialOpportunity: enrichment.potentialOpportunity,
                priority: priority.priority, priorityScore: priority.priorityScore, scoreBreakdown: priority.scoreBreakdown,
                recommendedNextAction: outreach.recommendedNextAction, personalizedOutreach: outreach.personalizedOutreach,
                evaluatorReport: evaluation, qcStatus: evaluation.finalDecision, qcReason: [...evaluation.hardFlagsTriggered, ...evaluation.allIssues, evaluation.evaluationSummary].filter(Boolean).join('; '),
                runId, executionEvents: run.executionEvents.filter(item => item.leadId === original.id),
              });
              updateRun(runId, { evaluations: run.evaluations, processedLeads: run.processedLeads });
            }
          }

        }
      }
    }
    run.completedLeads++;
    updateRun(runId, { classifications: run.classifications, executionEvents: run.executionEvents,
      errors: run.errors, completedLeads: run.completedLeads });
    await yieldToEventLoop();
  }
  updateRun(runId, {
    status: run.errors.length === run.totalLeads ? 'failed' : run.errors.length ? 'PARTIAL_FAILURE' : 'completed',
    completedAt: new Date().toISOString(), currentLeadId: null, currentStage: null,
  });
}

// Retain a deterministic Phase-1 entry point for cleaning regression tests only.
export async function runCleaning(runId: string, cleaner: typeof cleanLead = cleanLead): Promise<void> {
  const run = getRun(runId);
  if (run?.phase !== 'cleaning') throw new Error('Cleaning-only entry point requires a cleaning run.');
  await runPipeline(runId, undefined, cleaner);
}
