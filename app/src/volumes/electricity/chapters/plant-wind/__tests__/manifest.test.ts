/**
 * Guards of the chapter's data bindings: the manifest comes from the generated manifest file, every hotspot
 * id the steps bind to exists in the content, every cross-reference address the scene uses is a full address,
 * and the simulation still offers the tables the UI is built from.
 */
import { describe, expect, it } from 'vitest';
import { linkTarget } from '@/content';
import raw from '@electricity/content/generated/plant-wind.json';
import { DRIVETRAINS, ROTOR_SILHOUETTES } from '@electricity/sim/plant-wind';
import content, { crossTargets } from '../content';
import manifest from '../index';
import { HOTSPOTS } from '../hotspots';

describe('plant-wind manifest and content', () => {
  it('takes title and steps from the generated manifest', () => {
    expect(manifest.id).toBe(raw.id);
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.map((s) => s.title)).toEqual(raw.steps.map((s) => s.title));
    expect(manifest.steps.every((s) => s.blurb.length > 0)).toBe(true);
    expect(content.steps.map((s) => s.id)).toEqual(manifest.steps.map((s) => s.id));
  });

  it('binds every hotspot of the document by its content id', () => {
    for (const step of raw.steps) {
      const ids = step.hotspots.map((h) => h.id);
      expect(Object.values(HOTSPOTS[step.id as keyof typeof HOTSPOTS] ?? {}).sort(), step.id).toEqual([...ids].sort());
    }
  });

  it('reads portal and link targets as full addresses', () => {
    const portals = crossTargets('портали');
    expect(portals).toHaveLength(3);
    for (const address of portals) {
      const t = linkTarget(address);
      expect(t?.volumeId, address).toBe('electricity');
      expect(t?.chapterId, address).toBeTruthy();
    }
  });

  it('relies on tables the simulation library provides', () => {
    expect(ROTOR_SILHOUETTES.map((s) => s.diameterM)).toEqual([20, 82, 170, 236, 310]);
    expect(Object.keys(DRIVETRAINS)).toEqual(['A_DFIG', 'B_DIRECT', 'C_MEDIUM']);
  });
});
