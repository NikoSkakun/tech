import { describe, expect, it } from 'vitest';
import { checkN1, n1Flows, tripAndCascade } from '../n1Cascade';

const pct = (r: { loadingPct: Record<string, number> }, id: string) => Math.round(r.loadingPct[id]!);

describe('grid §Д DC power flow, N-1 and cascade', () => {
  it('s = 1,00 base flows', () => {
    const f = n1Flows(1).flowsMW;
    const exp: Record<string, number> = { L1: 1327, L2: 1095, L3: 578, L4: 864, L5: 714, L6: -9, L7: -114 };
    for (const [id, v] of Object.entries(exp)) expect(Math.abs(f[id]! - v)).toBeLessThan(1);
  });

  it('flows are linear in s; s = 0,55: L1 730 (46 %), L2 602 (46 %), L4 475 (48 %), L5 393 (49 %)', () => {
    const r = n1Flows(0.55);
    expect(Math.round(r.flowsMW.L1!)).toBe(730);
    expect(Math.round(r.flowsMW.L2!)).toBe(602);
    expect(Math.round(r.flowsMW.L4!)).toBe(475);
    expect(Math.round(r.flowsMW.L5!)).toBe(393);
    expect([pct(r, 'L1'), pct(r, 'L2'), pct(r, 'L4'), pct(r, 'L5')]).toEqual([46, 46, 48, 49]);
    expect(n1Flows(0.55).flowsMW.L3! / n1Flows(1).flowsMW.L3!).toBeCloseTo(0.55, 9);
  });

  it('N-1: 55 % secure (worst L1 → L4 91 %), 60 % boundary (99,6 %, document: «100 %»), 65 % violated (108 %)', () => {
    const a = checkN1(0.55);
    expect(a.secure).toBe(true);
    expect(a.worst.outageId).toBe('L1');
    expect(a.worst.worstLineId).toBe('L4');
    expect(Math.round(a.worst.worstLoadingPct)).toBe(91);
    const b = checkN1(0.6);
    expect(b.secure).toBe(true);
    expect(b.worst.worstLoadingPct).toBeCloseTo(99.6, 1);
    const c = checkN1(0.65);
    expect(c.secure).toBe(false);
    expect(Math.round(c.worst.worstLoadingPct)).toBe(108);
  });

  it('s = 1,00, L1 out: L2 125, L3 137, L4 166, L5 89, L6 90, L7 19 % → L4 at 1 s → L6 at 2 s → bus 3 dark (2200 MW)', () => {
    const c = tripAndCascade(1, 'L1');
    expect(['L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map((id) => pct(c.initial, id))).toEqual([125, 137, 166, 89, 90, 19]);
    expect(c.steps.map((s) => [s.timeS, s.lineId])).toEqual([
      [1, 'L4'],
      [2, 'L6'],
    ]);
    const mid = c.steps[0]!.after;
    expect(['L2', 'L5', 'L6', 'L7'].map((id) => pct(mid, id))).toEqual([192, 188, 367, 151]);
    const end = c.final;
    expect(end.deadBuses).toEqual(['3']);
    expect(end.unservedMW).toBeCloseTo(2200, 6);
    expect(['L2', 'L3', 'L5', 'L7'].map((id) => pct(end, id))).toEqual([79, 32, 96, 29]);
    expect(end.injectionMW['1']).toBeCloseTo(1350, 6);
    expect(end.injectionMW['2']).toBeCloseTo(450, 6);
  });

  it('s = 0,80, L1 out: L3 110, L4 133 % → L4 at 5 s → L6 at 6 s → bus 3 dark (1760 MW)', () => {
    const c = tripAndCascade(0.8, 'L1');
    expect([pct(c.initial, 'L3'), pct(c.initial, 'L4')]).toEqual([110, 133]);
    expect(c.steps.map((s) => [s.timeS, s.lineId])).toEqual([
      [5, 'L4'],
      [6, 'L6'],
    ]);
    expect(['L2', 'L5', 'L6', 'L7'].map((id) => pct(c.steps[0]!.after, id))).toEqual([154, 150, 293, 121]);
    expect(c.final.unservedMW).toBeCloseTo(1760, 6);
  });

  it.each([
    [0.7, 'oneQueue', { L4: 98, L2: 78, L3: 78 }, 0],
    [0.8, 'oneQueue', { L4: 112, L3: 89 }, 2],
    [0.8, 'twoQueues', { L4: 91, L2: 78, L3: 68 }, 0],
    [1.0, 'twoQueues', { L4: 113, L2: 98 }, 2],
  ] as const)('§Д.5 rescue: s = %s, %s', (s, action, loads, trips) => {
    const c = tripAndCascade(s, 'L1', action);
    for (const [id, v] of Object.entries(loads)) expect(pct(c.initial, id)).toBe(v);
    expect(c.steps.length).toBe(trips);
    if (trips > 0) expect(c.steps.map((x) => x.lineId)).toEqual(['L4', 'L6']);
  });
});
