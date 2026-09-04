import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { createActivity, getWorkout, updateWorkout, createTemplate } from '../api/workouts';
import { getSettings } from '../api/settings';
import type { CreateActivityParams } from '../api/workouts';
import {
  resolvePlanningFtp,
  calculateTotalTss,
  calculateIF,
  calculateTotalDuration,
  tssFromIF,
  ifFromTSS,
  formatHMS,
  parseHMS,
  formatDurationPreview,
  createEmptySegment,
  generateRepeatId,
  normalizeSegmentDuration,
  reorderTopLevelUnit,
  reorderStepWithinBlock,
  type PlanSegment,
  type IntensityMetric,
  type FtpHistoryEntry,
} from '../utils/tssCalculator';
import RepeatBlockEditor from '../components/RepeatBlockEditor';
import TemplateTray from '../components/TemplateTray';
import { materializeStepTemplate, materializeBlockTemplate } from '../utils/templateMaterialization';
import type { StepTemplate } from '../api/stepTemplates';
import type { BlockTemplate } from '../api/blockTemplates';

// --- Constants ---

const ACTIVITY_TYPES = [
  { value: 'ride', label: 'Ride' },
  { value: 'virtual_ride', label: 'Virtual Ride' },
  { value: 'mountain_ride', label: 'Mountain Ride' },
  { value: 'gravel_ride', label: 'Gravel Ride' },
  { value: 'run', label: 'Run' },
  { value: 'swim', label: 'Swim' },
  { value: 'walk', label: 'Walk' },
  { value: 'strength', label: 'Strength' },
  { value: 'other', label: 'Other' },
];

// --- Main Component ---

export default function PlanActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const isEditMode = !!params.id;

  // Detect template mode from route path
  const isTemplateMode = location.pathname.startsWith('/templates');
  const isTemplateEdit = isTemplateMode && isEditMode;
  const templateReturnTo = (location.state as any)?.returnTo as string | undefined;
  const templateDestination = isTemplateMode ? (templateReturnTo || '/templates') : '/calendar';

  // Form state
  const [activityType, setActivityType] = useState('ride');
  const [date, setDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [durationText, setDurationText] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [targetSpeed, setTargetSpeed] = useState('');

  // Track which field was last edited for auto-calculation
  const [lastEditedField, setLastEditedField] = useState<'distance' | 'speed' | null>(null);

  // TSS/IF
  const [plannedTss, setPlannedTss] = useState('');
  const [plannedIf, setPlannedIf] = useState('');
  const [tssManuallySet, setTssManuallySet] = useState(false);
  const [ifManuallySet, setIfManuallySet] = useState(false);

  // Tags, Equipment, Event
  const [tags, setTags] = useState('');
  const [equipment, setEquipment] = useState('');
  const [eventId, setEventId] = useState('');

  // Segments (flat array — preserves existing data model for API compat)
  const [segments, setSegments] = useState<PlanSegment[]>([]);

  // Repeat selection
  const [repeatStart, setRepeatStart] = useState('');
  const [repeatEnd, setRepeatEnd] = useState('');
  const [repeatCount, setRepeatCount] = useState('2');

  // FTP state
  const [ftpHistory, setFtpHistory] = useState<FtpHistoryEntry[] | undefined>(undefined);
  const [activityFtpOverride, setActivityFtpOverride] = useState<number | undefined>(undefined);

  // Activity-level intensity metric
  const [intensityMetric, setIntensityMetric] = useState<IntensityMetric>('power_ftp');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(isEditMode);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Derived: total segment duration
  const segmentTotalDuration = useMemo(() => {
    if (segments.length === 0) return 0;
    return calculateTotalDuration(segments);
  }, [segments]);

  // Compute effective duration seconds (from steps if present, from input otherwise)
  const effectiveDurationSeconds = useMemo(() => {
    if (segments.length > 0) return segmentTotalDuration;
    const parsed = parseHMS(durationText);
    return parsed !== null ? parsed : 0;
  }, [segments.length, segmentTotalDuration, durationText]);

  // Auto-calculate distance/speed
  useEffect(() => {
    if (effectiveDurationSeconds <= 0) return;
    const durationHours = effectiveDurationSeconds / 3600;

    if (lastEditedField === 'speed' && targetSpeed.trim()) {
      const speed = parseFloat(targetSpeed);
      if (!isNaN(speed) && speed > 0) {
        const calculatedDistance = (speed * durationHours).toFixed(1);
        setDistanceMiles(calculatedDistance);
      }
    } else if (lastEditedField === 'distance' && distanceMiles.trim()) {
      const dist = parseFloat(distanceMiles);
      if (!isNaN(dist) && dist > 0 && durationHours > 0) {
        const calculatedSpeed = (dist / durationHours).toFixed(1);
        setTargetSpeed(calculatedSpeed);
      }
    }
  }, [effectiveDurationSeconds, distanceMiles, targetSpeed, lastEditedField]);

  // Populate from template if passed via location.state
  useEffect(() => {
    if (isEditMode) return;
    const templateData = (location.state as any)?.template;
    if (!templateData) return;

    if (templateData.activityType) setActivityType(templateData.activityType);
    if (templateData.title) setTitle(templateData.title);
    if (templateData.description) setDescription(templateData.description);
    if (templateData.plannedDurationSeconds) {
      setDurationText(formatHMS(templateData.plannedDurationSeconds));
    }
    if (templateData.plannedDistanceMeters) {
      setDistanceMiles((templateData.plannedDistanceMeters / 1609.344).toFixed(1));
    }
    if (templateData.targetSpeed) setTargetSpeed(String(templateData.targetSpeed));
    if (templateData.plannedTss) {
      setPlannedTss(String(templateData.plannedTss));
      setTssManuallySet(true);
    }
    if (templateData.plannedIf) {
      setPlannedIf(String(templateData.plannedIf));
      setIfManuallySet(true);
    }
    if (templateData.tags && Array.isArray(templateData.tags) && templateData.tags.length > 0) {
      setTags(templateData.tags.join(', '));
    }
    if (templateData.segments && Array.isArray(templateData.segments)) {
      setSegments(JSON.parse(JSON.stringify(templateData.segments)));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch user settings for FTP history on mount
  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (settings.ftpHistory && settings.ftpHistory.length > 0) {
          setFtpHistory(settings.ftpHistory);
        }
      })
      .catch(() => {});
  }, []);

  // Load activity for edit mode
  useEffect(() => {
    if (!isEditMode || !params.id) return;
    let cancelled = false;
    setIsLoadingEdit(true);
    getWorkout(params.id)
      .then((workout) => {
        if (cancelled) return;
        const w = workout as any;
        setActivityType(w.activityType || 'ride');
        if (w.date) setDate(w.date);
        if (w.title) setTitle(w.title);
        if (w.description) setDescription(w.description);
        if (w.comment) setComment(w.comment);
        if (w.plannedDurationSeconds) {
          setDurationText(formatHMS(w.plannedDurationSeconds));
        }
        if (w.plannedDistanceMeters) {
          setDistanceMiles((w.plannedDistanceMeters / 1609.344).toFixed(1));
        }
        if (w.targetSpeed) setTargetSpeed(String(w.targetSpeed));
        if (w.plannedTss) {
          setPlannedTss(String(w.plannedTss));
          if (w.plannedTssOverride) setTssManuallySet(true);
        }
        if (w.plannedIf) {
          setPlannedIf(String(w.plannedIf));
          if (w.plannedIfOverride) setIfManuallySet(true);
        }
        if (w.referenceMetric && w.referenceMetric.type === 'ftp') {
          setActivityFtpOverride(w.referenceMetric.value);
        }
        if (w.referenceMetric && w.referenceMetric.type) {
          const metricType = w.referenceMetric.type;
          if (metricType === 'power_ftp' || metricType === 'hr_threshold' || metricType === 'hr_max' || metricType === 'power_watts') {
            setIntensityMetric(metricType);
          } else if (metricType === 'ftp') {
            setIntensityMetric('power_ftp');
          }
        }
        if (w.tags && w.tags.length > 0) setTags(w.tags.join(', '));
        if (w.equipment) setEquipment(JSON.stringify(w.equipment));
        if (w.eventId) setEventId(w.eventId);
        if (w.segments && Array.isArray(w.segments)) {
          setSegments(w.segments);
        }
        setIsLoadingEdit(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setSubmitError(err instanceof Error ? err.message : 'Failed to load activity');
          setIsLoadingEdit(false);
        }
      });
    return () => { cancelled = true; };
  }, [isEditMode, params.id]);

  // Segment management — all segment changes clear TSS/IF overrides
  const clearOverrides = useCallback(() => {
    setTssManuallySet(false);
    setIfManuallySet(false);
    setPlannedTss('');
    setPlannedIf('');
  }, []);

  const addSegment = useCallback((type: PlanSegment['type'] = 'interval') => {
    setSegments((prev) => [...prev, createEmptySegment(type)]);
    setShowAddMenu(false);
    clearOverrides();
  }, [clearOverrides]);

  const removeSegment = useCallback((index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
    setExpandedStep(null);
    clearOverrides();
  }, [clearOverrides]);

  const duplicateSegment = useCallback((index: number) => {
    setSegments((prev) => {
      const copy = { ...prev[index] };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    clearOverrides();
  }, [clearOverrides]);

  const updateSegment = useCallback((index: number, updates: Partial<PlanSegment>) => {
    setSegments((prev) => prev.map((seg, i) => (i === index ? { ...seg, ...updates } : seg)));
    clearOverrides();
  }, [clearOverrides]);

  // PLAN-061: Apply a reordering transform and keep `expandedStep` pointing at
  // the SAME segment after the flat indices shift. The reorder helpers preserve
  // segment object references, so we relocate the expanded step by identity.
  const applyReorder = useCallback(
    (compute: (prev: PlanSegment[]) => PlanSegment[]) => {
      setSegments((prev) => {
        const next = compute(prev);
        if (next === prev) return prev; // no-op (boundary) — leave expansion as-is
        setExpandedStep((cur) => {
          if (cur === null) return cur;
          const movedRef = prev[cur];
          const newIdx = next.indexOf(movedRef);
          return newIdx === -1 ? cur : newIdx;
        });
        return next;
      });
      clearOverrides();
    },
    [clearOverrides],
  );

  // PLAN-061: A single step's up/down control.
  // - If the step belongs to a repeat block, it reorders WITHIN that block
  //   (clamped to the block's bounds — it can never escape the block here).
  // - Otherwise it is a standalone top-level unit and reorders around whole
  //   adjacent units (moving atomically past entire blocks).
  const moveSegmentUp = useCallback((index: number) => {
    applyReorder((prev) =>
      prev[index]?.repeatId
        ? reorderStepWithinBlock(prev, index, 'up')
        : reorderTopLevelUnit(prev, index, 'up'),
    );
  }, [applyReorder]);

  const moveSegmentDown = useCallback((index: number) => {
    applyReorder((prev) =>
      prev[index]?.repeatId
        ? reorderStepWithinBlock(prev, index, 'down')
        : reorderTopLevelUnit(prev, index, 'down'),
    );
  }, [applyReorder]);

  // PLAN-061: Move an ENTIRE repeat block (identified by any member index) up
  // or down as one top-level unit, atomically.
  const moveBlockUp = useCallback((anyMemberIndex: number) => {
    applyReorder((prev) => reorderTopLevelUnit(prev, anyMemberIndex, 'up'));
  }, [applyReorder]);

  const moveBlockDown = useCallback((anyMemberIndex: number) => {
    applyReorder((prev) => reorderTopLevelUnit(prev, anyMemberIndex, 'down'));
  }, [applyReorder]);

  // PLAN-046: Group a contiguous range of segments into a repeat block.
  // The selectors are 1-based (human-facing); convert to zero-based internally.
  // Segments stay in the array ONCE — we tag them with a shared repeatId +
  // repeatCount rather than duplicating them.
  const handleRepeat = useCallback(() => {
    const startHuman = parseInt(repeatStart, 10);
    const endHuman = parseInt(repeatEnd, 10);
    const count = parseInt(repeatCount, 10);
    if (isNaN(startHuman) || isNaN(endHuman) || isNaN(count) || count < 1) return;
    // Convert 1-based selector values to zero-based indices.
    const start = startHuman - 1;
    const end = endHuman - 1;
    if (start < 0 || end < start || end >= segments.length) return;

    const newRepeatId = generateRepeatId();
    setSegments((prev) =>
      prev.map((seg, i) => {
        if (i >= start && i <= end) {
          return { ...seg, repeatId: newRepeatId, repeatCount: count };
        }
        return seg;
      }),
    );
    setRepeatStart('');
    setRepeatEnd('');
    setRepeatCount('2');
    clearOverrides();
  }, [repeatStart, repeatEnd, repeatCount, segments, clearOverrides]);

  // PLAN-046: Update the repeat count for a block (identified by repeatId) in
  // place, on every child segment. Does NOT duplicate child cards.
  const updateRepeatCount = useCallback((repeatId: string, count: number) => {
    const safeCount = Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
    setSegments((prev) =>
      prev.map((seg) => (seg.repeatId === repeatId ? { ...seg, repeatCount: safeCount } : seg)),
    );
    clearOverrides();
  }, [clearOverrides]);

  // PLAN-046: Add a child step to an existing repeat block — insert a segment
  // carrying the block's repeatId/count immediately after the block's last child.
  const addSegmentToBlock = useCallback((repeatId: string, count: number, type: PlanSegment['type'] = 'interval') => {
    setSegments((prev) => {
      // Find the last index belonging to this block.
      let lastIdx = -1;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].repeatId === repeatId) lastIdx = i;
      }
      if (lastIdx === -1) return prev;
      const newSeg: PlanSegment = { ...createEmptySegment(type), repeatId, repeatCount: count };
      const next = [...prev];
      next.splice(lastIdx + 1, 0, newSeg);
      return next;
    });
    clearOverrides();
  }, [clearOverrides]);

  // PLAN-059: Insert a Step Template as ONE standalone canonical step.
  // Materialization deep-copies by value and strips any repeat metadata, so the
  // inserted step is independent of the template and never becomes a block.
  // Safe top-level append (no merge with an existing repeat block).
  const insertStepTemplate = useCallback((template: StepTemplate) => {
    const step = materializeStepTemplate(template);
    setSegments((prev) => {
      const next = [...prev, step];
      setExpandedStep(next.length - 1);
      return next;
    });
    clearOverrides();
  }, [clearOverrides]);

  // PLAN-059: Insert a Block Template as ONE repeat block. Materialization
  // deep-copies steps, assigns a single fresh shared repeatId, and copies the
  // template's default repeatCount onto each step. Appended at top level so it
  // cannot inherit or merge with another block's repeatId.
  const insertBlockTemplate = useCallback((template: BlockTemplate) => {
    const blockSegments = materializeBlockTemplate(template);
    if (blockSegments.length === 0) return;
    setSegments((prev) => [...prev, ...blockSegments]);
    clearOverrides();
  }, [clearOverrides]);

  // Resolve FTP
  const resolvedFtp = useMemo(() => {
    return resolvePlanningFtp(activityFtpOverride, ftpHistory);
  }, [activityFtpOverride, ftpHistory]);

  // Preview calculations
  const segmentPreview = useMemo(() => {
    if (segments.length === 0) return null;
    const totalDuration = calculateTotalDuration(segments);
    const manualTssVal = tssManuallySet && plannedTss.trim() ? parseFloat(plannedTss) : null;
    const manualIfVal = ifManuallySet && plannedIf.trim() ? parseFloat(plannedIf) : null;

    let tss: number | null;
    let ifValue: number | null;

    if (manualIfVal !== null && !isNaN(manualIfVal)) {
      // IF override → derive TSS from IF
      ifValue = manualIfVal;
      tss = totalDuration > 0 ? tssFromIF(manualIfVal, totalDuration) : null;
    } else if (manualTssVal !== null && !isNaN(manualTssVal)) {
      // TSS override → derive IF from TSS
      tss = manualTssVal;
      ifValue = totalDuration > 0 ? ifFromTSS(manualTssVal, totalDuration) : null;
    } else {
      // Calculate both from segments
      tss = calculateTotalTss(segments, resolvedFtp, intensityMetric);
      ifValue = calculateIF(segments, resolvedFtp, intensityMetric);
    }

    return { totalDuration, tss, if: ifValue, ftpAvailable: resolvedFtp !== null };
  }, [segments, resolvedFtp, intensityMetric, tssManuallySet, ifManuallySet, plannedTss, plannedIf]);

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!activityType) return;
    if (!isTemplateMode && !date) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = { activityType };
      if (!isTemplateMode) payload.date = date;

      if (title.trim()) payload.title = title.trim();
      if (description.trim()) payload.description = description.trim();
      if (!isTemplateMode && comment.trim()) payload.comment = comment.trim();

      // Duration: from segments if present, otherwise from input
      const durationSec = segments.length > 0 ? segmentTotalDuration : (parseHMS(durationText) || 0);
      if (durationSec > 0) payload.plannedDurationSeconds = durationSec;

      if (distanceMiles.trim()) {
        const miles = parseFloat(distanceMiles);
        if (!isNaN(miles) && miles > 0) payload.plannedDistanceMeters = Math.round(miles * 1609.344);
      }

      if (targetSpeed.trim()) { const v = parseFloat(targetSpeed); if (!isNaN(v)) payload.targetSpeed = v; }

      if (tags.trim()) payload.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (!isTemplateMode && eventId.trim()) payload.eventId = eventId.trim();

      // PLAN-056: normalize each step's duration invariant (exactly one of
      // time/distance) at the domain boundary before persisting.
      if (segments.length > 0) payload.segments = segments.map(normalizeSegmentDuration);

      // Use effective TSS/IF values (accounts for overrides and calculations)
      if (segments.length > 0 && segmentPreview) {
        const segDuration = calculateTotalDuration(segments);
        if (durationSec === 0 && segDuration > 0) {
          payload.plannedDurationSeconds = segDuration;
        }
        if (segmentPreview.tss !== null && segmentPreview.tss > 0) {
          payload.plannedTss = Math.round(segmentPreview.tss);
        }
        if (segmentPreview.if !== null && segmentPreview.if > 0) {
          payload.plannedIf = Math.round(segmentPreview.if * 100) / 100;
        }
        if (!isTemplateMode) {
          // Persist override provenance (always send the current state, including false)
          payload.plannedTssOverride = tssManuallySet;
          payload.plannedIfOverride = ifManuallySet;
        }
      } else {
        // No segments — use the form field values directly
        if (plannedTss.trim()) { const v = parseFloat(plannedTss); if (!isNaN(v)) payload.plannedTss = v; }
        if (plannedIf.trim()) { const v = parseFloat(plannedIf); if (!isNaN(v)) payload.plannedIf = v; }
        if (!isTemplateMode) {
          payload.plannedTssOverride = false;
          payload.plannedIfOverride = false;
        }
      }

      // Persist intensity metric choice in referenceMetric
      if (intensityMetric !== 'power_ftp' || resolvedFtp) {
        payload.referenceMetric = { type: intensityMetric, value: resolvedFtp || 0 };
      }

      if (isTemplateMode) {
        if (isTemplateEdit && params.id) {
          await updateWorkout(params.id, payload as any);
        } else {
          await createTemplate(payload as any);
        }
        navigate(templateDestination);
      } else {
        if (isEditMode && params.id) {
          await updateWorkout(params.id, payload as any);
        } else {
          await createActivity(payload as unknown as CreateActivityParams);
        }
        navigate('/calendar');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save as Template handler — uses current form state to create a new template
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveSuccess, setTemplateSaveSuccess] = useState(false);

  const handleSaveAsTemplate = async () => {
    if (isSavingTemplate || segments.length === 0) return;
    setIsSavingTemplate(true);
    try {
      const templatePayload: Record<string, unknown> = { activityType };
      if (title.trim()) templatePayload.title = title.trim();
      if (description.trim()) templatePayload.description = description.trim();

      const durationSec = segments.length > 0 ? segmentTotalDuration : (parseHMS(durationText) || 0);
      if (durationSec > 0) templatePayload.plannedDurationSeconds = durationSec;

      if (distanceMiles.trim()) {
        const miles = parseFloat(distanceMiles);
        if (!isNaN(miles) && miles > 0) templatePayload.plannedDistanceMeters = Math.round(miles * 1609.344);
      }
      if (targetSpeed.trim()) { const v = parseFloat(targetSpeed); if (!isNaN(v)) templatePayload.targetSpeed = v; }
      if (tags.trim()) templatePayload.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);

      templatePayload.segments = segments.map(normalizeSegmentDuration);

      if (segmentPreview) {
        if (segmentPreview.tss !== null && segmentPreview.tss > 0) templatePayload.plannedTss = Math.round(segmentPreview.tss);
        if (segmentPreview.if !== null && segmentPreview.if > 0) templatePayload.plannedIf = Math.round(segmentPreview.if * 100) / 100;
      }

      if (intensityMetric !== 'power_ftp' || resolvedFtp) {
        templatePayload.referenceMetric = { type: intensityMetric, value: resolvedFtp || 0 };
      }

      await createTemplate(templatePayload as any);
      setTemplateSaveSuccess(true);
      setTimeout(() => setTemplateSaveSuccess(false), 3000);
    } catch {
      setSubmitError('Failed to save as template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  if (isLoadingEdit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg" data-testid="loading-indicator">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 flex gap-4 items-start" data-testid="plan-activity-workspace">
      {/* PLAN-059: Step/Block Template tray (quick insertion). Shown when
          planning/editing an Activity; not shown when editing a whole-Activity
          template, which is authored differently. */}
      {!isTemplateMode && (
        <TemplateTray onInsertStep={insertStepTemplate} onInsertBlock={insertBlockTemplate} />
      )}

      <div className="flex-1 min-w-0" data-testid="plan-activity-page">
      <h1 className="text-2xl font-bold text-pureWhite mb-6" data-testid="page-title">
        {isTemplateMode
          ? (isTemplateEdit ? 'Edit Template' : 'New Template')
          : (isEditMode ? 'Edit Activity' : 'Plan Activity')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Workout Header — compact info */}
        <WorkoutHeader
          activityType={activityType} setActivityType={setActivityType}
          date={date} setDate={setDate}
          title={title} setTitle={setTitle}
          description={description} setDescription={setDescription}
          isTemplateMode={isTemplateMode}
        />

        {/* Activity Details — always visible */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-4" data-testid="activity-details-section">
          <h2 className="text-lg font-semibold text-pureWhite">Activity Details</h2>

          {/* Intensity Metric */}
          <div>
            <label className="block text-sm text-softFog mb-1">Intensity Metric</label>
            <select
              value={intensityMetric}
              onChange={(e) => setIntensityMetric(e.target.value as IntensityMetric)}
              className="w-full md:w-64 px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
              data-testid="intensity-metric-select"
            >
              <option value="power_ftp">Power — % FTP</option>
              <option value="hr_threshold">Heart Rate — % Threshold</option>
              <option value="hr_max">Heart Rate — % Max</option>
              <option value="power_watts">Watts</option>
            </select>
          </div>

          {/* Duration - read-only when steps exist, editable otherwise */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-softFog mb-1">Planned Duration</label>
              {segments.length > 0 ? (
                <div className="px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue" data-testid="duration-input">
                  {formatHMS(segmentTotalDuration)} <small className="text-softFog">(from steps)</small>
                </div>
              ) : (
                <input
                  type="text"
                  value={durationText}
                  onChange={(e) => setDurationText(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                  placeholder="0:30:00"
                  data-testid="duration-input"
                />
              )}
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Distance (miles)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={distanceMiles}
                onChange={(e) => { setDistanceMiles(e.target.value); setLastEditedField('distance'); }}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                placeholder="20"
                data-testid="distance-input"
              />
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Target Speed (mph)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={targetSpeed}
                onChange={(e) => { setTargetSpeed(e.target.value); setLastEditedField('speed'); }}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                placeholder="18"
                data-testid="target-speed-input"
              />
            </div>
          </div>

          {/* TSS/IF & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-softFog mb-1">Planned TSS</label>
              <input
                type="number"
                min="0"
                value={segments.length > 0 && segmentPreview?.tss != null && !tssManuallySet ? segmentPreview.tss.toFixed(0) : plannedTss}
                onChange={(e) => {
                  setPlannedTss(e.target.value);
                  setTssManuallySet(e.target.value.trim() !== '');
                  if (segments.length > 0) { setIfManuallySet(false); setPlannedIf(''); }
                }}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                placeholder="100"
                data-testid="planned-tss-input"
              />
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Planned IF</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={segments.length > 0 && segmentPreview?.if != null && !ifManuallySet ? segmentPreview.if.toFixed(2) : plannedIf}
                onChange={(e) => {
                  setPlannedIf(e.target.value);
                  setIfManuallySet(e.target.value.trim() !== '');
                  if (segments.length > 0) { setTssManuallySet(false); setPlannedTss(''); }
                }}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue"
                placeholder="0.85"
                data-testid="planned-if-input"
              />
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Event</label>
              <input type="text" value={eventId} onChange={(e) => setEventId(e.target.value)} className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue" placeholder="Event ID" data-testid="event-id-input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-softFog mb-1">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue" placeholder="intervals, threshold" data-testid="tags-input" />
            </div>
            <div>
              <label className="block text-sm text-softFog mb-1">Equipment</label>
              <input type="text" value={equipment} onChange={(e) => setEquipment(e.target.value)} className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue" placeholder="Equipment ID" data-testid="equipment-input" />
            </div>
          </div>
        </section>

        {/* Workout Summary Bar — immediately above Workout Steps */}
        {segmentPreview && (
          <WorkoutSummary preview={segmentPreview} resolvedFtp={resolvedFtp} />
        )}

        {/* Workout Steps Builder (PLAN-056: extracted reusable component) */}
        <RepeatBlockEditor
          segments={segments}
          expandedStep={expandedStep}
          resolvedFtp={resolvedFtp}
          intensityMetric={intensityMetric}
          showAddMenu={showAddMenu}
          onToggleAddMenu={() => setShowAddMenu(!showAddMenu)}
          onAddSegment={(t) => addSegment(t)}
          onToggleStep={(flatIndex) => setExpandedStep(expandedStep === flatIndex ? null : flatIndex)}
          onUpdateSegment={(flatIndex, updates) => updateSegment(flatIndex, updates)}
          onRemoveSegment={(flatIndex) => removeSegment(flatIndex)}
          onDuplicateSegment={(flatIndex) => duplicateSegment(flatIndex)}
          onMoveSegmentUp={(flatIndex) => moveSegmentUp(flatIndex)}
          onMoveSegmentDown={(flatIndex) => moveSegmentDown(flatIndex)}
          onUpdateRepeatCount={(repeatId, count) => updateRepeatCount(repeatId, count)}
          onAddSegmentToBlock={(repeatId, count) => addSegmentToBlock(repeatId, count)}
          onMoveBlockUp={(flatIndex) => moveBlockUp(flatIndex)}
          onMoveBlockDown={(flatIndex) => moveBlockDown(flatIndex)}
          repeatStart={repeatStart}
          repeatEnd={repeatEnd}
          repeatCount={repeatCount}
          onRepeatStartChange={setRepeatStart}
          onRepeatEndChange={setRepeatEnd}
          onRepeatCountChange={setRepeatCount}
          onGroupIntoRepeat={handleRepeat}
        />

        {/* Error */}
        {submitError && (
          <div className="text-red-400 text-sm bg-red-900/20 rounded p-3" data-testid="submit-error">
            {submitError}
          </div>
        )}

        {/* Template save success */}
        {templateSaveSuccess && (
          <div className="text-green-400 text-sm bg-green-900/20 rounded p-3" data-testid="template-save-success">
            Template saved successfully
          </div>
        )}

        {/* Action Bar */}
        <div className="flex justify-between gap-3">
          <div>
            {segments.length > 0 && !isTemplateMode && (
              <button
                type="button"
                disabled={isSavingTemplate}
                onClick={handleSaveAsTemplate}
                className="px-4 py-2.5 rounded bg-steelBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm disabled:opacity-50"
                data-testid="save-as-template-btn"
              >
                {isSavingTemplate ? 'Saving...' : 'Save as Template'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(templateDestination)} className="px-5 py-2.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors" data-testid="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !activityType || (!isTemplateMode && !date)} className="px-5 py-2.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors disabled:opacity-50" data-testid="submit-btn">
              {isSubmitting ? 'Saving...' : (isTemplateMode ? (isTemplateEdit ? 'Update Template' : 'Create Template') : (isEditMode ? 'Update Activity' : 'Create Activity'))}
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

// --- Helper Components ---

function WorkoutHeader({ activityType, setActivityType, date, setDate, title, setTitle, description, setDescription, isTemplateMode }: {
  activityType: string; setActivityType: (v: string) => void;
  date: string; setDate: (v: string) => void;
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  isTemplateMode?: boolean;
}) {
  return (
    <section className="bg-charcoalGray rounded-lg p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-softFog mb-1">Type *</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue text-sm"
            required
            data-testid="activity-type-select"
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {!isTemplateMode && (
          <div>
            <label className="block text-xs text-softFog mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue text-sm"
              required
              data-testid="activity-date-input"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-softFog mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue text-sm"
            placeholder="e.g. Morning Intervals"
            data-testid="activity-title-input"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-softFog mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue text-sm"
          rows={2}
          placeholder="Workout description..."
          data-testid="activity-description-input"
        />
      </div>
    </section>
  );
}

function WorkoutSummary({ preview, resolvedFtp }: { preview: { totalDuration: number; tss: number | null; if: number | null; ftpAvailable: boolean }; resolvedFtp: number | null }) {
  return (
    <div className="bg-deepNavy rounded-lg p-4 border border-brightCyan" data-testid="segment-preview">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brightCyan">
          Workout Summary{resolvedFtp ? ` (FTP: ${resolvedFtp}W)` : ''}
        </h3>
      </div>
      <div className="flex gap-6 mt-2 text-sm text-lightSilver">
        <span data-testid="preview-duration">Duration: {formatDurationPreview(preview.totalDuration)}</span>
        <span data-testid="preview-tss">TSS: {preview.tss !== null ? preview.tss.toFixed(0) : '—'}</span>
        <span data-testid="preview-if">IF: {preview.if !== null ? preview.if.toFixed(2) : '—'}</span>
      </div>
      {!preview.ftpAvailable && (
        <p className="text-xs text-yellow-400 mt-2" data-testid="ftp-unavailable-warning">
          FTP not configured — set FTP in settings to calculate TSS/IF
        </p>
      )}
    </div>
  );
}

