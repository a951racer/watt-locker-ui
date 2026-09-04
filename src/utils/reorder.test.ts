/**
 * PLAN-061: Atomic step / repeat-block reordering helper tests.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveTopLevelUnits,
  reorderTopLevelUnit,
  reorderStepWithinBlock,
  buildRenderRows,
  type PlanSegment,
} from './tssCalculator';

// Build a standalone step.
function step(name: string): PlanSegment {
  return { name, type: 'interval', durationType: 'time', durationSeconds: 300 };
}
// Build a block's steps (shared repeatId + repeatCount).
function block(repeatId: string, count: number, names: string[]): PlanSegment[] {
  return names.map((name) => ({ name, type: 'interval', durationType: 'time', durationSeconds: 300, repeatId, repeatCount: count }));
}

const names = (segs: PlanSegment[]) => segs.map((s) => s.name);

describe('deriveTopLevelUnits', () => {
  it('collapses contiguous same-repeatId segments into one block unit', () => {
    const segs = [step('A'), ...block('x', 3, ['X1', 'X2']), step('B'), ...block('y', 2, ['Y1', 'Y2'])];
    const units = deriveTopLevelUnits(segs);
    expect(units.map((u) => u.kind)).toEqual(['step', 'block', 'step', 'block']);
    expect(units[1]).toMatchObject({ kind: 'block', repeatId: 'x', start: 1, end: 2 });
    expect(units[3]).toMatchObject({ kind: 'block', repeatId: 'y', start: 4, end: 5 });
  });

  it('handles only standalone steps, only one block, and one-step blocks', () => {
    expect(deriveTopLevelUnits([step('A'), step('B')]).map((u) => u.kind)).toEqual(['step', 'step']);
    expect(deriveTopLevelUnits(block('x', 2, ['X1', 'X2'])).map((u) => u.kind)).toEqual(['block']);
    expect(deriveTopLevelUnits(block('x', 2, ['X1'])).map((u) => u.kind)).toEqual(['block']);
  });
});

describe('reorderTopLevelUnit — Step ↔ Block', () => {
  it('moves a standalone Step above a multi-step Block', () => {
    const segs = [...block('x', 3, ['X1', 'X2']), step('A')];
    const out = reorderTopLevelUnit(segs, 2, 'up'); // A is at flat index 2
    expect(names(out)).toEqual(['A', 'X1', 'X2']);
  });

  it('moves a standalone Step below a multi-step Block', () => {
    const segs = [step('A'), ...block('x', 3, ['X1', 'X2'])];
    const out = reorderTopLevelUnit(segs, 0, 'down'); // A at index 0
    expect(names(out)).toEqual(['X1', 'X2', 'A']);
  });

  it('moves a Block above a standalone Step', () => {
    const segs = [step('A'), ...block('x', 3, ['X1', 'X2'])];
    const out = reorderTopLevelUnit(segs, 1, 'up'); // any block member
    expect(names(out)).toEqual(['X1', 'X2', 'A']);
  });

  it('moves a Block below a standalone Step', () => {
    const segs = [...block('x', 3, ['X1', 'X2']), step('A')];
    const out = reorderTopLevelUnit(segs, 0, 'down');
    expect(names(out)).toEqual(['A', 'X1', 'X2']);
  });

  it('moves a one-step Block atomically', () => {
    const segs = [step('A'), ...block('x', 4, ['X1'])];
    const out = reorderTopLevelUnit(segs, 1, 'up');
    expect(names(out)).toEqual(['X1', 'A']);
    expect(out[0].repeatId).toBe('x');
    expect(out[0].repeatCount).toBe(4);
  });

  it('swaps two adjacent Blocks atomically', () => {
    const segs = [...block('x', 2, ['X1', 'X2']), ...block('y', 3, ['Y1', 'Y2'])];
    const out = reorderTopLevelUnit(segs, 0, 'down'); // move block x down
    expect(names(out)).toEqual(['Y1', 'Y2', 'X1', 'X2']);
    // repeatIds preserved and not merged.
    expect(out.slice(0, 2).every((s) => s.repeatId === 'y')).toBe(true);
    expect(out.slice(2).every((s) => s.repeatId === 'x')).toBe(true);
  });

  it('moves a middle unit without disturbing surrounding units', () => {
    const segs = [step('A'), step('B'), ...block('x', 2, ['X1', 'X2'])];
    const out = reorderTopLevelUnit(segs, 1, 'down'); // B (middle) down, swaps with block
    expect(names(out)).toEqual(['A', 'X1', 'X2', 'B']);
  });

  it('is a no-op at boundaries', () => {
    const segs = [step('A'), ...block('x', 2, ['X1', 'X2'])];
    expect(reorderTopLevelUnit(segs, 0, 'up')).toBe(segs); // first unit up
    expect(reorderTopLevelUnit(segs, 1, 'down')).toBe(segs); // last unit down
  });

  describe('block integrity after top-level reorder', () => {
    it('preserves contiguity, order, repeatId, repeatCount and loses/dups nothing', () => {
      const segs = [step('A'), ...block('x', 5, ['X1', 'X2', 'X3']), step('B')];
      const out = reorderTopLevelUnit(segs, 0, 'down'); // A down past the block
      // A moved below the whole block; block intact.
      expect(names(out)).toEqual(['X1', 'X2', 'X3', 'A', 'B']);
      const blockSegs = out.filter((s) => s.repeatId === 'x');
      expect(names(blockSegs)).toEqual(['X1', 'X2', 'X3']); // order preserved, contiguous
      expect(out.findIndex((s) => s.repeatId === 'x')).toBe(0);
      expect(out.filter((s) => s.repeatId === 'x')).toHaveLength(3); // no loss/dup
      expect(blockSegs.every((s) => s.repeatCount === 5)).toBe(true);
      expect(out).toHaveLength(segs.length); // total count unchanged
    });
  });
});

describe('reorderStepWithinBlock', () => {
  it('reorders a step within its own block, preserving repeatId', () => {
    const segs = block('x', 3, ['X1', 'X2', 'X3']);
    const out = reorderStepWithinBlock(segs, 2, 'up'); // X3 up
    expect(names(out)).toEqual(['X1', 'X3', 'X2']);
    expect(out.every((s) => s.repeatId === 'x')).toBe(true);
  });

  it('cannot escape the block via up on the first block step', () => {
    const segs = [step('A'), ...block('x', 2, ['X1', 'X2'])];
    const out = reorderStepWithinBlock(segs, 1, 'up'); // X1 is first in block
    expect(out).toBe(segs); // no-op — does not swap with the standalone step
  });

  it('cannot escape the block via down on the last block step', () => {
    const segs = [...block('x', 2, ['X1', 'X2']), step('A')];
    const out = reorderStepWithinBlock(segs, 1, 'down'); // X2 is last in block
    expect(out).toBe(segs); // no-op
  });

  it('is a no-op for a standalone (non-block) step', () => {
    const segs = [step('A'), step('B')];
    expect(reorderStepWithinBlock(segs, 0, 'down')).toBe(segs);
  });

  it('keeps the block contiguous', () => {
    const segs = [step('A'), ...block('x', 2, ['X1', 'X2', 'X3']), step('B')];
    const out = reorderStepWithinBlock(segs, 2, 'down'); // X2 down within block
    const ids = out.map((s) => s.repeatId);
    // The three block members remain contiguous.
    const first = ids.indexOf('x');
    expect(ids.slice(first, first + 3).every((id) => id === 'x')).toBe(true);
  });
});

describe('numbering (buildRenderRows) after reorder', () => {
  it('recomputes 1-based flat numbers correctly', () => {
    const segs = [...block('x', 3, ['X1', 'X2']), step('A')];
    const out = reorderTopLevelUnit(segs, 2, 'up'); // A to top
    const rows = buildRenderRows(out);
    // Row 0 = standalone A at flatIndex 0 (display #1); row 1 = block children at 1,2.
    expect(rows[0]).toMatchObject({ kind: 'single' });
    expect((rows[0] as { child: { flatIndex: number } }).child.flatIndex).toBe(0);
    expect(rows[1]).toMatchObject({ kind: 'repeat' });
    const blockRow = rows[1] as { children: { flatIndex: number }[] };
    expect(blockRow.children.map((c) => c.flatIndex)).toEqual([1, 2]);
  });
});

describe('PLAN-061 reported regression', () => {
  it('moving a standalone step up then down repeatedly never splits the block or duplicates steps', () => {
    // Initial: Block[5k TT, Recover] then standalone Warm Up.
    let segs: PlanSegment[] = [...block('r', 3, ['5k TT', 'Recover']), step('Warm Up')];

    const assertIntact = (s: PlanSegment[]) => {
      // Exactly one of each named step.
      expect(s.filter((x) => x.name === '5k TT')).toHaveLength(1);
      expect(s.filter((x) => x.name === 'Recover')).toHaveLength(1);
      expect(s.filter((x) => x.name === 'Warm Up')).toHaveLength(1);
      // Exactly one intact, contiguous block (all 'r').
      const rIdx = s.map((x, i) => (x.repeatId === 'r' ? i : -1)).filter((i) => i >= 0);
      expect(rIdx).toHaveLength(2);
      expect(rIdx[1] - rIdx[0]).toBe(1); // contiguous
      expect(s.filter((x) => x.name === '5k TT')[0].repeatId).toBe('r');
      expect(s).toHaveLength(3);
    };

    for (let i = 0; i < 5; i++) {
      // Move Warm Up UP (it's the last unit -> top-level swap with block).
      const wuUp = segs.findIndex((x) => x.name === 'Warm Up');
      segs = reorderTopLevelUnit(segs, wuUp, 'up');
      expect(names(segs)).toEqual(['Warm Up', '5k TT', 'Recover']);
      assertIntact(segs);

      // Move Warm Up DOWN (back below the block).
      const wuDown = segs.findIndex((x) => x.name === 'Warm Up');
      segs = reorderTopLevelUnit(segs, wuDown, 'down');
      expect(names(segs)).toEqual(['5k TT', 'Recover', 'Warm Up']);
      assertIntact(segs);
    }
  });
});
