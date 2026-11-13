import { describe, expect, it } from 'vitest';
import { COMPARE_ROWS, sortRows } from '../compare';
import { annualEnergyTWh, dayTiles, homesSupplied } from '../metrics';
import { createPowerRace, nominalFinishMin, type LaneId } from '../race';
import { rankine, RANKINE_IAPWS } from '../rankine';
import { SANKEY, sankeySummary, type SankeyType } from '../sankey';
import { braytonIdealEfficiency, carnotEfficiency, markerRatio, PLANT_MARKERS, realBand } from '../thermo';

describe('M1 Carnot', () => {
  it('(600, 30) → 0,6528, band 35,9…49,0 %; (540, 30) 0,6272; (280, 30) 0,4520; (1600, 30) 0,8382; T_h ≤ T_c → 0', () => {
    expect(carnotEfficiency(600, 30)).toBeCloseTo(0.6528, 4);
    expect(realBand(600, 30).map((x) => +(x * 100).toFixed(1))).toEqual([35.9, 49.0]);
    expect(carnotEfficiency(540, 30)).toBeCloseTo(0.6272, 4);
    expect(carnotEfficiency(280, 30)).toBeCloseTo(0.452, 4);
    expect(carnotEfficiency(1600, 30)).toBeCloseTo(0.8382, 4);
    expect(carnotEfficiency(30, 30)).toBe(0);
  });
  it('markers: nuclear 0,73·η_C, coal subcritical 0,59·η_C, CCGT 0,74·η_C', () => {
    expect(markerRatio(PLANT_MARKERS.nuclear)).toBeCloseTo(0.73, 2);
    expect(markerRatio(PLANT_MARKERS.coalSubcritical)).toBeCloseTo(0.59, 2);
    expect(markerRatio(PLANT_MARKERS.ccgt)).toBeCloseTo(0.74, 2);
  });
});

describe('M2 Rankine (IAPWS-IF97 values, document ±0,5 pp hand values)', () => {
  it('cycle η 0,3521 / 0,3882 / 0,4087 (document 0,35 / 0,39 / 0,42; reconcile-E1 expected 0,352 / 0,388 / 0,415)', () => {
    expect(rankine(false, false).eta).toBe(0.3521);
    expect(rankine(true, false).eta).toBe(0.3882);
    expect(rankine(true, true).eta).toBe(0.4087);
    expect(Math.abs(rankine(false, false).eta - 0.35)).toBeLessThan(0.005);
    expect(Math.abs(rankine(true, false).eta - 0.39)).toBeLessThan(0.005);
  });
  it('moisture 35 / 18 / 8 %, warning above 13 %; turbine 877 / 1288 / 1564 kJ/kg; pump ≈ 20 kJ/kg', () => {
    expect(Object.values(RANKINE_IAPWS).map((p) => Math.round(p.moisture * 100))).toEqual([35, 18, 8]);
    expect(rankine(true, false).moistureWarning).toBe(true);
    expect(rankine(true, true).moistureWarning).toBe(false);
    expect(Object.values(RANKINE_IAPWS).map((p) => Math.round(p.turbineKJkg))).toEqual([877, 1288, 1564]);
    expect(RANKINE_IAPWS.reheat.pumpKJkg).toBeCloseTo(20, 0);
  });
  it('without condenser the efficiency falls by more than a quarter (factor 0,67…0,73; document ×0,72)', () => {
    for (const p of Object.values(RANKINE_IAPWS)) expect(p.noCondenserFactor).toBeLessThan(0.75);
    expect(rankine(true, false, false).shownEta).toBe(0.2785);
    expect(RANKINE_IAPWS.superheat.noCondenserFactor).toBeCloseTo(0.72, 2);
  });
  it('ideal cycles 0,402 / 0,443 / 0,459 (document 0,40 / 0,44 / 0,47)', () => {
    expect(Object.values(RANKINE_IAPWS).map((p) => +p.etaIdeal.toFixed(3))).toEqual([0.402, 0.443, 0.459]);
  });
});

describe('M3 Brayton ideal', () => {
  it.each([
    [10, 0.4821],
    [20, 0.5751],
    [30, 0.6216],
    [40, 0.6514],
  ])('r = %s → %s', (r, e) => expect(braytonIdealEfficiency(r)).toBeCloseTo(e, 4));
});

describe('M4 Sankey', () => {
  it.each([
    ['coal', 42.6],
    ['gasCcgt', 58],
    ['nuclear', 31.7],
    ['hydro', 89],
    ['wind', 42],
    ['solarPv', 19],
    ['geothermal', 12],
    ['biomass', 30],
    ['fuelCell', 50],
  ] as const)('%s → %s to the grid; grid + losses = 100; every node balances', (t, g) => {
    const s = sankeySummary(t as SankeyType);
    expect(s.gridShare).toBeCloseTo(g, 9);
    expect(s.gridShare + s.lossShare).toBeCloseTo(100, 9);
    const flows = SANKEY[t as SankeyType];
    const inner = new Set(flows.map((f) => f.from).filter((n) => flows.some((f) => f.to === n)));
    for (const n of inner) {
      const inSum = flows.filter((f) => f.to === n).reduce((a, f) => a + f.value, 0);
      const outSum = flows.filter((f) => f.from === n).reduce((a, f) => a + f.value, 0);
      expect(outSum).toBeCloseTo(inSum, 9);
    }
  });
});

describe('M5 energy and CF', () => {
  it('(1000, 0,90) 7,884; (0,85) 7,446; (0,35) 3,066; (0,14) 1,226 TWh; 7,884 TWh ≈ 2,6 million homes', () => {
    expect([0.9, 0.85, 0.35, 0.14].map((cf) => +annualEnergyTWh(1000, cf).toFixed(3))).toEqual([7.884, 7.446, 3.066, 1.226]);
    expect(homesSupplied(7.884) / 1e6).toBeCloseTo(2.63, 2);
  });
  it('day tiles are deterministic, 365 long, and average to the requested CF', () => {
    for (const t of ['nuclear', 'wind', 'solar'] as const) {
      const a = dayTiles(t);
      expect(a).toEqual(dayTiles(t));
      expect(a.length).toBe(365);
      const mean = a.reduce((x, y) => x + y, 0) / 365;
      expect(Math.abs(mean - { nuclear: 0.85, wind: 0.35, solar: 0.14 }[t])).toBeLessThan(0.01);
    }
    expect(dayTiles('nuclear').filter((x) => x === 0).length).toBeGreaterThanOrEqual(35);
  });
});

describe('M6 power race', () => {
  it('nominal finish: coal ≈ 7,2, CCGT ≈ 4,5, GT ≈ 1,5, hydro ≈ 0,4 min', () => {
    expect(nominalFinishMin('coal')).toBeCloseTo(7.17, 2);
    expect(nominalFinishMin('ccgt')).toBeCloseTo(4.5, 9);
    expect(nominalFinishMin('gt')).toBeCloseTo(1.53, 2);
    expect(nominalFinishMin('hydro')).toBeCloseTo(0.43, 2);
  });
  it('simulated: finish order and the smooth tail (finish within 0,5 % slightly after the nominal time)', () => {
    const race = createPowerRace();
    race.demandJump();
    for (let i = 0; i < 900; i++) race.step(1 / 60);
    const ids: LaneId[] = ['bess', 'hydro', 'gasEngine', 'gt', 'ccgt', 'coal'];
    const fin = ids.map((id) => race.lane(id).finishedAtMin!);
    expect([...fin].sort((a, b) => a - b)).toEqual(fin);
    expect(fin[5]!).toBeGreaterThan(7.17);
    expect(fin[5]!).toBeLessThan(7.9);
    expect(race.lane('nuclear').pct).toBeCloseTo(100, 1);
  });
  it('blackout: only black-start lanes come back (hydro after 1,5 min, GT after 10 min)', () => {
    const race = createPowerRace();
    race.blackout();
    race.step(1.4);
    expect(race.lane('hydro').pct).toBe(0);
    race.step(1);
    expect(race.lane('hydro').pct).toBeGreaterThan(50);
    expect(race.lane('coal').pct).toBe(0);
    expect(race.lane('coal').dead).toBe(true);
    race.step(10);
    expect(race.lane('gt').pct).toBeGreaterThan(0);
    expect(race.lane('nuclear').pct).toBe(0);
  });
});

describe('compare table', () => {
  it('15 rows; sorting by median CO₂ puts wind and nuclear first and unknowns last', () => {
    expect(COMPARE_ROWS.length).toBe(15);
    const s = sortRows(COMPARE_ROWS, 'co2Median');
    expect(s[0]!.id).toBe('windOnshore');
    expect(s.at(-1)!.co2Median).toBeNull();
  });
});
