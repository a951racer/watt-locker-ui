/**
 * PLAN-029G: TSS/IF Calculator Canary Tests
 * These tests verify the calculator correctly interprets power values
 * based on the effective intensity metric.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSegmentTss,
  calculateTotalTss,
  calculateIF,
  getSegmentAvgPowerWatts,
  calculateTotalDuration,
  tssFromIF,
  ifFromTSS,
  type PlanSegment,
} from './tssCalculator';

describe('TSS/IF Calculator', () => {
  describe('Canary 1 — 100% FTP for one hour', () => {
    const segment: PlanSegment = {
      type: 'interval',
      durationSeconds: 3600,
      powerMin: 100,
      powerMax: 100,
    };
    const ftp = 270;

    it('resolves average power to FTP watts', () => {
      const watts = getSegmentAvgPowerWatts(segment, ftp, 'power_ftp');
      expect(watts).toBe(270); // 100% of 270
    });

    it('produces TSS = 100', () => {
      const tss = calculateSegmentTss(segment, ftp, 'power_ftp');
      expect(Math.round(tss)).toBe(100);
    });

    it('produces IF = 1.00', () => {
      const ifVal = calculateIF([segment], ftp, 'power_ftp');
      expect(ifVal).toBeCloseTo(1.0, 2);
    });
  });

  describe('Canary 2 — 80% FTP for one hour', () => {
    const segment: PlanSegment = {
      type: 'interval',
      durationSeconds: 3600,
      powerMin: 80,
      powerMax: 80,
    };
    const ftp = 270;

    it('resolves average power to 216W', () => {
      const watts = getSegmentAvgPowerWatts(segment, ftp, 'power_ftp');
      expect(watts).toBeCloseTo(216, 0);
    });

    it('produces TSS = 64', () => {
      const tss = calculateSegmentTss(segment, ftp, 'power_ftp');
      expect(Math.round(tss)).toBe(64);
    });

    it('produces IF = 0.80', () => {
      const ifVal = calculateIF([segment], ftp, 'power_ftp');
      expect(ifVal).toBeCloseTo(0.80, 2);
    });
  });

  describe('Canary 3 — 200W for one hour (power_watts)', () => {
    const segment: PlanSegment = {
      type: 'interval',
      durationSeconds: 3600,
      powerMin: 200,
      powerMax: 200,
    };
    const ftp = 250;

    it('resolves average power to 200W directly', () => {
      const watts = getSegmentAvgPowerWatts(segment, ftp, 'power_watts');
      expect(watts).toBe(200);
    });

    it('produces TSS = 64', () => {
      const tss = calculateSegmentTss(segment, ftp, 'power_watts');
      expect(Math.round(tss)).toBe(64);
    });

    it('produces IF = 0.80', () => {
      const ifVal = calculateIF([segment], ftp, 'power_watts');
      expect(ifVal).toBeCloseTo(0.80, 2);
    });
  });

  describe('Canary 4 — power_ftp and power_watts equivalence', () => {
    const ftp = 270;

    const segmentA: PlanSegment = {
      type: 'interval',
      durationSeconds: 3600,
      powerMin: 80,
      powerMax: 80,
    };

    const segmentB: PlanSegment = {
      type: 'interval',
      durationSeconds: 3600,
      powerMin: 216,
      powerMax: 216,
    };

    it('produces the same TSS', () => {
      const tssA = calculateSegmentTss(segmentA, ftp, 'power_ftp');
      const tssB = calculateSegmentTss(segmentB, ftp, 'power_watts');
      expect(Math.round(tssA)).toBe(Math.round(tssB));
    });

    it('produces the same IF', () => {
      const ifA = calculateIF([segmentA], ftp, 'power_ftp');
      const ifB = calculateIF([segmentB], ftp, 'power_watts');
      expect(ifA).toBeCloseTo(ifB!, 2);
    });
  });

  describe('Segment-level metric override', () => {
    const ftp = 250;

    it('uses segment override instead of activity metric', () => {
      const segment: PlanSegment = {
        type: 'interval',
        durationSeconds: 3600,
        powerMin: 200,
        powerMax: 200,
        intensityMetric: 'power_watts', // override: literal watts
      };
      // Activity metric is power_ftp, but segment overrides to power_watts
      const watts = getSegmentAvgPowerWatts(segment, ftp, 'power_ftp');
      expect(watts).toBe(200); // NOT 500 (which would be 200% of 250)
    });

    it('segment without override inherits activity metric', () => {
      const segment: PlanSegment = {
        type: 'interval',
        durationSeconds: 3600,
        powerMin: 80,
        powerMax: 80,
        // No intensityMetric override
      };
      const watts = getSegmentAvgPowerWatts(segment, ftp, 'power_ftp');
      expect(watts).toBe(200); // 80% of 250
    });
  });

  describe('HR-based segments produce no power TSS', () => {
    const ftp = 270;

    it('hr_threshold segment returns 0 watts', () => {
      const segment: PlanSegment = {
        type: 'steady',
        durationSeconds: 3600,
        hrMin: 75,
        hrMax: 85,
        intensityMetric: 'hr_threshold',
      };
      expect(getSegmentAvgPowerWatts(segment, ftp, 'power_ftp')).toBe(0);
    });

    it('hr_max segment returns 0 watts', () => {
      const segment: PlanSegment = {
        type: 'steady',
        durationSeconds: 3600,
        hrMin: 70,
        hrMax: 80,
        intensityMetric: 'hr_max',
      };
      expect(getSegmentAvgPowerWatts(segment, ftp, 'power_ftp')).toBe(0);
    });

    it('HR-only workout produces null TSS', () => {
      const segments: PlanSegment[] = [
        { type: 'steady', durationSeconds: 3600, hrMin: 75, hrMax: 85, intensityMetric: 'hr_threshold' },
      ];
      const tss = calculateTotalTss(segments, ftp, 'hr_threshold');
      expect(tss).toBe(0); // all segments are HR → 0 contribution
    });
  });

  describe('Mixed segments', () => {
    const ftp = 250;

    it('correctly calculates TSS from mixed power_ftp and power_watts', () => {
      const segments: PlanSegment[] = [
        { type: 'warmup', durationSeconds: 600, powerMin: 50, powerMax: 50 }, // 50% FTP = 125W
        { type: 'interval', durationSeconds: 1200, powerMin: 200, powerMax: 200, intensityMetric: 'power_watts' }, // 200W
        { type: 'recovery', durationSeconds: 600, powerMin: 40, powerMax: 40 }, // 40% FTP = 100W
      ];

      const tss = calculateTotalTss(segments, ftp, 'power_ftp');
      expect(tss).not.toBeNull();

      // Warmup: (600 * (125/250)^2) / 3600 * 100 = (600 * 0.25) / 3600 * 100 = 4.17
      // Interval: (1200 * (200/250)^2) / 3600 * 100 = (1200 * 0.64) / 3600 * 100 = 21.33
      // Recovery: (600 * (100/250)^2) / 3600 * 100 = (600 * 0.16) / 3600 * 100 = 2.67
      // Total ≈ 28.17
      expect(Math.round(tss!)).toBe(28);
    });
  });

  describe('tssFromIF and ifFromTSS helpers', () => {
    it('tssFromIF: 1 hour, IF 1.0 → TSS 100', () => {
      expect(tssFromIF(1.0, 3600)).toBeCloseTo(100, 0);
    });

    it('tssFromIF: 1 hour, IF 0.8 → TSS 64', () => {
      expect(tssFromIF(0.8, 3600)).toBeCloseTo(64, 0);
    });

    it('ifFromTSS: 1 hour, TSS 100 → IF 1.0', () => {
      expect(ifFromTSS(100, 3600)).toBeCloseTo(1.0, 2);
    });

    it('ifFromTSS: 1 hour, TSS 64 → IF 0.8', () => {
      expect(ifFromTSS(64, 3600)).toBeCloseTo(0.8, 2);
    });
  });

  describe('Duration calculation', () => {
    it('sums segment durations', () => {
      const segments: PlanSegment[] = [
        { type: 'warmup', durationSeconds: 600 },
        { type: 'interval', durationSeconds: 1200 },
        { type: 'cooldown', durationSeconds: 600 },
      ];
      expect(calculateTotalDuration(segments)).toBe(2400);
    });
  });
});
