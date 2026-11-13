import { describe, expect, it } from 'vitest';
import raw from '@electricity/content/generated/lab-inverter.json';
import meta from '@electricity/content/generated/lab-inverter.manifest.json';
import { STEP_IDS } from '../chapter';
import manifest from '../index';

describe('lab-inverter manifest', () => {
  it('has the 12 steps of the generated content, in order', () => {
    const ids = manifest.steps.map((s) => s.id);
    expect(ids).toEqual(raw.steps.map((s) => s.id));
    expect(ids).toEqual([...STEP_IDS]);
    expect(ids).toHaveLength(12);
  });

  it('takes identity and place from the generated manifest', () => {
    expect(manifest.id).toBe('lab-inverter');
    expect(manifest.title).toBe(meta.title);
    expect(manifest.order).toBe(meta.order);
    expect(manifest.group).toBe(meta.group);
    expect(manifest.parent).toBe(meta.parent);
    expect(manifest.axisLabel).toBe(meta.axisLabel);
  });
});
