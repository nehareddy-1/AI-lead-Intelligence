// DEMO ONLY: retained as a visual fixture. Real runs use server/pipeline/orchestrator.ts.
import { 
  RawLead, 
  ProcessedLead, 
  StructuredAgentLog, 
  PipelineStageKey, 
  StepState,
  ScoreBreakdown,
  QCReport,
  EvaluatorReport,
  EvaluatorMetricScore,
  ExecutionEvent,
  RunConfigurationSnapshot,
  EvaluatorWeights
} from '../types/lead';
import { PRESET_PROCESSED_LEADS } from '../data/sampleLeads';
import { DEFAULT_EVALUATOR_WEIGHTS, DEFAULT_EVALUATION_THRESHOLDS } from '../data/defaultConfig';

/**
 * Format current timestamp as HH:MM:SS
 */
export function getFormattedTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Helper to process a single raw lead through all 6 components,
 * returning the processed lead, execution events, and structured logs.
 */
export function processLeadRecord(
  rawLead: RawLead,
  existingLeads: RawLead[],
  leadIndex: number,
  configSnapshot?: RunConfigurationSnapshot,
  runId: string = 'RUN-001'
): { 
  processedLead: ProcessedLead; 
  logs: StructuredAgentLog[]; 
  executionEvents: ExecutionEvent[] 
} {
  const weights: EvaluatorWeights = configSnapshot?.evaluation_weights || DEFAULT_EVALUATOR_WEIGHTS;
  const passThreshold = configSnapshot?.pass_threshold ?? DEFAULT_EVALUATION_THRESHOLDS.passThreshold;
  const reviewThreshold = configSnapshot?.review_threshold ?? DEFAULT_EVALUATION_THRESHOLDS.reviewThreshold;

  const classifierVersion = configSnapshot?.classifier_prompt_version || 'v1';
  const enrichmentVersion = configSnapshot?.enrichment_prompt_version || 'v1';
  const outreachVersion = configSnapshot?.outreach_prompt_version || 'v1';
  const evaluatorVersion = configSnapshot?.evaluator_prompt_version || 'v1';

  // Check if we have a match in preset leads by name or ID
  const preset = PRESET_PROCESSED_LEADS.find(
    (p) => 
      p.id.toLowerCase() === rawLead.id.toLowerCase() ||
      p.name.toLowerCase().trim() === rawLead.name.toLowerCase().trim()
  );

  let processedLead: ProcessedLead;

  if (preset) {
    processedLead = {
      ...preset,
      id: rawLead.id || preset.id,
      phone: rawLead.phone || preset.phone,
      email: rawLead.email || preset.email,
      location: rawLead.location || preset.location,
      education: rawLead.education || preset.education,
      experience: rawLead.experience || preset.experience,
      germanLevel: rawLead.germanLevel !== undefined ? rawLead.germanLevel : preset.germanLevel,
      conversation: rawLead.conversation || preset.conversation,
      runId,
    };
  } else {
    processedLead = buildDynamicLead(rawLead, existingLeads, leadIndex, runId);
  }

  // Calculate Evaluator report & metrics
  const evaluatorReport = computeEvaluatorReport(
    rawLead, 
    processedLead, 
    weights, 
    passThreshold, 
    reviewThreshold
  );

  processedLead.evaluatorReport = evaluatorReport;
  processedLead.qcStatus = evaluatorReport.finalDecision;
  if (evaluatorReport.hardFlagsTriggered.length > 0) {
    processedLead.qcReason = evaluatorReport.hardFlagsTriggered[0];
  } else if (evaluatorReport.allIssues.length > 0) {
    processedLead.qcReason = evaluatorReport.allIssues[0];
  }

  // Generate the 6 Execution Events
  const executionEvents = generateExecutionEvents(
    rawLead,
    processedLead,
    evaluatorReport,
    runId,
    classifierVersion,
    enrichmentVersion,
    outreachVersion,
    evaluatorVersion
  );

  processedLead.executionEvents = executionEvents;

  // Map execution events to legacy/live StructuredAgentLogs for live console streaming
  const logs = executionEvents.map((evt) => convertEventToLog(evt, processedLead));

  return { processedLead, logs, executionEvents };
}

/**
 * Computes generic, structured AI quality evaluation across the 6 dimensions:
 * 1. Factual Grounding
 * 2. Intent Understanding
 * 3. Completeness
 * 4. Internal Consistency
 * 5. Outreach Alignment
 * 6. Uncertainty Handling
 */
function computeEvaluatorReport(
  raw: RawLead,
  lead: ProcessedLead,
  weights: EvaluatorWeights,
  passThreshold: number,
  reviewThreshold: number
): EvaluatorReport {
  const hardFlags: string[] = [];
  const fgIssues: string[] = [];
  const iuIssues: string[] = [];
  const compIssues: string[] = [];
  const icIssues: string[] = [];
  const oaIssues: string[] = [];
  const uhIssues: string[] = [];

  let fgScore = 95;
  let iuScore = 94;
  let compScore = 90;
  let icScore = 100;
  let oaScore = 92;
  let uhScore = 96;

  const conv = (raw.conversation || '').toLowerCase();
  const edu = (raw.education || '').toLowerCase();
  const isGermanMissing = !raw.germanLevel || raw.germanLevel.trim() === '';

  // 1. Missing German Level Handling (e.g. Akash)
  if (isGermanMissing) {
    // If the system did NOT hallucinate B1, reward uncertainty handling
    if (!lead.personalizedOutreach.toLowerCase().includes('b1') && !lead.profile.toLowerCase().includes('b1')) {
      uhScore = 95;
      compScore = 80;
      compIssues.push('German proficiency missing in raw CSV input.');
      hardFlags.push('Missing Information: German proficiency was not provided in source lead.');
    } else {
      // Hallucination detected
      fgScore = 55;
      uhScore = 40;
      fgIssues.push('Unsupported claim: AI inferred German level when source was blank.');
      hardFlags.push('Unsupported factual claim: German level hallucinated.');
    }
  }

  // 2. Expectation Risk / Employment Guarantee (e.g. Karan)
  if (conv.includes('guarantee')) {
    if (lead.personalizedOutreach.toLowerCase().includes('guarantee')) {
      oaScore = 50;
      oaIssues.push('Outreach inappropriately promised guaranteed job.');
      hardFlags.push('Unsupported employment guarantee detected in outreach draft.');
    } else {
      oaScore = 88;
      iuIssues.push('Candidate inquired regarding job guarantee; outreach correctly avoided promises.');
      hardFlags.push('Expectation Risk: Candidate inquired regarding job guarantee.');
    }
  }

  // 3. Ambiguous Healthcare Pathway (e.g. Farhan - Pharmacy / Physiotherapy)
  if (lead.relevant === 'REVIEW' || edu.includes('pharm') || edu.includes('physio')) {
    iuScore = 82;
    icScore = 88;
    iuIssues.push('Allied health qualification requires syllabus equivalence audit.');
    hardFlags.push('Qualification Uncertainty: Pathway eligibility requires human verification.');
  }

  // 4. Duplicate submission
  if (lead.duplicateStatus === 'Potential Duplicate') {
    icScore = 85;
    icIssues.push('Duplicate contact details detected across records.');
    hardFlags.push('Duplicate submission detected from matching contact details.');
  }

  // 5. Timeline mentioned in source but not captured
  if (conv.includes('next month') || conv.includes('january') || conv.includes('immediately')) {
    if (lead.missingInformation.some((m) => m.toLowerCase().includes('timeline'))) {
      compScore = Math.min(compScore, 85);
      compIssues.push('Timeline was mentioned in source conversation but flagged for confirmation in enrichment.');
    }
  }

  // 6. Non-relevant lead
  if (lead.relevant === 'NO') {
    fgScore = 98;
    iuScore = 96;
    oaScore = 95;
  }

  // Calculate weighted score deterministically:
  // Factual Grounding (w.fg) + Intent (w.iu) + Completeness (w.comp) + Consistency (w.ic) + Outreach (w.oa) + Uncertainty (w.uh)
  const totalWeight = weights.factual_grounding + 
                      weights.intent_understanding + 
                      weights.completeness + 
                      weights.internal_consistency + 
                      weights.outreach_alignment + 
                      weights.uncertainty_handling;

  const normalizedTotalWeight = totalWeight > 0 ? totalWeight : 100;

  const weightedSum = (
    fgScore * weights.factual_grounding +
    iuScore * weights.intent_understanding +
    compScore * weights.completeness +
    icScore * weights.internal_consistency +
    oaScore * weights.outreach_alignment +
    uhScore * weights.uncertainty_handling
  ) / normalizedTotalWeight;

  const weightedScore = Math.round(weightedSum * 10) / 10;

  // Determine final decision with Hard Review Rules
  let finalDecision: 'PASS' | 'REVIEW' | 'FAIL' = 'PASS';

  if (hardFlags.length > 0) {
    finalDecision = 'REVIEW';
  } else if (weightedScore >= passThreshold) {
    finalDecision = 'PASS';
  } else if (weightedScore >= reviewThreshold) {
    finalDecision = 'REVIEW';
  } else {
    finalDecision = 'FAIL';
  }

  const allIssues = [
    ...fgIssues,
    ...iuIssues,
    ...compIssues,
    ...icIssues,
    ...oaIssues,
    ...uhIssues,
  ];

  return {
    metrics: {
      factual_grounding: { score: fgScore, issues: fgIssues },
      intent_understanding: { score: iuScore, issues: iuIssues },
      completeness: { score: compScore, issues: compIssues },
      internal_consistency: { score: icScore, issues: icIssues },
      outreach_alignment: { score: oaScore, issues: oaIssues },
      uncertainty_handling: { score: uhScore, issues: uhIssues },
    },
    weightedScore,
    finalDecision,
    hardFlagsTriggered: hardFlags,
    allIssues,
    evaluationSummary: hardFlags.length > 0 
      ? hardFlags[0] 
      : allIssues.length > 0 
      ? allIssues[0] 
      : 'All generated data verified against source evidence. Zero hallucinations detected.',
  };
}

/**
 * Generates the unified, observable ExecutionEvents for the 6 components
 */
function generateExecutionEvents(
  raw: RawLead,
  lead: ProcessedLead,
  evaluatorReport: EvaluatorReport,
  runId: string,
  classifierVersion: string,
  enrichmentVersion: string,
  outreachVersion: string,
  evaluatorVersion: string
): ExecutionEvent[] {
  const events: ExecutionEvent[] = [];
  const time = getFormattedTime();

  // 1. CLEANING ENGINE (Deterministic)
  const isDuplicate = lead.duplicateStatus === 'Potential Duplicate';
  events.push({
    id: `${lead.id}-evt-clean`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'clean',
    componentName: 'Cleaning Engine',
    componentType: 'deterministic',
    promptVersion: null,
    model: null,
    startedAt: time,
    completedAt: time,
    durationMs: 30,
    durationFormatted: '0.03s',
    status: isDuplicate ? 'review' : 'success',
    error: null,
    input: {
      name: raw.name,
      phone: raw.phone || '[Blank]',
      email: raw.email || '[Blank]',
      german_level: raw.germanLevel || '[Missing]',
    },
    output: {
      name: lead.name,
      phone: raw.phone ? `+${raw.phone.replace(/[^0-9]/g, '')}` : 'Missing',
      email: (raw.email || '').toLowerCase().trim(),
      german_level: raw.germanLevel ? raw.germanLevel.toUpperCase().trim() : 'Missing',
      duplicate_status: isDuplicate ? 'Potential Duplicate' : 'Unique',
    },
    summary: isDuplicate 
      ? 'Duplicate submission detected from matching contact details.' 
      : 'Phone normalized to standard format, email syntax checked, duplicate verified.',
  });

  // 2. CLASSIFICATION AGENT (AI)
  events.push({
    id: `${lead.id}-evt-classify`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'classification',
    componentName: 'Classification Agent',
    componentType: 'ai',
    promptVersion: classifierVersion,
    model: 'Mock AI',
    startedAt: time,
    completedAt: time,
    durationMs: 1310,
    durationFormatted: '1.31s',
    status: lead.relevant === 'REVIEW' ? 'review' : 'success',
    error: null,
    input: {
      education: raw.education || 'Unspecified',
      experience: raw.experience || 'Not provided',
      german_level: raw.germanLevel || 'Missing',
      conversation: raw.conversation || 'None',
    },
    output: {
      relevant: lead.relevant === 'YES' ? 'Yes' : lead.relevant === 'REVIEW' ? 'Review' : 'No',
      confidence: Math.round(lead.confidence) / 100,
      reason: lead.relevanceReason,
      evidence: lead.evidence || [],
    },
    summary: lead.relevanceReason,
    evidence: lead.evidence,
  });

  // 3. ENRICHMENT AGENT (AI)
  events.push({
    id: `${lead.id}-evt-enrich`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'enrichment',
    componentName: 'Enrichment Agent',
    componentType: 'ai',
    promptVersion: enrichmentVersion,
    model: 'Mock AI',
    startedAt: time,
    completedAt: time,
    durationMs: 1620,
    durationFormatted: '1.62s',
    status: 'success',
    error: null,
    input: {
      cleaned_lead: {
        name: lead.name,
        education: lead.education,
        experience: lead.experience,
        german_level: lead.germanLevel || 'Missing',
      },
      classification: {
        relevant: lead.relevant,
        confidence: lead.confidence,
        reason: lead.relevanceReason,
      },
    },
    output: {
      profile: lead.profile,
      intent: lead.intent,
      needs: lead.potentialNeeds,
      objections: lead.objections || [],
      missing_information: lead.missingInformation || [],
      potential_opportunity: lead.potentialOpportunity,
      recommended_next_step: lead.recommendedNextAction,
    },
    summary: `Profile synthesized. ${lead.potentialNeeds.length} candidate needs identified.`,
  });

  // 4. PRIORITY ENGINE (Deterministic)
  const b = lead.scoreBreakdown;
  events.push({
    id: `${lead.id}-evt-priority`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'priority',
    componentName: 'Priority Engine',
    componentType: 'deterministic',
    promptVersion: null,
    model: null,
    startedAt: time,
    completedAt: time,
    durationMs: 10,
    durationFormatted: '0.01s',
    status: 'success',
    error: null,
    input: {
      fit_signal: b.fit >= 15 ? 'strong' : 'moderate',
      intent_signal: b.intent >= 20 ? 'high' : 'medium',
      career_readiness: b.careerReadiness >= 12 ? 'high' : 'moderate',
      urgency: b.urgency >= 12 ? 'medium' : 'low',
      buying_signal: b.buyingSignal >= 10 ? 'high' : 'medium',
      data_confidence: b.dataConfidence >= 8 ? 'high' : 'moderate',
    },
    output: {
      fit: b.fit,
      intent: b.intent,
      career_readiness: b.careerReadiness,
      urgency: b.urgency,
      buying_signal: b.buyingSignal,
      data_confidence: b.dataConfidence,
      total: b.total,
      priority: lead.priority,
    },
    summary: `Deterministic weighted matrix computed: ${b.total}/100 (${lead.priority} Priority).`,
  });

  // 5. OUTREACH AGENT (AI)
  events.push({
    id: `${lead.id}-evt-outreach`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'outreach',
    componentName: 'Outreach Agent',
    componentType: 'ai',
    promptVersion: outreachVersion,
    model: 'Mock AI',
    startedAt: time,
    completedAt: time,
    durationMs: 1120,
    durationFormatted: '1.12s',
    status: 'success',
    error: null,
    input: {
      profile: lead.profile,
      intent: lead.intent,
      needs: lead.potentialNeeds,
      objections: lead.objections,
      priority: lead.priority,
      recommended_next_action: lead.recommendedNextAction,
    },
    output: {
      message: lead.personalizedOutreach,
    },
    summary: 'Tailored consultative outreach message generated without unverified promises.',
  });

  // 6. EVALUATOR AGENT (AI Evaluation + Deterministic Scoring)
  events.push({
    id: `${lead.id}-evt-evaluator`,
    runId,
    leadId: lead.id,
    leadName: lead.name,
    component: 'evaluator',
    componentName: 'Evaluator Agent',
    componentType: 'ai',
    promptVersion: evaluatorVersion,
    model: 'Mock AI',
    startedAt: time,
    completedAt: time,
    durationMs: 1480,
    durationFormatted: '1.48s',
    status: evaluatorReport.finalDecision === 'PASS' ? 'success' : evaluatorReport.finalDecision === 'REVIEW' ? 'review' : 'failed',
    error: null,
    input: {
      original_lead: {
        name: raw.name,
        education: raw.education,
        german_level: raw.germanLevel || 'Missing',
        conversation: raw.conversation,
      },
      classification: {
        relevant: lead.relevant,
        confidence: lead.confidence,
        evidence: lead.evidence,
      },
      enrichment: {
        profile: lead.profile,
        intent: lead.intent,
        needs: lead.potentialNeeds,
      },
      outreach_draft: lead.personalizedOutreach,
    },
    output: {
      factual_grounding: evaluatorReport.metrics.factual_grounding,
      intent_understanding: evaluatorReport.metrics.intent_understanding,
      completeness: evaluatorReport.metrics.completeness,
      internal_consistency: evaluatorReport.metrics.internal_consistency,
      outreach_alignment: evaluatorReport.metrics.outreach_alignment,
      uncertainty_handling: evaluatorReport.metrics.uncertainty_handling,
      weighted_score: evaluatorReport.weightedScore,
      hard_flags: evaluatorReport.hardFlagsTriggered,
      final_decision: evaluatorReport.finalDecision,
    },
    summary: `Quality Evaluator: ${evaluatorReport.weightedScore}% Quality (${evaluatorReport.finalDecision}). ${evaluatorReport.evaluationSummary}`,
  });

  return events;
}

/**
 * Converts ExecutionEvent to StructuredAgentLog for live processing feed
 */
function convertEventToLog(evt: ExecutionEvent, lead: ProcessedLead): StructuredAgentLog {
  const stageMap: Record<ExecutionEvent['component'], PipelineStageKey> = {
    clean: 'CLEAN',
    classification: 'CLASSIFY',
    enrichment: 'ENRICH',
    priority: 'PRIORITIZE',
    outreach: 'OUTREACH',
    evaluator: 'EVALUATE',
  };

  return {
    id: evt.id,
    timestamp: evt.completedAt,
    stage: stageMap[evt.component],
    leadId: lead.id,
    leadName: lead.name,
    status: evt.status === 'review' ? 'warning' : evt.status === 'failed' ? 'error' : 'success',
    stageTitle: evt.componentName.toUpperCase(),
    duration: evt.durationFormatted,
    input: evt.input,
    output: evt.output,
    summary: evt.summary || 'Step completed successfully.',
    details: {
      evidence: evt.evidence,
    },
  };
}

/**
 * Dynamic fallback builder for uploaded CSV rows that aren't in preset list
 */
function buildDynamicLead(
  raw: RawLead, 
  existingLeads: RawLead[], 
  leadIndex: number,
  runId: string
): ProcessedLead {
  const isDuplicate = existingLeads.some(
    (other, idx) =>
      idx !== leadIndex &&
      ((raw.phone && other.phone && raw.phone.replace(/[^0-9]/g, '') === other.phone.replace(/[^0-9]/g, '')) ||
       (raw.email && other.email && raw.email.toLowerCase().trim() === other.email.toLowerCase().trim()))
  );

  const duplicateStatus = isDuplicate ? 'Potential Duplicate' : 'None';

  const edu = (raw.education || '').toLowerCase();
  const conv = (raw.conversation || '').toLowerCase();
  const lang = (raw.germanLevel || '').toUpperCase();

  const isHealthcare = edu.includes('nurs') || edu.includes('mbbs') || edu.includes('bpt') || edu.includes('pharm') || edu.includes('physio') || edu.includes('doc') || edu.includes('health');
  const hasGermanyIntent = conv.includes('germany') || conv.includes('deutschland') || conv.includes('relocat') || conv.includes('german');

  let relevant: 'YES' | 'NO' | 'REVIEW' = 'YES';
  let confidence = 85;
  let relevanceReason = 'Healthcare professional with expressed relocation interest.';
  const evidence: string[] = [];

  if (raw.education) evidence.push(`Education: ${raw.education}`);
  if (raw.germanLevel) evidence.push(`German level: ${raw.germanLevel}`);
  if (raw.conversation) evidence.push(`Context: "${raw.conversation.slice(0, 50)}..."`);

  if (!isHealthcare) {
    relevant = 'NO';
    confidence = 95;
    relevanceReason = 'Candidate qualification is outside eligible healthcare pathways.';
  } else if (edu.includes('pharm') || edu.includes('physio')) {
    relevant = 'REVIEW';
    confidence = 65;
    relevanceReason = 'Allied health credential requires individual syllabus equivalence audit.';
  } else if (!hasGermanyIntent && !raw.conversation) {
    relevant = 'REVIEW';
    confidence = 60;
    relevanceReason = 'Candidate motivation requires qualification call.';
  }

  // Scoring
  const fit = isHealthcare ? (edu.includes('nurs') ? 19 : 14) : 4;
  const intentScore = hasGermanyIntent ? 22 : 12;
  const readiness = lang.includes('B2') ? 15 : lang.includes('B1') ? 13 : lang.includes('A2') ? 10 : 7;
  const urgency = conv.includes('tomorrow') || conv.includes('immediate') || conv.includes('today') || conv.includes('ready') ? 14 : 10;
  const buyingSignal = conv.includes('fee') || conv.includes('contract') || conv.includes('interview') ? 13 : 8;
  const dataConf = (raw.phone ? 3 : 0) + (raw.email ? 3 : 0) + (raw.germanLevel ? 2 : 0) + (raw.education ? 2 : 0);

  let totalScore = Math.min(100, Math.max(10, fit + intentScore + readiness + urgency + buyingSignal + dataConf));
  if (!isHealthcare) totalScore = Math.min(25, totalScore);

  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (totalScore >= 80) priority = 'HIGH';
  else if (totalScore >= 50) priority = 'MEDIUM';

  const scoreBreakdown: ScoreBreakdown = {
    fit,
    intent: intentScore,
    careerReadiness: readiness,
    urgency,
    buyingSignal,
    dataConfidence: dataConf,
    total: totalScore,
  };

  const profile = `${raw.education || 'Graduate'} | ${raw.experience || 'Experience unspecified'} | ${raw.germanLevel ? `${raw.germanLevel} German` : 'German: Missing'}`;
  const intent = hasGermanyIntent ? 'Germany healthcare relocation pathway.' : 'General career inquiry.';
  const potentialNeeds = [
    'Credential assessment and recognition guidance',
    'German language progression roadmap',
    'Hospital matching & visa documentation',
  ];
  const missingInformation: string[] = [];
  if (!raw.germanLevel) missingInformation.push('Current German language level');
  if (!raw.experience) missingInformation.push('Detailed hospital ward experience');
  if (!raw.location) missingInformation.push('Current city of residence');

  const recommendedNextAction = isHealthcare
    ? `Schedule 15-minute consultation to walk candidate through German pathway and language milestones.`
    : `Send qualification mismatch notification.`;

  const personalizedOutreach = isHealthcare
    ? `Hi ${raw.name.split(' ')[0]}, thank you for connecting with us regarding the German healthcare pathway. With your ${raw.education || 'healthcare background'}${raw.germanLevel ? ` and ${raw.germanLevel} German skills` : ''}, we can support your hospital placement and documentation. Would you be available for a brief briefing tomorrow?`
    : `Hi ${raw.name.split(' ')[0]}, thank you for reaching out. Our programs are specialized exclusively for licensed healthcare staff moving to German hospitals. As we do not handle general visas, we cannot assist with this request.`;

  return {
    ...raw,
    id: raw.id || `L${String(leadIndex + 1).padStart(3, '0')}`,
    name: raw.name,
    duplicateStatus,
    isDuplicate,
    relevant,
    confidence,
    relevanceReason,
    evidence,
    profile,
    intent,
    potentialNeeds,
    objections: ['Timeline and shift balancing during study'],
    missingInformation,
    potentialOpportunity: isHealthcare ? 'Hospital placement track with language sponsorship.' : 'Disqualified lead.',
    priorityScore: totalScore,
    priority,
    scoreBreakdown,
    recommendedNextAction,
    personalizedOutreach,
    qcStatus: 'PASS',
    qcReason: 'Verified against source record; no hallucinations.',
    runId,
  };
}
