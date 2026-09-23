import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  Sparkles, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  Cpu, 
  ShieldCheck, 
  Scale, 
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  AgentConfigurationState, 
  AgentPromptConfig, 
  EvaluatorWeights, 
  EvaluationThresholds 
} from '../types/lead';
import { 
  DEFAULT_AGENT_CONFIGURATION, 
  DEFAULT_AGENT_PROMPTS, 
  DEFAULT_EVALUATOR_WEIGHTS, 
  DEFAULT_EVALUATION_THRESHOLDS 
} from '../data/defaultConfig';

interface AgentConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfigurationState;
  defaults?: AgentConfigurationState;
  onSaveConfig: (updatedConfig: AgentConfigurationState) => void;
}

export const AgentConfigurationModal: React.FC<AgentConfigurationModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  defaults = DEFAULT_AGENT_CONFIGURATION,
}) => {


  // Active top-level section: 'prompts' | 'evaluator'
  const [activeSection, setActiveSection] = useState<'prompts' | 'evaluator'>('prompts');

  // Prompts editing state
  const [selectedAgentKey, setSelectedAgentKey] = useState<'classification' | 'enrichment' | 'outreach' | 'evaluator'>('classification');
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({
    classification: config.prompts.classification.systemPrompt,
    enrichment: config.prompts.enrichment.systemPrompt,
    outreach: config.prompts.outreach.systemPrompt,
    evaluator: config.prompts.evaluator.systemPrompt,
  });

  // Weights editing state
  const [weightsDraft, setWeightsDraft] = useState<EvaluatorWeights>({ ...config.evaluatorWeights });
  const [thresholdsDraft, setThresholdsDraft] = useState<EvaluationThresholds>({ ...config.thresholds });

  useEffect(() => {
    if (!isOpen) return;
    setPromptDrafts(Object.fromEntries(Object.entries(config.prompts).map(([key, prompt]) => [key, prompt.systemPrompt])));
    setWeightsDraft({ ...config.evaluatorWeights });
    setThresholdsDraft({ ...config.thresholds });
  }, [isOpen, config]);

  // Subtle success notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Weight validation: must equal 100
  const currentTotalWeight = 
    Number(weightsDraft.factual_grounding || 0) +
    Number(weightsDraft.intent_understanding || 0) +
    Number(weightsDraft.completeness || 0) +
    Number(weightsDraft.internal_consistency || 0) +
    Number(weightsDraft.outreach_alignment || 0) +
    Number(weightsDraft.uncertainty_handling || 0);

  const isWeightValid = currentTotalWeight === 100;

  // Handlers for Prompts
  const handleSavePrompt = (key: 'classification' | 'enrichment' | 'outreach' | 'evaluator') => {
    const currentVersionNum = parseInt(config.prompts[key].version.replace('v', ''), 10) || 1;
    const nextVersion = `v${currentVersionNum + 1}`;

    const updatedPrompts = {
      ...config.prompts,
      [key]: {
        ...config.prompts[key],
        systemPrompt: promptDrafts[key],
        version: nextVersion,
      },
    };

    onSaveConfig({
      ...config,
      prompts: updatedPrompts,
    });

    showToast(`${config.prompts[key].name} configuration updated (${nextVersion}).`);
  };

  const handleResetPrompt = (key: 'classification' | 'enrichment' | 'outreach' | 'evaluator') => {
    const defaultText = defaults.prompts[key].systemPrompt;
    setPromptDrafts((prev) => ({ ...prev, [key]: defaultText }));
    
    const updatedPrompts = {
      ...config.prompts,
      [key]: {
        ...config.prompts[key],
        systemPrompt: defaultText,
        version: `v${(parseInt(config.prompts[key].version.replace('v', ''), 10) || 1) + 1}`,
      },
    };

    onSaveConfig({
      ...config,
      prompts: updatedPrompts,
    });

    showToast(`${config.prompts[key].name} reset to default.`);
  };

  // Handlers for Weights & Thresholds
  const handleSaveEvaluator = () => {
    if (!isWeightValid) return;

    onSaveConfig({
      ...config,
      evaluatorWeights: { ...weightsDraft },
      thresholds: { ...thresholdsDraft },
    });

    showToast('AI Quality Evaluation settings updated successfully.');
  };

  const handleResetEvaluator = () => {
    setWeightsDraft({ ...DEFAULT_EVALUATOR_WEIGHTS });
    setThresholdsDraft({ ...DEFAULT_EVALUATION_THRESHOLDS });

    onSaveConfig({
      ...config,
      evaluatorWeights: { ...DEFAULT_EVALUATOR_WEIGHTS },
      thresholds: { ...DEFAULT_EVALUATION_THRESHOLDS },
    });

    showToast('AI Quality Evaluation reset to default weights & thresholds.');
  };

  if (!isOpen) return null;

  const activeAgent = config.prompts[selectedAgentKey];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Agent Configuration</h2>
                <span className="text-[10px] font-mono uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold border border-indigo-200">
                  Control Plane
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Configure the instructions used by each AI component and control how AI-generated outputs are evaluated.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Navigation Tabs (Agent Prompts vs Evaluation Settings) */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-4">
          <button
            onClick={() => setActiveSection('prompts')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeSection === 'prompts'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Agent Prompts</span>
          </button>

          <button
            onClick={() => setActiveSection('evaluator')}
            className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeSection === 'evaluator'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Evaluation Settings</span>
          </button>

          {/* Toast Alert */}
          {toastMessage && (
            <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* SECTION 1: AGENT PROMPTS */}
          {activeSection === 'prompts' && (
            <div className="space-y-5">
              {/* Agent Subtabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {(['classification', 'enrichment', 'outreach', 'evaluator'] as const).map((key) => {
                  const item = config.prompts[key];
                  const isActive = selectedAgentKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedAgentKey(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{item.name.replace(' Agent', '')}</span>
                      <span className="font-mono text-[10px] opacity-75 bg-slate-200/80 px-1.5 py-0.2 rounded-full">
                        {item.version}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Agent Prompt Editor Card */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      {activeAgent.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeAgent.shortDesc}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="text-xs text-slate-500 font-medium">Prompt Version:</span>
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {activeAgent.version}
                    </span>
                  </div>
                </div>

                {/* System Prompt Textarea */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    System Prompt
                  </label>
                  <textarea
                    rows={12}
                    value={promptDrafts[selectedAgentKey]}
                    onChange={(e) =>
                      setPromptDrafts({
                        ...promptDrafts,
                        [selectedAgentKey]: e.target.value,
                      })
                    }
                    className="w-full p-3.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-inner"
                    placeholder="Enter system prompt instructions..."
                  />
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    Changes take effect immediately on next run and are stored in session state.
                  </p>
                </div>

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => handleResetPrompt(selectedAgentKey)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset Default</span>
                  </button>

                  <button
                    onClick={() => handleSavePrompt(selectedAgentKey)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs shadow-indigo-200 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: EVALUATION SETTINGS */}
          {activeSection === 'evaluator' && (
            <div className="space-y-6">
              {/* Evaluator Title & Description */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  AI Quality Evaluation
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Control how generated lead intelligence is evaluated before it is considered sales-ready. 
                  AI returns individual dimension scores, and the application computes the deterministic weighted average.
                </p>
              </div>

              {/* Evaluation Weights Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Evaluation Dimensions & Weights
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">TOTAL:</span>
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                        isWeightValid
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {currentTotalWeight}%
                    </span>
                  </div>
                </div>

                {/* Weights Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Factual Grounding */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Factual Grounding / Accuracy</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.factual_grounding}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={weightsDraft.factual_grounding}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, factual_grounding: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Verifies all claims directly against source notes; flags hallucinations.</p>
                  </div>

                  {/* Intent Understanding */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Intent Understanding</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.intent_understanding}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={weightsDraft.intent_understanding}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, intent_understanding: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Accurately captures Germany relocation motivation and urgency.</p>
                  </div>

                  {/* Completeness */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Completeness</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.completeness}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={5}
                      value={weightsDraft.completeness}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, completeness: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Ensures no stated timeline, specialty, or qualification detail is missed.</p>
                  </div>

                  {/* Internal Consistency */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Internal Consistency</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.internal_consistency}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={5}
                      value={weightsDraft.internal_consistency}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, internal_consistency: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Checks coherence across classification, enrichment profile, and scoring.</p>
                  </div>

                  {/* Outreach Alignment */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Outreach Alignment</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.outreach_alignment}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={weightsDraft.outreach_alignment}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, outreach_alignment: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Guarantees outreach message respects verified facts without false promises.</p>
                  </div>

                  {/* Uncertainty Handling */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">Uncertainty Handling</span>
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {weightsDraft.uncertainty_handling}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={5}
                      value={weightsDraft.uncertainty_handling}
                      onChange={(e) =>
                        setWeightsDraft({ ...weightsDraft, uncertainty_handling: Number(e.target.value) })
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Penalizes making up missing data (e.g. blank German level); rewards flagging for review.</p>
                  </div>
                </div>

                {/* Weight Validation Message */}
                {!isWeightValid && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      ⚠ Evaluation weights must total exactly 100%. Current Total: {currentTotalWeight}%
                    </span>
                  </div>
                )}
              </div>

              {/* Decision Thresholds */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Decision Thresholds
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">PASS Threshold</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        &ge; {thresholdsDraft.passThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={95}
                      step={1}
                      value={thresholdsDraft.passThreshold}
                      onChange={(e) =>
                        setThresholdsDraft({ ...thresholdsDraft, passThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Scores {thresholdsDraft.passThreshold}–100 receive PASS and are deemed sales-ready.</p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800">REVIEW Threshold</span>
                      <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                        &ge; {thresholdsDraft.reviewThreshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={85}
                      step={1}
                      value={thresholdsDraft.reviewThreshold}
                      onChange={(e) =>
                        setThresholdsDraft({ ...thresholdsDraft, reviewThreshold: Number(e.target.value) })
                      }
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">Scores {thresholdsDraft.reviewThreshold}–{thresholdsDraft.passThreshold - 1} route to Review Queue. Below {thresholdsDraft.reviewThreshold} routes to FAIL.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleResetEvaluator}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Default</span>
                </button>

                <button
                  onClick={handleSaveEvaluator}
                  disabled={!isWeightValid}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-2xs ${
                    isWeightValid
                      ? 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 cursor-pointer'
                      : 'text-slate-400 bg-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
