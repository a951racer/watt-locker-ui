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
  expandSegments,
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
      expect(tss).toBeNull(); // all segments are HR → no power basis → null
    });
  });

  describe('Mixed segments', () => {
    const ftp = 250;

    it('correctly calculates TSS from mixed power_ftp and power_watts using normalized intensity', () => {
      const segments: PlanSegment[] = [
        { type: 'warmup', durationSeconds: 600, powerMin: 50, powerMax: 50 }, // 50% FTP = 125W
        { type: 'interval', durationSeconds: 1200, powerMin: 200, powerMax: 200, intensityMetric: 'power_watts' }, // 200W
        { type: 'recovery', durationSeconds: 600, powerMin: 40, powerMax: 40 }, // 40% FTP = 100W
      ];

      const tss = calculateTotalTss(segments, ftp, 'power_ftp');
      expect(tss).not.toBeNull();

      // 4th-power normalized intensity:
      // NP = (600×125⁴ + 1200×200⁴ + 600×100⁴) / 2400)^0.25
      //    = (2,126,484,375,000 / 2400)^0.25 ≈ 172.5W
      // IF = 172.5 / 250 = 0.69
      // TSS = (2400/3600) × 0.69² × 100 ≈ 31.7
      expect(Math.round(tss!)).toBe(32);
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

  describe('PLAN-043: Variable-intensity normalized IF/TSS (Aug 25 workout)', () => {
    // Exact replica of the Aug 25 "Z4 Follies" / "TT Intervals" structured workout
    const ftp = 270;
    const segments: PlanSegment[] = [
      { type: 'warmup', durationSeconds: 600, powerMin: 30, powerMax: 50 },     // 40% → 108W
      { type: 'steady', durationSeconds: 1080, powerMin: 56, powerMax: 76 },     // 66% → 178.2W
      { type: 'interval', durationSeconds: 180, powerMin: 91, powerMax: 106 },   // 98.5% → 265.95W
      { type: 'recovery', durationSeconds: 300, powerMin: 56, powerMax: 76 },    // 66% → 178.2W
      { type: 'interval', durationSeconds: 180, powerMin: 91, powerMax: 106 },   // 98.5% → 265.95W
      { type: 'recovery', durationSeconds: 300, powerMin: 56, powerMax: 76 },    // 66% → 178.2W
      { type: 'interval', durationSeconds: 180, powerMin: 91, powerMax: 106 },   // 98.5% → 265.95W
      { type: 'recovery', durationSeconds: 300, powerMin: 56, powerMax: 76 },    // 66% → 178.2W
      { type: 'interval', durationSeconds: 180, powerMin: 91, powerMax: 106 },   // 98.5% → 265.95W
      { type: 'recovery', durationSeconds: 300, powerMin: 56, powerMax: 76 },    // 66% → 178.2W
      { type: 'steady', durationSeconds: 1200, powerMin: 56, powerMax: 76 },     // 66% → 178.2W
      { type: 'cooldown', durationSeconds: 600, powerMin: 35, powerMax: 50 },    // 42.5% → 114.75W
    ];

    it('produces IF ≈ 0.71 using 4th-power normalized intensity', () => {
      const ifVal = calculateIF(segments, ftp, 'power_ftp');
      expect(ifVal).not.toBeNull();
      expect(ifVal!).toBeCloseTo(0.71, 2);
    });

    it('produces TSS ≈ 76 derived from normalized IF', () => {
      const tss = calculateTotalTss(segments, ftp, 'power_ftp');
      expect(tss).not.toBeNull();
      expect(Math.round(tss!)).toBe(76);
    });

    it('total duration is 5400 seconds', () => {
      expect(calculateTotalDuration(segments)).toBe(5400);
    });
  });

  describe('PLAN-043: Constant-power workout (normalized = linear)', () => {
    it('60 minutes @ 80% FTP → IF 0.80, TSS 64', () => {
      const ftp = 270;
      const segments: PlanSegment[] = [
        { type: 'steady', durationSeconds: 3600, powerMin: 80, powerMax: 80 },
      ];
      const ifVal = calculateIF(segments, ftp, 'power_ftp');
      expect(ifVal).toBeCloseTo(0.80, 2);
      const tss = calculateTotalTss(segments, ftp, 'power_ftp');
      expect(Math.round(tss!)).toBe(64);
    });
  });
});

describe('PLAN-046: Repeat-block expansion (expandSegments)', () => {
  it('expands a 2-segment block with repeatCount=4 into 8 segments', () => {
    const segments: PlanSegment[] = [
      { type: 'interval', durationSeconds: 360, powerMin: 90, powerMax: 90, repeatId: 'r1', repeatCount: 4 },
      { type: 'recovery', durationSeconds: 180, powerMin: 50, powerMax: 50, repeatId: 'r1', repeatCount: 4 },
    ];
    const expanded = expandSegments(segments);
    expect(expanded).toHaveLength(8);
    // Alternating hard/easy pattern preserved
    expect(expanded[0].type).toBe('interval');
    expect(expanded[1].type).toBe('recovery');
    expect(expanded[6].type).toBe('interval');
    expect(expanded[7].type).toBe('recovery');
    // Repeat metadata stripped from expanded copies
    expanded.forEach((seg) => {
      expect(seg.repeatId).toBeUndefined();
      expect(seg.repeatCount).toBeUndefined();
    });
  });

  it('passes through non-repeat segments once', () => {
    const segments: PlanSegment[] = [
      { type: 'warmup', durationSeconds: 600 },
      { type: 'cooldown', durationSeconds: 300 },
    ];
    const expanded = expandSegments(segments);
    expect(expanded).toHaveLength(2);
    expect(expanded[0].type).toBe('warmup');
    expect(expanded[1].type).toBe('cooldown');
  });

  it('uses the first child repeatCount as authoritative', () => {
    const segments: PlanSegment[] = [
      { type: 'interval', durationSeconds: 60, repeatId: 'r1', repeatCount: 3 },
      // Second child carries a stale count — should be ignored
      { type: 'recovery', durationSeconds: 60, repeatId: 'r1', repeatCount: 99 },
    ];
    const expanded = expandSegments(segments);
    expect(expanded).toHaveLength(6); // 2 * 3
  });

  it('treats repeatCount=1 as executing the block once', () => {
    const segments: PlanSegment[] = [
      { type: 'interval', durationSeconds: 60, repeatId: 'r1', repeatCount: 1 },
      { type: 'recovery', durationSeconds: 60, repeatId: 'r1', repeatCount: 1 },
    ];
    const expanded = expandSegments(segments);
    expect(expanded).toHaveLength(2);
  });

  it('handles two distinct contiguous repeat blocks and interleaved singles', () => {
    const segments: PlanSegment[] = [
      { type: 'warmup', durationSeconds: 600 },
      { type: 'interval', durationSeconds: 60, repeatId: 'a', repeatCount: 2 },
      { type: 'recovery', durationSeconds: 60, repeatId: 'a', repeatCount: 2 },
      { type: 'steady', durationSeconds: 120 },
      { type: 'interval', durationSeconds: 30, repeatId: 'b', repeatCount: 3 },
      { type: 'cooldown', durationSeconds: 300 },
    ];
    const expanded = expandSegments(segments);
    // 1 warmup + (2*2 block a) + 1 steady + (1*3 block b) + 1 cooldown = 1+4+1+3+1 = 10
    expect(expanded).toHaveLength(10);
  });

  describe('Duration of a repeated block', () => {
    it('{Hard 6:00, Easy 3:00} repeated 4x + others equals 4*(360+180) plus others', () => {
      const segments: PlanSegment[] = [
        { type: 'warmup', durationSeconds: 600 },
        { type: 'interval', durationSeconds: 360, powerMin: 90, powerMax: 90, repeatId: 'r1', repeatCount: 4 },
        { type: 'recovery', durationSeconds: 180, powerMin: 50, powerMax: 50, repeatId: 'r1', repeatCount: 4 },
        { type: 'cooldown', durationSeconds: 300 },
      ];
      const expected = 4 * (360 + 180) + 600 + 300;
      expect(calculateTotalDuration(segments)).toBe(expected);
    });
  });

  describe('IF/TSS for expanded repeat sequence equals manually-flattened equivalent', () => {
    const ftp = 270;

    const withRepeat: PlanSegment[] = [
      { type: 'warmup', durationSeconds: 600, powerMin: 40, powerMax: 40 },
      { type: 'interval', durationSeconds: 180, powerMin: 98, powerMax: 98, repeatId: 'r1', repeatCount: 4 },
      { type: 'recovery', durationSeconds: 300, powerMin: 55, powerMax: 55, repeatId: 'r1', repeatCount: 4 },
      { type: 'cooldown', durationSeconds: 600, powerMin: 40, powerMax: 40 },
    ];

    const manuallyFlattened: PlanSegment[] = [
      { type: 'warmup', durationSeconds: 600, powerMin: 40, powerMax: 40 },
      { type: 'interval', durationSeconds: 180, powerMin: 98, powerMax: 98 },
      { type: 'recovery', durationSeconds: 300, powerMin: 55, powerMax: 55 },
      { type: 'interval', durationSeconds: 180, powerMin: 98, powerMax: 98 },
      { type: 'recovery', durationSeconds: 300, powerMin: 55, powerMax: 55 },
      { type: 'interval', durationSeconds: 180, powerMin: 98, powerMax: 98 },
      { type: 'recovery', durationSeconds: 300, powerMin: 55, powerMax: 55 },
      { type: 'interval', durationSeconds: 180, powerMin: 98, powerMax: 98 },
      { type: 'recovery', durationSeconds: 300, powerMin: 55, powerMax: 55 },
      { type: 'cooldown', durationSeconds: 600, powerMin: 40, powerMax: 40 },
    ];

    it('produces identical duration', () => {
      expect(calculateTotalDuration(withRepeat)).toBe(calculateTotalDuration(manuallyFlattened));
    });

    it('produces identical IF', () => {
      const ifRepeat = calculateIF(withRepeat, ftp, 'power_ftp');
      const ifFlat = calculateIF(manuallyFlattened, ftp, 'power_ftp');
      expect(ifRepeat).not.toBeNull();
      expect(ifRepeat!).toBeCloseTo(ifFlat!, 6);
    });

    it('produces identical TSS', () => {
      const tssRepeat = calculateTotalTss(withRepeat, ftp, 'power_ftp');
      const tssFlat = calculateTotalTss(manuallyFlattened, ftp, 'power_ftp');
      expect(tssRepeat).not.toBeNull();
      expect(tssRepeat!).toBeCloseTo(tssFlat!, 6);
    });
  });
});
