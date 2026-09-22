import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  Scale, 
  ShieldAlert 
} from 'lucide-react';
import { EvaluatorReport, EvaluatorWeights } from '../types/lead';
import { DEFAULT_EVALUATOR_WEIGHTS } from '../data/defaultConfig';

interface QualityEvaluationCardProps {
  evaluatorReport?: EvaluatorReport;
  weights?: EvaluatorWeights;
}

export const QualityEvaluationCard: React.FC<QualityEvaluationCardProps> = ({
  evaluatorReport,
  weights = DEFAULT_EVALUATOR_WEIGHTS,
}) => {
  if (!evaluatorReport) {
    return null;
  }

  const { weightedScore, finalDecision, metrics, hardFlagsTriggered, allIssues } = evaluatorReport;
  const isPass = finalDecision === 'PASS';
  const isReview = finalDecision === 'REVIEW';
  const isFail = finalDecision === 'FAIL';

  const dimensionConfigs = [
    {
      key: 'factual_grounding' as const,
      label: 'Factual Grounding / Accuracy',
      weight: weights.factual_grounding,
      data: metrics.factual_grounding,
    },
    {
      key: 'intent_understanding' as const,
      label: 'Intent Understanding',
      weight: weights.intent_understanding,
      data: metrics.intent_understanding,
    },
    {
      key: 'completeness' as const,
      label: 'Completeness',
      weight: weights.completeness,
      data: metrics.completeness,
    },
    {
      key: 'internal_consistency' as const,
      label: 'Internal Consistency',
      weight: weights.internal_consistency,
      data: metrics.internal_consistency,
    },
    {
      key: 'outreach_alignment' as const,
      label: 'Outreach Alignment',
      weight: weights.outreach_alignment,
      data: metrics.outreach_alignment,
    },
    {
      key: 'uncertainty_handling' as const,
      label: 'Uncertainty Handling',
      weight: weights.uncertainty_handling,
      data: metrics.uncertainty_handling,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-50 via-white to-indigo-50/20 px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                AI Quality Evaluation
              </h3>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.2 rounded font-semibold">
                Independent Audit
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Evaluated across 6 quality dimensions with deterministic scoring & hard safety guardrails.
            </p>
          </div>
        </div>

        {/* Overall Quality Badge & Score */}
        <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Overall Quality
            </div>
            <div className="font-mono text-xl font-bold text-slate-900">
              {weightedScore}%
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 ${
              isPass
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : isReview
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {isPass && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            {isReview && <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />}
            {isFail && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
            <span>{finalDecision}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-5 sm:p-6 space-y-6">
        {/* Hard Review Flags Alert (if any triggered) */}
        {hardFlagsTriggered && hardFlagsTriggered.length > 0 && (
          <div className="p-4 bg-amber-50/90 border border-amber-300/80 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>Hard Review Guardrail Triggered</span>
            </div>
            <p className="text-xs text-amber-800 font-medium">
              Even if weighted evaluation score is high, critical ambiguity or risk routes this lead to human review:
            </p>
            <ul className="space-y-1 pl-5 list-disc text-xs text-amber-900 font-medium pt-1">
              {hardFlagsTriggered.map((flag, idx) => (
                <li key={idx}>{flag}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 6 Dimensions Horizontal Score Bars */}
        <div className="space-y-3.5">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-slate-100">
            <span>Evaluation Dimensions</span>
            <span className="text-slate-400 font-normal">Score / 100 (Weight)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
            {dimensionConfigs.map((dim) => {
              const score = dim.data.score;
              const isHigh = score >= 90;
              const isMedium = score >= 75 && score < 90;
              const isLow = score < 75;

              return (
                <div key={dim.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{dim.label}</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-bold text-slate-900">{score} / 100</span>
                      <span className="text-slate-400">({dim.weight}%)</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${score}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isHigh
                          ? 'bg-emerald-500'
                          : isMedium
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues Detected Section */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Issues Detected
          </div>

          {allIssues && allIssues.length > 0 ? (
            <div className="space-y-2">
              {allIssues.map((issue, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">⚠ </span>
                    {issue}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/70 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">
                ✓ No material quality issues detected. All extracted points grounded in source evidence.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
