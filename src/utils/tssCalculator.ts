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
  // PLAN-046: repeat-block metadata (Option B — flat segments tagged with group info).
  // Contiguous segments sharing the same repeatId form one logical repeat block.
  repeatId?: string;
  // The repeat count for the block, stored on every child segment of the block.
  // The first child's value is authoritative.
  repeatCount?: number;
}

/**
 * PLAN-046: Expand repeat blocks into the flat execution sequence.
 *
 * For a contiguous run of segments sharing a `repeatId` with `repeatCount = N`,
 * the run is emitted N times (repeat metadata stripped from the expanded copies).
 * Segments without a `repeatId` pass through once, unchanged.
 *
 * This is the ONLY place expansion happens. The calculation functions call this
 * first, then run the existing math on the expanded array.
 */
export function expandSegments(segments: PlanSegment[]): PlanSegment[] {
  const result: PlanSegment[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (!seg.repeatId) {
      // Not part of a repeat block — pass through once.
      result.push(seg);
      i += 1;
      continue;
    }
    // Gather the contiguous run sharing this repeatId.
    const repeatId = seg.repeatId;
    let j = i;
    while (j < segments.length && segments[j].repeatId === repeatId) {
      j += 1;
    }
    const run = segments.slice(i, j);
    // First child's count is authoritative; default to 1, floor to >= 1 integer.
    const rawCount = run[0].repeatCount;
    const count = Number.isFinite(rawCount) && (rawCount as number) >= 1
      ? Math.floor(rawCount as number)
      : 1;
    for (let rep = 0; rep < count; rep++) {
      for (const child of run) {
        // Strip repeat metadata from expanded copies.
        const { repeatId: _rid, repeatCount: _rc, ...rest } = child;
        result.push({ ...rest });
      }
    }
    i = j;
  }
  return result;
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
 * Calculate total TSS from all segments using normalized intensity.
 * TSS = (totalDuration / 3600) × IF² × 100
 * where IF is the 4th-power normalized intensity factor.
 * Returns null if FTP is not available.
 */
export function calculateTotalTss(
  segments: PlanSegment[],
  ftp: number | null,
  activityMetric: IntensityMetric = 'power_ftp',
): number | null {
  if (ftp === null || ftp <= 0) return null;
  const expanded = expandSegments(segments);
  const ifValue = calculateIF(expanded, ftp, activityMetric);
  if (ifValue === null || ifValue <= 0) return null;
  const totalDuration = expanded.reduce((sum, seg) => sum + seg.durationSeconds, 0);
  return tssFromIF(ifValue, totalDuration);
}

/**
 * Calculate estimated IF from segments using 4th-power normalized intensity.
 * normalizedPower = (Σ(segPower⁴ × segDuration) / totalDuration)^(1/4)
 * IF = normalizedPower / FTP
 * Returns null if FTP is not available or no power-based segments exist.
 */
export function calculateIF(
  segments: PlanSegment[],
  ftp: number | null,
  activityMetric: IntensityMetric = 'power_ftp',
): number | null {
  if (ftp === null || ftp <= 0 || segments.length === 0) return null;
  const expanded = expandSegments(segments);
  const totalDuration = expanded.reduce((sum, seg) => sum + seg.durationSeconds, 0);
  if (totalDuration === 0) return null;
  const weightedPower4 = expanded.reduce((sum, seg) => {
    const power = getSegmentAvgPowerWatts(seg, ftp, activityMetric);
    return sum + Math.pow(power, 4) * seg.durationSeconds;
  }, 0);
  const normalizedPower = Math.pow(weightedPower4 / totalDuration, 0.25);
  if (normalizedPower <= 0) return null;
  return normalizedPower / ftp;
}

/**
 * Calculate total duration from segments in seconds.
 */
export function calculateTotalDuration(segments: PlanSegment[]): number {
  return expandSegments(segments).reduce((sum, seg) => sum + seg.durationSeconds, 0);
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
