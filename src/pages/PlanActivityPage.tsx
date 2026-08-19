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
  type PlanSegment,
  type IntensityMetric,
  type FtpHistoryEntry,
} from '../utils/tssCalculator';

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

const SEGMENT_TYPES: PlanSegment['type'][] = ['warmup', 'interval', 'recovery', 'cooldown', 'steady'];

const SEGMENT_LABELS: Record<PlanSegment['type'], string> = {
  warmup: 'Warm Up',
  interval: 'Work',
  recovery: 'Recovery',
  cooldown: 'Cool Down',
  steady: 'Steady',
};

const SEGMENT_COLORS: Record<PlanSegment['type'], string> = {
  warmup: 'bg-yellow-500',
  interval: 'bg-red-500',
  recovery: 'bg-green-500',
  cooldown: 'bg-blue-500',
  steady: 'bg-purple-500',
};

// --- Utility Functions ---

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseHMS(input: string): number | null {
  const parts = input.split(':').map(p => parseInt(p, 10));
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
    if (h < 0 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (isNaN(m) || isNaN(s)) return null;
    if (m < 0 || s < 0 || s > 59) return null;
    return m * 60 + s;
  }
  return null;
}

function formatDurationPreview(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatStepDuration(seconds: number): string {
  return formatHMS(seconds);
}

function createEmptySegment(type: PlanSegment['type'] = 'interval'): PlanSegment {
  return { type, durationSeconds: 300, powerMin: undefined, powerMax: undefined };
}

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

  const moveSegmentUp = useCallback((index: number) => {
    if (index === 0) return;
    setSegments((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setExpandedStep((prev) => (prev === index ? index - 1 : prev));
    clearOverrides();
  }, [clearOverrides]);

  const moveSegmentDown = useCallback((index: number) => {
    setSegments((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setExpandedStep((prev) => (prev === index ? index + 1 : prev));
    clearOverrides();
  }, [clearOverrides]);

  const handleRepeat = useCallback(() => {
    const start = parseInt(repeatStart, 10);
    const end = parseInt(repeatEnd, 10);
    const count = parseInt(repeatCount, 10);
    if (isNaN(start) || isNaN(end) || isNaN(count) || count < 2) return;
    if (start < 0 || end < start || end >= segments.length) return;

    const slice = segments.slice(start, end + 1);
    const expanded: PlanSegment[] = [];
    for (let i = 0; i < count; i++) {
      expanded.push(...slice.map((s) => ({ ...s })));
    }
    setSegments((prev) => [
      ...prev.slice(0, start),
      ...expanded,
      ...prev.slice(end + 1),
    ]);
    setRepeatStart('');
    setRepeatEnd('');
    setRepeatCount('2');
  }, [repeatStart, repeatEnd, repeatCount, segments]);

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

      if (segments.length > 0) payload.segments = segments;

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

      templatePayload.segments = segments;

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
    <div className="max-w-4xl mx-auto py-6 px-4" data-testid="plan-activity-page">
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

        {/* Workout Steps Builder */}
        <section className="bg-charcoalGray rounded-lg p-5 space-y-3" data-testid="segment-builder-section">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-pureWhite">Workout Steps</h2>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-3 py-1.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm"
                data-testid="add-segment-btn"
              >
                + Add Step
              </button>
              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 bg-deepNavy border border-steelBlue rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                  {SEGMENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addSegment(t)}
                      className="w-full text-left px-3 py-2 text-sm text-lightSilver hover:bg-steelBlue/50 flex items-center gap-2"
                      data-testid={`add-step-${t}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${SEGMENT_COLORS[t]}`} />
                      {SEGMENT_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {segments.length === 0 && (
            <div className="text-center py-8 text-softFog">
              <p className="text-sm">No steps yet. Add steps to build your workout.</p>
            </div>
          )}

          <div className="space-y-2">
            {segments.map((segment, idx) => (
              <StepCard
                key={idx}
                segment={segment}
                index={idx}
                totalCount={segments.length}
                expanded={expandedStep === idx}
                resolvedFtp={resolvedFtp}
                activityMetric={intensityMetric}
                onToggle={() => setExpandedStep(expandedStep === idx ? null : idx)}
                onUpdate={(updates) => updateSegment(idx, updates)}
                onRemove={() => removeSegment(idx)}
                onDuplicate={() => duplicateSegment(idx)}
                onMoveUp={() => moveSegmentUp(idx)}
                onMoveDown={() => moveSegmentDown(idx)}
              />
            ))}
          </div>

          {/* Repeat controls */}
          {segments.length >= 2 && (
            <div className="flex items-end gap-2 bg-deepNavy rounded p-3 border border-steelBlue mt-3" data-testid="repeat-controls">
              <div>
                <label className="block text-xs text-softFog mb-0.5">From #</label>
                <input
                  type="number"
                  min="0"
                  max={segments.length - 1}
                  value={repeatStart}
                  onChange={(e) => setRepeatStart(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid="repeat-start-input"
                />
              </div>
              <div>
                <label className="block text-xs text-softFog mb-0.5">To #</label>
                <input
                  type="number"
                  min="0"
                  max={segments.length - 1}
                  value={repeatEnd}
                  onChange={(e) => setRepeatEnd(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid="repeat-end-input"
                />
              </div>
              <div>
                <label className="block text-xs text-softFog mb-0.5">× Count</label>
                <input
                  type="number"
                  min="2"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid="repeat-count-input"
                />
              </div>
              <button
                type="button"
                onClick={handleRepeat}
                className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm"
                data-testid="repeat-btn"
              >
                Repeat
              </button>
            </div>
          )}
        </section>

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

function StepCard({ segment, index, totalCount, expanded, resolvedFtp, activityMetric, onToggle, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown }: {
  segment: PlanSegment;
  index: number;
  totalCount: number;
  expanded: boolean;
  resolvedFtp: number | null;
  activityMetric: IntensityMetric;
  onToggle: () => void;
  onUpdate: (updates: Partial<PlanSegment>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const effectiveMetric = segment.intensityMetric || activityMetric;
  const showPowerFields = effectiveMetric === 'power_ftp' || effectiveMetric === 'power_watts';
  const showHrFields = effectiveMetric === 'hr_threshold' || effectiveMetric === 'hr_max';
  const isPctFtp = effectiveMetric === 'power_ftp';

  const powerSummary = useMemo(() => {
    if (showPowerFields) {
      const min = segment.powerMin;
      const max = segment.powerMax;
      if (!min && !max) return null;
      if (isPctFtp && resolvedFtp) {
        // Values are percentages — show derived watts
        if (min && max && min === max) return `${min}% → ${Math.round((min / 100) * resolvedFtp)} W`;
        if (min && max) return `${min}–${max}% → ${Math.round((min / 100) * resolvedFtp)}–${Math.round((max / 100) * resolvedFtp)} W`;
        const val = min || max;
        if (val) return `${val}% → ${Math.round((val / 100) * resolvedFtp)} W`;
        return null;
      }
      // power_watts or no FTP: show literal watts
      if (min && max && min === max) return `${min} W`;
      if (min && max) return `${min}–${max} W`;
      return `${min || max} W`;
    } else {
      const min = segment.hrMin;
      const max = segment.hrMax;
      if (!min && !max) return null;
      const label = effectiveMetric === 'hr_threshold' ? '% Threshold' : '% Max';
      if (min && max && min === max) return `${min} ${label}`;
      if (min && max) return `${min}–${max} ${label}`;
      return `${min || max} ${label}`;
    }
  }, [segment.powerMin, segment.powerMax, segment.hrMin, segment.hrMax, resolvedFtp, showPowerFields, isPctFtp, effectiveMetric]);

  // Local state for duration text input (to allow typing partial H:MM:SS)
  const [durationText, setDurationText] = useState(formatHMS(segment.durationSeconds));

  // Sync local text when segment changes externally
  useEffect(() => {
    setDurationText(formatHMS(segment.durationSeconds));
  }, [segment.durationSeconds]);

  const handleDurationChange = (value: string) => {
    setDurationText(value);
    const secs = parseHMS(value);
    if (secs !== null) {
      onUpdate({ durationSeconds: secs });
    }
  };

  if (expanded) {
    return (
      <div className="bg-deepNavy rounded-lg p-4 border border-electricBlue" data-testid={`segment-${index}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs text-softFog mb-0.5">Type</label>
            <select
              value={segment.type}
              onChange={(e) => onUpdate({ type: e.target.value as PlanSegment['type'] })}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid={`segment-${index}-type`}
            >
              {SEGMENT_TYPES.map((t) => (
                <option key={t} value={t}>{SEGMENT_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-softFog mb-0.5">Duration</label>
            <input
              type="text"
              value={durationText}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              placeholder="0:05:00"
              data-testid={`segment-${index}-duration`}
            />
          </div>
          <div>
            <label className="block text-xs text-softFog mb-0.5">Intensity</label>
            <select
              value={segment.intensityMetric || ''}
              onChange={(e) => onUpdate({ intensityMetric: e.target.value ? e.target.value as IntensityMetric : undefined })}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid={`segment-${index}-metric`}
            >
              <option value="">Default</option>
              <option value="power_ftp">Power — % FTP</option>
              <option value="hr_threshold">HR — % Threshold</option>
              <option value="hr_max">HR — % Max</option>
              <option value="power_watts">Watts</option>
            </select>
          </div>
        </div>
        {/* Conditional target fields based on effective metric */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {showPowerFields && (
            <>
              <div>
                <label className="block text-xs text-softFog mb-0.5">
                  {isPctFtp ? 'Min (% FTP)' : 'Min (W)'}
                  {isPctFtp && resolvedFtp && segment.powerMin ? ` → ${Math.round((segment.powerMin / 100) * resolvedFtp)} W` : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  value={segment.powerMin ?? ''}
                  onChange={(e) => onUpdate({ powerMin: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid={`segment-${index}-power-min`}
                />
              </div>
              <div>
                <label className="block text-xs text-softFog mb-0.5">
                  {isPctFtp ? 'Max (% FTP)' : 'Max (W)'}
                  {isPctFtp && resolvedFtp && segment.powerMax ? ` → ${Math.round((segment.powerMax / 100) * resolvedFtp)} W` : ''}
                </label>
                <input
                  type="number"
                  min="0"
                  value={segment.powerMax ?? ''}
                  onChange={(e) => onUpdate({ powerMax: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid={`segment-${index}-power-max`}
                />
              </div>
            </>
          )}
          {showHrFields && (
            <>
              <div>
                <label className="block text-xs text-softFog mb-0.5">HR Min ({effectiveMetric === 'hr_threshold' ? '% Threshold' : '% Max'})</label>
                <input
                  type="number"
                  min="0"
                  value={segment.hrMin ?? ''}
                  onChange={(e) => onUpdate({ hrMin: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid={`segment-${index}-hr-min`}
                />
              </div>
              <div>
                <label className="block text-xs text-softFog mb-0.5">HR Max ({effectiveMetric === 'hr_threshold' ? '% Threshold' : '% Max'})</label>
                <input
                  type="number"
                  min="0"
                  value={segment.hrMax ?? ''}
                  onChange={(e) => onUpdate({ hrMax: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                  data-testid={`segment-${index}-hr-max`}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-softFog mb-0.5">Cadence Min</label>
            <input
              type="number"
              min="0"
              value={segment.cadenceMin ?? ''}
              onChange={(e) => onUpdate({ cadenceMin: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid={`segment-${index}-cadence-min`}
            />
          </div>
          <div>
            <label className="block text-xs text-softFog mb-0.5">Cadence Max</label>
            <input
              type="number"
              min="0"
              value={segment.cadenceMax ?? ''}
              onChange={(e) => onUpdate({ cadenceMax: e.target.value ? parseInt(e.target.value, 10) : undefined })}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid={`segment-${index}-cadence-max`}
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-softFog mb-0.5">Notes</label>
          <input
            type="text"
            value={segment.notes ?? ''}
            onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
            className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
            placeholder="Step notes..."
            data-testid={`segment-${index}-notes`}
          />
        </div>
        <div className="flex items-center justify-between border-t border-steelBlue pt-2">
          <button type="button" onClick={onToggle} className="text-xs text-brightCyan hover:text-pureWhite">Done</button>
          <div className="flex gap-2">
            <button type="button" onClick={onMoveUp} disabled={index === 0} className="px-2 py-1 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan disabled:opacity-30" data-testid={`segment-${index}-move-up`}>↑</button>
            <button type="button" onClick={onMoveDown} disabled={index === totalCount - 1} className="px-2 py-1 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan disabled:opacity-30" data-testid={`segment-${index}-move-down`}>↓</button>
            <button type="button" onClick={onDuplicate} className="px-2 py-1 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan" data-testid={`segment-${index}-duplicate`}>Duplicate</button>
            <button type="button" onClick={onRemove} className="px-2 py-1 text-xs rounded bg-red-700 text-pureWhite hover:bg-red-600" data-testid={`segment-${index}-remove`}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  // Collapsed view
  return (
    <div
      className="bg-deepNavy rounded-lg p-3 border border-steelBlue hover:border-electricBlue cursor-pointer transition-colors"
      data-testid={`segment-${index}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEGMENT_COLORS[segment.type]}`} />
          <span className="text-sm font-medium text-pureWhite w-20">{SEGMENT_LABELS[segment.type]}</span>
          <span className="text-sm text-lightSilver">{formatStepDuration(segment.durationSeconds)}</span>
          {powerSummary && <span className="text-sm text-softFog ml-2 truncate">{powerSummary}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="px-1.5 py-0.5 text-xs rounded text-softFog hover:text-pureWhite disabled:opacity-30" data-testid={`segment-${index}-move-up`}>↑</button>
          <button type="button" onClick={onMoveDown} disabled={index === totalCount - 1} className="px-1.5 py-0.5 text-xs rounded text-softFog hover:text-pureWhite disabled:opacity-30" data-testid={`segment-${index}-move-down`}>↓</button>
          <button type="button" onClick={onRemove} className="px-1.5 py-0.5 text-xs rounded text-softFog hover:text-red-400" data-testid={`segment-${index}-remove`}>✕</button>
        </div>
      </div>
    </div>
  );
}
