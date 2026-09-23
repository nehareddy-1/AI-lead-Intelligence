import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEvaluation, DIMENSIONS, type EvaluationDimensions } from '../server/agents/evaluator';
import { DEFAULT_AGENT_CONFIGURATION as config } from '../src/data/defaultConfig';
import { createRun, getRun } from '../server/store/runStore';
import { runPipeline } from '../server/pipeline/orchestrator';
import { fixtureRequest, evaluation } from './pipeline.fixtures';
import { pipelineCSV } from '../src/services/runs';
const classification = { relevant: 'Yes' as const, confidence: 1, reason: 'Supported.', evidence: ['Nursing'] };
const dimensions = (score: number): EvaluationDimensions => ({ metrics: Object.fromEntries(DIMENSIONS.map(k => [k, { score, issues: [] }])) as unknown as EvaluationDimensions['metrics'], hardFlags: [], evaluationSummary: 'Audit complete.' });

test('weighted score, inclusive thresholds, hard fail and review gates are deterministic', () => {
  for (const [score, expected] of [[90,'PASS'],[89.99,'REVIEW'],[75,'REVIEW'],[74.99,'FAIL']] as const) {
    const result = aggregateEvaluation(dimensions(score), config.evaluatorWeights, config.thresholds, classification, false);
    assert.equal(result.weightedScore, score); assert.equal(result.finalDecision, expected);
  }
  const varied = dimensions(100); varied.metrics.factual_grounding.score = 0;
  assert.equal(aggregateEvaluation(varied, config.evaluatorWeights, config.thresholds, classification, false).weightedScore, 70);
  assert.equal(aggregateEvaluation(dimensions(100), config.evaluatorWeights, config.thresholds, { ...classification, relevant: 'Review' }, false).finalDecision, 'REVIEW');
  assert.equal(aggregateEvaluation(dimensions(100), config.evaluatorWeights, config.thresholds, classification, true).finalDecision, 'REVIEW');
  assert.equal(aggregateEvaluation({ ...dimensions(100), hardFlags: ['unsupported_guarantee'] }, config.evaluatorWeights, config.thresholds, classification, false).finalDecision, 'FAIL');
  assert.throws(() => aggregateEvaluation(dimensions(100), { ...config.evaluatorWeights, completeness: 0 }, config.thresholds, classification, false));
});

test('six-stage run snapshots evaluator prompt/config, stores real dashboard results and exports evaluation', async () => {
  const configuration = structuredClone(config);
  configuration.prompts.evaluator.systemPrompt = 'Runtime evaluation prompt'; configuration.prompts.evaluator.version = 'v9';
  const run = createRun({ leads: [{ id: 'test', name: 'Synthetic Test' }], configuration }, 'evaluation');
  configuration.prompts.evaluator.systemPrompt = 'Changed'; configuration.thresholds.passThreshold = 99;
  let sent = '';
  await runPipeline(run.runId, async (request, count) => { if (request.schemaName === 'lead_evaluator') sent = request.instructions; return fixtureRequest(request, count); });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed'); assert.equal(done.aiInvocationCount, 4); assert.equal(done.executionEvents.length, 6);
  assert.ok(sent.startsWith('Runtime evaluation prompt')); assert.equal(done.executionEvents.at(-1)?.promptVersion, 'v9');
  assert.equal(done.evaluations[0].result.weightedScore, 95);
  assert.equal(done.processedLeads[0].qcStatus, 'REVIEW');
  assert.equal(done.processedLeads[0].confidence, 20);
  assert.equal(done.processedLeads[0].executionEvents?.length, 6);
  assert.match(pipelineCSV(done), /Quality Decision/); assert.match(pipelineCSV(done), /evaluation-v1/);
});

test('invalid evaluator output for one lead never drops it -- a flagged placeholder lands it in the Review Queue instead of faking a quality decision', async () => {
  const run = createRun({ leads: [{ id: 'one' }, { id: 'two' }], configuration: config }, 'evaluation');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_evaluator') {
      count();
      const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
      const results = body.leads.map(({ leadId }) => leadId === 'one'
        ? { leadId, ...evaluation, metrics: { ...evaluation.metrics, factual_grounding: { score: 101, issues: [] } } }
        : { leadId, ...evaluation });
      return { model: 'test', text: JSON.stringify({ results }) };
    }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  // Classify + enrich + outreach + evaluate: exactly one batched call each, covering both leads.
  assert.equal(done.aiInvocationCount, 4);
  assert.equal(done.processedLeads.length, 2);
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks.length, 1);
  assert.equal(done.aiFallbacks[0].leadId, 'one'); assert.equal(done.aiFallbacks[0].stage, 'evaluator');
  const flaggedLead = done.processedLeads.find(l => l.id === 'one')!;
  assert.equal(flaggedLead.aiFallbackUsed, true);
  assert.equal(flaggedLead.qcStatus, 'REVIEW');
  assert.equal(flaggedLead.evaluatorReport?.weightedScore, 0);
  const other = done.processedLeads.find(l => l.id === 'two')!;
  assert.equal(other.aiFallbackUsed, false);
  const flaggedEvent = done.executionEvents.find(e => e.leadId === 'one' && e.component === 'evaluator')!;
  assert.equal(flaggedEvent.status, 'review');
  assert.ok(Object.keys(flaggedEvent.output).length > 0);
});
