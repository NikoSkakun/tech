/**
 * Guards of the chapter's data bindings: the manifest comes from the generated manifest file, every hotspot id
 * the steps bind to exists in the content, the cross-reference addresses the scene uses are full addresses,
 * and the simulation still gives the control values the document quotes.
 */
import { describe, expect, it } from 'vitest';
import { linkTarget } from '@/content';
import raw from '@electricity/content/generated/plant-nuclear.json';
import { feedPerProduct, kEff } from '@electricity/sim/plant-nuclear';
import content, { crossTargets } from '../content';
import { HOTSPOTS } from '../hotspots';
import manifest from '../index';
import { hexLattice } from '../parts/fuel-models';

describe('plant-nuclear manifest and content', () => {
  it('takes title and steps from the generated manifest', () => {
    expect(manifest.id).toBe(raw.id);
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.every((s) => s.blurb.length > 0)).toBe(true);
    expect(content.steps.map((s) => s.id)).toEqual(manifest.steps.map((s) => s.id));
  });

  it('binds every hotspot of the document by its content id', () => {
    for (const step of raw.steps) {
      const ids = step.hotspots.map((h) => h.id);
      expect(Object.values(HOTSPOTS[step.id as keyof typeof HOTSPOTS] ?? {}).sort(), step.id).toEqual([...ids].sort());
    }
  });

  it('reads the links of step 12 as full addresses', () => {
    const links = crossTargets('крок 12');
    expect(links).toHaveLength(2);
    for (const address of links) expect(linkTarget(address)?.volumeId, address).toBe('electricity');
  });

  it('draws the lattices the document counts: 163 assemblies, 331 rod positions, 61 drives', () => {
    expect(hexLattice(7, 1, true)).toHaveLength(163);
    expect(hexLattice(10, 1)).toHaveLength(331);
    expect(hexLattice(10, 1).filter((p) => p.ring === 3)).toHaveLength(18);
    expect(hexLattice(4, 1)).toHaveLength(61);
  });

  it('relies on the model values the document quotes', () => {
    expect(kEff(4.5, true, 0.66, 'large')).toBeCloseTo(1.0, 2);
    expect(feedPerProduct(4.5, 0.25)).toBeCloseTo(9.22, 2);
  });
});
