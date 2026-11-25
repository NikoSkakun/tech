import { describe, expect, it } from 'vitest';
import { lifeAtHours, lifeHours, meterVoltage } from '@circuit/shared/stage';
import { drawerLife } from '../numbers';
import { grainSpent, placeSliceGrains, SLICE_R } from '../slice';
import { EDGE, SEP, edgeAtoms, oxideCrumbs, zincGrains } from '../micro/layout';

describe('alkaline: the numbers of the volume', () => {
  it('ten years in a drawer cost about a quarter of the store, eight hours of light all of it', () => {
    expect(drawerLife(0)).toBe(0);
    expect(drawerLife(1)).toBeCloseTo(0.03, 5);
    expect(drawerLife(10)).toBeGreaterThan(0.25);
    expect(drawerLife(10)).toBeLessThan(0.27);
    expect(lifeAtHours(lifeHours())).toBe(1);
    // the riddle: after ten years the meter still shows far more than a battery after a night of light
    expect(meterVoltage(drawerLife(10), 0)).toBeGreaterThan(meterVoltage(lifeAtHours(6), 0));
  });

  it('the slice: zinc turns to oxide from the separator inward, none fresh, all dead', () => {
    expect(grainSpent(1, 0)).toBe(0);
    expect(grainSpent(0, 1)).toBe(1);
    expect(grainSpent(0.95, 0.4)).toBeGreaterThan(grainSpent(0.2, 0.4));
    const grains = placeSliceGrains();
    expect(grains.length).toBeGreaterThan(150);
    for (const g of grains) expect(Math.hypot(g.x, g.y) + g.r).toBeLessThanOrEqual(SLICE_R.sepIn + 0.003);
  });

  it('the micro world is seeded and keeps its sides: zinc left of the separator, oxide right', () => {
    expect(zincGrains()).toEqual(zincGrains());
    for (const g of zincGrains()) expect(g.x + g.r).toBeLessThan(SEP.from + 0.05);
    for (const c of oxideCrumbs()) expect(c.x - c.r).toBeGreaterThan(SEP.to);
    const atoms = edgeAtoms();
    expect(atoms.some((a) => a.layer === 0)).toBe(true);
    for (const a of atoms) expect(a.x).toBeLessThanOrEqual(EDGE.x + 1e-9);
  });
});
