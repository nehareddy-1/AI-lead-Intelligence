import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLead } from '../server/pipeline/cleaning';
import { createRun, getRun } from '../server/store/runStore';
import { runCleaning } from '../server/pipeline/orchestrator';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { parseCSV } from '../src/services/csvParser';
import { SAMPLE_RAW_CSV } from '../src/data/sampleLeads';
import type { OriginalLead } from '../server/types/pipeline';

const lead = (fields: Partial<OriginalLead> = {}): OriginalLead => ({ id: 'L001', name: '  Neha   Patel  ', ...fields });
test('normalizes whitespace without mutating source', () => {
  const input = lead(); const source = structuredClone(input);
  assert.equal(cleanLead(input).lead.name, 'Neha Patel'); assert.deepEqual(input, source);
});
test('normalizes email without inventing an address', () => assert.equal(cleanLead(lead({ email: ' NEHA@EXAMPLE.COM ' })).lead.email, 'neha@example.com'));
test('normalizes recognized German levels', () => {
  for (const value of ['b1', 'B 1', ' b 1 ']) assert.equal(cleanLead(lead({ germanLevel: value })).lead.germanLevel, 'B1');
});
test('missing German stays null and is identified', () => {
  for (const value of [null, '', '  ', undefined]) {
    const result = cleanLead(lead({ germanLevel: value }));
    assert.equal(result.lead.germanLevel, null); assert.ok(result.validation.missingFields.includes('germanLevel'));
  }
});
test('duplicate email matches earlier normalized valid contact', () => {
  const first = cleanLead(lead({ email: 'NEHA@example.com' }));
  const second = cleanLead(lead({ id: 'L002', email: ' neha@example.com ' }), [first]);
  assert.equal(second.duplicateStatus, 'Duplicate'); assert.equal(second.duplicateOfLeadId, 'L001');
});
test('duplicate phone ignores safe formatting', () => {
  const first = cleanLead(lead({ phone: '+91 98234 56789' }));
  const second = cleanLead(lead({ id: 'L002', phone: '+91-(98234)-56789' }), [first]);
  assert.equal(second.duplicateStatus, 'Duplicate');
});
test('name alone is not a duplicate', () => {
  const first = cleanLead(lead({ email: 'first@example.com', phone: '9876543210' }));
  assert.equal(cleanLead(lead({ id: 'L002', email: 'second@example.com', phone: '9876543211' }), [first]).duplicateStatus, 'Unique');
});
test('invalid contacts are preserved and never duplicate identifiers', () => {
  const first = cleanLead(lead({ email: 'not-an-email', phone: 'call me' }));
  assert.equal(first.lead.email, 'not-an-email'); assert.ok(first.validation.invalidFields.includes('email'));
  assert.equal(cleanLead(lead({ id: 'L002', email: 'not-an-email', phone: 'call me' }), [first]).duplicateStatus, 'Unique');
});
test('preserves conversation exactly except surrounding whitespace', () => {
  const text = '  Hello  there.\nB1? "No" — keep this.  ';
  assert.equal(cleanLead(lead({ conversation: text })).lead.conversation, text.trim());
});
test('does not infer names, country codes or unknown language levels', () => {
  const result = cleanLead(lead({ name: null, phone: '98765 43210', germanLevel: 'B3' }));
  assert.equal(result.lead.name, null); assert.equal(result.lead.phone, '9876543210'); assert.equal(result.lead.germanLevel, 'B3');
  assert.ok(result.validation.invalidFields.includes('germanLevel'));
});
test('configuration and source snapshots are isolated; warnings are execution success', async () => {
  const config = structuredClone(DEFAULT_AGENT_CONFIGURATION);
  const input = lead({ germanLevel: null });
  const run = createRun({ leads: [input], configuration: config }, 'cleaning');
  config.prompts.classification.systemPrompt = 'changed'; input.name = 'changed';
  await runCleaning(run.runId);
  const result = getRun(run.runId)!;
  assert.equal(result.status, 'completed'); assert.equal(result.executionEvents[0].status, 'success');
  assert.equal(result.originalLeads[0].name, '  Neha   Patel  ');
  assert.notEqual(result.configurationSnapshot.prompts.classification.systemPrompt, 'changed');
  assert.deepEqual(result.executionEvents[0].input, result.originalLeads[0]);
  assert.deepEqual(result.executionEvents[0].output, result.cleanedLeads[0]);
  assert.ok(result.executionEvents[0].durationMs >= 0); assert.equal(result.executionEvents[0].model, null);
  result.originalLeads[0].name = 'mutated read'; assert.notEqual(getRun(run.runId)!.originalLeads[0].name, 'mutated read');
  assert.equal(result.aiInvocationCount, 0); assert.deepEqual(result.processedLeads, []);
});
test('unexpected per-record failure is safe and other leads continue', async () => {
  const run = createRun({ leads: [lead(), lead({ id: 'L002' })], configuration: DEFAULT_AGENT_CONFIGURATION }, 'cleaning');
  await runCleaning(run.runId, (input, previous) => { if (input.id === 'L001') throw new Error('private diagnostic'); return cleanLead(input, previous); });
  const result = getRun(run.runId)!;
  assert.equal(result.status, 'PARTIAL_FAILURE'); assert.equal(result.completedLeads, 2); assert.equal(result.cleanedLeads.length, 1);
  assert.equal(result.executionEvents[0].status, 'failed'); assert.ok(!JSON.stringify(result).includes('private diagnostic'));
});
test('sample CSV preserves Last Contacted separately and cleans all 30 without presets', async () => {
  const parsed = parseCSV(SAMPLE_RAW_CSV); assert.equal(parsed.error, undefined); assert.equal(parsed.rows.length, 30);
  assert.equal(parsed.rows[0].phone, '+91 98234 56789'); assert.equal(parsed.rows[0].lastContacted, 'Yesterday');
  const run = createRun({ leads: parsed.rows as OriginalLead[], configuration: DEFAULT_AGENT_CONFIGURATION }, 'cleaning');
  await runCleaning(run.runId); const result = getRun(run.runId)!;
  assert.equal(result.executionEvents.length, 30); assert.ok(result.executionEvents.every(event => event.component === 'clean'));
  const neha = result.cleanedLeads.find(item => item.lead.name === 'Neha Patel')!;
  assert.equal(neha.lead.germanLevel, 'B1');
  const akash = result.cleanedLeads.find(item => item.lead.name === 'Akash Joshi')!;
  assert.equal(akash.lead.germanLevel, null); assert.ok(akash.validation.missingFields.includes('germanLevel'));
  assert.equal(result.cleanedLeads[9].duplicateOfLeadId, 'L009');
});
test('CSV retains source whitespace and rejects malformed CSV', () => {
  const parsed = parseCSV('Name,Email\n"  Neha Patel  ", NEHA@EXAMPLE.COM ');
  assert.equal(parsed.rows[0].name, '  Neha Patel  ');
  assert.ok(parseCSV('Name,Email\n"unfinished,email').error);
  assert.ok(parseCSV('Name,Email\nNeha').error);
});
