import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIRequest, ClassificationError } from '../server/services/openai';
import { validateClassification } from '../server/utils/validation';
import { createRun, getRun } from '../server/store/runStore';
import { runPipeline } from '../server/pipeline/orchestrator';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { DEFAULT_CLASSIFICATION_PROMPT } from '../server/prompts/defaults';

const lead = { id: 'generated-row-1', name: 'Farhan', education: 'BPharm', conversation: 'Interested in Germany' };
const result = { relevant: 'Review', reason: 'Healthcare background and Germany intent are present, but pathway fit requires verification.', confidence: 0.68, evidence: ['BPharm', 'Interested in Germany'] };
const configuration = () => ({ ...structuredClone(DEFAULT_AGENT_CONFIGURATION), prompts: { ...structuredClone(DEFAULT_AGENT_CONFIGURATION.prompts), classification: { ...DEFAULT_CLASSIFICATION_PROMPT } } });

test('strict output validation rejects fabricated evidence and invalid certainty', () => {
  assert.deepEqual(validateClassification(JSON.stringify(result), lead), result);
  for (const invalid of [ { ...result, confidence: 1.1 }, { ...result, extra: true }, { ...result, evidence: ['BSc Nursing'] }, { ...result, evidence: ['generated-row-1'] }, { ...result, relevant: 'Yes', evidence: [] } ]) {
    assert.throws(() => validateClassification(JSON.stringify(invalid), lead), ClassificationError);
  }
  assert.throws(() => validateClassification('not JSON', lead), ClassificationError);
  assert.equal(validateClassification(JSON.stringify({ ...result, evidence: [], confidence: 0 }), lead).relevant, 'Review');
  for (const relevant of ['Yes', 'No', 'Review']) assert.equal(validateClassification(JSON.stringify({ ...result, relevant }), lead).relevant, relevant);
});

test('official SDK sends Responses schema and snapshotted editable prompt; pipeline stops after classification', async () => {
  const bodies: any[] = [];
  const transport: typeof fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: 'resp_test', object: 'response', status: 'completed', model: 'test-model', output: [{ id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(result), annotations: [] }] }], usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 } }), { headers: { 'Content-Type': 'application/json', 'x-request-id': 'req_test' } });
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
  assert.equal(JSON.parse(bodies[0].input).conversation, lead.conversation);
  assert.ok(!JSON.stringify(finished).includes('test-secret-never-log'));
  const next = createRun({ leads: [lead], configuration: config });
  await runPipeline(next.runId, request);
  assert.ok(bodies[1].instructions.startsWith('Runtime prompt B'));
});

test('running event is visible; failed validation does not fabricate results or stop subsequent leads', async () => {
  const run = createRun({ leads: [lead, { ...lead, id: 'second' }], configuration: configuration() });
  let calls = 0;
  await runPipeline(run.runId, async (_request, count) => {
    count(); calls++;
    assert.equal(getRun(run.runId)!.executionEvents.at(-1)!.status, 'running');
    return { text: JSON.stringify(calls === 1 ? { ...result, evidence: ['Invented qualification'] } : result), model: 'test' };
  });
  const finished = getRun(run.runId)!;
  assert.equal(finished.status, 'PARTIAL_FAILURE'); assert.equal(finished.aiInvocationCount, 2);
  assert.equal(finished.classifications.length, 1);
  assert.equal(finished.errors[0].type, 'UNSUPPORTED_EVIDENCE');
  assert.deepEqual(finished.executionEvents[1].output, {});
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

test('evidence schema preserves exact source punctuation and excludes repeated CSV row IDs', async () => {
  const { classificationSchema, classificationInput } = await import('../server/agents/classifier');
  const { cleanLead } = await import('../server/pipeline/cleaning');
  const original = { id: 'L003', col_0: 'L003', name: 'Synthetic Test', education: 'B.Sc Nursing', germanLevel: 'B1', col_7: 'Explore options', conversation: 'Early stage' };
  const input = classificationInput(original, cleanLead(original, []).lead);
  const schema = classificationSchema(original);
  const choices = (schema.properties.evidence.items as { enum: string[] }).enum;
  assert.deepEqual(choices, input.sourceEvidence);
  assert.ok(choices.includes('B.Sc Nursing'));
  assert.ok(choices.includes('Explore options'));
  assert.ok(!choices.includes('BSc Nursing')); assert.ok(!choices.includes('L003'));
  const output = { relevant: 'Review', confidence: 0.7, reason: 'Nursing background is present; Germany career intent needs clarification.', evidence: ['B.Sc Nursing', 'Explore options', 'Early stage'] };
  assert.deepEqual(validateClassification(JSON.stringify(output), original), output);
  assert.throws(() => validateClassification(JSON.stringify({ ...output, evidence: ['Interested in Germany'] }), original));
  assert.equal(classificationSchema({ id: 'empty', conversation: null }).properties.evidence.maxItems, 0);
  const long = { id: 'long', conversation: 'Source '.repeat(600) };
  for (const quote of (classificationSchema(long).properties.evidence.items as { enum: string[] }).enum) {
    assert.ok(long.conversation.includes(quote)); assert.ok(quote.length <= 2000);
  }
});
