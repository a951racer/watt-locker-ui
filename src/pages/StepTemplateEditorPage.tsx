/**
 * PLAN-057: Step Template editor (create + edit).
 *
 * A Step Template = a required template name + ONE canonical Activity Step.
 * The step is edited with the SAME reusable StepEditor used by the planner
 * (PLAN-056) — there is no template-specific step editor. The step is
 * normalized (exactly one of time/distance) before saving.
 *
 * This page does NOT insert anything into an activity (materialization is a
 * later PLAN task) and adds no template reference to any activity.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StepEditor from '../components/StepEditor';
import { getSettings } from '../api/settings';
import {
  createStepTemplate,
  getStepTemplate,
  updateStepTemplate,
} from '../api/stepTemplates';
import {
  createEmptySegment,
  normalizeSegmentDuration,
  resolvePlanningFtp,
  type PlanSegment,
  type IntensityMetric,
  type FtpHistoryEntry,
} from '../utils/tssCalculator';

const noop = () => {};

export default function StepTemplateEditorPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isEditMode = !!params.id;

  const [name, setName] = useState('');
  const [step, setStep] = useState<PlanSegment>(() => createEmptySegment('interval'));
  const [ftpHistory, setFtpHistory] = useState<FtpHistoryEntry[] | undefined>(undefined);
  const [activityMetric] = useState<IntensityMetric>('power_ftp');

  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve FTP for the StepEditor's %FTP → watts preview.
  const resolvedFtp = useMemo(() => resolvePlanningFtp(undefined, ftpHistory), [ftpHistory]);

  // FTP history (for preview only; targets are stored relative, never baked).
  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (settings.ftpHistory && settings.ftpHistory.length > 0) {
          setFtpHistory(settings.ftpHistory);
        }
      })
      .catch(() => {});
  }, []);

  // Load existing template in edit mode.
  useEffect(() => {
    if (!isEditMode || !params.id) return;
    let cancelled = false;
    setIsLoading(true);
    getStepTemplate(params.id)
      .then((tpl) => {
        if (cancelled) return;
        setName(tpl.name);
        setStep(tpl.step);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load step template');
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isEditMode, params.id]);

  const updateStep = useCallback((updates: Partial<PlanSegment>) => {
    setStep((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      // Normalize the canonical step (exactly one of time/distance) before save.
      const normalizedStep = normalizeSegmentDuration(step);
      const payload = { name: name.trim(), step: normalizedStep };
      if (isEditMode && params.id) {
        await updateStepTemplate(params.id, payload);
      } else {
        await createStepTemplate(payload);
      }
      navigate('/templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save step template');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg" data-testid="loading-indicator">Loading step template...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4" data-testid="step-template-editor-page">
      <h1 className="text-2xl font-bold text-pureWhite mb-6" data-testid="page-title">
        {isEditMode ? 'Edit Step Template' : 'New Step Template'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Template identity (distinct from the step's optional canonical name) */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-3">
          <div>
            <label className="block text-sm text-softFog mb-1">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
              placeholder="e.g. Sweet Spot 10"
              required
              maxLength={120}
              data-testid="template-name-input"
            />
          </div>
        </section>

        {/* Canonical step — edited with the shared StepEditor */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-3" data-testid="step-template-step-section">
          <h2 className="text-lg font-semibold text-pureWhite">Step</h2>
          <StepEditor
            segment={step}
            index={0}
            displayNumber={1}
            totalCount={1}
            expanded={true}
            resolvedFtp={resolvedFtp}
            activityMetric={activityMetric}
            onToggle={noop}
            onUpdate={updateStep}
            onRemove={noop}
            onDuplicate={noop}
            onMoveUp={noop}
            onMoveDown={noop}
          />
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
            disabled={isSubmitting || !name.trim()}
            className="px-5 py-2.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Step Template' : 'Create Step Template')}
          </button>
        </div>
      </form>
    </div>
  );
}
