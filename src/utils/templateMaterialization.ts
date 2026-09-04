/**
 * PLAN-059: Template materialization helpers.
 *
 * Pure, domain-oriented functions that turn a Step Template / Block Template
 * into ordinary canonical activity data (`PlanSegment[]`). They perform:
 *   - a deep copy by value (no shared object references with the template),
 *   - normalization of the canonical duration invariant,
 *   - repeat-block metadata handling per template kind.
 *
 * They do NOT persist anything, add any template reference/provenance
 * (`stepTemplateId`, `blockTemplateId`, etc.), or touch the UI. The output is
 * indistinguishable from hand-built activity segments — which is exactly what a
 * future Garmin adapter expects.
 *
 * Templates are blueprints: after materialization the produced segments are
 * fully independent of their source template.
 */
import {
  normalizeSegmentDuration,
  generateRepeatId,
  type PlanSegment,
} from './tssCalculator';

/** Shape of a Step Template's canonical step (from api/stepTemplates). */
interface StepTemplateLike {
  step: PlanSegment;
}

/** Shape of a Block Template (from api/blockTemplates). */
interface BlockTemplateLike {
  repeatCount: number;
  steps: PlanSegment[];
}

/** Deep copy a segment by value so later edits cannot mutate template state. */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Materialize a Step Template into ONE standalone canonical activity step.
 *
 * - Deep-copies the template's step (independent of the template).
 * - Strips any repeat-block metadata (`repeatId`/`repeatCount`) so a Step
 *   Template can never accidentally become a repeat block.
 * - Normalizes the duration invariant (exactly one of time/distance).
 * - Adds NO template reference.
 */
export function materializeStepTemplate(template: StepTemplateLike): PlanSegment {
  const copy = deepCopy(template.step);
  // A standalone step must not carry repeat-block grouping metadata.
  delete copy.repeatId;
  delete copy.repeatCount;
  return normalizeSegmentDuration(copy);
}

/**
 * Materialize a Block Template into an ordered run of canonical activity steps
 * forming ONE repeat block.
 *
 * - Deep-copies every step by value, preserving order.
 * - Assigns a SINGLE fresh `repeatId` shared by all steps in this block (so it
 *   renders/expands as one repeat group and never merges with or inherits
 *   another block's id).
 * - Sets each step's `repeatCount` to the template's default (independently
 *   editable afterwards).
 * - Normalizes each step's duration invariant.
 * - Adds NO template reference.
 *
 * The returned segments are ready to append/splice into an activity's flat
 * `segments` array (PLAN-046 "Option B" contiguous repeat run).
 */
export function materializeBlockTemplate(template: BlockTemplateLike): PlanSegment[] {
  const repeatId = generateRepeatId();
  const rawCount = template.repeatCount;
  const repeatCount =
    Number.isFinite(rawCount) && rawCount >= 1 ? Math.floor(rawCount) : 1;

  return template.steps.map((step) => {
    const copy = normalizeSegmentDuration(deepCopy(step));
    return { ...copy, repeatId, repeatCount };
  });
}
