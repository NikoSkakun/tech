/**
 * Guards of the chapter's data bindings: the manifest comes from the generated manifest file, every hotspot
 * id the steps bind to exists in the content, cross-reference targets are full addresses, and the simulation
 * still gives the numbers the scene is composed around (document, steps 1 and 6).
 */
import { describe, expect, it } from 'vitest';
import { linkTarget } from '@/content';
import raw from '@electricity/content/generated/plant-gas.json';
import { GT_PRESETS, combinedCycle, lanePowerPct } from '@electricity/sim/plant-gas';
import content, { crossTargets } from '../content';
import manifest from '../index';
import { HOTSPOTS } from '../hotspots';
import { STEP_IDS } from '../steps';
import { BASE_LOAD, CCGT_FULL_MW, islandPowerMW } from '../sim-bindings/island';
import { tsContour } from '../sim-bindings/gt';

describe('plant-gas manifest and content', () => {
  it('takes title and steps from the generated manifest', () => {
    expect(manifest.id).toBe(raw.id);
    expect(manifest.title).toBe(raw.title);
    expect(manifest.group).toBe(raw.group);
    expect(manifest.steps.map((s) => s.id)).toEqual(raw.steps.map((s) => s.id));
    expect(manifest.steps.every((s) => s.blurb.length > 0)).toBe(true);
    expect(content.steps.map((s) => s.id)).toEqual(manifest.steps.map((s) => s.id));
    expect(STEP_IDS).toEqual(manifest.steps.map((s) => s.id));
  });

  it('binds every hotspot of the document by its content id', () => {
    for (const step of raw.steps) {
      const ids = step.hotspots.map((h) => h.id);
      expect(Object.values(HOTSPOTS[step.id as keyof typeof HOTSPOTS] ?? {}).sort(), step.id).toEqual([...ids].sort());
    }
  });

  it('reads link targets as full addresses', () => {
    const role = crossTargets('крок 10');
    expect(role).toContain('electricity/plants/gallery');
    for (const address of role) expect(linkTarget(address)?.volumeId, address).toBe('electricity');
  });
});

describe('plant-gas scene numbers', () => {
  it('island power: ≈ 520 MW at night base, ≈ 940 MW at the morning peak', () => {
    expect(CCGT_FULL_MW).toBeCloseTo(811, 0);
    expect(islandPowerMW({ gt: BASE_LOAD, peaker: 0, engines: 3 })).toBeCloseTo(520, 0);
    expect(islandPowerMW({ gt: 1, peaker: 1, engines: 8 })).toBeCloseTo(941, 0);
  });

  it('T–s contour closes on the low isobar and encloses positive work', () => {
    const ts = tsContour(20, 1600);
    const [p1, p2, p3, p4] = ts.points as [{ s: number; t: number }, { s: number; t: number }, { s: number; t: number }, { s: number; t: number }];
    expect(p1.t).toBeCloseTo(15, 1);
    expect(p2.t).toBeCloseTo(468.5, 0);
    expect(p3.t).toBe(1600);
    expect(p4.t).toBeCloseTo(652, 0);
    expect(p4.s).toBeGreaterThan(p3.s);
    expect(ts.grid.upper.every((u, i) => u >= (ts.grid.lower[i] ?? 0) - 1e-6)).toBe(true);
  });

  it('relies on the presets and lanes the simulation provides', () => {
    expect(Object.keys(GT_PRESETS)).toEqual(['classE', 'classF', 'classHJ', 'aeroderivative']);
    expect(combinedCycle({ pressureRatio: 20, titC: 1600, levels: 3, hrsg: false, firingMW: 0 }).eta).toBeCloseTo(0.437, 3);
    expect(lanePowerPct('gasEngine', 2.5)).toBe(100);
  });
});
