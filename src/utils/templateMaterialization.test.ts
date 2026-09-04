/**
 * PLAN-059: templateMaterialization helper tests.
 */
import { describe, it, expect } from 'vitest';
import { materializeStepTemplate, materializeBlockTemplate } from './templateMaterialization';
import type { PlanSegment } from './tssCalculator';

const stepTemplate = {
  id: 'st-1',
  userId: 'u1',
  name: 'Sweet Spot 10',
  step: {
    name: 'Sweet Spot',
    type: 'interval',
    durationType: 'time',
    durationSeconds: 600,
    intensityMetric: 'power_ftp',
    powerMin: 88,
    powerMax: 92,
    notes: 'hold steady',
  } as PlanSegment,
  createdAt: '2024-06-01',
  updatedAt: '2024-06-02',
};

const blockTemplate = {
  id: 'bt-1',
  userId: 'u1',
  name: '3x Sweet Spot',
  repeatCount: 3,
  steps: [
    { name: 'Warm Up', type: 'warmup', durationType: 'time', durationSeconds: 300, intensityMetric: 'power_ftp', powerMin: 55, powerMax: 65 },
    { name: 'Sweet Spot', type: 'interval', durationType: 'time', durationSeconds: 600, intensityMetric: 'power_ftp', powerMin: 88, powerMax: 92 },
    { type: 'recovery', durationType: 'time', durationSeconds: 180 },
  ] as PlanSegment[],
  createdAt: '2024-06-01',
  updatedAt: '2024-06-02',
};

describe('materializeStepTemplate', () => {
  it('produces an independent canonical step with the template values', () => {
    const step = materializeStepTemplate(stepTemplate);
    expect(step.name).toBe('Sweet Spot');
    expect(step.type).toBe('interval');
    expect(step.durationType).toBe('time');
    expect(step.durationSeconds).toBe(600);
    expect(step.intensityMetric).toBe('power_ftp');
    expect(step.powerMin).toBe(88);
    expect(step.powerMax).toBe(92);
    expect(step.notes).toBe('hold steady');
  });

  it('adds NO template reference', () => {
    const step = materializeStepTemplate(stepTemplate) as unknown as Record<string, unknown>;
    expect(step.stepTemplateId).toBeUndefined();
    expect(step.templateId).toBeUndefined();
  });

  it('strips repeat metadata so a Step Template never becomes a block', () => {
    const withRepeat = {
      ...stepTemplate,
      step: { ...stepTemplate.step, repeatId: 'leaked', repeatCount: 4 },
    };
    const step = materializeStepTemplate(withRepeat);
    expect(step.repeatId).toBeUndefined();
    expect(step.repeatCount).toBeUndefined();
  });

  it('is independent: editing the result does not mutate the template', () => {
    const step = materializeStepTemplate(stepTemplate);
    step.powerMin = 90;
    step.powerMax = 94;
    step.name = 'Changed';
    expect(stepTemplate.step.powerMin).toBe(88);
    expect(stepTemplate.step.powerMax).toBe(92);
    expect(stepTemplate.step.name).toBe('Sweet Spot');
  });

  it('normalizes a distance step (drops time)', () => {
    const distTpl = { ...stepTemplate, step: { type: 'interval', durationType: 'distance', distanceMeters: 1609, durationSeconds: 600 } as PlanSegment };
    const step = materializeStepTemplate(distTpl);
    expect(step.durationType).toBe('distance');
    expect(step.distanceMeters).toBe(1609);
    expect(step.durationSeconds).toBeUndefined();
  });
});

describe('materializeBlockTemplate', () => {
  it('produces the correct ordered steps', () => {
    const segs = materializeBlockTemplate(blockTemplate);
    expect(segs).toHaveLength(3);
    expect(segs.map((s) => s.type)).toEqual(['warmup', 'interval', 'recovery']);
    expect(segs[1].name).toBe('Sweet Spot');
  });

  it('assigns a fresh repeatId shared by all steps', () => {
    const segs = materializeBlockTemplate(blockTemplate);
    const ids = new Set(segs.map((s) => s.repeatId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBeTruthy();
  });

  it('copies the default repeatCount onto every step', () => {
    const segs = materializeBlockTemplate(blockTemplate);
    expect(segs.every((s) => s.repeatCount === 3)).toBe(true);
  });

  it('two insertions receive different repeatIds', () => {
    const a = materializeBlockTemplate(blockTemplate);
    const b = materializeBlockTemplate(blockTemplate);
    expect(a[0].repeatId).not.toBe(b[0].repeatId);
  });

  it('adds NO template reference to any step', () => {
    const segs = materializeBlockTemplate(blockTemplate);
    for (const s of segs as unknown as Record<string, unknown>[]) {
      expect(s.blockTemplateId).toBeUndefined();
      expect(s.templateId).toBeUndefined();
    }
  });

  it('is independent: editing the result does not mutate the template', () => {
    const segs = materializeBlockTemplate(blockTemplate);
    segs[1].powerMin = 90;
    segs[1].name = 'Edited';
    segs[0].repeatCount = 5;
    expect(blockTemplate.steps[1].powerMin).toBe(88);
    expect(blockTemplate.steps[1].name).toBe('Sweet Spot');
    expect(blockTemplate.repeatCount).toBe(3);
  });

  it('floors an out-of-range default repeatCount to >= 1', () => {
    const bad = { ...blockTemplate, repeatCount: 0 };
    const segs = materializeBlockTemplate(bad);
    expect(segs.every((s) => s.repeatCount === 1)).toBe(true);
  });

  it('normalizes each step (distance step keeps only distance)', () => {
    const tpl = { ...blockTemplate, steps: [{ type: 'interval', durationType: 'distance', distanceMeters: 3218, durationSeconds: 60 } as PlanSegment] };
    const segs = materializeBlockTemplate(tpl);
    expect(segs[0].durationType).toBe('distance');
    expect(segs[0].distanceMeters).toBe(3218);
    expect(segs[0].durationSeconds).toBeUndefined();
  });
});
