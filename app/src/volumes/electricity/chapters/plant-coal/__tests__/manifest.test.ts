/**
 * Guards of the chapter's data bindings: the manifest comes from the generated manifest file, every hotspot id the
 * steps bind to exists in the content, the cross-references the scene uses are full addresses, and the simulation
 * still gives the document's checkpoints the UI relies on.
 */
import { describe, expect, it } from 'vitest';
import { linkTarget } from '@/content';
import raw from '@electricity/content/generated/plant-coal.json';
import { ccs, chpOperatingPoint, fuelUse, unitEfficiency } from '@electricity/sim/plant-coal';
import content, { crossTargets } from '../content';
import manifest from '../index';
import { HOTSPOTS } from '../hotspots';

describe('plant-coal manifest and content', () => {
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

  it('reads link targets as full addresses', () => {
    const targets = crossTargets('role-ukraine');
    expect(targets.length).toBeGreaterThan(0);
    for (const address of targets) expect(linkTarget(address)?.volumeId, address).toBe('electricity');
  });

  it('relies on the checkpoints of the simulation', () => {
    expect(Math.round(fuelUse('lignite', 1000, 0.4).wagonsPerDay)).toBe(309);
    expect(unitEfficiency({ pressureMPa: 27, tempC: 600 })).toBeCloseTo(0.449, 3);
    expect(Math.round(ccs('bituminous', 1000, 0.45, true).stackGPerKWh)).toBe(101);
    expect(chpOperatingPoint(480).electricMW).toBeCloseTo(220, 6);
  });
});
