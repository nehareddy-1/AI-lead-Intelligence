import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureRequest, enrichment } from './pipeline.fixtures';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { createRun, getRun } from '../server/store/runStore';
import { runPipeline } from '../server/pipeline/orchestrator';
import { buildBatchSchema, leadIdProperty, outputBudget, parseBatchOutput } from '../server/agents/batching';
import { ClassificationError } from '../server/services/openai';
import type { AIRequest } from '../server/services/openai';

function leadsOf(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `L${i + 1}`, name: `Lead ${i + 1}`, education: 'BSc Nursing', germanLevel: 'B2',
    email: `lead${i + 1}@example.com`, phone: `+9190000000${String(i).padStart(2, '0')}`,
    conversation: 'I want to work in Germany. I can enroll today.',
  }));
}

// --- Unit tests for the shared batching helper (server/agents/batching.ts) ---

test('outputBudget scales with batch size but stays bounded', () => {
  assert.equal(outputBudget(1), 2400);
  assert.equal(outputBudget(10), 13200);
  assert.equal(outputBudget(50), 16000); // capped
  assert.equal(outputBudget(0), 2400); // at least a one-lead budget
});

test('buildBatchSchema wraps an item schema into a fixed-length results array', () => {
  const item = { type: 'object' };
  const schema: any = buildBatchSchema(item, ['a', 'b', 'c']);
  assert.equal(schema.properties.results.minItems, 3);
  assert.equal(schema.properties.results.maxItems, 3);
  assert.equal(schema.properties.results.items, item);
  assert.deepEqual(leadIdProperty(['a', 'b']).enum, ['a', 'b']);
});

test('parseBatchOutput enforces envelope integrity (tier 1) before isolating per-lead validation failures (tier 2); both carry the raw rejected payload for debugging', () => {
  const validate = (item: any) => { if (item.bad) throw new ClassificationError('BAD_ITEM', 'bad'); return item.value; };
  const rawBadJson = 'not json';
  try { parseBatchOutput(rawBadJson, ['a'], validate); assert.fail('expected a throw'); }
  catch (error) { assert.ok(error instanceof ClassificationError); assert.deepEqual((error as ClassificationError).details, { rawResponseText: rawBadJson }); }
  assert.throws(() => parseBatchOutput(JSON.stringify({ results: [{ leadId: 'a', value: 1 }] }), ['a', 'b'], validate), ClassificationError);
  assert.throws(() => parseBatchOutput(JSON.stringify({ results: [{ leadId: 'a', value: 1 }, { leadId: 'a', value: 2 }] }), ['a', 'b'], validate), ClassificationError);
  assert.throws(() => parseBatchOutput(JSON.stringify({ results: [{ leadId: 'a', value: 1 }, { leadId: 'stranger', value: 2 }] }), ['a', 'b'], validate), ClassificationError);
  const outcomes = parseBatchOutput(JSON.stringify({ results: [{ leadId: 'a', value: 1 }, { leadId: 'b', bad: true, value: 2 }] }), ['a', 'b'], validate);
  assert.equal(outcomes.get('a'), 1);
  const badOutcome = outcomes.get('b');
  assert.ok(badOutcome instanceof ClassificationError);
  assert.deepEqual((badOutcome as ClassificationError).details, { leadId: 'b', bad: true, value: 2 });
});

// --- Pipeline-level batching behavior ---

test('classification makes exactly one OpenAI call per batch, not per lead', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  config.batchSize = 2;
  const run = createRun({ leads: leadsOf(4), configuration: config }, 'classification');
  const requestBodies: any[] = [];
  await runPipeline(run.runId, async (request, count) => { requestBodies.push(JSON.parse(request.input)); return fixtureRequest(request, count); });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.classifications.length, 4);
  // 4 leads at batch size 2 is 2 batches, so exactly 2 calls -- never one call per lead (4).
  assert.equal(done.aiInvocationCount, 2);
  assert.deepEqual(requestBodies.map(body => body.leads.length), [2, 2]);
});

test('batches run sequentially end-to-end: batch 1 finishes Evaluate before batch 2 starts Clean', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  config.batchSize = 2;
  const run = createRun({ leads: leadsOf(4), configuration: config }, 'evaluation');
  await runPipeline(run.runId, fixtureRequest);
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  const batch1Ids = new Set(['L1', 'L2']);
  const batch2Ids = new Set(['L3', 'L4']);
  const lastBatch1EvaluatorIndex = done.executionEvents.reduce((last, event, index) => batch1Ids.has(event.leadId) && event.component === 'evaluator' ? index : last, -1);
  const firstBatch2CleanIndex = done.executionEvents.findIndex(event => batch2Ids.has(event.leadId) && event.component === 'clean');
  assert.ok(lastBatch1EvaluatorIndex >= 0 && firstBatch2CleanIndex >= 0);
  assert.ok(lastBatch1EvaluatorIndex < firstBatch2CleanIndex, `expected batch 1 to fully finish (index ${lastBatch1EvaluatorIndex}) before batch 2's cleaning starts (index ${firstBatch2CleanIndex})`);
});

test('a malformed envelope never drops a lead -- both its batch\'s leads get a flagged placeholder and continue; a later batch is unaffected', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  config.batchSize = 2;
  const run = createRun({ leads: leadsOf(4), configuration: config }, 'evaluation');
  await runPipeline(run.runId, async (request: AIRequest, count) => {
    if (request.schemaName === 'lead_enrichment') {
      const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
      if (body.leads.some(lead => lead.leadId === 'L1')) {
        count();
        return { model: 'test', text: JSON.stringify({ results: [] }) }; // wrong count -> whole envelope fails
      }
    }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks.filter(error => error.type === 'BATCH_ENVELOPE_INVALID').length, 2);
  assert.ok(done.aiFallbacks.filter(error => error.type === 'BATCH_ENVELOPE_INVALID').every(error => ['L1', 'L2'].includes(error.leadId)));
  assert.equal(done.processedLeads.length, 4);
  assert.deepEqual(done.processedLeads.filter(lead => lead.aiFallbackUsed).map(lead => lead.id).sort(), ['L1', 'L2']);
  assert.ok(done.processedLeads.filter(lead => ['L3', 'L4'].includes(lead.id)).every(lead => !lead.aiFallbackUsed));
});

test('one bad entry inside an otherwise-valid envelope never drops that lead -- it gets a flagged placeholder while its batch-mate completes normally', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  config.batchSize = 2;
  const run = createRun({ leads: leadsOf(2), configuration: config }, 'evaluation');
  await runPipeline(run.runId, async (request: AIRequest, count) => {
    if (request.schemaName === 'lead_enrichment') {
      count();
      const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
      const results = body.leads.map(({ leadId }) => leadId === 'L1' ? { leadId, ...enrichment, evidence: ['Invented qualification'] } : { leadId, ...enrichment });
      return { model: 'test', text: JSON.stringify({ results }) };
    }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.processedLeads.length, 2);
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks.filter(error => error.leadId === 'L1' && error.type === 'UNSUPPORTED_EVIDENCE').length, 1);
  assert.equal(done.processedLeads.find(lead => lead.id === 'L1')!.aiFallbackUsed, true);
  assert.equal(done.processedLeads.find(lead => lead.id === 'L2')!.aiFallbackUsed, false);
});

test('a batch size at least as large as the dataset processes everything as a single batch', async () => {
  const run = createRun({ leads: leadsOf(2), configuration: structuredClone(DEFAULT_AGENT_CONFIGURATION) }, 'classification');
  await runPipeline(run.runId, fixtureRequest);
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.classifications.length, 2);
  assert.equal(done.completedLeads, 2);
  assert.equal(done.aiInvocationCount, 1);
});
