/**
 * PLAN-058: Block Template editor (create + edit).
 *
 * A Block Template = a required name + a default repeat count + an ORDERED,
 * FLAT list of canonical Activity Steps (no nested blocks). Steps are edited
 * with the SAME reusable StepEditor (PLAN-056) — no template-specific step
 * editor. Steps may be added blank or COPIED from an existing Step Template
 * (authoring convenience only: the copy is by value, no persistent reference).
 *
 * This page does NOT insert anything into an activity (materialization is a
 * later PLAN task).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StepEditor from '../components/StepEditor';
import { getSettings } from '../api/settings';
import {
  createBlockTemplate,
  getBlockTemplate,
  updateBlockTemplate,
} from '../api/blockTemplates';
import { listStepTemplates, type StepTemplate } from '../api/stepTemplates';
import {
  createEmptySegment,
  normalizeSegmentDuration,
  resolvePlanningFtp,
  type PlanSegment,
  type IntensityMetric,
  type FtpHistoryEntry,
} from '../utils/tssCalculator';

export default function BlockTemplateEditorPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isEditMode = !!params.id;

  const [name, setName] = useState('');
  const [repeatCount, setRepeatCount] = useState('3');
  const [steps, setSteps] = useState<PlanSegment[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [ftpHistory, setFtpHistory] = useState<FtpHistoryEntry[] | undefined>(undefined);
  const [activityMetric] = useState<IntensityMetric>('power_ftp');

  // Add-step menu / Step Template picker state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showStepTemplatePicker, setShowStepTemplatePicker] = useState(false);
  const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
  const [stepTemplatesLoaded, setStepTemplatesLoaded] = useState(false);

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedFtp = useMemo(() => resolvePlanningFtp(undefined, ftpHistory), [ftpHistory]);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (settings.ftpHistory && settings.ftpHistory.length > 0) setFtpHistory(settings.ftpHistory);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode || !params.id) return;
    let cancelled = false;
    setIsLoading(true);
    getBlockTemplate(params.id)
      .then((tpl) => {
        if (cancelled) return;
        setName(tpl.name);
        setRepeatCount(String(tpl.repeatCount));
        setSteps(tpl.steps);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load block template');
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEditMode, params.id]);

  // --- Step management (flat, ordered; NO nesting) ---
  const addBlankStep = useCallback(() => {
    setSteps((prev) => [...prev, createEmptySegment('interval')]);
    setShowAddMenu(false);
    setShowStepTemplatePicker(false);
  }, []);

  const openStepTemplatePicker = useCallback(async () => {
    setShowStepTemplatePicker(true);
    setShowAddMenu(false);
    if (!stepTemplatesLoaded) {
      try {
        const items = await listStepTemplates();
        setStepTemplates(items);
      } catch {
        setStepTemplates([]);
      } finally {
        setStepTemplatesLoaded(true);
      }
    }
  }, [stepTemplatesLoaded]);

  const addStepFromTemplate = useCallback((tpl: StepTemplate) => {
    // COPY the canonical step by value (deep copy) — no persistent reference,
    // no stepTemplateId. The block owns an independent step from here on.
    const copied: PlanSegment = JSON.parse(JSON.stringify(tpl.step));
    setSteps((prev) => {
      const next = [...prev, copied];
      // Expand the newly added step so the user can edit it immediately.
      setExpandedStep(next.length - 1);
      return next;
    });
    setShowStepTemplatePicker(false);
    setShowAddMenu(false);
  }, []);

  const updateStep = useCallback((index: number, updates: Partial<PlanSegment>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setExpandedStep(null);
  }, []);

  const duplicateStep = useCallback((index: number) => {
    setSteps((prev) => {
      const copy: PlanSegment = JSON.parse(JSON.stringify(prev[index]));
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  }, []);

  const moveStepUp = useCallback((index: number) => {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setExpandedStep((prev) => (prev === index ? index - 1 : prev));
  }, []);

  const moveStepDown = useCallback((index: number) => {
    setSteps((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setExpandedStep((prev) => (prev === index ? index + 1 : prev));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) { setError('Template name is required'); return; }
    if (steps.length === 0) { setError('A block template must contain at least one step'); return; }
    const rc = parseInt(repeatCount, 10);
    if (!Number.isInteger(rc) || rc < 1) { setError('Repeat count must be a positive integer'); return; }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        repeatCount: rc,
        steps: steps.map(normalizeSegmentDuration),
      };
      if (isEditMode && params.id) {
        await updateBlockTemplate(params.id, payload);
      } else {
        await createBlockTemplate(payload);
      }
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save block template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg" data-testid="loading-indicator">Loading block template...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4" data-testid="block-template-editor-page">
      <h1 className="text-2xl font-bold text-pureWhite mb-6" data-testid="page-title">
        {isEditMode ? 'Edit Block Template' : 'New Block Template'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Template identity + repeat count */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm text-softFog mb-1">Block Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                placeholder="e.g. 3x Sweet Spot"
                required
                maxLength={120}
                data-testid="template-name-input"
              />
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Repeat Count</label>
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                value={repeatCount}
                onChange={(e) => setRepeatCount(e.target.value)}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                data-testid="repeat-count-input"
              />
            </div>
          </div>
        </section>

        {/* Steps — reused StepEditor, flat ordered list */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-3" data-testid="block-steps-section">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-pureWhite">Steps</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowAddMenu((v) => !v); setShowStepTemplatePicker(false); }}
                className="px-3 py-1.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm"
                data-testid="add-step-btn"
              >
                + Add Step
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 bg-deepNavy border border-steelBlue rounded-lg shadow-lg z-10 py-1 min-w-[180px]">
                  <button
                    type="button"
                    onClick={addBlankStep}
                    className="w-full text-left px-3 py-2 text-sm text-lightSilver hover:bg-steelBlue/50"
                    data-testid="add-blank-step"
                  >
                    Blank Step
                  </button>
                  <button
                    type="button"
                    onClick={openStepTemplatePicker}
                    className="w-full text-left px-3 py-2 text-sm text-lightSilver hover:bg-steelBlue/50"
                    data-testid="add-from-step-template"
                  >
                    From Step Template…
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step Template picker */}
          {showStepTemplatePicker && (
            <div className="bg-deepNavy border border-steelBlue rounded-lg p-3" data-testid="step-template-picker">
              {!stepTemplatesLoaded && <p className="text-sm text-softFog">Loading step templates…</p>}
              {stepTemplatesLoaded && stepTemplates.length === 0 && (
                <p className="text-sm text-softFog" data-testid="step-template-picker-empty">No step templates yet.</p>
              )}
              {stepTemplatesLoaded && stepTemplates.length > 0 && (
                <ul className="space-y-1">
                  {stepTemplates.map((tpl) => (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        onClick={() => addStepFromTemplate(tpl)}
                        className="w-full text-left px-3 py-2 text-sm text-lightSilver hover:bg-steelBlue/50 rounded"
                        data-testid={`step-template-option-${tpl.id}`}
                      >
                        {tpl.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {steps.length === 0 && (
            <div className="text-center py-8 text-softFog" data-testid="no-steps">
              <p className="text-sm">No steps yet. Add steps to build your block.</p>
            </div>
          )}

          <div className="space-y-2">
            {steps.map((segment, index) => (
              <StepEditor
                key={index}
                segment={segment}
                index={index}
                displayNumber={index + 1}
                totalCount={steps.length}
                expanded={expandedStep === index}
                resolvedFtp={resolvedFtp}
                activityMetric={activityMetric}
                onToggle={() => setExpandedStep(expandedStep === index ? null : index)}
                onUpdate={(updates) => updateStep(index, updates)}
                onRemove={() => removeStep(index)}
                onDuplicate={() => duplicateStep(index)}
                onMoveUp={() => moveStepUp(index)}
                onMoveDown={() => moveStepDown(index)}
              />
            ))}
          </div>
        </section>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 rounded p-3" data-testid="submit-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/templates')}
            className="px-5 py-2.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors"
            data-testid="cancel-btn"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || steps.length === 0}
            className="px-5 py-2.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Block Template' : 'Create Block Template')}
          </button>
        </div>
      </form>
    </div>
  );
}
