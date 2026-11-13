import { describe, expect, it } from 'vitest';
import { createMcb, fuseTripTimeS, mcbTripTime, rcdTrips, selectivity } from '../protection';
import { curveIbA, curveIc1A, shockZone, timeToFibrillationZoneS } from '../shock';
import { firstOrderStep, transformerTopOilC } from '../thermal';

describe('MCB (home §А)', () => {
  it.each([
    [1.45, 195],
    [1.49, 172],
    [2, 65.9],
    [2.55, 36.1],
    [3, 25.0],
  ])('%s·In on C16 from cold → %s s', (k, t) => {
    const r = mcbTripTime(k * 16, 16, 'C');
    expect(r.reason).toBe('thermal');
    expect(Math.abs(r.timeS - t)).toBeLessThan(t < 100 ? 0.1 : 1);
  });

  it('1,13·In never; 5·In on C → 8,4 s; 5·In on B → 0,01 s magnetic; 4000 A on C16 → 0,01 s', () => {
    expect(mcbTripTime(1.13 * 16, 16, 'C').timeS).toBe(Infinity);
    expect(mcbTripTime(80, 16, 'C').timeS).toBeCloseTo(8.4, 1);
    expect(mcbTripTime(80, 16, 'B')).toEqual({ timeS: 0.01, reason: 'magnetic' });
    expect(mcbTripTime(4000, 16, 'C').reason).toBe('magnetic');
  });

  it('compressor 72 A / 0,3 s: B16 trips (≥ 64 A), C16 does not, θ after start ≈ 0,05', () => {
    const b = createMcb(16, 'B');
    b.step(0.3, 72);
    expect(b.state.closed).toBe(false);
    expect(b.state.tripReason).toBe('magnetic');
    const c = createMcb(16, 'C');
    c.step(0.3, 72);
    expect(c.state.closed).toBe(true);
    expect(c.state.theta).toBeCloseTo((72 / 16) ** 2 * (1 - Math.exp(-0.3 / 120)), 9);
    expect(c.state.theta).toBeCloseTo(0.05, 2);
  });

  it('time-domain trip equals the analytic time for any dt; a hot bimetal re-trips sooner', () => {
    for (const dt of [1 / 60, 1 / 30, 0.5]) {
      const m = createMcb(16, 'C');
      while (m.state.closed && m.state.timeS < 100) m.step(dt, 32);
      expect(m.state.tripTimeS!).toBeCloseTo(65.92, 1);
    }
    const m = createMcb(16, 'C');
    while (m.state.closed) m.step(0.1, 32);
    m.step(10, 0); // cools a little
    m.close();
    let t = 0;
    while (m.state.closed) {
      m.step(0.1, 32);
      t += 0.1;
    }
    expect(t).toBeLessThan(20);
  });
});

describe('fuse, selectivity, RCD (distribution Р5, home §В)', () => {
  const chain = [
    { id: 'C16', kind: 'mcb', ratedA: 16, curve: 'C' },
    { id: 'C40', kind: 'mcb', ratedA: 40, curve: 'C' },
    { id: 'gG160', kind: 'fuse', ratedA: 160 },
  ] as const;
  it('250 A through all three: C16 0,01 s ✔, C40 5,31 s, fuse 55,5 s', () => {
    const r = selectivity(chain, 250);
    expect(r.map((x) => x.trips)).toEqual([true, false, false]);
    expect(r[1]!.timeS).toBeCloseTo(5.31, 2);
    expect(r[2]!.timeS).toBeCloseTo(55.5, 1);
  });
  it('1200 A (C40 + fuse): C40 0,01 s ✔, fuse 1,45 s; 5000 A fuse only → 0,082 s', () => {
    const r = selectivity(chain.slice(1), 1200);
    expect(r[0]!.trips).toBe(true);
    expect(r[1]!.timeS).toBeCloseTo(1.45, 2);
    expect(fuseTripTimeS(5000, 160)).toBeCloseTo(0.082, 3);
    expect(fuseTripTimeS(190, 160)).toBe(Infinity);
  });
  it('RCD 30 mA threshold 22,5 mA', () => {
    expect(rcdTrips(0.023, 0.03)).toBe(true);
    expect(rcdTrips(0.0233, 0.03)).toBe(true);
    expect(rcdTrips(0.0223, 0.03)).toBe(false);
    expect(rcdTrips(0.1917, 0.3)).toBe(false);
  });
});

describe('IEC 60479 zones (home §В)', () => {
  it('curves: I_b(0,025) ≈ 119 mA, I_b(2) = 10 mA, I_c1(0,025) ≈ 458 mA, I_c1(1) = 50 mA', () => {
    expect(curveIbA(0.025) * 1000).toBeCloseTo(119, 0);
    expect(curveIbA(2) * 1000).toBeCloseTo(10, 6);
    expect(curveIbA(10)).toBe(0.005);
    expect(Math.abs(curveIc1A(0.025) * 1000 - 458)).toBeLessThan(1);
    expect(curveIc1A(1)).toBeCloseTo(0.05, 9);
  });
  it('191,7 mA: 25 ms → AC-3, 1 s → AC-4, crosses c1 at ≈ 0,23 s; 2,3 mA → AC-2; 230 mA / 25 ms → AC-3', () => {
    expect(shockZone(0.1917, 0.025)).toBe('AC-3');
    expect(shockZone(0.1917, 1)).toBe('AC-4');
    expect(timeToFibrillationZoneS(0.1917)).toBeCloseTo(0.235, 2);
    expect(shockZone(0.0023, 5)).toBe('AC-2');
    expect(shockZone(0.23, 0.025)).toBe('AC-3');
    expect(shockZone(0.0004, 5)).toBe('AC-1');
  });
});

describe('thermal helpers', () => {
  it('first-order step is exact and stable for large dt', () => {
    expect(firstOrderStep(0, 10, 5, 5)).toBeCloseTo(10 * (1 - Math.exp(-1)), 12);
    expect(firstOrderStep(0, 10, 5, 1e6)).toBeCloseTo(10, 12);
  });
  it('transformer top oil (Т3 via distribution step 3): β 0,6 → 49,9; 1,0 → 75,0; 1,2 → 90,6 °C', () => {
    expect(transformerTopOilC(0.6)).toBeCloseTo(49.9, 1);
    expect(transformerTopOilC(1)).toBeCloseTo(75, 6);
    expect(transformerTopOilC(1.2)).toBeCloseTo(90.6, 1);
  });
});
