/**
 * RepeatBlockEditor — reusable renderer/editor for the ordered list of canonical
 * Activity Steps, including PLAN-046 repeat blocks and the "group into repeat"
 * controls.
 *
 * PLAN-056: Extracted verbatim from PlanActivityPage's inline segment-list JSX
 * so it can be reused by the Activity Planner and (in later PLAN tasks) the
 * Block Template editor. It operates on the CANONICAL flat `PlanSegment[]`
 * model — a "block" is a contiguous run sharing a repeatId (blocks cannot
 * nest). All step editing is delegated to the shared StepEditor. No
 * template-specific block model is introduced.
 *
 * State and mutation logic remain in the parent (PlanActivityPage); this
 * component is presentational and receives handlers as props, so existing
 * behavior and data-testids are unchanged.
 */
import StepEditor from './StepEditor';
import {
  buildRenderRows,
  SEGMENT_TYPES,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  type PlanSegment,
  type IntensityMetric,
} from '../utils/tssCalculator';

export interface RepeatBlockEditorProps {
  segments: PlanSegment[];
  expandedStep: number | null;
  resolvedFtp: number | null;
  intensityMetric: IntensityMetric;
  // Add-step menu (parent owns open/close state to preserve behavior)
  showAddMenu: boolean;
  onToggleAddMenu: () => void;
  onAddSegment: (type: PlanSegment['type']) => void;
  // Per-step handlers (keyed by flat index)
  onToggleStep: (flatIndex: number) => void;
  onUpdateSegment: (flatIndex: number, updates: Partial<PlanSegment>) => void;
  onRemoveSegment: (flatIndex: number) => void;
  onDuplicateSegment: (flatIndex: number) => void;
  onMoveSegmentUp: (flatIndex: number) => void;
  onMoveSegmentDown: (flatIndex: number) => void;
  // Repeat-block handlers
  onUpdateRepeatCount: (repeatId: string, count: number) => void;
  onAddSegmentToBlock: (repeatId: string, count: number) => void;
  // PLAN-061: move an entire block as one top-level unit (any member flatIndex).
  onMoveBlockUp: (anyMemberIndex: number) => void;
  onMoveBlockDown: (anyMemberIndex: number) => void;
  // Repeat controls (group a contiguous range into a block)
  repeatStart: string;
  repeatEnd: string;
  repeatCount: string;
  onRepeatStartChange: (v: string) => void;
  onRepeatEndChange: (v: string) => void;
  onRepeatCountChange: (v: string) => void;
  onGroupIntoRepeat: () => void;
}

export default function RepeatBlockEditor({
  segments,
  expandedStep,
  resolvedFtp,
  intensityMetric,
  showAddMenu,
  onToggleAddMenu,
  onAddSegment,
  onToggleStep,
  onUpdateSegment,
  onRemoveSegment,
  onDuplicateSegment,
  onMoveSegmentUp,
  onMoveSegmentDown,
  onUpdateRepeatCount,
  onAddSegmentToBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  repeatStart,
  repeatEnd,
  repeatCount,
  onRepeatStartChange,
  onRepeatEndChange,
  onRepeatCountChange,
  onGroupIntoRepeat,
}: RepeatBlockEditorProps) {
  const rows = buildRenderRows(segments);

  const renderStep = (segment: PlanSegment, flatIndex: number) => (
    <StepEditor
      key={flatIndex}
      segment={segment}
      index={flatIndex}
      displayNumber={flatIndex + 1}
      totalCount={segments.length}
      expanded={expandedStep === flatIndex}
      resolvedFtp={resolvedFtp}
      activityMetric={intensityMetric}
      onToggle={() => onToggleStep(flatIndex)}
      onUpdate={(updates) => onUpdateSegment(flatIndex, updates)}
      onRemove={() => onRemoveSegment(flatIndex)}
      onDuplicate={() => onDuplicateSegment(flatIndex)}
      onMoveUp={() => onMoveSegmentUp(flatIndex)}
      onMoveDown={() => onMoveSegmentDown(flatIndex)}
    />
  );

  return (
    <section className="bg-charcoalGray rounded-lg p-5 space-y-3" data-testid="segment-builder-section">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-pureWhite">Workout Steps</h2>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleAddMenu}
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
                  onClick={() => onAddSegment(t)}
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
        {rows.map((row, rowIdx) => {
          if (row.kind === 'single') {
            return renderStep(row.child.segment, row.child.flatIndex);
          }
          // Repeat block — visually distinct container; children keep their true
          // global step number (flatIndex + 1). PLAN-061: the block is one
          // top-level unit and moves atomically via its own up/down controls;
          // rowIdx is the unit position among all top-level units.
          const firstChildIndex = row.children[0].flatIndex;
          const isFirstUnit = rowIdx === 0;
          const isLastUnit = rowIdx === rows.length - 1;
          return (
            <div
              key={`block-${row.repeatId}`}
              className="border-2 border-brightCyan rounded-lg p-3 space-y-2"
              data-testid={`repeat-block-${row.repeatId}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-medium text-brightCyan">
                  <span>Repeat</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.count}
                    onChange={(e) => onUpdateRepeatCount(row.repeatId, parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-2 py-0.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm text-center"
                    data-testid={`repeat-block-count-${row.repeatId}`}
                  />
                  <span>times</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* PLAN-061: move the whole block as one top-level unit */}
                  <button
                    type="button"
                    onClick={() => onMoveBlockUp(firstChildIndex)}
                    disabled={isFirstUnit}
                    className="px-1.5 py-0.5 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan disabled:opacity-30"
                    data-testid={`repeat-block-move-up-${row.repeatId}`}
                    aria-label="Move block up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveBlockDown(firstChildIndex)}
                    disabled={isLastUnit}
                    className="px-1.5 py-0.5 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan disabled:opacity-30"
                    data-testid={`repeat-block-move-down-${row.repeatId}`}
                    aria-label="Move block down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddSegmentToBlock(row.repeatId, row.count)}
                    className="px-2 py-1 text-xs rounded bg-steelBlue text-pureWhite hover:bg-brightCyan"
                    data-testid={`repeat-block-add-${row.repeatId}`}
                  >
                    + Add to Block
                  </button>
                </div>
              </div>
              {row.children.map((child) => renderStep(child.segment, child.flatIndex))}
            </div>
          );
        })}
      </div>

      {/* Repeat controls */}
      {segments.length >= 2 && (
        <div className="flex items-end gap-2 bg-deepNavy rounded p-3 border border-steelBlue mt-3" data-testid="repeat-controls">
          <div>
            <label className="block text-xs text-softFog mb-0.5">Start step</label>
            <input
              type="number"
              min="1"
              max={segments.length}
              value={repeatStart}
              onChange={(e) => onRepeatStartChange(e.target.value)}
              className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid="repeat-start-input"
            />
          </div>
          <div>
            <label className="block text-xs text-softFog mb-0.5">End step</label>
            <input
              type="number"
              min="1"
              max={segments.length}
              value={repeatEnd}
              onChange={(e) => onRepeatEndChange(e.target.value)}
              className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid="repeat-end-input"
            />
          </div>
          <div>
            <label className="block text-xs text-softFog mb-0.5">× Count</label>
            <input
              type="number"
              min="1"
              step="1"
              value={repeatCount}
              onChange={(e) => onRepeatCountChange(e.target.value)}
              className="w-16 px-2 py-1.5 rounded bg-midnightBlue text-lightSilver border border-steelBlue text-sm"
              data-testid="repeat-count-input"
            />
          </div>
          <button
            type="button"
            onClick={onGroupIntoRepeat}
            className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm"
            data-testid="repeat-btn"
          >
            Group into Repeat
          </button>
        </div>
      )}
    </section>
  );
}
