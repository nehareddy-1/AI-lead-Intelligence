export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type QCStatus = 'PASS' | 'REVIEW' | 'FAIL';

export type PipelineStageKey = 
  | 'CLEAN' 
  | 'CLASSIFY' 
  | 'ENRICH' 
  | 'PRIORITIZE' 
  | 'OUTREACH' 
  | 'EVALUATE';

export type StepState = 'waiting' | 'running' | 'completed' | 'review' | 'failed';

export interface RawLead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  location?: string;
  education?: string;
  experience?: string;
  germanLevel?: string;
  leadSource?: string;
  lastContacted?: string;
  conversation?: string;
  [key: string]: any;
}

export interface ScoreBreakdown {
  fit: number; // max 20
  intent: number; // max 25
  careerReadiness: number; // max 15
  urgency: number; // max 15
  buyingSignal: number; // max 15
  dataConfidence: number; // max 10
  total: number; // max 100
}

export interface EvaluatorMetricScore {
  score: number; // 0 - 100
  issues: string[];
}

export interface EvaluatorReport {
  metrics: {
    factual_grounding: EvaluatorMetricScore;
    intent_understanding: EvaluatorMetricScore;
    completeness: EvaluatorMetricScore;
    internal_consistency: EvaluatorMetricScore;
    outreach_alignment: EvaluatorMetricScore;
    uncertainty_handling: EvaluatorMetricScore;
  };
  weightedScore: number; // e.g. 92.8
  finalDecision: 'PASS' | 'REVIEW' | 'FAIL';
  hardFlagsTriggered: string[];
  allIssues: string[];
  evaluationSummary?: string;
}

export interface QCReport {
  status: QCStatus;
  issueDetected?: string;
  sourceData?: string;
  problem?: string;
  recommendedFix?: string;
  reason?: string;
}

export interface ExecutionEvent {
  id: string;
  runId: string;
  leadId: string;
  leadName?: string;
  component: 'clean' | 'classification' | 'enrichment' | 'priority' | 'outreach' | 'evaluator';
  componentName: string;
  componentType: 'ai' | 'deterministic';
  input: Record<string, any>;
  output: Record<string, any>;
  promptVersion: string | null;
  model: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  durationFormatted: string;
  status: 'success' | 'review' | 'failed';
  error: { type: string; message: string } | null;
  summary?: string;
  evidence?: string[];
}

export interface ProcessedLead extends RawLead {
  duplicateStatus: 'None' | 'Potential Duplicate';
  isDuplicate?: boolean;
  
  // Classification
  relevant: 'YES' | 'NO' | 'REVIEW';
  confidence: number;
  relevanceReason: string;
  evidence: string[];
  
  // Enrichment
  profile: string;
  intent: string;
  potentialNeeds: string[];
  objections: string[];
  missingInformation: string[];
  potentialOpportunity: string;
  
  // Prioritization
  priorityScore: number;
  priority: PriorityLevel;
  scoreBreakdown: ScoreBreakdown;
  
  // Outreach
  recommendedNextAction: string;
  personalizedOutreach: string;
  
  // Evaluation / QC
  qcStatus: QCStatus;
  qcReason: string;
  qcReport?: QCReport;
  evaluatorReport?: EvaluatorReport;
  reviewedByHuman?: boolean;

  // Execution trace & run reference
  runId?: string;
  executionEvents?: ExecutionEvent[];
}

export interface StructuredAgentLog {
  id: string;
  timestamp: string;
  stage: PipelineStageKey;
  leadId: string;
  leadName: string;
  status: 'running' | 'success' | 'warning' | 'error';
  stageTitle: string;
  duration?: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  summary: string;
  details?: {
    evidence?: string[];
    reasons?: string[];
    flags?: string[];
    scores?: Record<string, number | string>;
  };
}

export interface DatasetValidationSummary {
  totalLeads: number;
  columnsDetected: number;
  columnNames: string[];
  missingFieldsCount: number;
  potentialDuplicatesCount: number;
  previewRows: RawLead[];
}

export type AppState =
  | 'EMPTY'
  | 'UPLOADED'
  | 'VALIDATION_ERROR'
  | 'READY'
  | 'PROCESSING'
  | 'COMPLETE'
  | 'PARTIAL_FAILURE'
  | 'FAILED';

export interface EvaluatorWeights {
  factual_grounding: number;
  intent_understanding: number;
  completeness: number;
  internal_consistency: number;
  outreach_alignment: number;
  uncertainty_handling: number;
}

export interface EvaluationThresholds {
  passThreshold: number;
  reviewThreshold: number;
}

export interface AgentPromptConfig {
  id: 'classification' | 'enrichment' | 'outreach' | 'evaluator';
  name: string;
  shortDesc: string;
  systemPrompt: string;
  version: string;
}

export interface AgentConfigurationState {
  prompts: Record<'classification' | 'enrichment' | 'outreach' | 'evaluator', AgentPromptConfig>;
  evaluatorWeights: EvaluatorWeights;
  thresholds: EvaluationThresholds;
}

export interface RunConfigurationSnapshot {
  run_id?: string;
  created_at?: string;
  classifier_prompt_version: string;
  enrichment_prompt_version: string;
  outreach_prompt_version: string;
  evaluator_prompt_version: string;
  evaluation_weights: EvaluatorWeights;
  pass_threshold: number;
  review_threshold: number;
}

export interface RunInfo {
  runId: string;
  startedAt: string;
  completedAt?: string;
  totalLeads: number;
  completedLeads: number;
  simulatedAICalls: number;
  warningsCount: number;
  errorsCount: number;
  totalDurationSeconds: number;
  status: 'running' | 'completed' | 'failed';
  configSnapshot: RunConfigurationSnapshot;
}
