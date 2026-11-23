// The solver of the volume `water` (sim/README.md): the forces are the gradient of the energy, ice holds its
// hexagonal sheet, melts into a denser liquid, the hot plate drives molecules out, and the helpers around it
// (the temperature map, the heat of a real gram, the scrub process, the snow crystal) keep their promises.
import { describe, expect, it } from 'vitest';
import LIQUID from '../fixtures/liquid.json';
import { CELL_H, CELL_W, iceSheet, addAll, type Placed } from '../lattice';
import { mulberry, WaterMd } from '../md';
import { fromCelsius, heated, heatTo, T_BOIL, T_ICE, T_LIQUID, toCelsius } from '../scale';
import { boilProcess, iceSample, liquidSample, meltProcess, MOLECULES } from '../setups';
import { growSnowflake, WEATHERS } from '../snowflake';

const bondsPerMolecule = (md: WaterMd, from = 0.5): number => {
  let n = 0;
  for (let i = 0; i < 2 * md.count; i++) if (md.alive[i >> 1] && md.bond[i]! > from) n++;
  return n / Math.max(1, md.living);
};
const top90 = (md: WaterMd): number => {
  const ys = [...Array(md.count).keys()].filter((i) => md.alive[i]).map((i) => md.pos[3 * i + 1]!);
  ys.sort((a, b) => a - b);
  return ys[Math.floor(ys.length * 0.9)]!;
};

describe('water: the solver', () => {
  it('conserves energy without a bath (forces and torques are the gradient of the energy)', () => {
    const md = new WaterMd({ capacity: 200, width: 12 * CELL_W + 6, height: 8 * CELL_H + 6 });
    addAll(md, iceSheet(12, 8, mulberry(7), [3, 3]));
    md.thermalise(0.05, 3);
    md.step(1);
    const e0 = md.potential + md.kinetic();
    md.step(3000);
    expect(Math.abs(md.potential + md.kinetic() - e0) / md.count).toBeLessThan(2e-3);
  });

  it('is deterministic: the same seed gives the same state', () => {
    const a = iceSample(-20, 7);
    const b = iceSample(-20, 7);
    a.step(400);
    b.step(400);
    expect(Array.from(a.pos.subarray(0, 30))).toEqual(Array.from(b.pos.subarray(0, 30)));
  });

  it('a sheet of ice obeys the ice rules and holds its bonds at −20 °C', () => {
    const md = iceSample(-20);
    md.computeForces();
    // 252 molecules in 14 × 9 cells: every hydrogen that has a neighbour in its direction is bonded to it
    expect(bondsPerMolecule(md)).toBeGreaterThan(1.3);
    md.step(4000);
    expect(bondsPerMolecule(md)).toBeGreaterThan(1.15);
    expect(toCelsius(md.temperature)).toBeLessThan(0);
  });

  it('the hot plate under an open box drives the water out as steam', () => {
    const md = liquidSample(LIQUID as unknown as Placed[], 90, 11, 19);
    md.lid = { mode: 'open' };
    md.heating = { mode: 'bath', temperature: T_BOIL * 3, tau: 1.5, below: 3 };
    md.step(24000);
    expect(md.living).toBeLessThan(MOLECULES * 0.9);
  }, 30000);
});

describe('water: temperature and heat', () => {
  it('maps the model to degrees: absolute zero, the melting range, the boiling point', () => {
    expect(toCelsius(0)).toBeCloseTo(-273.15, 6);
    expect(toCelsius((T_ICE + T_LIQUID) / 2)).toBe(0);
    expect(toCelsius(T_BOIL)).toBeCloseTo(100, 6);
    for (const c of [-200, -20, -1, 1, 37, 99]) expect(toCelsius(fromCelsius(c))).toBeCloseTo(c, 6);
  });

  it('a real gram stands at 0 °C and at 100 °C while it melts and boils', () => {
    expect(heated(0).celsius).toBe(-20);
    const half = heated(heatTo(0, 0.5));
    expect(half.celsius).toBe(0);
    expect(half.ice).toBeCloseTo(0.5, 6);
    expect(heated(heatTo(100, 0.25)).steam).toBeCloseTo(0.25, 6);
    // melting takes as much heat as warming the water by about 80 degrees; boiling 5.4 times 0 → 100
    expect((heatTo(0, 1) - heatTo(0, 0)) / (heatTo(80) - heatTo(0, 1))).toBeCloseTo(1, 1);
    expect((heatTo(100, 1) - heatTo(100, 0)) / (heatTo(100, 0) - heatTo(0, 1))).toBeCloseTo(5.4, 1);
  });
});

describe('water: the roads the reader scrubs', () => {
  it('melting: the sheet loses its order, the liquid is lower than the ice was, and the road replays backward', () => {
    const p = meltProcess();
    const ice = { bonds: bondsPerMolecule(p.md), top: top90(p.md) };
    let guard = 0;
    while (p.shown < 1 - 1e-6 && guard++ < 4000) p.update(1, 0.24);
    expect(p.shown).toBeCloseTo(1, 5);
    expect(bondsPerMolecule(p.md)).toBeLessThan(ice.bonds * 0.75);
    expect(top90(p.md)).toBeLessThan(ice.top - 0.4); // denser: the same molecules take less room
    // backward: the kept frames, down to the ice the road started from
    expect(p.update(0.5, 0.1)).toBeCloseTo(0.5, 6);
    p.update(0, 0);
    let strong = 0;
    for (let i = 0; i < 2 * MOLECULES; i++) if (p.bond[i]! > 0.5) strong++;
    expect(strong / MOLECULES).toBeGreaterThan(1.2);
  }, 60000);

  it('boiling: by the end of the road most of the water has left as steam', () => {
    const p = boilProcess(LIQUID as unknown as Placed[]);
    let guard = 0;
    while (p.shown < 1 - 1e-6 && guard++ < 5000) p.update(1, 0.24);
    expect(p.md.living).toBeLessThan(MOLECULES * 0.6);
  }, 90000);
});

describe('water: the snow crystal', () => {
  it.each(WEATHERS.map((w, i) => [i, w] as const))('weather %i grows a crystal with six-fold symmetry', (_i, w) => {
    const f = growSnowflake(w);
    expect(f.count).toBeGreaterThan(800);
    const cells = new Set<string>();
    for (let i = 0; i < f.count; i++) cells.add(`${f.q[i]},${f.r[i]}`);
    // a turn by 60° maps (q, r) to (−r, q + r): every cell has its image
    for (let i = 0; i < f.count; i++) expect(cells.has(`${-f.r[i]!},${f.q[i]! + f.r[i]!}`)).toBe(true);
    expect(f.at[0]).toBe(0);
  });
});
