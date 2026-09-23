import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIRequest, ClassificationError } from '../server/services/openai';
import { validateClassificationItem } from '../server/utils/validation';
import { createRun, getRun } from '../server/store/runStore';
import { runPipeline } from '../server/pipeline/orchestrator';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { DEFAULT_CLASSIFICATION_PROMPT } from '../server/prompts/defaults';

const lead = { id: 'generated-row-1', name: 'Farhan', education: 'BPharm', conversation: 'Interested in Germany' };
const result = { relevant: 'Review', reason: 'Healthcare background and Germany intent are present, but pathway fit requires verification.', confidence: 0.68, evidence: ['BPharm', 'Interested in Germany'] };
const configuration = () => ({ ...structuredClone(DEFAULT_AGENT_CONFIGURATION), prompts: { ...structuredClone(DEFAULT_AGENT_CONFIGURATION.prompts), classification: { ...DEFAULT_CLASSIFICATION_PROMPT } } });

test('strict per-lead output validation rejects fabricated evidence and invalid certainty', () => {
  const item = { leadId: lead.id, ...result };
  assert.deepEqual(validateClassificationItem(item, lead), result);
  for (const invalid of [ { ...item, confidence: 1.1 }, { ...item, extra: true }, { ...item, evidence: ['BSc Nursing'] }, { ...item, evidence: ['generated-row-1'] }, { ...item, relevant: 'Yes', evidence: [] } ]) {
    assert.throws(() => validateClassificationItem(invalid, lead), ClassificationError);
  }
  assert.throws(() => validateClassificationItem({ ...item, leadId: '' }, lead), ClassificationError);
  assert.throws(() => validateClassificationItem('not an object', lead), ClassificationError);
  assert.equal(validateClassificationItem({ ...item, evidence: [], confidence: 0 }, lead).relevant, 'Review');
  for (const relevant of ['Yes', 'No', 'Review']) assert.equal(validateClassificationItem({ ...item, relevant }, lead).relevant, relevant);
});

test('official SDK sends one batched Responses schema call and snapshotted editable prompt; pipeline stops after classification', async () => {
  const bodies: any[] = [];
  const transport: typeof fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'resp_test', object: 'response', status: 'completed', model: 'test-model', output: [{ id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ results: [{ leadId: lead.id, ...result }] }), annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 } }), { headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_test' } });
  };
  const request = createOpenAIRequest('test-secret-never-log', transport);
  const config = configuration();
  config.prompts.classification.systemPrompt = 'Runtime prompt A'; config.prompts.classification.version = 'v7';
  const run = createRun({ leads: [lead], configuration: config });
  config.prompts.classification.systemPrompt = 'Runtime prompt B'; config.prompts.classification.version = 'v8';
  await runPipeline(run.runId, request);
  const finished = getRun(run.runId)!;
  assert.equal(finished.status, 'completed'); assert.equal(finished.aiInvocationCount, 1);
  assert.deepEqual(finished.executionEvents.map(e => e.component), ['clean', 'classification']);
  assert.deepEqual(finished.processedLeads, []);
  assert.deepEqual(finished.classifications[0].result, result);
  const event = finished.executionEvents[1];
  assert.equal(event.status, 'review'); assert.equal(event.promptVersion, 'v7');
  assert.equal(event.requestId, 'req_test'); assert.ok(event.durationMs > 0);
  assert.equal(event.responseValidation?.valid, true);
  assert.ok(bodies[0].instructions.startsWith('Runtime prompt A'));
  assert.equal(bodies[0].store, false); assert.equal(bodies[0].text.format.strict, true);
  assert.equal(bodies[0].text.format.type, 'json_schema');
  assert.equal(bodies[0].text.format.name, 'lead_classification');
  const sentInput = JSON.parse(bodies[0].input);
  assert.equal(sentInput.leads.length, 1);
  assert.equal(sentInput.leads[0].leadId, lead.id);
  assert.equal(sentInput.leads[0].conversation, lead.conversation);
  assert.ok(!JSON.stringify(finished).includes('test-secret-never-log'));
  const next = createRun({ leads: [lead], configuration: config });
  await runPipeline(next.runId, request);
  assert.ok(bodies[1].instructions.startsWith('Runtime prompt B'));
});

test('a batched call\'s running events are visible; one bad lead gets a flagged placeholder instead of being dropped or blocking its batch-mate', async () => {
  const run = createRun({ leads: [lead, { ...lead, id: 'second' }], configuration: configuration() });
  let sawRunning = false;
  await runPipeline(run.runId, async (req, count) => {
    count();
    const events = getRun(run.runId)!.executionEvents.filter(e => e.component === 'classification');
    sawRunning = events.length === 2 && events.every(e => e.status === 'running');
    const body = JSON.parse(req.input) as { leads: { leadId: string }[] };
    const results = body.leads.map(({ leadId }) => leadId === lead.id
      ? { leadId, ...result, evidence: ['Invented qualification'] }
      : { leadId, ...result });
    return { text: JSON.stringify({ results }), model: 'test' };
  });
  assert.ok(sawRunning);
  const finished = getRun(run.runId)!;
  // ONE batched call covered both leads -- this is the whole point of the change.
  assert.equal(finished.status, 'completed'); assert.equal(finished.aiInvocationCount, 1);
  assert.equal(finished.classifications.length, 2);
  assert.equal(finished.errors.length, 0);
  assert.equal(finished.aiFallbacks.length, 1);
  assert.equal(finished.aiFallbacks[0].leadId, lead.id); assert.equal(finished.aiFallbacks[0].type, 'UNSUPPORTED_EVIDENCE');
  const placeholder = finished.classifications.find(c => c.leadId === lead.id)!.result;
  assert.equal(placeholder.relevant, 'Review'); assert.equal(placeholder.confidence, 0); assert.deepEqual(placeholder.evidence, []);
  const event = finished.executionEvents.find(e => e.leadId === lead.id && e.component === 'classification')!;
  assert.equal(event.status, 'review'); assert.equal(event.error?.type, 'UNSUPPORTED_EVIDENCE');
  assert.deepEqual(event.output, placeholder);
});

test('a malformed batch envelope never drops any lead in that batch -- every lead gets a flagged placeholder, with the raw response captured for debugging', async () => {
  const run = createRun({ leads: [lead, { ...lead, id: 'second' }], configuration: configuration() });
  await runPipeline(run.runId, async (_req, count) => { count(); return { text: JSON.stringify({ results: [{ leadId: lead.id, ...result }] }), model: 'test' }; });
  const finished = getRun(run.runId)!;
  assert.equal(finished.status, 'completed'); assert.equal(finished.classifications.length, 2);
  assert.equal(finished.errors.length, 0);
  assert.equal(finished.aiFallbacks.length, 2);
  assert.ok(finished.aiFallbacks.every(e => e.type === 'BATCH_ENVELOPE_INVALID'));
  const event = finished.executionEvents.find(e => e.component === 'classification')!;
  assert.equal(event.status, 'review');
  assert.equal(typeof (event.debugInfo?.rejectedOutput as { rawResponseText?: unknown } | undefined)?.rawResponseText, 'string');
});

test('SDK rate-limit error is sanitized and counted exactly once without retries', async () => {
  let attempts = 0; let count = 0;
  const request = createOpenAIRequest('test-key', async () => {
    attempts++;
    return new Response(JSON.stringify({ error: { message: 'sensitive-provider-content', type: 'rate_limit_error' } }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  });
  await assert.rejects(request({ model: 'test', instructions: 'test', input: '{}', schema: {} }, () => count++), (error: any) => error.code === 'OPENAI_RATE_LIMIT' && !error.message.includes('sensitive'));
  assert.equal(attempts, 1); assert.equal(count, 1);
});

test('SDK refuses incomplete and refused responses without exposing provider text', async () => {
  for (const [status, output, code] of [
    ['incomplete', [], 'OPENAI_INCOMPLETE'],
    ['completed', [{ type: 'message', content: [{ type: 'refusal', refusal: 'private refusal text' }] }], 'OPENAI_REFUSAL'],
    ['completed', [], 'OPENAI_EMPTY'],
  ] as const) {
    const request = createOpenAIRequest('test-key', async () => new Response(JSON.stringify({ id: 'resp', status, output, model: 'test' }), { headers: { 'Content-Type': 'application/json' } }));
    await assert.rejects(request({ model: 'test', instructions: 'test', input: '{}', schema: {} }, () => {}), (error: any) => error.code === code && !error.message.includes('private refusal'));
  }
});

test('evidence guidance preserves exact source punctuation; validation rejects fabricated, borrowed, and row-ID evidence', async () => {
  const { sourceEvidence } = await import('../server/agents/classifier');
  const original = { id: 'L003', col_0: 'L003', name: 'Synthetic Test', education: 'B.Sc Nursing', germanLevel: 'B1', col_7: 'Explore options', conversation: 'Early stage' };
  const choices = sourceEvidence(original);
  assert.ok(choices.includes('B.Sc Nursing'));
  assert.ok(choices.includes('Explore options'));
  assert.ok(!choices.includes('BSc Nursing')); assert.ok(!choices.includes('L003'));
  const output = { leadId: 'L003', relevant: 'Review', confidence: 0.7, reason: 'Nursing background is present; Germany career intent needs clarification.', evidence: ['B.Sc Nursing', 'Explore options', 'Early stage'] };
  assert.deepEqual(validateClassificationItem(output, original), { relevant: 'Review', confidence: 0.7, reason: output.reason, evidence: output.evidence });
  assert.throws(() => validateClassificationItem({ ...output, evidence: ['Interested in Germany'] }, original));
  // The bare row ID itself (not a value that happens to duplicate it elsewhere) is never usable
  // as evidence -- covered directly against `lead` (no id-duplicate column) in the first test above.
  const long = { id: 'long', conversation: 'Source '.repeat(600) };
  for (const quote of sourceEvidence(long)) {
    assert.ok(long.conversation.includes(quote)); assert.ok(quote.length <= 1800);
  }
  assert.equal(sourceEvidence({ id: 'empty', conversation: null }).length, 0);
  // Batch isolation: this evidence is real for L003, but must not validate against a different
  // lead's own source data -- one lead's batch-mate can never borrow another's evidence.
  const other = { id: 'L004', name: 'Other Person', education: 'B.Com', conversation: 'No German plans yet.' };
  assert.throws(() => validateClassificationItem({ ...output, leadId: 'L004' }, other));
});
