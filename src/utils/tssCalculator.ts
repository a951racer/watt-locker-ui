/**
 * TSS/IF calculation utilities for planned workouts.
 *
 * FTP priority:
 * 1. Activity-level referenceMetric override (if present)
 * 2. User's configured FTP from settings (most recent ftpHistory entry)
 * 3. null — cannot calculate (UI should indicate FTP is required)
 *
 * The 200W fallback exists only in the backend's lookupFtp() for completed
 * workout processing. For planning previews, we do NOT assume 200W.
 */

export type IntensityMetric = 'power_ftp' | 'hr_threshold' | 'hr_max' | 'power_watts';

export interface PlanSegment {
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady';
  durationSeconds: number;
  intensityMetric?: IntensityMetric; // per-step override
  powerMin?: number;
  powerMax?: number;
  hrMin?: number;
  hrMax?: number;
  cadenceMin?: number;
  cadenceMax?: number;
  notes?: string;
}

export interface FtpHistoryEntry {
  effectiveDate: string;
  ftpWatts: number;
}

/**
 * Resolve the FTP to use for planning calculations.
 * Priority: activity override → user FTP history → null (not available).
 */
export function resolvePlanningFtp(
  activityFtpOverride?: number,
  ftpHistory?: FtpHistoryEntry[],
): number | null {
  if (activityFtpOverride && activityFtpOverride > 0) {
    return activityFtpOverride;
  }
  if (ftpHistory && ftpHistory.length > 0) {
    const sorted = [...ftpHistory].sort(
      (a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime(),
    );
    if (sorted[0].ftpWatts > 0) {
      return sorted[0].ftpWatts;
    }
  }
  return null;
}

/**
 * Get the average power in WATTS for a segment, accounting for intensity metric.
 *
 * - power_ftp: powerMin/powerMax are percentages → convert via FTP
 * - power_watts: powerMin/powerMax are literal watts
 * - hr_threshold / hr_max: no usable power basis → returns 0
 */
export function getSegmentAvgPowerWatts(
  segment: PlanSegment,
  ftp: number,
  activityMetric: IntensityMetric = 'power_ftp',
): number {
  const effectiveMetric = segment.intensityMetric || activityMetric;

  // HR-based segments have no power basis for TSS
  if (effectiveMetric === 'hr_threshold' || effectiveMetric === 'hr_max') {
    return 0;
  }

  const min = segment.powerMin ?? 0;
  const max = segment.powerMax ?? 0;
  let avgRaw = 0;
  if (min > 0 && max > 0) avgRaw = (min + max) / 2;
  else if (min > 0) avgRaw = min;
  else if (max > 0) avgRaw = max;

  if (avgRaw <= 0) return 0;

  // Convert percentage to watts for power_ftp
  if (effectiveMetric === 'power_ftp') {
    return (avgRaw / 100) * ftp;
  }

  // power_watts: already in watts
  return avgRaw;
}

/**
 * Calculate estimated TSS for a single segment.
 * TSS = (duration_seconds * (avg_power_watts / FTP)^2) / 3600 * 100
 */
export function calculateSegmentTss(
  segment: PlanSegment,
  ftp: number,
  activityMetric: IntensityMetric = 'power_ftp',
): number {
  const avgPowerWatts = getSegmentAvgPowerWatts(segment, ftp, activityMetric);
  if (avgPowerWatts <= 0 || ftp <= 0 || segment.durationSeconds <= 0) return 0;
  return (segment.durationSeconds * Math.pow(avgPowerWatts / ftp, 2)) / 3600 * 100;
}

/**
 * Calculate total TSS from all segments.
 * Returns null if FTP is not available.
 * Skips HR-based segments (they contribute 0 TSS).
 */
export function calculateTotalTss(
  segments: PlanSegment[],
  ftp: number | null,
  activityMetric: IntensityMetric = 'power_ftp',
): number | null {
  if (ftp === null || ftp <= 0) return null;
  const total = segments.reduce((sum, seg) => sum + calculateSegmentTss(seg, ftp, activityMetric), 0);
  return total;
}

/**
 * Calculate estimated IF from segments.
 * IF = duration-weighted average power / FTP
 * Returns null if FTP is not available or no power-based segments exist.
 */
export function calculateIF(
  segments: PlanSegment[],
  ftp: number | null,
  activityMetric: IntensityMetric = 'power_ftp',
): number | null {
  if (ftp === null || ftp <= 0 || segments.length === 0) return null;
  const totalDuration = segments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
  if (totalDuration === 0) return null;
  const weightedPower = segments.reduce((sum, seg) => {
    return sum + getSegmentAvgPowerWatts(seg, ftp, activityMetric) * seg.durationSeconds;
  }, 0);
  const avgPower = weightedPower / totalDuration;
  if (avgPower <= 0) return null;
  return avgPower / ftp;
}

/**
 * Calculate total duration from segments in seconds.
 */
export function calculateTotalDuration(segments: PlanSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
}

/**
 * Derive TSS from IF and duration.
 * TSS = (duration_hours) * IF^2 * 100
 */
export function tssFromIF(ifValue: number, durationSeconds: number): number {
  return (durationSeconds / 3600) * Math.pow(ifValue, 2) * 100;
}

/**
 * Derive IF from TSS and duration.
 * IF = sqrt(TSS / (duration_hours * 100))
 */
export function ifFromTSS(tss: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.sqrt(tss / ((durationSeconds / 3600) * 100));
}
