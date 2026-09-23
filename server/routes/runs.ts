import { Router } from 'express';
import { validateRunRequest } from '../utils/validation';
import { createRun, getRun, updateRun } from '../store/runStore';
import { runPipeline } from '../pipeline/orchestrator';
import { requireOpenAIKey, createOpenAIRequest, type RequestClassification } from '../services/openai';

// A test may inject an HTTP transport; production always checks the server key.
export function createRunsRouter(testRequest?: RequestClassification) {
  const router = Router();
  router.post('/', (req, res) => {
    try { validateRunRequest(req.body); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid run request.' }); return; }
    let request: RequestClassification;
    try { request = testRequest || createOpenAIRequest(requireOpenAIKey()); }
    catch { res.status(503).json({ error: 'Set OPENAI_API_KEY in the server .env file and restart the backend. No AI run was started.' }); return; }
    const run = createRun(req.body, 'evaluation');
    res.status(202).json(run);
    setImmediate(() => {
      void runPipeline(run.runId, request).catch(() => {
        updateRun(run.runId, { status: 'failed', currentStage: null, currentLeadId: null,
          completedAt: new Date().toISOString(), errors: [{ leadId: '', type: 'PIPELINE_ERROR', message: 'The run stopped unexpectedly.' }] });
      });
    });
  });
  router.get('/:runId', (req, res) => {
    const run = getRun(req.params.runId);
    if (!run) { res.status(404).json({ error: 'Run not found. Run data is lost when the backend restarts.' }); return; }
    res.json(run);
  });
  return router;
}
