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

/**
 * PLAN-056: A canonical Activity Step's duration is defined by EXACTLY ONE of
 * time or distance — never both. `durationType` makes that explicit.
 *
 * Backward compatibility: legacy segments have no `durationType` and always
 * carry `durationSeconds`; they are treated as time-based (see
 * `resolveDurationType` / `normalizeSegmentDuration`). No data migration is
 * required — normalization happens at the domain boundary.
 */
export type DurationType = 'time' | 'distance';

export interface PlanSegment {
  // PLAN-056: optional canonical step name/label. Undefined/empty is valid and
  // applies to every step regardless of origin (manual, template, etc.).
  name?: string;
  type: 'warmup' | 'interval' | 'recovery' | 'cooldown' | 'steady';
  // PLAN-056: explicit duration type. When absent, the segment is time-based
  // (legacy behavior). Exactly one of durationSeconds / distanceMeters is
  // meaningful, selected by durationType.
  durationType?: DurationType;
  // Time-based duration in seconds (present when durationType === 'time', or
  // for legacy segments without durationType). Optional so a distance-based
  // step can legally omit it.
  durationSeconds?: number;
  // PLAN-056: distance-based duration in METERS (present when
  // durationType === 'distance'). Stored in meters to match the activity-level
  // plannedDistanceMeters convention; the UI converts to miles for display.
  distanceMeters?: number;
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
 * PLAN-056: Resolve a segment's effective duration type.
 *
 * Explicit `durationType` wins. Otherwise infer: a segment with a
 * `distanceMeters` value and no time value is distance-based; everything else
 * (including all legacy segments) is time-based. This keeps existing persisted
 * activities working without a migration.
 */
export function resolveDurationType(segment: Pick<PlanSegment, 'durationType' | 'durationSeconds' | 'distanceMeters'>): DurationType {
  if (segment.durationType === 'distance' || segment.durationType === 'time') {
    return segment.durationType;
  }
  if (
    (segment.durationSeconds === undefined || segment.durationSeconds === null) &&
    typeof segment.distanceMeters === 'number' &&
    segment.distanceMeters > 0
  ) {
    return 'distance';
  }
  return 'time';
}

/**
 * PLAN-056: Enforce the "exactly one duration" invariant on a segment.
 *
 * - time     → durationType='time', keep durationSeconds, drop distanceMeters
 * - distance → durationType='distance', keep distanceMeters, drop durationSeconds
 *
 * Returns a new segment; does not mutate the input. Used at the domain/editor
 * boundary so both persisted and edited steps satisfy the invariant.
 */
export function normalizeSegmentDuration(segment: PlanSegment): PlanSegment {
  const type = resolveDurationType(segment);
  const rest = { ...segment };
  if (type === 'time') {
    return {
      ...rest,
      durationType: 'time',
      durationSeconds: typeof segment.durationSeconds === 'number' ? segment.durationSeconds : 0,
      distanceMeters: undefined,
    };
  }
  return {
    ...rest,
    durationType: 'distance',
    distanceMeters: typeof segment.distanceMeters === 'number' ? segment.distanceMeters : 0,
    durationSeconds: undefined,
  };
}

/**
 * PLAN-056: The time contribution (seconds) of a segment for time-based
 * calculations (total duration, TSS, IF).
 *
 * Time-based steps contribute their `durationSeconds`. Distance-based steps
 * have no time basis, so they contribute 0 — we deliberately do NOT invent a
 * pace/speed model to convert distance to time (documented limitation). This
 * keeps every existing time-based calculation byte-for-byte unchanged.
 */
export function getSegmentDurationSeconds(segment: Pick<PlanSegment, 'durationType' | 'durationSeconds' | 'distanceMeters'>): number {
  if (resolveDurationType(segment) === 'distance') return 0;
  return typeof segment.durationSeconds === 'number' ? segment.durationSeconds : 0;
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
  const durationSeconds = getSegmentDurationSeconds(segment);
  if (avgPowerWatts <= 0 || ftp <= 0 || durationSeconds <= 0) return 0;
  return (durationSeconds * Math.pow(avgPowerWatts / ftp, 2)) / 3600 * 100;
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
  const totalDuration = expanded.reduce((sum, seg) => sum + getSegmentDurationSeconds(seg), 0);
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
  const totalDuration = expanded.reduce((sum, seg) => sum + getSegmentDurationSeconds(seg), 0);
  if (totalDuration === 0) return null;
  const weightedPower4 = expanded.reduce((sum, seg) => {
    const power = getSegmentAvgPowerWatts(seg, ftp, activityMetric);
    return sum + Math.pow(power, 4) * getSegmentDurationSeconds(seg);
  }, 0);
  const normalizedPower = Math.pow(weightedPower4 / totalDuration, 0.25);
  if (normalizedPower <= 0) return null;
  return normalizedPower / ftp;
}

/**
 * Calculate total duration from segments in seconds.
 */
export function calculateTotalDuration(segments: PlanSegment[]): number {
  return expandSegments(segments).reduce((sum, seg) => sum + getSegmentDurationSeconds(seg), 0);
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

// ---------------------------------------------------------------------------
// PLAN-056: Shared step/segment presentation helpers & constants.
//
// These were previously private to PlanActivityPage. They are exported here so
// the extracted StepEditor / RepeatBlockEditor components and the planner share
// ONE definition (no template-specific duplicates). Behavior is unchanged.
// ---------------------------------------------------------------------------

/** Meters per mile — the app persists distance in meters and displays miles. */
export const METERS_PER_MILE = 1609.344;

export const SEGMENT_TYPES: PlanSegment['type'][] = ['warmup', 'interval', 'recovery', 'cooldown', 'steady'];

export const SEGMENT_LABELS: Record<PlanSegment['type'], string> = {
  warmup: 'Warm Up',
  interval: 'Work',
  recovery: 'Recovery',
  cooldown: 'Cool Down',
  steady: 'Steady',
};

export const SEGMENT_COLORS: Record<PlanSegment['type'], string> = {
  warmup: 'bg-yellow-500',
  interval: 'bg-red-500',
  recovery: 'bg-green-500',
  cooldown: 'bg-blue-500',
  steady: 'bg-purple-500',
};

/** Format whole seconds as canonical H:MM:SS. */
export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse a duration string into seconds.
 * - Bare number (no colon) → whole minutes (e.g. "30" → 30:00, "90" → 1:30:00).
 * - "m:ss" or "h:mm:ss".
 * Returns null for empty/invalid input.
 */
export function parseHMS(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  if (!trimmed.includes(':')) {
    const minutes = Number(trimmed);
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    return Math.round(minutes * 60);
  }

  const parts = trimmed.split(':').map((p) => (p === '' ? NaN : Number(p)));
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

/** Compact duration preview (drops leading zero hours). */
export function formatDurationPreview(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Create a new time-based interval step with sensible defaults. */
export function createEmptySegment(type: PlanSegment['type'] = 'interval'): PlanSegment {
  return { type, durationType: 'time', durationSeconds: 300, powerMin: undefined, powerMax: undefined };
}

// PLAN-046: generate a unique id for a repeat block.
let repeatIdCounter = 0;
export function generateRepeatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  repeatIdCounter += 1;
  return `repeat-${Date.now()}-${repeatIdCounter}`;
}

/**
 * PLAN-046: Group contiguous flat segments into logical rows for rendering.
 * A row is either a single standalone segment, or a repeat block containing
 * contiguous segments that share a repeatId. `flatIndex` on each child
 * preserves the segment's position in the flat array.
 */
export type RenderChild = { segment: PlanSegment; flatIndex: number };
export type RenderRow =
  | { kind: 'single'; child: RenderChild }
  | { kind: 'repeat'; repeatId: string; count: number; children: RenderChild[] };

export function buildRenderRows(segments: PlanSegment[]): RenderRow[] {
  const rows: RenderRow[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (!seg.repeatId) {
      rows.push({ kind: 'single', child: { segment: seg, flatIndex: i } });
      i += 1;
      continue;
    }
    const repeatId = seg.repeatId;
    const children: RenderChild[] = [];
    let j = i;
    while (j < segments.length && segments[j].repeatId === repeatId) {
      children.push({ segment: segments[j], flatIndex: j });
      j += 1;
    }
    const first = children[0].segment.repeatCount;
    const count = first && first >= 1 ? Math.floor(first) : 1;
    rows.push({ kind: 'repeat', repeatId, count, children });
    i = j;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// PLAN-061: Atomic step / repeat-block reordering.
//
// The canonical activity is a flat `PlanSegment[]`; a repeat block is a run of
// contiguous segments sharing a `repeatId`. For reordering, a "top-level unit"
// is EITHER a standalone step OR a whole contiguous repeat block. Blocks must
// always move atomically (all their steps together, preserving internal order,
// `repeatId`, and `repeatCount`).
//
// These are pure helpers: they take `segments` + an index/direction and return
// a NEW segments array (never mutate the input). `repeatId` is the source of
// truth — no DOM inspection, no new persistence.
// ---------------------------------------------------------------------------

export type ReorderDirection = 'up' | 'down';

/** A top-level reorderable unit: a standalone step or a whole repeat block. */
export interface TopLevelUnit {
  kind: 'step' | 'block';
  /** repeatId when kind === 'block'. */
  repeatId?: string;
  /** Flat-array [start, end] inclusive range this unit occupies. */
  start: number;
  end: number;
}

/**
 * Derive the ordered list of top-level units from the flat segments array.
 * Contiguous segments sharing a repeatId collapse into one 'block' unit.
 */
export function deriveTopLevelUnits(segments: PlanSegment[]): TopLevelUnit[] {
  const units: TopLevelUnit[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (!seg.repeatId) {
      units.push({ kind: 'step', start: i, end: i });
      i += 1;
      continue;
    }
    const repeatId = seg.repeatId;
    let j = i;
    while (j < segments.length && segments[j].repeatId === repeatId) j += 1;
    units.push({ kind: 'block', repeatId, start: i, end: j - 1 });
    i = j;
  }
  return units;
}

/** Find the index (in the derived units list) of the unit that owns a flat segment index. */
export function findTopLevelUnitIndex(segments: PlanSegment[], flatIndex: number): number {
  const units = deriveTopLevelUnits(segments);
  return units.findIndex((u) => flatIndex >= u.start && flatIndex <= u.end);
}

/**
 * Reorder the top-level unit that owns `flatIndex` up or down by one position,
 * swapping it with the ENTIRE neighbouring unit. Blocks move atomically.
 *
 * Returns a new segments array. If the move is a no-op (unit already at the
 * boundary, or invalid index), returns the original array unchanged.
 */
export function reorderTopLevelUnit(
  segments: PlanSegment[],
  flatIndex: number,
  direction: ReorderDirection,
): PlanSegment[] {
  const units = deriveTopLevelUnits(segments);
  const unitIdx = units.findIndex((u) => flatIndex >= u.start && flatIndex <= u.end);
  if (unitIdx === -1) return segments;

  const swapWith = direction === 'up' ? unitIdx - 1 : unitIdx + 1;
  if (swapWith < 0 || swapWith >= units.length) return segments;

  const a = units[Math.min(unitIdx, swapWith)];
  const b = units[Math.max(unitIdx, swapWith)];

  // Rebuild: everything before `a`, then `b`'s slice, then `a`'s slice, then
  // everything after `b`. This swaps the two adjacent units atomically while
  // preserving every segment's data, order-within-unit, repeatId and repeatCount.
  const before = segments.slice(0, a.start);
  const aSlice = segments.slice(a.start, a.end + 1);
  const bSlice = segments.slice(b.start, b.end + 1);
  const after = segments.slice(b.end + 1);
  return [...before, ...bSlice, ...aSlice, ...after];
}

/**
 * Reorder a single step WITHIN its own repeat block, up or down by one, without
 * escaping the block. Preserves `repeatId`/`repeatCount` and block contiguity.
 *
 * If the segment at `flatIndex` is not part of a block, or the move would cross
 * the block boundary (already first/last within the block), returns the
 * original array unchanged.
 */
export function reorderStepWithinBlock(
  segments: PlanSegment[],
  flatIndex: number,
  direction: ReorderDirection,
): PlanSegment[] {
  if (flatIndex < 0 || flatIndex >= segments.length) return segments;
  const repeatId = segments[flatIndex].repeatId;
  if (!repeatId) return segments;

  // Determine the block's contiguous flat range.
  let start = flatIndex;
  while (start - 1 >= 0 && segments[start - 1].repeatId === repeatId) start -= 1;
  let end = flatIndex;
  while (end + 1 < segments.length && segments[end + 1].repeatId === repeatId) end += 1;

  const target = direction === 'up' ? flatIndex - 1 : flatIndex + 1;
  // Clamp to within the block — a step may not escape via its own up/down.
  if (target < start || target > end) return segments;

  const next = [...segments];
  [next[flatIndex], next[target]] = [next[target], next[flatIndex]];
  return next;
}
