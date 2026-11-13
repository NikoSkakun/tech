import { describe, expect, it } from 'vitest';
import {
  GENSET_APPLIANCES,
  GENSETS,
  KAH_PER_KG,
  PEMFC,
  SOFC,
  arbitrageProfit,
  bessFrequencyRun,
  bessSizing,
  cellPoint,
  engineeringGain,
  fusionBalance,
  gensetOperatingPoint,
  hydrogenLoop,
  loadStepResponse,
  magneticPressureMpa,
  maxPowerPoint,
  minimumBessWithoutShedding,
  nifYieldMj,
  stack,
  startCheck,
  voyagerRtgW,
} from '..';

describe('plant-future M1 fuel cell', () => {
  it('PEMFC U(i): 0 → 0.980; 0.05 → 0.918; 0.2 → 0.858; 0.5 → 0.784; 1.0 → 0.665; 1.4 → 0.458; 1.6 → 0.186', () => {
    const rows = [
      [0, 0.98],
      [0.05, 0.918],
      [0.2, 0.858],
      [0.5, 0.784],
      [1.0, 0.665],
      [1.4, 0.458],
      [1.6, 0.186],
    ] as const;
    for (const [i, u] of rows) expect(cellPoint(i, PEMFC).voltageV).toBeCloseTo(u, 3);
    expect(cellPoint(0.5).powerWcm2).toBeCloseTo(0.392, 3);
    expect(cellPoint(0.5).efficiency).toBeCloseTo(0.63, 2);
    expect(cellPoint(1).efficiency).toBeCloseTo(0.53, 2);
    const m = maxPowerPoint();
    expect(m.powerWcm2).toBeCloseTo(0.71, 2);
    expect(m.i).toBeCloseTo(1.2, 1);
    expect(cellPoint(3).voltageV).toBe(0);
  });
  it('stack 300 cells × 300 cm²: 0.5 → 235 V, 35.3 kW; 1.0 → 200 V, 59.8 kW; SOFC 0.5 → 0.835, 1.0 → 0.698', () => {
    expect(stack(300, 0.5).voltageV).toBeCloseTo(235, 0);
    expect(stack(300, 0.5).powerW / 1000).toBeCloseTo(35.3, 1);
    expect(Math.abs(stack(300, 1).voltageV - 200)).toBeLessThan(1); // 199.4 V (59.8 kW exact)
    expect(stack(300, 1).powerW / 1000).toBeCloseTo(59.8, 1);
    expect(cellPoint(0.5, SOFC).voltageV).toBeCloseTo(0.835, 3);
    expect(cellPoint(1.0, SOFC).voltageV).toBeCloseTo(0.698, 3);
  });
});

describe('plant-future M2 hydrogen loop', () => {
  it('26.59 kAh/kg; U_el 1.6/1.8/1.9/2.0 → 42.5/47.9/50.5/53.2 kWh/kg (η 0.78/0.70/0.66/0.63)', () => {
    expect(KAH_PER_KG).toBeCloseTo(26.59, 2);
    const rows = [
      [1.6, 42.5, 0.78],
      [1.8, 47.9, 0.7],
      [1.9, 50.5, 0.66],
      [2.0, 53.2, 0.63],
    ] as const;
    for (const [u, e, eta] of rows) {
      const r = hydrogenLoop(u, 0.7);
      expect(r.electrolyserKwhPerKg).toBeCloseTo(e, 1);
      expect(r.electrolyserEtaLhv).toBeCloseTo(eta, 2);
    }
  });
  it('η_rt 0.368, with compression 0.324; Sankey 66 / 34 / 37 / 29', () => {
    expect(hydrogenLoop(1.9, 0.7).roundTrip).toBeCloseTo(0.368, 3);
    expect(hydrogenLoop(1.9, 0.7, true).roundTrip).toBeCloseTo(0.324, 3);
    const s = hydrogenLoop(1.9, 0.7).sankey;
    expect([s.hydrogen, s.electrolysisLoss, s.electricity, s.fuelCellLoss].map(Math.round)).toEqual([
      66, 34, 37, 29,
    ]);
    const c = hydrogenLoop(1.9, 0.7, true).sankey;
    expect(c.electricity + c.compression + c.fuelCellLoss).toBeCloseTo(c.hydrogen, 9);
  });
});

describe('plant-future M3 gensets', () => {
  it('diesel 10 kW: 10 → 3.30 l/h, 0.330, η 0.306; 7.5 → 2.675, 0.357, 0.283; 2.5 → 1.425, 0.570, 0.177; full tank 12.1 h', () => {
    const d = GENSETS.diesel10;
    const rows = [
      [10, 3.3, 0.33, 0.306],
      [7.5, 2.675, 0.357, 0.283],
      [2.5, 1.425, 0.57, 0.177],
    ] as const;
    for (const [p, f, l, eta] of rows) {
      const r = gensetOperatingPoint(d, p);
      expect(r.fuelLPerH).toBeCloseTo(f, 3);
      expect(r.litresPerKwh).toBeCloseTo(l, 3);
      expect(r.efficiency).toBeCloseTo(eta, 3);
    }
    expect(gensetOperatingPoint(d, 10).tankHours).toBeCloseTo(12.1, 1);
  });
  it('petrol 3 kW: 3 → 1.56, 0.520, 0.216; 0.75 → 0.66, 0.880, 0.128; inverter 2 kW at 0.5 → 0.325, 0.650, 0.173; petrol at 0.5 → 0.56', () => {
    const p = GENSETS.petrol3;
    expect(gensetOperatingPoint(p, 3).fuelLPerH).toBeCloseTo(1.56, 3);
    expect(gensetOperatingPoint(p, 3).efficiency).toBeCloseTo(0.216, 3);
    expect(gensetOperatingPoint(p, 0.75).litresPerKwh).toBeCloseTo(0.88, 3);
    expect(gensetOperatingPoint(p, 0.75).efficiency).toBeCloseTo(0.128, 3);
    const i = gensetOperatingPoint(GENSETS.inverter2, 0.5);
    expect(i.fuelLPerH).toBeCloseTo(0.325, 3);
    expect(i.litresPerKwh).toBeCloseTo(0.65, 3);
    expect(i.efficiency).toBeCloseTo(0.173, 3);
    expect(gensetOperatingPoint(p, 0.5).fuelLPerH).toBeCloseTo(0.56, 3);
  });
  it('load step dip and protection', () => {
    const d = GENSETS.petrol3;
    expect(loadStepResponse(d, 1.5, 0).uPu).toBeCloseTo(0.9, 9);
    expect(loadStepResponse(d, 1.5, 0).fPu).toBeCloseTo(0.975, 9);
    expect(loadStepResponse(GENSETS.inverter2, 1, 0)).toEqual({ uPu: 0.97, fPu: 1 });
    expect(loadStepResponse(d, 0.5, 0)).toEqual({ uPu: 1, fPu: 1 });
    expect(startCheck(d, 2.2, 'pump').trips).toBe(true);
    expect(startCheck(GENSETS.diesel10, 2.2, 'pump').trips).toBe(false);
  });
  it('step 4 appliances follow _shared-house.md §3 (fridge 150 W ×5, boiler 100 W ×2, router 20 W, laptop 65 W, pump 1000 W ×5)', () => {
    expect(GENSET_APPLIANCES.fridge).toEqual({ kw: 0.15, kStart: 5, tStartS: 0.3 });
    expect(GENSET_APPLIANCES.boiler).toEqual({ kw: 0.1, kStart: 2, tStartS: 0.2 });
    expect([GENSET_APPLIANCES.kettle.kw, GENSET_APPLIANCES.waterHeater.kw]).toEqual([2, 2]);
    expect([GENSET_APPLIANCES.router.kw, GENSET_APPLIANCES.laptop.kw]).toEqual([0.02, 0.065]);
    expect(GENSET_APPLIANCES.pump).toEqual({ kw: 1, kStart: 5, tStartS: 0.5 });
    // petrol 3 kW with 2,2 kW running: pump start 2,2 + 5·1,0 = 7,2 kW > 1,3·3 → protection trips
    expect(startCheck(GENSETS.petrol3, 2.2, 'pump').peakKw).toBeCloseTo(7.2, 9);
  });
});

describe('plant-future M4 BESS in FCR (island, 1000 MW lost; ±0.02 Hz, ±0.3 s)', () => {
  const rows = [
    [4, 0, 48.93, 2.45, 750, 49.93],
    [4, 250, 48.96, 3.5, 750, 49.93],
    [4, 500, 49.13, 8.2, 0, 49.72],
    [4, 750, 49.68, 3.3, 0, 49.84],
    [4, 1000, 49.81, 1.0, 0, 49.87],
    [2, 0, 48.85, 1.3, 750, 49.91],
    [2, 500, 48.97, 2.9, 750, 49.95],
    [2, 750, 49.54, 2.8, 0, 49.84],
    [6, 0, 48.96, 3.7, 750, 49.87],
    [6, 500, 49.31, 9.7, 0, 49.66],
  ] as const;
  for (const [h, b, nadir, tn, shed, f30] of rows) {
    it(`H ${h} s, BESS ${b} MW`, () => {
      const r = bessFrequencyRun(h, b);
      expect(Math.abs(r.nadirHz - nadir)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(r.nadirTimeS - tn)).toBeLessThanOrEqual(0.3);
      expect(r.shedMw).toBe(shed);
      expect(Math.abs(r.f30Hz - f30)).toBeLessThanOrEqual(0.02);
    });
  }
  it('RoCoF −0.521 / −1.042 / −0.347 Hz/s; minimum BESS without UFLS: 600 MW (H 2), 500 MW (H 4)', () => {
    expect(bessFrequencyRun(4, 0, 1).rocofHzPerS).toBeCloseTo(-0.521, 3);
    expect(bessFrequencyRun(2, 0, 1).rocofHzPerS).toBeCloseTo(-1.042, 3);
    expect(bessFrequencyRun(6, 0, 1).rocofHzPerS).toBeCloseTo(-0.347, 3);
    expect(minimumBessWithoutShedding(2)).toBe(600);
    expect(Math.abs(bessFrequencyRun(2, 600).nadirHz - 49.12)).toBeLessThanOrEqual(0.02);
    expect(minimumBessWithoutShedding(4)).toBe(500);
  });
  it('arbitrage break-even 1/0.87 ≈ 1.15; sizing 100 MW × 4 h → 80 containers', () => {
    expect(arbitrageProfit(1, 1.15).breakEvenRatio).toBeCloseTo(1.149, 3);
    expect(arbitrageProfit(1, 1.1).profitable).toBe(false);
    expect(arbitrageProfit(50, 100).profitPerMwh).toBeCloseTo(37, 9);
    expect(bessSizing(100, 4).containers).toBe(80);
  });
});

describe('plant-future M5–M6', () => {
  it('fusion balance controls', () => {
    const a = fusionBalance(1e20, 9, 3.5);
    expect(a.pFusWm3 / 1e6).toBeCloseTo(0.56, 2);
    expect(Math.abs(a.q - 20)).toBeLessThan(1);
    expect(a.tripleProduct).toBeCloseTo(3.15e21, -18);
    const b = fusionBalance(5e19, 10, 0.6);
    expect(b.pFusWm3 / 1e6).toBeCloseTo(0.194, 3);
    expect(b.q).toBeCloseTo(0.53, 2);
    expect(fusionBalance(1e20, 15, 1).pFusWm3 / 1e6).toBeCloseTo(1.7, 2);
    expect(fusionBalance(1e20, 15, 1).q).toBeCloseTo(4.2, 1);
    expect(Math.abs(fusionBalance(1e20, 15, 2).q - 41)).toBeLessThan(1);
    expect(fusionBalance(1e20, 15, 3).ignition).toBe(true);
    expect(fusionBalance(1e20, 5, 3).q).toBeCloseTo(1.2, 1);
  });
  it('NIF curve and engineering gain', () => {
    const rows = [
      [1.9, 0.37],
      [2.0, 1.54],
      [2.05, 3.13],
      [2.08, 4.8],
    ] as const;
    for (const [w, y] of rows) expect(nifYieldMj(w)).toBeCloseTo(y, 2);
    expect(nifYieldMj(2.15)).toBe(12);
    expect(engineeringGain(nifYieldMj(2.05), 2.05, 0.01)).toBeCloseTo(0.006, 3);
    expect(engineeringGain(8.6, 2.08, 0.01)).toBeCloseTo(0.017, 3);
    expect(engineeringGain(8.6, 2.08, 0.2)).toBeCloseTo(0.33, 2);
  });
  it('Voyager RTG 2000 ≈ 338 W, 2026 ≈ 225 W, 2030 ≈ 211 W; B²/2μ₀ at 5 T ≈ 9.95 MPa', () => {
    expect(Math.round(voyagerRtgW(2000))).toBe(338);
    expect(Math.round(voyagerRtgW(2026))).toBe(225);
    expect(Math.round(voyagerRtgW(2030))).toBe(211);
    expect(voyagerRtgW(2026)).toBeLessThan(235);
    expect(magneticPressureMpa(5)).toBeCloseTo(9.95, 2);
  });
});
