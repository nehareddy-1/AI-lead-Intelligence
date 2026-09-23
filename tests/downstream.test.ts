import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enrichment, fixtureRequest } from './pipeline.fixtures';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { createRun, getRun } from '../server/store/runStore';
import { runPipeline } from '../server/pipeline/orchestrator';
import { prioritizeLead } from '../server/pipeline/priority';
import { cleanLead } from '../server/pipeline/cleaning';
import { pipelineCSV } from '../src/services/runs';
import { ClassificationError } from '../server/services/openai';
const lead = { id: 'one', name: 'Test', education: 'BSc Nursing', germanLevel: 'B2', email: 'test@example.com', phone: '+919999999999', conversation: 'I want to work in Germany. I can enroll today.' };
const classified = { relevant: 'Yes' as const, reason: 'Explicit interest.', confidence: 0.9, evidence: ['BSc Nursing'] };

test('five-stage pipeline uses snapshotted prompts, three calls, real events, and exports; no evaluator', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  config.prompts.enrichment.systemPrompt = 'Enrichment runtime A'; config.prompts.outreach.systemPrompt = 'Outreach runtime A';
  const run = createRun({ leads: [lead], configuration: config }, 'outreach');
  config.prompts.enrichment.systemPrompt = 'Changed'; config.prompts.outreach.systemPrompt = 'Changed';
  const requests: any[] = [];
  await runPipeline(run.runId, async (request, count) => { requests.push(request); return fixtureRequest(request, count); });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed'); assert.equal(done.aiInvocationCount, 3);
  assert.deepEqual(done.executionEvents.map(e => e.component), ['clean', 'classification', 'enrichment', 'priority', 'outreach']);
  assert.equal(done.executionEvents[3].model, null); assert.equal(done.executionEvents[3].promptVersion, null);
  assert.ok(requests[1].instructions.startsWith('Enrichment runtime A'));
  assert.ok(requests[2].instructions.startsWith('Outreach runtime A'));
  assert.deepEqual(JSON.parse(requests[2].input).priority, done.priorities[0].result);
  assert.equal(done.outreaches.length, 1); assert.deepEqual(done.processedLeads, []);
  assert.ok(done.executionEvents.every(e => e.durationMs >= 0 && e.completedAt));
  assert.match(pipelineCSV(done), /Could you tell us about your career goals/);
});

test('deterministic score sums exactly, unknown signals score zero, and review/nonfit/duplicate are constrained', () => {
  const cleaned = cleanLead(lead, []);
  const high = structuredClone(enrichment);
  high.signals = { intent: { value: 'explicit', evidence: ['Germany'] }, urgency: { value: 'immediate', evidence: ['today'] }, buyingSignal: { value: 'commitment', evidence: ['enroll'] } };
  const score = prioritizeLead(cleaned, classified, high);
  assert.equal(score.priorityScore, 100); assert.equal(score.priority, 'HIGH');
  assert.equal(Object.entries(score.scoreBreakdown).filter(([k]) => k !== 'total').reduce((n, [, v]) => n + v, 0), score.priorityScore);
  assert.deepEqual(prioritizeLead(cleaned, classified, high), score);
  assert.equal(prioritizeLead(cleaned, { ...classified, relevant: 'Review' }, high).priority, 'MEDIUM');
  assert.equal(prioritizeLead(cleaned, { ...classified, relevant: 'No' }, high).priority, 'LOW');
  assert.equal(prioritizeLead({ ...cleaned, duplicateStatus: 'Duplicate' }, classified, high).priority, 'MEDIUM');
  const unknown = prioritizeLead(cleanLead({ id: 'empty' }, []), { ...classified, relevant: 'Review' }, enrichment);
  assert.equal(unknown.priorityScore, 10); assert.equal(unknown.scoreBreakdown.urgency, 0);
});

test('invalid enrichment blocks dependent stages and preserves other leads', async () => {
  const run = createRun({ leads: [lead, { ...lead, id: 'two' }], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  let enrichCalls = 0;
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_enrichment' && ++enrichCalls === 1) { count(); return { model: 'test', text: JSON.stringify({ ...enrichment, evidence: ['Invented qualification'] }) }; }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'PARTIAL_FAILURE'); assert.equal(done.aiInvocationCount, 5);
  assert.deepEqual(done.executionEvents.filter(e => e.leadId === 'one').map(e => e.component), ['clean', 'classification', 'enrichment']);
  assert.equal(done.outreaches.length, 1); assert.equal(done.errors[0].type, 'UNSUPPORTED_EVIDENCE');
});

test('outreach failure retains valid prior outputs and does not fabricate a draft', async () => {
  const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_outreach') { count(); throw new ClassificationError('OPENAI_TIMEOUT', 'Request timed out.'); }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'failed'); assert.equal(done.priorities.length, 1); assert.equal(done.outreaches.length, 0); assert.equal(done.aiInvocationCount, 3);
  assert.equal(done.executionEvents.at(-1)?.error?.type, 'OPENAI_TIMEOUT');
});

test('non-unknown enrichment signals require real evidence and malformed outreach is rejected', async () => {
  for (const bad of [
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'explicit', evidence: [] } } },
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'explicit', evidence: ['Invented intent'] } } },
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'unsupported', evidence: ['Germany'] } } },
  ]) {
    const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
    await runPipeline(run.runId, async (request, count) => {
      if (request.schemaName === 'lead_enrichment') { count(); return { model: 'test', text: JSON.stringify(bad) }; }
      return fixtureRequest(request, count);
    });
    assert.equal(getRun(run.runId)!.enrichments.length, 0);
    assert.equal(getRun(run.runId)!.priorities.length, 0);
  }
  const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_outreach') { count(); return { model: 'test', text: '{"personalizedOutreach":"Unsupported"}' }; }
    return fixtureRequest(request, count);
  });
  assert.equal(getRun(run.runId)!.outreaches.length, 0);
  assert.equal(getRun(run.runId)!.errors[0].type, 'INVALID_OUTPUT');
});
