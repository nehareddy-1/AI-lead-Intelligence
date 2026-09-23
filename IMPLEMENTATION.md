# Complete local pipeline

The active pipeline executes Cleaning, Classification, Enrichment, Priority, Outreach and Evaluator. Existing UI styling,
upload/preview flow, configuration editor and Result/Logs surfaces are retained.

## Server changes

- `services/openai.ts`: official OpenAI SDK Responses client, server-only credentials,
  strict JSON schema, timeout, no retries, safe errors and request metadata.
- `agents/classifier.ts`: cleaned/source input, runtime prompt and output contract.
- `pipeline/classification.ts`: AI invocation plus independent response validation.
- `prompts/defaults.ts`: source-grounded Classification default with uncertainty Review.
- `utils/validation.ts`: response shape/range/evidence checks alongside request validation.
- `pipeline/orchestrator.ts`: Cleaning → Classification → Enrichment → Priority → Outreach → Evaluator → Results, live events, per-lead
  failures, invocation counting and measured durations.
- `store/runStore.ts` and `types/pipeline.ts`: immutable configuration/model snapshots,
  separate classification results, original/cleaned records and in-memory run lifecycle.
- `routes/runs.ts` and `index.ts`: default configuration endpoint, credential preflight,
  asynchronous run creation and polling. Test dependencies are injected in process only.

## Frontend changes

`src/services/runs.ts` fetches configuration, submits/polls runs, adapts real events,
and exports partial results. `App.tsx` uses real Clean/Classify progress. Existing
LeadExplorer/LeadDetails show partial results without fabricated final lead records.
ExecutionLogCard/LeadExecutionLogs show real statuses and response validation.
The demo processor remains isolated from the active application.

## Added stages

`server/agents/enrichment.ts` defines strict extraction and categorical signal schemas,
validates response shape and quoted source evidence, and sends the runtime enrichment prompt.
`server/pipeline/priority.ts` calculates and logs versioned deterministic scores.
`server/agents/outreach.ts` generates and validates draft-only outreach using earlier outputs.
`server/services/openai.ts` shares the existing Responses transport across all AI stages.
`RunRecord` stores separate typed enrichments, priorities and outreaches; it stores validated evaluation results. The orchestrator skips dependent stages after failure and continues
other leads. UI progress, activity events, Result/Logs and CSV use these actual outputs.

## Verification and limits

Tests cover transport request formatting, all stage prompt snapshots, three-call invocation
counts, score arithmetic and gates, validation failures, downstream failure handling,
export, cleaning regressions and HTTP lifecycle. Network/model behavior requires a configured
local key. Evaluator was added in server/agents/evaluator.ts, with deterministic weighted aggregation,
strict score validation and versioned decision rules. The existing dashboard now consumes
actual processedLeads; CSV includes metrics, score, decision and issues.
No database, Python backend, automatic message sending or durable human approval was added.
