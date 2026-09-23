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

test('five-stage pipeline uses snapshotted prompts, three batched calls, real events, and exports; no evaluator', async () => {
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
  assert.deepEqual(JSON.parse(requests[2].input).leads[0].priority, done.priorities[0].result);
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

test('invalid enrichment for one lead never drops it -- it continues with a flagged placeholder, and each stage is still exactly one batched call', async () => {
  const run = createRun({ leads: [lead, { ...lead, id: 'two' }], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_enrichment') {
      count();
      const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
      const results = body.leads.map(({ leadId }) => leadId === lead.id
        ? { leadId, ...enrichment, evidence: ['Invented qualification'] }
        : { leadId, ...enrichment });
      return { model: 'test', text: JSON.stringify({ results }) };
    }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  // Classification + enrichment + outreach: exactly one batched call each, never one per lead.
  assert.equal(done.aiInvocationCount, 3);
  assert.deepEqual(done.executionEvents.filter(e => e.leadId === lead.id).map(e => e.component), ['clean', 'classification', 'enrichment', 'priority', 'outreach']);
  assert.equal(done.outreaches.length, 2);
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks.length, 1);
  assert.equal(done.aiFallbacks[0].leadId, lead.id); assert.equal(done.aiFallbacks[0].stage, 'enrichment'); assert.equal(done.aiFallbacks[0].type, 'UNSUPPORTED_EVIDENCE');
  const fallbackEnrichment = done.enrichments.find(e => e.leadId === lead.id)!.result;
  assert.equal(fallbackEnrichment.profile, 'Unverified');
  const fallbackEvent = done.executionEvents.find(e => e.leadId === lead.id && e.component === 'enrichment')!;
  assert.equal(fallbackEvent.status, 'review'); assert.equal(fallbackEvent.error?.type, 'UNSUPPORTED_EVIDENCE');
  assert.deepEqual(fallbackEvent.output, fallbackEnrichment);
});

test('a whole-batch stage failure (e.g. a timeout) does not drop the lead -- it continues with a placeholder, flagged for review', async () => {
  const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_outreach') { count(); throw new ClassificationError('OPENAI_TIMEOUT', 'Request timed out.'); }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed'); assert.equal(done.priorities.length, 1); assert.equal(done.outreaches.length, 1); assert.equal(done.aiInvocationCount, 3);
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks.length, 1); assert.equal(done.aiFallbacks[0].type, 'OPENAI_TIMEOUT');
  assert.equal(done.executionEvents.at(-1)?.status, 'review');
  assert.equal(done.executionEvents.at(-1)?.error?.type, 'OPENAI_TIMEOUT');
  assert.equal(done.outreaches[0].result.recommendedNextAction, 'Manual review required.');
});

test('non-unknown enrichment signals requiring real evidence, and malformed outreach, never drop the lead -- they produce a flagged placeholder', async () => {
  for (const bad of [
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'explicit', evidence: [] } } },
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'explicit', evidence: ['Invented intent'] } } },
    { ...enrichment, signals: { ...enrichment.signals, intent: { value: 'unsupported', evidence: ['Germany'] } } },
  ]) {
    const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
    await runPipeline(run.runId, async (request, count) => {
      if (request.schemaName === 'lead_enrichment') { count(); return { model: 'test', text: JSON.stringify({ results: [{ leadId: lead.id, ...bad }] }) }; }
      return fixtureRequest(request, count);
    });
    const done = getRun(run.runId)!;
    assert.equal(done.status, 'completed');
    assert.equal(done.enrichments.length, 1); assert.equal(done.enrichments[0].result.profile, 'Unverified');
    assert.equal(done.priorities.length, 1);
    assert.equal(done.errors.length, 0); assert.equal(done.aiFallbacks.length, 1);
  }
  const run = createRun({ leads: [lead], configuration: DEFAULT_AGENT_CONFIGURATION }, 'outreach');
  await runPipeline(run.runId, async (request, count) => {
    if (request.schemaName === 'lead_outreach') { count(); return { model: 'test', text: JSON.stringify({ results: [{ leadId: lead.id, personalizedOutreach: 'Unsupported' }] }) }; }
    return fixtureRequest(request, count);
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.outreaches.length, 1); assert.equal(done.outreaches[0].result.recommendedNextAction, 'Manual review required.');
  assert.equal(done.errors.length, 0);
  assert.equal(done.aiFallbacks[0].type, 'INVALID_OUTPUT');
});

test('a lead needing an upstream (non-evaluator) fallback is still flagged for review even when classification is clean and the evaluator itself scores it well', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  const two = { ...lead, id: 'two', email: 'test2@example.com', phone: '+919999999998' };
  const run = createRun({ leads: [lead, two], configuration: config }, 'evaluation');
  await runPipeline(run.runId, async (request, count) => {
    const body = JSON.parse(request.input) as { leads: { leadId: string }[] };
    const leadIds = body.leads.map(l => l.leadId);
    if (request.schemaName === 'lead_classification') {
      count();
      return { model: 'test', text: JSON.stringify({ results: leadIds.map(leadId => ({ leadId, ...classified })) }) };
    }
    if (request.schemaName === 'lead_enrichment') {
      count();
      const results = leadIds.map(leadId => leadId === lead.id
        ? { leadId, ...enrichment, evidence: ['Invented qualification'] } // fabricated -> fallback for `lead` only
        : { leadId, ...enrichment });
      return { model: 'test', text: JSON.stringify({ results }) };
    }
    return fixtureRequest(request, count); // outreach/evaluator: shared high-scoring fixtures for both leads
  });
  const done = getRun(run.runId)!;
  assert.equal(done.status, 'completed');
  assert.equal(done.processedLeads.length, 2);
  const flagged = done.processedLeads.find(l => l.id === lead.id)!;
  assert.equal(flagged.aiFallbackUsed, true);
  // Without this guarantee, a clean-scoring evaluator run would silently mark this lead PASS even
  // though its enrichment is an unverified placeholder -- it must be forced into Review instead.
  assert.equal(flagged.qcStatus, 'REVIEW');
  assert.match(flagged.qcReason, /fallback/);
  const clean = done.processedLeads.find(l => l.id === 'two')!;
  assert.equal(clean.aiFallbackUsed, false);
  assert.equal(clean.qcStatus, 'PASS');
});
