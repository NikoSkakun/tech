import type { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createBulb } from '../bulb';
import { supportShadow } from '../bulb-shadow';

describe('the supports’ shadow in the lamp’s own light (owner 2026-11-20)', () => {
  it('is practically gone at full brightness and grows, still subtle, as the lamp dims', () => {
    expect(supportShadow(1)).toBeLessThan(0.05);
    expect(supportShadow(0.5)).toBeGreaterThan(supportShadow(0.8));
    expect(supportShadow(0.2)).toBeGreaterThan(supportShadow(0.5));
    expect(supportShadow(0)).toBeLessThanOrEqual(0.6);
  });

  it('only the metal mesh (base + supports) gets the fading distance material; the moon’s depth pass is untouched', () => {
    const bulb = createBulb();
    const casters: Mesh[] = [];
    bulb.group.traverse((o) => {
      if (o.customDistanceMaterial) casters.push(o as Mesh);
    });
    expect(casters.length).toBe(1);
    expect(casters[0]!.castShadow).toBe(true);
    expect(casters[0]!.customDepthMaterial).toBeUndefined();
  });
});
