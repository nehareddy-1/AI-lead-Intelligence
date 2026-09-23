import { fixtureRequest } from './pipeline.fixtures';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/index';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import type { RunRecord } from '../server/types/pipeline';

test('HTTP run lifecycle, invalid inputs, safe errors and independent snapshots', async () => {
  const server = createApp(fixtureRequest).listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/runs`;
  try {
    const request = { leads: [{ id: 'L001', name: ' Neha Patel ', germanLevel: null }], configuration: structuredClone(DEFAULT_AGENT_CONFIGURATION) };
    const post = (body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ ...request, leads: [request.leads[0], request.leads[0]] })).status, 400);
    const badConfig = structuredClone(request); badConfig.configuration.thresholds.reviewThreshold = 100;
    assert.equal((await post(badConfig)).status, 400);
    const response = await post(request); assert.equal(response.status, 202);
    const initial = await response.json() as RunRecord;
    assert.match(initial.runId, /^[a-f0-9-]{36}$/);
    let run = initial;
    for (let i = 0; i < 20 && ['waiting', 'running'].includes(run.status); i++) {
      run = await (await fetch(`${url}/${initial.runId}`)).json() as RunRecord;
    }
    assert.equal(run.status, 'completed'); assert.equal(run.executionEvents.length, 6);
    assert.equal(run.cleanedLeads[0].lead.name, 'Neha Patel'); assert.equal(run.originalLeads[0].name, ' Neha Patel ');
    assert.deepEqual(run.configurationSnapshot, request.configuration);
    assert.equal((await fetch(`${url}/missing`)).status, 404);
    const malformed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400); assert.deepEqual(await malformed.json(), { error: 'Invalid JSON request.' });
    assert.equal((await fetch(url + '/missing')).status, 404);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('missing credentials prevent a run; configuration exposes server prompt, never credentials', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const server = createApp().listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const config = await (await fetch(`${base}/configuration`)).json();
    assert.match(config.prompts.classification.systemPrompt, /Pharmacy/);
    assert.ok(!JSON.stringify(config).includes('OPENAI_API_KEY'));
    const response = await fetch(`${base}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: [{ id: 'one' }], configuration: config }) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).runId, undefined);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
