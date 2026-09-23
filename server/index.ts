import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunsRouter } from './routes/runs';

import type { RequestClassification } from './services/openai';
import { DEFAULT_AGENT_CONFIGURATION } from '../src/data/defaultConfig';
import { DEFAULT_CLASSIFICATION_PROMPT } from './prompts/defaults';

export function createApp(testRequest?: RequestClassification) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.get('/api/configuration', (_req, res) => res.json({ ...DEFAULT_AGENT_CONFIGURATION, prompts: { ...DEFAULT_AGENT_CONFIGURATION.prompts, classification: DEFAULT_CLASSIFICATION_PROMPT } }));
  app.use('/api/runs', createRunsRouter(testRequest));
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });
  if (process.env.NODE_ENV === 'production') {
    const dist = fileURLToPath(new URL('../dist', import.meta.url));
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  const errors: express.ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Request too large.' : status === 400 ? 'Invalid JSON request.' : 'Internal server error.' });
  };
  app.use(errors);
  return app;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, '127.0.0.1', () => console.log(`Lead Intelligence API listening at http://127.0.0.1:${port}`));
}
