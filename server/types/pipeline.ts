import type { AgentConfigurationState, ExecutionEvent, PipelineStageKey, ProcessedLead } from '../../src/types/lead';

export type SourceValue = string | null;
// Parsed source values are preserved verbatim, including unknown CSV columns.
export interface OriginalLead { id: string; [field: string]: SourceValue }
export interface CleaningValidation {
  missingFields: string[];
  invalidFields: string[];
  warnings: string[];
}
export interface CleanedLead extends OriginalLead {
  name: string | null;
  email: string | null;
  phone: string | null;
  germanLevel: string | null;
}
export interface CleaningResult {
  lead: CleanedLead;
  duplicateStatus: 'Unique' | 'Duplicate';
  duplicateOfLeadId?: string;
  duplicateReason?: string;
  validation: CleaningValidation;
}
export type RunStatus = 'waiting' | 'running' | 'completed' | 'PARTIAL_FAILURE' | 'failed';
export interface RunRecord {
  runId: string;
  phase: 'cleaning' | 'classification' | 'outreach' | 'evaluation';
  enrichments: { leadId: string; result: import('../agents/enrichment').EnrichmentResult }[];
  priorities: { leadId: string; result: import('../pipeline/priority').PriorityResult }[];
  outreaches: { leadId: string; result: import('../agents/outreach').OutreachResult }[];
  evaluations: { leadId: string; result: import('../agents/evaluator').EvaluationResult }[];
  evaluationRulesVersion: string;
  priorityRulesVersion: string;
  classificationModel: string | null;
  classifications: { leadId: string; result: ClassificationResult }[];
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  configurationSnapshot: AgentConfigurationState;
  totalLeads: number;
  completedLeads: number;
  currentLeadId: string | null;
  currentStage: PipelineStageKey | null;
  originalLeads: OriginalLead[];
  cleanedLeads: CleaningResult[];
  processedLeads: ProcessedLead[];
  executionEvents: ExecutionEvent[];
  warnings: { leadId: string; message: string }[];
  errors: { leadId: string; type: string; message: string }[];
  aiInvocationCount: number;
}
export interface StartRunRequest { leads: OriginalLead[]; configuration: AgentConfigurationState }


export interface ClassificationResult {
  relevant: 'Yes' | 'No' | 'Review';
  reason: string;
  confidence: number;
  evidence: string[];
}
