# AI Lead Intelligence — Complete local pipeline

React/Vite UI with the existing TypeScript/Express backend. The active pipeline is
**Cleaning → Classification → Enrichment → Priority → Outreach → Evaluator → Results**.
Evaluator audits the generated outputs; code calculates the final weighted quality decision.

## Run locally

Set these values in the repository `.env` (ignored by Git):

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
```

Keep the API key server-side; never use a VITE-prefixed key. Restart the backend
after changing environment values. Dependencies include the official OpenAI SDK.

Run `npm run dev:server` and `npm run dev` in separate terminals, then open
http://localhost:3000. Vite proxies `/api` to loopback port 3001. Alternatively,
`npm run build` then `npm start` serves both at http://127.0.0.1:3001.
Use Node 22.12+ and keep development dependencies installed for the tsx runner.

## Classification and configuration

`GET /api/configuration` supplies the server default prompt. The existing Agent
Configuration editor controls prompt text and version submitted with each run.
`POST /api/runs` validates input and snapshots configuration and model before
returning 202. Missing server credentials return 503 without starting a run.
`GET /api/runs/:runId` exposes actual progress, results and execution events.

Each successfully cleaned lead makes one Responses API request with the run's
classification prompt plus the application output/evidence contract. Structured
output contains only `relevant`, `reason`, `confidence`, and `evidence`. The server
independently validates field shape, ranges and evidence provenance. Evidence
must occur within an original source field, allowing case/whitespace normalization.
Generated row IDs are excluded. Unsupported evidence fails validation; it is never
silently accepted or turned into a fabricated result. With no evidence, only Review
is accepted. The prompt instructs uncertain pathway fit (including ambiguous
pharmacy cases) to return Review. Semantic correctness still requires live assessment.

Requests use `store: false`, a 45-second timeout, and no automatic retries. Invocation
counts measure attempted SDK requests, including failed requests. Each classification
has a running event followed by its actual terminal status, measured duration,
validated output or safe error, prompt version, model and available usage/request ID.
Raw provider responses and model reasoning are not logged. Other leads continue after
an individual failure. HTTP errors, refusals and malformed output never trigger mocks.

The existing Result/Logs surfaces and CSV download include all five stages.
Completed evaluations populate the existing dashboard and review queue. Failed records retain their partial results and error logs.
Runs and prompt edits are in memory; reload resets UI configuration.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`.
Tests cover cleaning regressions, HTTP lifecycle, strict classification validation,
source evidence, runtime prompt snapshots, SDK Responses request format, invocation
counts, partial failures, and sanitized rate limits. SDK transport tests use local
fixtures and do not incur API charges; they do not prove real model behavior.

For a live check, configure the key, start both processes, edit the Classification
prompt, and run a small CSV. Inspect the run configuration snapshot and Classification
logs; expect four AI calls and six component events per successful lead. Failed dependencies
stop later stages for that lead, while other leads continue.

## Source data and cleaning contract

- `originalLeads`: a deep copy of the parsed uploaded fields before cleaning;
  CSV cell whitespace is retained. The parser assigns row IDs, but no longer
  invents names. CSV escaping is decoded; this is not a byte archive of the file.
- `cleanedLeads`: separate `{ lead, validation, duplicateStatus, ... } records.
  Known missing fields consistently become null. Original values remain in
  originalLeads and the event input; the engine never mutates them.
- `processedLeads`: complete results only after a validated evaluation.
- `configurationSnapshot`: deep-copied complete active configuration, including
  prompt text and versions. Priority and evaluation rule versions are saved separately.
  Store functions return copies to prevent aliasing.

Names/location/education/experience use conservative whitespace cleanup. Emails
are lowercase and checked syntactically; malformed addresses are flagged, not
repaired. Phones remove spaces, dots, parentheses and hyphens only when the result
is 7–15 digits with an optional leading `+`. No country code is inferred; this is
basic syntax validation, not proof of reachability. Unknown phone characters are
retained and flagged. German A1–C2 case/spacing variants are normalized; explicit
`None`/`Beginner` remains source text, not an inferred proficiency level. Other
unrecognized grades are retained and flagged. Ambiguous experience remains text;
obvious negative durations are flagged. Conversation text is trimmed only at its
edges; internal spaces, line breaks and wording remain intact.

Duplicates use exact normalized **valid** email or phone, referencing the first
matching earlier successfully cleaned row. The first row remains Unique; later
matches are Duplicate. Name alone never establishes a match. Missing/invalid
contacts do not match. There is no fuzzy matching or row deletion.

CSV download escapes values and prefixes spreadsheet-formula-leading characters
with an apostrophe. The authoritative original/cleaned records remain unchanged.

## In-memory storage

**This prototype uses in-memory run storage. Run data is lost when the backend
process restarts or redeploys.**

`server/store/runStore.ts` owns the private `Map<string, RunRecord>`.
There is no database or filesystem persistence. Resetting the browser workflow
stops that browser's polling, not backend work; already submitted runs remain in
memory until restart. Reloading the page resets frontend selection/configuration;
a known run ID can still be retrieved from the API until the process restarts.
There is intentionally no multi-instance synchronization or durable recovery.

## Mock isolation and UI scope

`src/services/leadProcessor.ts` is explicitly marked DEMO ONLY and is not imported
by the active app. `processLeadRecord`, `buildDynamicLead`, `computeEvaluatorReport`
and `generateExecutionEvents` cannot supply real run data. Presets remain in the
sample module as fixtures; only SAMPLE_RAW_CSV is used as live sample input.

The existing upload, preview, styling, pipeline and log cards are retained. Lead
Explorer/LeadDetails have a partial pipeline view using the existing two-column and
Result/Logs patterns. Full AI dashboard and Review Queue components are retained
and populated from completed backend results. Failed or unfinished records remain in the
partial-results view. No durable human approval endpoint is implemented yet.


## Enrichment, Priority and Outreach

Enrichment uses the snapshotted runtime prompt and original/cleaned data plus classification.
It returns profile, intent, potential needs, objections, missing information, opportunity,
recommended action, source evidence and categorical intent/urgency/buying signals.
Each non-unknown signal must include a validated original-source quotation. This is source
analysis, not external contact/company lookup. Unsupported evidence fails the component.
Quote matching validates provenance, not the semantic truth of every generated statement.

Priority is deterministic and versioned `priority-v1`, retaining the UI's six categories:

| Category | Rules | Maximum |
| --- | --- | --- |
| Fit | Yes 20; Review 10; No 0 | 20 |
| Intent | Explicit 25; exploratory 12; unknown 0 | 25 |
| Career readiness | German B2/C1/C2 15; B1 12; A2 8; A1 4; unknown 0 | 15 |
| Urgency | Immediate 15; planned 8; unknown 0 | 15 |
| Buying signal | Commitment 15; inquiry 8; unknown 0 | 15 |
| Data confidence | Valid phone 3, email 3, present education 2, recognized German level 2 | 10 |

The total is the exact sum, with HIGH >=80, MEDIUM >=50, otherwise LOW. Classification
No limits the label to LOW; Review or duplicate limits it to MEDIUM. The total is not
silently changed by these gates. Logs include inputs, breakdown, reasons and rule version.
These initial business rules are explicit defaults, not learned predictions or eligibility rules.

Outreach receives original/cleaned data and validated earlier results. The runtime prompt
controls a draft and recommended action, with original-source evidence. Review cases ask
for clarification; No cases avoid a sales pitch; opt-outs should not receive outreach.
Drafts are evaluated but never sent. No sending endpoint exists.

All four AI calls share the server-only OpenAI client and snapshotted OPENAI_MODEL.
The [official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
describes the Responses text.format schema used here. No packages were added for these stages.

## Evaluator and remaining work

`server/agents/evaluator.ts` independently compares generated outputs with original source
records. The runtime prompt returns six dimension scores (0–100), observable issues,
material hard flags and a concise summary. It does not return a weighted score or decision.
Code uses the run's snapshotted weights, rounds the weighted mean to two decimals, and
applies inclusive thresholds: score >= pass => PASS; score >= review => REVIEW; otherwise
FAIL. Material unsupported claims/guarantees, contradictions or ignored opt-outs force FAIL.
Classification Review or duplicate contact downgrades a would-be PASS to REVIEW.
Missing source fields acknowledged as unknown are not automatically hallucinations.
The calculation is versioned `evaluation-v1`; weights, thresholds, model, prompt version,
inputs, output and timing are inspectable in the run/logs. Quality FAIL is a valid evaluation
result, not an execution failure. Invalid or failed AI responses produce no quality decision.

The complete local processing pipeline is implemented. Remaining production work:
persistent runs/configuration and human approval audit trail, authentication/access control,
durable background jobs/retries and deployment operations. Human approval buttons are
currently disabled for backend runs rather than changing a browser-only quality label.
The review queue includes FAIL, REVIEW, ambiguous classifications and duplicates. Outreach
sending is intentionally absent. No automated decision guarantees factual accuracy; examine
quality issues and drafts before use.

Live verification: a synthetic single-lead run completed all six components with four
real OpenAI requests on gpt-4.1-mini, producing a 99.25 PASS evaluation. This verifies
connectivity and the full runtime path, not model accuracy across all datasets.
