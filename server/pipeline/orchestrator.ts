import { evaluateBatch, DIMENSIONS, type EvaluationResult } from '../agents/evaluator';
import { enrichBatch, type EnrichmentResult } from '../agents/enrichment';
import { draftOutreachBatch, type OutreachResult } from '../agents/outreach';
import { prioritizeLead, type PriorityResult } from './priority';
import { randomUUID } from 'node:crypto';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import type { ExecutionEvent, PipelineStageKey } from '../../src/types/lead';
import { cleanLead } from './cleaning';
import { classifyBatch } from './classification';
import { classificationInput } from '../agents/classifier';
import { ClassificationError, createOpenAIRequest, requireOpenAIKey, type AIResponse, type RequestClassification } from '../services/openai';
import { getRun, updateRun } from '../store/runStore';
import { cleaningEvent } from '../utils/executionEvent';
import type { ClassificationResult, CleaningResult, OriginalLead } from '../types/pipeline';

function chunkList<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size) || 1);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) chunks.push(items.slice(i, i + safeSize));
  return chunks;
}

// Placeholder builders: when an AI-driven stage's output fails validation, the lead is never
// dropped. Instead we substitute a safe, honestly-labeled result authored by the app itself (never
// AI-generated text that failed validation) so the lead keeps moving through the rest of the
// pipeline. Each placeholder is shaped exactly like a real result, so no downstream stage or
// consumer needs to special-case it -- it naturally scores as unverified/low-confidence and lands
// the lead in the Review Queue.
function classificationPlaceholder(_original: OriginalLead, error: ClassificationError): ClassificationResult {
  return { relevant: 'Review', reason: `AI classification could not be verified (${error.code}); flagged for manual review.`, confidence: 0, evidence: [] };
}
function enrichmentPlaceholder(_original: OriginalLead, _error: ClassificationError): EnrichmentResult {
  const unknown = <T extends string>(value: T) => ({ value, evidence: [] as string[] });
  return {
    profile: 'Unverified', intent: 'Unknown', potentialNeeds: [], objections: [],
    missingInformation: ['AI enrichment could not be verified against source data.'],
    potentialOpportunity: 'Unverified', recommendedNextAction: 'Manual review required.', evidence: [],
    signals: { intent: unknown('unknown'), urgency: unknown('unknown'), buyingSignal: unknown('unknown') },
  };
}
function outreachPlaceholder(_original: OriginalLead, _error: ClassificationError): OutreachResult {
  return { recommendedNextAction: 'Manual review required.', personalizedOutreach: 'Outreach draft unavailable -- AI response failed validation. Please draft manually after review.', evidence: [] };
}
function evaluatorPlaceholder(error: ClassificationError, rulesVersion: string): EvaluationResult {
  const issue = `AI evaluation could not be verified (${error.code}); flagged for manual review.`;
  const metrics = Object.fromEntries(DIMENSIONS.map(key => [key, { score: 0, issues: [issue] }])) as EvaluationResult['metrics'];
  return { metrics, weightedScore: 0, finalDecision: 'REVIEW', hardFlagsTriggered: [], allIssues: [issue], evaluationSummary: 'AI evaluation could not be verified; flagged for manual review.', rulesVersion };
}

// Each batch runs its own complete mini-pipeline (Clean -> Classify -> Enrich -> Priority ->
// Outreach -> Evaluate) to completion before the next batch starts. Every AI stage makes exactly
// ONE OpenAI call covering every still-eligible lead in that batch, never one call per lead. A
// lead that fails any stage is excluded from later stages in its own batch but never blocks its
// batch-mates or later batches.
export async function runPipeline(runId: string, request?: RequestClassification, cleaner: typeof cleanLead = cleanLead): Promise<void> {
  const run = getRun(runId);
  if (!run || run.status !== 'waiting') return;
  updateRun(runId, { status: 'running', startedAt: new Date().toISOString() });

  const batchSize = Math.max(1, Math.floor(run.configurationSnapshot.batchSize) || 1);
  const count = () => { run.aiInvocationCount++; updateRun(runId, { aiInvocationCount: run.aiInvocationCount }); };

  // Each lead is "retired" (counted in completedLeads) exactly once: either when it first
  // fails a stage, or when it clears the last stage this run's phase reaches.
  const retired = new Set<string>();
  const retire = (leadId: string) => {
    if (retired.has(leadId)) return;
    retired.add(leadId);
    run.completedLeads++;
    updateRun(runId, { completedLeads: run.completedLeads });
  };
  const bumpStageProgress = (stage: PipelineStageKey, delta: number) => {
    run.stageProgress = { ...run.stageProgress, [stage]: run.stageProgress[stage] + delta };
    updateRun(runId, { stageProgress: run.stageProgress });
  };
  const setBatch = (stage: PipelineStageKey | null, index: number, totalBatches: number, leadIds: string[]) => {
    run.currentBatch = stage ? { stage, index, totalBatches, leadIds } : null;
    updateRun(runId, { currentBatch: run.currentBatch, currentStage: stage });
  };
  const finish = () => {
    updateRun(runId, {
      status: run.errors.length === run.totalLeads ? 'failed' : run.errors.length ? 'PARTIAL_FAILURE' : 'completed',
      completedAt: new Date().toISOString(), currentLeadId: null, currentStage: null, currentBatch: null,
    });
  };

  // Created lazily, on first actual use: a cleaning-only run never needs a configured API key.
  let invoke: RequestClassification | undefined = request;
  const invokeRequest = (): RequestClassification => invoke || (invoke = createOpenAIRequest(requireOpenAIKey()));

  // Shared bookkeeping for every batched AI stage: creates one running ExecutionEvent per lead,
  // makes the single batch call, then resolves each lead's event from the returned outcome map.
  // A lead is NEVER dropped for an AI-agent reason: a per-lead ClassificationError (tier 2), or the
  // whole call throwing (tier 1, an envelope-level problem that can't be safely attributed to one
  // lead), is handled by substituting a safe, honestly-labeled placeholder result via
  // `placeholderFor` and letting the lead continue -- flagged for review, never vanished. The
  // fallback is recorded in `run.aiFallbacks` and in the returned `fallback` set, distinct from
  // `run.errors`, which stays reserved for genuine drops.
  const runBatchedStage = async <TResult extends object>(
    component: 'classification' | 'enrichment' | 'outreach' | 'evaluator',
    componentName: string,
    promptVersion: string,
    leads: OriginalLead[],
    leadNameFor: (original: OriginalLead) => string | undefined,
    inputFor: (original: OriginalLead) => Record<string, unknown>,
    call: () => Promise<{ outcomes: Map<string, TResult | ClassificationError>; response: AIResponse }>,
    onSuccess: (original: OriginalLead, result: TResult, event: ExecutionEvent) => void,
    placeholderFor: (original: OriginalLead, error: ClassificationError) => TResult,
  ): Promise<{ succeeded: Set<string>; fallback: Set<string> }> => {
    const events = new Map<string, ExecutionEvent>();
    for (const original of leads) {
      const event: ExecutionEvent = {
        id: randomUUID(), runId, leadId: original.id, leadName: leadNameFor(original),
        component, componentName, componentType: 'ai', input: inputFor(original), output: {},
        promptVersion, model: run.classificationModel, startedAt: new Date().toISOString(), completedAt: '', durationMs: 0,
        durationFormatted: 'Running', status: 'running', error: null,
      };
      events.set(original.id, event);
      run.executionEvents.push(event);
    }
    updateRun(runId, { executionEvents: run.executionEvents });
    const start = performance.now();
    const finalize = (event: ExecutionEvent) => {
      event.durationMs = performance.now() - start;
      event.durationFormatted = `${event.durationMs.toFixed(3)} ms`;
      event.completedAt = new Date().toISOString();
    };
    const succeeded = new Set<string>();
    const fallback = new Set<string>();
    const applyFallback = (original: OriginalLead, event: ExecutionEvent, error: ClassificationError) => {
      const placeholder = placeholderFor(original, error);
      event.output = { ...placeholder };
      event.status = 'review';
      event.error = { type: error.code, message: error.message };
      event.responseValidation = { valid: false, issues: [error.code] };
      if (error.details !== undefined) event.debugInfo = { rejectedOutput: error.details };
      run.aiFallbacks.push({ leadId: original.id, stage: component, type: error.code, message: error.message });
      onSuccess(original, placeholder, event);
      succeeded.add(original.id);
      fallback.add(original.id);
    };
    try {
      const { outcomes, response } = await call();
      for (const original of leads) {
        const event = events.get(original.id)!;
        const outcome = outcomes.get(original.id);
        finalize(event);
        if (outcome instanceof ClassificationError) {
          applyFallback(original, event, outcome);
        } else if (outcome) {
          event.output = { ...outcome };
          event.status = 'success';
          event.model = response.model;
          event.requestId = response.requestId;
          event.usage = response.usage;
          event.responseValidation = { valid: true, issues: [] };
          onSuccess(original, outcome, event);
          succeeded.add(original.id);
        } else {
          // Defensive, practically unreachable: parseBatchOutput guarantees an outcome for every
          // requested leadId. This is a true drop, not an AI-agent fallback.
          const safe = new ClassificationError('MISSING_OUTCOME', 'No result was returned for this lead.');
          event.status = 'failed';
          event.error = { type: safe.code, message: safe.message };
          event.responseValidation = { valid: false, issues: [safe.code] };
          run.errors.push({ leadId: original.id, type: safe.code, message: safe.message });
        }
      }
    } catch (error) {
      const safe = error instanceof ClassificationError ? error : new ClassificationError(`${component.toUpperCase()}_BATCH_ERROR`, 'This stage could not complete for this batch.');
      for (const original of leads) {
        const event = events.get(original.id)!;
        finalize(event);
        applyFallback(original, event, safe);
      }
    }
    updateRun(runId, { executionEvents: run.executionEvents, errors: run.errors, aiFallbacks: run.aiFallbacks });
    return { succeeded, fallback };
  };

  const batches = chunkList(run.originalLeads, batchSize);

  batchLoop: for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    // Union of every stage's fallback set for this batch -- leads that needed a safe placeholder
    // anywhere upstream, so their final ProcessedLead can be flagged with aiFallbackUsed: true.
    const aiFallbackUsedIds = new Set<string>();

    // --- Stage: Cleaning (sequential within the batch; duplicate detection depends on
    // processing order and looks back across the full cumulative cleaned set so far, including
    // every earlier batch) ---
    setBatch('CLEAN', batchIndex + 1, batches.length, batch.map(item => item.id));
    const cleanedThisBatch: CleaningResult[] = [];
    for (const original of batch) {
      updateRun(runId, { currentLeadId: original.id });
      const cleanStartedAt = new Date().toISOString();
      const cleanStart = performance.now();
      let cleaned;
      try {
        cleaned = cleaner(structuredClone(original), structuredClone(run.cleanedLeads));
        run.cleanedLeads.push(cleaned);
        cleanedThisBatch.push(cleaned);
        run.executionEvents.push(cleaningEvent(runId, original, cleanStartedAt, cleanStart, cleaned));
        run.warnings.push(...cleaned.validation.warnings.map(message => ({ leadId: original.id, message })));
      } catch {
        const event = cleaningEvent(runId, original, cleanStartedAt, cleanStart);
        run.executionEvents.push(event);
        run.errors.push({ leadId: original.id, ...event.error! });
      }
      updateRun(runId, { cleanedLeads: run.cleanedLeads, executionEvents: run.executionEvents, warnings: run.warnings, errors: run.errors });
      if (!cleaned || run.phase === 'cleaning') retire(original.id);
      await yieldToEventLoop();
    }
    bumpStageProgress('CLEAN', batch.length);
    updateRun(runId, { currentLeadId: null });
    if (run.phase === 'cleaning') continue batchLoop;

    const cleanedById = new Map(cleanedThisBatch.map(item => [item.lead.id, item]));
    const afterClean = batch.filter(original => cleanedById.has(original.id));
    if (!afterClean.length) continue batchLoop;

    // --- Stage: Classification (ONE batched call for this batch's cleaned leads) ---
    setBatch('CLASSIFY', batchIndex + 1, batches.length, afterClean.map(item => item.id));
    const classificationByLead = new Map<string, ClassificationResult>();
    const { succeeded: classifySucceeded, fallback: classifyFallback } = await runBatchedStage<ClassificationResult>(
      'classification', 'Classification Agent', run.configurationSnapshot.prompts.classification.version,
      afterClean,
      original => cleanedById.get(original.id)!.lead.name || undefined,
      original => classificationInput(original, cleanedById.get(original.id)!.lead),
      () => classifyBatch(
        afterClean.map(original => ({ original, cleaned: cleanedById.get(original.id)!.lead })),
        run.configurationSnapshot.prompts.classification, run.classificationModel!, invokeRequest(), count,
      ),
      (original, result, event) => {
        run.classifications.push({ leadId: original.id, result });
        classificationByLead.set(original.id, result);
        event.status = result.relevant === 'Review' ? 'review' : 'success';
        event.summary = result.reason;
        event.evidence = result.evidence;
      },
      classificationPlaceholder,
    );
    for (const id of classifyFallback) aiFallbackUsedIds.add(id);
    updateRun(runId, { classifications: run.classifications });
    bumpStageProgress('CLASSIFY', afterClean.length);
    for (const original of afterClean) {
      if (!classifySucceeded.has(original.id) || run.phase === 'classification') retire(original.id);
    }
    if (run.phase === 'classification') continue batchLoop;

    const afterClassify = afterClean.filter(original => classifySucceeded.has(original.id));
    if (!afterClassify.length) continue batchLoop;

    // --- Stage: Enrichment (ONE batched call for this batch's classified leads) ---
    setBatch('ENRICH', batchIndex + 1, batches.length, afterClassify.map(item => item.id));
    const enrichmentByLead = new Map<string, EnrichmentResult>();
    const { succeeded: enrichSucceeded, fallback: enrichFallback } = await runBatchedStage<EnrichmentResult>(
      'enrichment', 'Enrichment Agent', run.configurationSnapshot.prompts.enrichment.version,
      afterClassify,
      original => cleanedById.get(original.id)!.lead.name || undefined,
      original => ({ originalLead: original, cleanedLead: cleanedById.get(original.id)!.lead, classification: classificationByLead.get(original.id)! }),
      () => enrichBatch(
        afterClassify.map(original => ({ original, cleaned: cleanedById.get(original.id)!.lead, classification: classificationByLead.get(original.id)! })),
        run.configurationSnapshot.prompts.enrichment, run.classificationModel!, invokeRequest(), count,
      ),
      (original, result) => { run.enrichments.push({ leadId: original.id, result }); enrichmentByLead.set(original.id, result); },
      enrichmentPlaceholder,
    );
    for (const id of enrichFallback) aiFallbackUsedIds.add(id);
    updateRun(runId, { enrichments: run.enrichments });
    bumpStageProgress('ENRICH', afterClassify.length);
    for (const original of afterClassify) if (!enrichSucceeded.has(original.id)) retire(original.id);

    const afterEnrich = afterClassify.filter(original => enrichSucceeded.has(original.id));
    if (!afterEnrich.length) continue batchLoop;

    // --- Stage: Priority (deterministic, per lead -- never batched, there is no AI call) ---
    setBatch('PRIORITIZE', batchIndex + 1, batches.length, afterEnrich.map(item => item.id));
    const priorityByLead = new Map<string, PriorityResult>();
    const prioritySucceeded = new Set<string>();
    for (const original of afterEnrich) {
      const cleaned = cleanedById.get(original.id)!;
      const classification = classificationByLead.get(original.id)!;
      const enrichment = enrichmentByLead.get(original.id)!;
      const event: ExecutionEvent = {
        id: randomUUID(), runId, leadId: original.id, leadName: cleaned.lead.name || undefined,
        component: 'priority', componentName: 'Priority Engine', componentType: 'deterministic',
        input: { cleaned, classification, enrichment, rulesVersion: run.priorityRulesVersion }, output: {},
        promptVersion: null, model: null, startedAt: new Date().toISOString(), completedAt: '', durationMs: 0,
        durationFormatted: 'Running', status: 'running', error: null,
      };
      const start = performance.now();
      run.executionEvents.push(event);
      try {
        const result = prioritizeLead(cleaned, classification, enrichment);
        run.priorities.push({ leadId: original.id, result });
        priorityByLead.set(original.id, result);
        event.output = { ...result };
        event.status = 'success';
        prioritySucceeded.add(original.id);
      } catch (error) {
        const safe = error instanceof ClassificationError ? error : new ClassificationError('STAGE_ERROR', 'This component could not complete for this record.');
        event.status = 'failed';
        event.error = { type: safe.code, message: safe.message };
        run.errors.push({ leadId: original.id, ...event.error });
      } finally {
        event.durationMs = performance.now() - start;
        event.durationFormatted = `${event.durationMs.toFixed(3)} ms`;
        event.completedAt = new Date().toISOString();
      }
    }
    updateRun(runId, { executionEvents: run.executionEvents, priorities: run.priorities, errors: run.errors });
    bumpStageProgress('PRIORITIZE', afterEnrich.length);
    for (const original of afterEnrich) if (!prioritySucceeded.has(original.id)) retire(original.id);

    const afterPriority = afterEnrich.filter(original => prioritySucceeded.has(original.id));
    if (!afterPriority.length) continue batchLoop;

    // --- Stage: Outreach (ONE batched call for this batch's prioritized leads) ---
    setBatch('OUTREACH', batchIndex + 1, batches.length, afterPriority.map(item => item.id));
    const outreachByLead = new Map<string, OutreachResult>();
    const { succeeded: outreachSucceeded, fallback: outreachFallback } = await runBatchedStage<OutreachResult>(
      'outreach', 'Outreach Agent', run.configurationSnapshot.prompts.outreach.version,
      afterPriority,
      original => cleanedById.get(original.id)!.lead.name || undefined,
      original => ({ originalLead: original, cleanedLead: cleanedById.get(original.id)!.lead, classification: classificationByLead.get(original.id)!, enrichment: enrichmentByLead.get(original.id)!, priority: priorityByLead.get(original.id)! }),
      () => draftOutreachBatch(
        afterPriority.map(original => ({ original, cleaned: cleanedById.get(original.id)!.lead, classification: classificationByLead.get(original.id)!, enrichment: enrichmentByLead.get(original.id)!, priority: priorityByLead.get(original.id)! })),
        run.configurationSnapshot.prompts.outreach, run.classificationModel!, invokeRequest(), count,
      ),
      (original, result) => { run.outreaches.push({ leadId: original.id, result }); outreachByLead.set(original.id, result); },
      outreachPlaceholder,
    );
    for (const id of outreachFallback) aiFallbackUsedIds.add(id);
    updateRun(runId, { outreaches: run.outreaches });
    bumpStageProgress('OUTREACH', afterPriority.length);
    for (const original of afterPriority) {
      if (!outreachSucceeded.has(original.id) || run.phase === 'outreach') retire(original.id);
    }
    if (run.phase === 'outreach') continue batchLoop;

    const afterOutreach = afterPriority.filter(original => outreachSucceeded.has(original.id));
    if (!afterOutreach.length) continue batchLoop;

    // --- Stage: Evaluate (ONE batched call for this batch's drafted leads; final stage) ---
    setBatch('EVALUATE', batchIndex + 1, batches.length, afterOutreach.map(item => item.id));
    const evaluationEntries = afterOutreach.map(original => ({
      leadId: original.id,
      input: {
        originalLead: original, cleaned: cleanedById.get(original.id)!, classification: classificationByLead.get(original.id)!,
        enrichment: enrichmentByLead.get(original.id)!, priority: priorityByLead.get(original.id)!, outreach: outreachByLead.get(original.id)!,
      },
    }));
    const evaluationInputByLead = new Map(evaluationEntries.map(entry => [entry.leadId, entry.input]));
    const evaluationByLead = new Map<string, EvaluationResult>();
    const { succeeded: evaluateSucceeded, fallback: evaluateFallback } = await runBatchedStage<EvaluationResult>(
      'evaluator', 'Evaluator Agent', run.configurationSnapshot.prompts.evaluator.version,
      afterOutreach,
      original => cleanedById.get(original.id)!.lead.name || undefined,
      original => ({ ...evaluationInputByLead.get(original.id)!, weights: run.configurationSnapshot.evaluatorWeights, thresholds: run.configurationSnapshot.thresholds, rulesVersion: run.evaluationRulesVersion }),
      () => evaluateBatch(evaluationEntries, run.configurationSnapshot, run.classificationModel!, invokeRequest(), count),
      (original, result) => {
        // A lead that needed a fallback anywhere upstream (Classification, Enrichment, Outreach)
        // must still be easy to spot even if the evaluator's own (real) audit scores it well --
        // never silently PASS a lead built partly from an unverified placeholder.
        const finalResult = aiFallbackUsedIds.has(original.id) && result.finalDecision === 'PASS'
          ? { ...result, finalDecision: 'REVIEW' as const, allIssues: [...result.allIssues, 'An earlier AI stage needed a safe fallback for this lead; flagged for manual review.'] }
          : result;
        run.evaluations.push({ leadId: original.id, result: finalResult }); evaluationByLead.set(original.id, finalResult);
      },
      (_original, error) => evaluatorPlaceholder(error, run.evaluationRulesVersion),
    );
    for (const id of evaluateFallback) aiFallbackUsedIds.add(id);
    bumpStageProgress('EVALUATE', afterOutreach.length);
    for (const original of afterOutreach) {
      if (evaluateSucceeded.has(original.id)) {
        const cleaned = cleanedById.get(original.id)!;
        const classification = classificationByLead.get(original.id)!;
        const enrichment = enrichmentByLead.get(original.id)!;
        const priority = priorityByLead.get(original.id)!;
        const outreach = outreachByLead.get(original.id)!;
        const evaluation = evaluationByLead.get(original.id)!;
        const rawFields = Object.fromEntries(Object.entries(cleaned.lead).filter(([, value]) => value !== null)) as Record<string, string>;
        run.processedLeads.push({
          ...rawFields, id: original.id, name: cleaned.lead.name || original.id,
          duplicateStatus: cleaned.duplicateStatus === 'Duplicate' ? 'Potential Duplicate' : 'None', isDuplicate: cleaned.duplicateStatus === 'Duplicate',
          relevant: classification.relevant.toUpperCase() as 'YES' | 'NO' | 'REVIEW', confidence: Math.round(classification.confidence * 100), relevanceReason: classification.reason, evidence: classification.evidence,
          profile: enrichment.profile, intent: enrichment.intent, potentialNeeds: enrichment.potentialNeeds, objections: enrichment.objections, missingInformation: enrichment.missingInformation, potentialOpportunity: enrichment.potentialOpportunity,
          priority: priority.priority, priorityScore: priority.priorityScore, scoreBreakdown: priority.scoreBreakdown,
          recommendedNextAction: outreach.recommendedNextAction, personalizedOutreach: outreach.personalizedOutreach,
          evaluatorReport: evaluation, qcStatus: evaluation.finalDecision, qcReason: [...evaluation.hardFlagsTriggered, ...evaluation.allIssues, evaluation.evaluationSummary].filter(Boolean).join('; '),
          aiFallbackUsed: aiFallbackUsedIds.has(original.id),
          runId, executionEvents: run.executionEvents.filter(item => item.leadId === original.id),
        });
      }
      retire(original.id);
    }
    updateRun(runId, { evaluations: run.evaluations, processedLeads: run.processedLeads });
  }

  finish();
}

// Retain a deterministic Phase-1 entry point for cleaning regression tests only.
export async function runCleaning(runId: string, cleaner: typeof cleanLead = cleanLead): Promise<void> {
  const run = getRun(runId);
  if (run?.phase !== 'cleaning') throw new Error('Cleaning-only entry point requires a cleaning run.');
  await runPipeline(runId, undefined, cleaner);
}
