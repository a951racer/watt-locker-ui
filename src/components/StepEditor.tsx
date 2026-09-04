/**
 * StepEditor — reusable editor for a single canonical Activity Step.
 *
 * PLAN-056: Extracted verbatim from PlanActivityPage's inline `StepCard` so it
 * can be reused by the Activity Planner and (in later PLAN tasks) the Step
 * Template and Block Template editors. It edits the CANONICAL `PlanSegment`
 * structure — there is no template-specific step type.
 *
 * Behavior preserved from the original inline card: collapsed summary row +
 * expanded edit form, per-step intensity metric override, power/HR/cadence
 * ranges, notes, move/duplicate/remove, and the same data-testids.
 *
 * New in PLAN-056:
 * - Optional step name (segment-<i>-name).
 * - Explicit duration type time|distance (segment-<i>-duration-type), mutually
 *   exclusive: switching type clears the other value. Distance is entered in
 *   miles (segment-<i>-distance) and stored in meters.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  formatHMS,
  parseHMS,
  resolveDurationType,
  METERS_PER_MILE,
  SEGMENT_TYPES,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  type PlanSegment,
  type IntensityMetric,
} from '../utils/tssCalculator';

export interface StepEditorProps {
  segment: PlanSegment;
  index: number;
  displayNumber: number;
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
}

function formatMiles(meters: number | undefined): string {
  if (typeof meters !== 'number' || meters <= 0) return '';
  return (meters / METERS_PER_MILE).toFixed(2);
}

export default function StepEditor({
  segment,
  index,
  displayNumber,
  totalCount,
  expanded,
  resolvedFtp,
  activityMetric,
  onToggle,
  onUpdate,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const effectiveMetric = segment.intensityMetric || activityMetric;
  const showPowerFields = effectiveMetric === 'power_ftp' || effectiveMetric === 'power_watts';
  const showHrFields = effectiveMetric === 'hr_threshold' || effectiveMetric === 'hr_max';
  const isPctFtp = effectiveMetric === 'power_ftp';

  const durationType = resolveDurationType(segment);
  const isDistance = durationType === 'distance';

  const powerSummary = useMemo(() => {
    if (showPowerFields) {
      const min = segment.powerMin;
      const max = segment.powerMax;
      if (!min && !max) return null;
      if (isPctFtp && resolvedFtp) {
        if (min && max && min === max) return `${min}% → ${Math.round((min / 100) * resolvedFtp)} W`;
        if (min && max) return `${min}–${max}% → ${Math.round((min / 100) * resolvedFtp)}–${Math.round((max / 100) * resolvedFtp)} W`;
        const val = min || max;
        if (val) return `${val}% → ${Math.round((val / 100) * resolvedFtp)} W`;
        return null;
      }
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

  // Collapsed summary of the duration (time H:MM:SS or "N.NN mi").
  const durationSummary = isDistance
    ? `${formatMiles(segment.distanceMeters) || '0'} mi`
    : formatHMS(segment.durationSeconds ?? 0);

  // Local state for the time duration text input (allows typing partial H:MM:SS
  // without reformatting mid-edit). Mirrors the original StepCard behavior.
  const [durationText, setDurationText] = useState(formatHMS(segment.durationSeconds ?? 0));
  const [durationFocused, setDurationFocused] = useState(false);

  useEffect(() => {
    if (!durationFocused) {
      setDurationText(formatHMS(segment.durationSeconds ?? 0));
    }
  }, [segment.durationSeconds, durationFocused]);

  // PLAN-060: local text state for the distance (miles) input, mirroring the
  // time-duration pattern. Keeping the raw typed text while focused prevents the
  // controlled value from reformatting mid-edit (e.g. "5." → "5.00"), which
  // previously made it impossible to type a decimal like 5.75.
  const [distanceText, setDistanceText] = useState(formatMiles(segment.distanceMeters));
  const [distanceFocused, setDistanceFocused] = useState(false);

  useEffect(() => {
    if (!distanceFocused) {
      setDistanceText(formatMiles(segment.distanceMeters));
    }
  }, [segment.distanceMeters, distanceFocused]);

  const handleDurationChange = (value: string) => {
    setDurationText(value);
    const secs = parseHMS(value);
    if (secs !== null) {
      onUpdate({ durationSeconds: secs });
    }
  };

  const handleDurationBlur = () => {
    setDurationFocused(false);
    const secs = parseHMS(durationText);
    if (secs !== null) {
      onUpdate({ durationSeconds: secs });
      setDurationText(formatHMS(secs));
    } else {
      setDurationText(formatHMS(segment.durationSeconds ?? 0));
    }
  };

  // PLAN-056: switch duration type, enforcing mutual exclusion by clearing the
  // now-incompatible value so it can't linger in the underlying step.
  const handleDurationTypeChange = (nextType: 'time' | 'distance') => {
    if (nextType === durationType) return;
    if (nextType === 'time') {
      onUpdate({ durationType: 'time', durationSeconds: segment.durationSeconds ?? 0, distanceMeters: undefined });
    } else {
      onUpdate({ durationType: 'distance', distanceMeters: segment.distanceMeters ?? 0, durationSeconds: undefined });
    }
  };

  const handleDistanceChange = (milesText: string) => {
    // Track the raw text so the user can type intermediate states like "5."
    // without the controlled value snapping back to a whole number.
    setDistanceText(milesText);
    if (milesText.trim() === '') {
      onUpdate({ distanceMeters: undefined });
      return;
    }
    const miles = parseFloat(milesText);
    // parseFloat preserves the fractional component (no integer truncation).
    // Commit only when the value is a valid non-negative number; limit to two
    // decimal places of precision before converting miles → meters.
    if (!isNaN(miles) && miles >= 0) {
      const twoDp = Math.round(miles * 100) / 100;
      onUpdate({ distanceMeters: Math.round(twoDp * METERS_PER_MILE) });
    }
  };

  const handleDistanceBlur = () => {
    setDistanceFocused(false);
    // On commit, normalize a non-empty entry to canonical two-decimal miles
    // derived from the stored meters. An empty entry is left blank.
    if (distanceText.trim() !== '') {
      setDistanceText(formatMiles(segment.distanceMeters));
    }
  };

  if (expanded) {
    return (
      <div className="bg-deepNavy rounded-lg p-4 border border-electricBlue" data-testid={`segment-${index}`}>
        <div className="text-xs text-softFog mb-2" data-testid={`segment-${index}-number`}>Step {displayNumber}</div>

        {/* PLAN-056: optional step name */}
        <div className="mb-3">
          <label className="block text-xs text-softFog mb-0.5">Name</label>
          <input
            type="text"
            value={segment.name ?? ''}
            onChange={(e) => onUpdate({ name: e.target.value || undefined })}
            className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
            placeholder="e.g. Sweet Spot (optional)"
            data-testid={`segment-${index}-name`}
          />
        </div>

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

          {/* PLAN-056: explicit duration type — time or distance (mutually exclusive) */}
          <div>
            <label className="block text-xs text-softFog mb-0.5">Duration Type</label>
            <select
              value={durationType}
              onChange={(e) => handleDurationTypeChange(e.target.value as 'time' | 'distance')}
              className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid={`segment-${index}-duration-type`}
            >
              <option value="time">Time</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          {isDistance ? (
            <div>
              <label className="block text-xs text-softFog mb-0.5">Distance (mi)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={distanceText}
                onChange={(e) => handleDistanceChange(e.target.value)}
                onFocus={() => setDistanceFocused(true)}
                onBlur={handleDistanceBlur}
                className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                placeholder="1.50"
                data-testid={`segment-${index}-distance`}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-softFog mb-0.5">Duration</label>
              <input
                type="text"
                value={durationText}
                onChange={(e) => handleDurationChange(e.target.value)}
                onFocus={() => setDurationFocused(true)}
                onBlur={handleDurationBlur}
                className="w-full px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
                placeholder="mm or h:mm:ss"
                data-testid={`segment-${index}-duration`}
              />
            </div>
          )}

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
          <span className="text-xs text-softFog w-5 flex-shrink-0 text-right" data-testid={`segment-${index}-number`}>{displayNumber}.</span>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEGMENT_COLORS[segment.type]}`} />
          <span className="text-sm font-medium text-pureWhite w-20">{segment.name?.trim() ? segment.name : SEGMENT_LABELS[segment.type]}</span>
          <span className="text-sm text-lightSilver">{durationSummary}</span>
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
