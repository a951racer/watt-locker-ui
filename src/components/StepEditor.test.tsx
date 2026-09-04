/**
 * PLAN-056 — StepEditor component tests.
 *
 * Covers the newly-required canonical capabilities (optional name, explicit
 * time|distance duration with mutual exclusion) and confirms existing intensity
 * editing behavior is preserved after extraction from PlanActivityPage.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StepEditor from './StepEditor';
import type { PlanSegment } from '../utils/tssCalculator';

function renderEditor(segment: PlanSegment, overrides: Partial<Parameters<typeof StepEditor>[0]> = {}) {
  const onUpdate = vi.fn();
  const props = {
    segment,
    index: 0,
    displayNumber: 1,
    totalCount: 1,
    expanded: true,
    resolvedFtp: 270,
    activityMetric: 'power_ftp' as const,
    onToggle: vi.fn(),
    onUpdate,
    onRemove: vi.fn(),
    onDuplicate: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    ...overrides,
  };
  render(<StepEditor {...props} />);
  return { onUpdate };
}

describe('StepEditor (PLAN-056)', () => {
  it('renders the expanded editor with the canonical fields', () => {
    renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    expect(screen.getByTestId('segment-0-name')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-type')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-duration-type')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-duration')).toBeInTheDocument();
    expect(screen.getByTestId('segment-0-metric')).toBeInTheDocument();
  });

  it('lets the user enter/edit an optional step name', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    fireEvent.change(screen.getByTestId('segment-0-name'), { target: { value: 'Sweet Spot' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sweet Spot' }));
  });

  it('a step with no name is valid (empty input)', () => {
    renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    const nameInput = screen.getByTestId('segment-0-name') as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('shows the time duration input for a time step and the distance input for a distance step', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    expect(screen.getByTestId('segment-0-duration')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-0-distance')).not.toBeInTheDocument();
    void onUpdate;

    renderEditor(
      { type: 'interval', durationType: 'distance', distanceMeters: 8047 },
      { index: 1 },
    );
    expect(screen.getByTestId('segment-1-distance')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-1-duration')).not.toBeInTheDocument();
  });

  it('switching time → distance clears the time value (mutual exclusion)', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    fireEvent.change(screen.getByTestId('segment-0-duration-type'), { target: { value: 'distance' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ durationType: 'distance', durationSeconds: undefined }),
    );
  });

  it('switching distance → time clears the distance value (mutual exclusion)', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 8047 });
    fireEvent.change(screen.getByTestId('segment-0-duration-type'), { target: { value: 'time' } });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ durationType: 'time', distanceMeters: undefined }),
    );
  });

  it('enters distance in miles and stores meters', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
    fireEvent.change(screen.getByTestId('segment-0-distance'), { target: { value: '1' } });
    // 1 mile → 1609 meters (rounded)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ distanceMeters: 1609 }));
  });

  it('preserves existing intensity editing (per-step metric override)', () => {
    const { onUpdate } = renderEditor({ type: 'interval', durationType: 'time', durationSeconds: 300 });
    fireEvent.change(screen.getByTestId('segment-0-metric'), { target: { value: 'power_watts' } });
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ intensityMetric: 'power_watts' }));
  });

  it('a legacy time step (no durationType) renders as a time step', () => {
    renderEditor({ type: 'interval', durationSeconds: 450 } as PlanSegment);
    const typeSelect = screen.getByTestId('segment-0-duration-type') as HTMLSelectElement;
    expect(typeSelect.value).toBe('time');
    expect(screen.getByTestId('segment-0-duration')).toBeInTheDocument();
  });

  // --- PLAN-060: decimal distance entry ---
  describe('PLAN-060 decimal distance entry', () => {
    it('accepts a two-decimal distance like 5.75 (miles → meters, decimals preserved)', () => {
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      const input = screen.getByTestId('segment-0-distance') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5.75' } });
      // The typed decimal is kept in the field (not snapped to a whole number).
      expect(input.value).toBe('5.75');
      // 5.75 mi × 1609.344 ≈ 9253.728 → 9254 m (decimals were NOT truncated).
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ distanceMeters: 9254 }));
    });

    it('accepts 5.50', () => {
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      const input = screen.getByTestId('segment-0-distance') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5.50' } });
      expect(input.value).toBe('5.50');
      // 5.5 mi × 1609.344 = 8851.392 → 8851 m
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ distanceMeters: 8851 }));
    });

    it('accepts a whole number 5', () => {
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      const input = screen.getByTestId('segment-0-distance') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5' } });
      expect(input.value).toBe('5');
      // 5 mi × 1609.344 = 8046.72 → 8047 m
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ distanceMeters: 8047 }));
    });

    it('keeps decimals through progressive typing (no snap-back to whole number)', () => {
      // Regression for the original bug: the controlled value re-derived from
      // stored meters used to reformat mid-edit (e.g. "5." → "5.00"), making a
      // decimal impossible to enter. With local text state, typing "5" then
      // "5.75" leaves the field showing the decimal value.
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      const input = screen.getByTestId('segment-0-distance') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.change(input, { target: { value: '5.75' } });
      expect(input.value).toBe('5.75'); // decimal preserved, not snapped to "5" / "5.00"
      // Last commit reflects the decimal miles → meters (9254), not 8047.
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0] as { distanceMeters?: number };
      expect(lastCall.distanceMeters).toBe(9254);
    });

    it('is configured for two-decimal precision (step=0.01, min=0, no negatives)', () => {
      renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      const input = screen.getByTestId('segment-0-distance') as HTMLInputElement;
      expect(input.getAttribute('step')).toBe('0.01');
      expect(input.getAttribute('min')).toBe('0');
      expect(input.getAttribute('type')).toBe('number');
    });

    it('does not commit a negative distance', () => {
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 0 });
      fireEvent.change(screen.getByTestId('segment-0-distance'), { target: { value: '-3' } });
      // No update with a negative meters value.
      const negativeCalls = onUpdate.mock.calls.filter(
        ([u]) => typeof (u as { distanceMeters?: number }).distanceMeters === 'number' && (u as { distanceMeters: number }).distanceMeters < 0,
      );
      expect(negativeCalls).toHaveLength(0);
    });

    it('switching distance → time still clears the distance value (invariant preserved)', () => {
      const { onUpdate } = renderEditor({ type: 'interval', durationType: 'distance', distanceMeters: 9254 });
      fireEvent.change(screen.getByTestId('segment-0-duration-type'), { target: { value: 'time' } });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ durationType: 'time', distanceMeters: undefined }),
      );
    });
  });
});
