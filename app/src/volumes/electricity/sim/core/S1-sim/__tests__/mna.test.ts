import { describe, expect, it } from 'vitest';
import { resistanceBetween, solveDc, voltageBetween, type CircuitElement } from '../mna';
import { createFuse } from '../protection';

const src = (id: string, plus: string, minus: string, emfV: number, r = 0): CircuitElement => ({
  kind: 'source',
  id,
  plus,
  minus,
  emfV,
  internalResistanceOhm: r,
});
const res = (id: string, a: string, b: string, ohm: number): CircuitElement => ({ kind: 'resistor', id, a, b, resistanceOhm: ohm });

describe('MNA DC solver — current «Модель симуляції» §7 control points', () => {
  it('12 V, 4 Ω + 2 Ω in series → 2 A, 8 V + 4 V', () => {
    const s = solveDc([src('V', 'p', 'g', 12), res('R1', 'p', 'm', 4), res('R2', 'm', 'g', 2)]);
    expect(s.elements.get('V')!.currentA).toBeCloseTo(2, 9);
    expect(s.elements.get('R1')!.voltageV).toBeCloseTo(8, 9);
    expect(s.elements.get('R2')!.voltageV).toBeCloseTo(4, 9);
    expect(s.maxKclResidualA).toBeLessThan(1e-9);
  });

  it('12 V, 6 Ω ∥ 3 Ω → 6 A = 2 A + 4 A', () => {
    const s = solveDc([src('V', 'p', 'g', 12), res('R6', 'p', 'g', 6), res('R3', 'p', 'g', 3)]);
    expect(s.elements.get('V')!.currentA).toBeCloseTo(6, 9);
    expect(s.elements.get('R6')!.currentA).toBeCloseTo(2, 9);
    expect(s.elements.get('R3')!.currentA).toBeCloseTo(4, 9);
  });

  it('12 V, 2 Ω + (6 Ω ∥ 3 Ω) → 3 A, 6 V on 2 Ω, branches 1 A / 2 A', () => {
    const s = solveDc([
      src('V', 'p', 'g', 12),
      { kind: 'wire', id: 'w', a: 'p', b: 'p2' },
      res('R2', 'p2', 'm', 2),
      res('R6', 'm', 'g', 6),
      res('R3', 'm', 'g', 3),
    ]);
    expect(s.elements.get('V')!.currentA).toBeCloseTo(3, 5);
    expect(s.elements.get('R2')!.voltageV).toBeCloseTo(6, 5);
    expect(s.elements.get('R6')!.currentA).toBeCloseTo(1, 5);
    expect(s.elements.get('R3')!.currentA).toBeCloseTo(2, 5);
    expect(s.maxKclResidualA).toBeLessThan(1e-9);
  });

  it('source with internal resistance: ℰ = 1,5 V, r = 0,2 Ω, lamp 5 Ω → 0,288 A, 1,44 V (§5)', () => {
    const s = solveDc([src('B', 'p', 'g', 1.5, 0.2), res('L', 'p', 'g', 5)]);
    expect(s.elements.get('B')!.currentA).toBeCloseTo(0.288462, 5);
    expect(s.elements.get('B')!.voltageV).toBeCloseTo(1.442308, 5);
    expect(s.elements.get('B')!.powerW).toBeCloseTo(1.5 * 0.288462, 5);
    expect(s.maxKclResidualA).toBeLessThan(1e-9);
  });

  it('open switch removes the branch; closed switch is 10⁻⁶ Ω', () => {
    const open = solveDc([src('V', 'p', 'g', 12), { kind: 'switch', id: 'S', a: 'p', b: 'x', closed: false }, res('R', 'x', 'g', 12)]);
    expect(open.elements.get('R')!.currentA).toBe(0);
    expect(open.potentials.get('x')).toBeCloseTo(0, 12); // still tied to ground through R
    const closed = solveDc([src('V', 'p', 'g', 12), { kind: 'switch', id: 'S', a: 'p', b: 'x', closed: true }, res('R', 'x', 'g', 12)]);
    expect(closed.elements.get('R')!.currentA).toBeCloseTo(1, 6);
  });

  it('isolated sub-graph without a source is floating (null potentials), the rest still solves', () => {
    const s = solveDc([src('V', 'p', 'g', 6), res('R', 'p', 'g', 3), res('Rx', 'x', 'y', 10)]);
    expect(s.potentials.get('x')).toBeNull();
    expect(s.potentials.get('y')).toBeNull();
    expect(s.elements.get('Rx')!.conducting).toBe(false);
    expect(s.elements.get('V')!.currentA).toBeCloseTo(2, 9);
    expect(voltageBetween(s, 'x', 'g')).toBeNull();
  });

  it('two disconnected circuits each use their own source «−» as reference', () => {
    const s = solveDc([src('V1', 'a', 'b', 6), res('R1', 'a', 'b', 2), src('V2', 'c', 'd', 9), res('R2', 'c', 'd', 3)]);
    expect(s.potentials.get('b')).toBe(0);
    expect(s.potentials.get('d')).toBe(0);
    expect(s.elements.get('V1')!.currentA).toBeCloseTo(3, 9);
    expect(s.elements.get('V2')!.currentA).toBeCloseTo(3, 9);
  });

  it('parallel ideal sources with different EMF → singular', () => {
    const s = solveDc([src('V1', 'p', 'g', 12), src('V2', 'p', 'g', 6), res('R', 'p', 'g', 10)]);
    expect(s.singular).toBe(true);
  });

  it('source shorted by a wire draws a huge current (detectable short circuit)', () => {
    const s = solveDc([src('V', 'p', 'g', 12), { kind: 'wire', id: 'w', a: 'p', b: 'g' }]);
    expect(Math.abs(s.elements.get('V')!.currentA)).toBeGreaterThan(20);
  });

  it('non-linear lamp R(U) converges to a self-consistent point', () => {
    const lampR = (u: number): number => 2.4 + (28.8 - 2.4) * Math.pow(Math.min(u, 20) / 12, 0.45);
    const s = solveDc([src('V', 'p', 'g', 6), { kind: 'lamp', id: 'L', a: 'p', b: 'g', resistanceOhm: lampR }]);
    const l = s.elements.get('L')!;
    expect(l.resistanceOhm).toBeCloseTo(lampR(6), 6);
    expect(l.currentA).toBeCloseTo(6 / lampR(6), 6);
    const s2 = solveDc([src('V', 'p', 'g', 12), res('R', 'p', 'm', 10), { kind: 'lamp', id: 'L', a: 'm', b: 'g', resistanceOhm: lampR }]);
    const l2 = s2.elements.get('L')!;
    expect(l2.resistanceOhm).toBeCloseTo(lampR(Math.abs(l2.voltageV)), 6);
    expect(s2.maxKclResidualA).toBeLessThan(1e-9);
  });

  it('burnt lamp and blown fuse are open circuits', () => {
    const s = solveDc([src('V', 'p', 'g', 12), { kind: 'fuse', id: 'F', a: 'p', b: 'x', blown: true }, { kind: 'lamp', id: 'L', a: 'x', b: 'g', resistanceOhm: 12 }]);
    expect(s.elements.get('L')!.currentA).toBe(0);
    const s2 = solveDc([src('V', 'p', 'g', 12), { kind: 'lamp', id: 'L', a: 'p', b: 'g', resistanceOhm: 12, burnt: true }]);
    expect(s2.elements.get('V')!.currentA).toBe(0);
  });

  it('ohmmeter: resistance between nodes with sources removed, OL for no path', () => {
    const net: CircuitElement[] = [src('B', 'n1', 'n4', 1.5, 0.2), { kind: 'switch', id: 'S', a: 'n1', b: 'n2', closed: false }, res('L', 'n2', 'n3', 5), { kind: 'wire', id: 'J', a: 'n3', b: 'n4' }];
    expect(resistanceBetween(net, 'n2', 'n3')).toBeCloseTo(5, 4);
    expect(resistanceBetween(net, 'n1', 'n2')).toBe(Infinity);
    expect(resistanceBetween([res('a', 'x', 'y', 6), res('b', 'x', 'y', 3)], 'x', 'y')).toBeCloseTo(2, 9);
  });

  it('energy balance: Σ source power = Σ dissipated power', () => {
    const s = solveDc([src('V', 'p', 'g', 9, 0.5), res('R1', 'p', 'm', 4), res('R2', 'm', 'g', 6), res('R3', 'm', 'g', 3)]);
    let dissipated = 0;
    for (const [id, e] of s.elements) if (id !== 'V') dissipated += e.powerW;
    const i = s.elements.get('V')!.currentA;
    dissipated += i * i * 0.5;
    expect(s.elements.get('V')!.powerW).toBeCloseTo(dissipated, 9);
  });
});

describe('fuse time–current hook', () => {
  it('blows after 0,3 s above 2·I_n, or 3 s above 1,25·I_n, never at I_n', () => {
    const f = createFuse({ ratedCurrentA: 1, curve: [{ multiple: 2, timeS: 0.3 }, { multiple: 1.25, timeS: 3 }] });
    for (let k = 0; k < 1000; k++) f.step(1, 0.01);
    expect(f.state.blown).toBe(false);
    let n = 0;
    while (!f.state.blown && n < 500) {
      f.step(7.14, 0.01);
      n++;
    }
    expect(n * 0.01).toBeCloseTo(0.3, 2);
    f.reset();
    n = 0;
    while (!f.state.blown && n < 1000) {
      f.step(1.5, 0.01);
      n++;
    }
    expect(n * 0.01).toBeCloseTo(3, 2);
  });
  it('instantaneous fuse (timeS = 0) blows on the first step', () => {
    const f = createFuse({ ratedCurrentA: 0.4, curve: [{ multiple: 1, timeS: 0 }] });
    expect(f.step(0.39, 0.016)).toBe(false);
    expect(f.step(0.41, 0.016)).toBe(true);
  });
});
