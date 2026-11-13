import { describe, expect, it } from 'vitest';
import { blackStartScenario, createHydroTurbine, generatorRpm, stepResponse } from '../governor';
import { AUTO_PLAN, fullCycle, Q_PUMP, Q_TURBINE, simulatePshDay, storedEnergyMWh, PSH } from '../pumpedStorage';
import { createReservoir, equilibriumLevelM, plantPowerMW } from '../reservoir';
import { chooseTurbine, energyPerCubicMetreKWh, gateOperatingPoint, homesForPowerMW, hydroPowerMW, peltonNozzles, turbineEfficiency } from '../turbines';
import { staticPressureMPa, surgeColour, surgePressureMPa } from '../waterHammer';

describe('M1 power', () => {
  it.each([
    [0.92, 966, 80.6, 702.7],
    [0.94, 966, 80.6, 718.0],
    [0.9, 100, 50, 44.1],
    [0.9, 10, 500, 44.1],
    [0.9, 300, 35, 92.7],
    [0.9, 10, 1000, 88.3],
    [0.92, 500, 20, 90.3],
  ])('η %s, Q %s, H %s → %s MW', (e, q, h, p) => expect(hydroPowerMW(e, q, h)).toBeCloseTo(p, 1));
  it('small Carpathian plant 0,334 MW; 1 m³ on 100 m = 0,2725 kWh; 703 MW ≈ 2,1 million homes', () => {
    expect(hydroPowerMW(0.85, 2, 20)).toBeCloseTo(0.334, 3);
    expect(energyPerCubicMetreKWh(100)).toBeCloseTo(0.2725, 4);
    expect(homesForPowerMW(703) / 1e6).toBeCloseTo(2.07, 2);
  });
});

describe('M2 turbines, M4 choice', () => {
  it('Francis 0,940 / 0,919 / 0,825 / 0,656 / 0,411; Kaplan 0,814 / 0,911; Pelton 0,830 / 0,881', () => {
    expect([0.85, 1, 0.5, 0.3, 0.1].map((x) => +turbineEfficiency('francis', x).toFixed(3))).toEqual([0.94, 0.919, 0.825, 0.656, 0.411]);
    expect([0.3, 1].map((x) => +turbineEfficiency('kaplan', x).toFixed(3))).toEqual([0.814, 0.911]);
    expect([0.2, 1].map((x) => +turbineEfficiency('pelton', x).toFixed(3))).toEqual([0.83, 0.881]);
    expect([0.1, 0.5, 1].map(peltonNozzles)).toEqual([1, 3, 6]);
  });
  it('gate 0,85 → 300 m³/s, H_net 77,6 m, 209,8 MW; 0,50 → 176,5 m³/s, 120,0 MW; 1,00 → 352,9 m³/s, 223,0 MW', () => {
    const a = gateOperatingPoint(0.85);
    expect([a.flowM3s, +a.netHeadM.toFixed(1), +a.powerMW.toFixed(1)]).toEqual([300, 77.6, 209.8]);
    const b = gateOperatingPoint(0.5);
    expect([+b.flowM3s.toFixed(1), +b.powerMW.toFixed(1)]).toEqual([176.5, 120.0]);
    const c = gateOperatingPoint(1);
    expect([+c.flowM3s.toFixed(1), +c.powerMW.toFixed(1)]).toEqual([352.9, 223.0]);
    expect(gateOperatingPoint(0.3).vortexRope).toBe(true);
  });
  it('choice: 1000 m Pelton; 400 m / 10 m³/s both; 80,6 m Francis; 40 m / 20 m³/s both; 10 m Kaplan + bulb', () => {
    expect(chooseTurbine(1000, 10).turbines).toEqual(['pelton']);
    expect(chooseTurbine(400, 10).turbines).toEqual(['pelton', 'francis']);
    expect(chooseTurbine(80.6, 966).turbines).toEqual(['francis']);
    expect(chooseTurbine(40, 20).turbines).toEqual(['francis', 'kaplan']);
    expect(chooseTurbine(10, 500)).toEqual({ turbines: ['kaplan'], bulb: true });
  });
});

describe('M3 water hammer', () => {
  it('0,5 s → 5,50 MPa red; 10 s → 0,300 green; tank 0,825 amber / 0,045; static 0,785 MPa', () => {
    expect(surgePressureMPa(0.5, false)).toBeCloseTo(5.5, 9);
    expect(surgeColour(surgePressureMPa(0.5, false))).toBe('red');
    expect(surgePressureMPa(10, false)).toBeCloseTo(0.3, 9);
    expect(surgeColour(0.3)).toBe('green');
    expect(surgePressureMPa(0.5, true)).toBeCloseTo(0.825, 9);
    expect(surgeColour(0.825)).toBe('amber');
    expect(surgePressureMPa(10, true)).toBeCloseTo(0.045, 9);
    expect(staticPressureMPa()).toBeCloseTo(0.785, 3);
  });
});

describe('M5 hydro governor', () => {
  it('step 0,8 → 0,9: 0,600 at 0⁺; 0,7896 at 0,75 s; 0,8945 at 3 s; → 0,900', () => {
    expect(stepResponse(0.8, 0.9, 0)).toBeCloseTo(0.6, 9);
    expect(stepResponse(0.8, 0.9, 0.75)).toBeCloseTo(0.7896, 4);
    expect(stepResponse(0.8, 0.9, 3)).toBeCloseTo(0.8945, 4);
    expect(stepResponse(0.8, 0.9, 60)).toBeCloseTo(0.9, 9);
  });
  it('10 s ramp: minimum 0,793 at ≈ 0,8 s, lag ≤ 0,023, 0,9 after the ramp (numeric, 0,5 ms)', () => {
    const t = createHydroTurbine(0.8);
    t.command(0.9, 10);
    let min = 1;
    let tMin = 0;
    let lag = 0;
    for (let i = 0; i < 1500; i++) {
      t.step(0.01);
      const p = t.mechanicalPower;
      if (p < min) {
        min = p;
        tMin = t.timeS;
      }
      lag = Math.max(lag, t.gate - p);
    }
    expect(min).toBeCloseTo(0.793, 3);
    expect(Math.abs(tMin - 0.8)).toBeLessThan(0.1);
    expect(lag).toBeLessThan(0.0235);
    expect(t.mechanicalPower).toBeCloseTo(0.9, 3);
  });
  it('rpm 3000/p; black-start timeline', () => {
    expect([generatorRpm(1), generatorRpm(40)]).toEqual([3000, 75]);
    expect(blackStartScenario(1).phase).toBe('diesel');
    expect(blackStartScenario(36).phase).toBe('synchronised');
    expect(blackStartScenario(95)).toMatchObject({ phase: 'done', substations: 5 });
  });
});

describe('M6 reservoir', () => {
  it('Q_in 800 → h 0, 423,8 MW; equilibria 0,25 / 1,08 / 1,78 m; manual g 0,5 → 1,72 m', () => {
    expect(plantPowerMW(0, 800)).toBeCloseTo(423.8, 1);
    expect(equilibriumLevelM(2000)).toBeCloseTo(0.25, 2);
    expect(equilibriumLevelM(10000)).toBeCloseTo(1.08, 2);
    expect(equilibriumLevelM(20000)).toBeCloseTo(1.78, 2);
    expect(equilibriumLevelM(10000, 0.5)).toBeCloseTo(1.72, 2);
  });
  it('manual g = 0, Q_in 5000: 0,288 m/h → overtopping after ≈ 13,9 h', () => {
    const r = createReservoir();
    r.set({ inflowM3s: 5000, auto: false, gate: 0 });
    while (r.state.status !== 'overtopping') r.step(60);
    expect(r.state.timeS / 3600).toBeCloseTo(13.9, 1);
  });
  it('storm from 800 m³/s: auto max ≈ 1,24 m (spill ≈ 11 000); manual g 0: forced ≈ 7,9 h, overtopping ≈ 11,1 h', () => {
    const a = createReservoir();
    a.startStorm();
    let spill = 0;
    for (let i = 0; i < 40 * 60; i++) {
      a.step(60);
      spill = Math.max(spill, a.state.spillM3s);
    }
    expect(a.state.maxLevelM).toBeCloseTo(1.24, 2);
    expect(spill / 1000).toBeCloseTo(11, 0);
    const m = createReservoir();
    m.set({ auto: false, gate: 0 });
    m.startStorm();
    let forced = 0;
    while (m.state.status !== 'overtopping') {
      m.step(60);
      if (!forced && m.state.status === 'forced') forced = m.state.timeS / 3600;
    }
    expect(forced).toBeCloseTo(7.9, 1);
    expect(m.state.timeS / 3600).toBeCloseTo(11.1, 1);
  });
});

describe('M7 pumped storage', () => {
  it('Q_t 244,6, Q_p 251,8 m³/s; full pump 11,03 h / 4645 MWh, full turbine 11,35 h / 3679 MWh; η_cycle 0,792', () => {
    expect(Q_TURBINE).toBeCloseTo(244.6, 1);
    expect(Q_PUMP).toBeCloseTo(251.8, 1);
    const c = fullCycle();
    expect(c.pumpHours).toBeCloseTo(11.03, 2);
    expect(Math.round(c.energyInMWh)).toBe(4645);
    expect(c.turbineHours).toBeCloseTo(11.35, 2);
    expect(Math.round(c.energyOutMWh)).toBe(3679);
    expect(c.efficiency).toBeCloseTo(0.792, 3);
    expect(Math.round(storedEnergyMWh(PSH.volumeMaxM3))).toBe(3679);
  });
  it('auto plan: W_in 3368, W_out 2592 MWh, V_end 3,205·10⁶ m³, max 8,44·10⁶, profit 330 480 − 128 405 = 202 075 €', () => {
    const d = simulatePshDay(AUTO_PLAN);
    expect(d.energyInMWh).toBe(3368);
    expect(d.energyOutMWh).toBe(2592);
    expect(d.volumeEndM3 / 1e6).toBeCloseTo(3.205, 3);
    expect(d.maxVolumeM3 / 1e6).toBeCloseTo(8.44, 2);
    expect([d.revenueEur, d.costEur, d.profitEur]).toEqual([330480, 128405, 202075]);
  });
  it('limits stop the unit within the hour (pumping all day ends exactly at V_max)', () => {
    const d = simulatePshDay(Array.from({ length: 24 }, () => 'pump' as const));
    expect(d.volumeEndM3).toBeCloseTo(PSH.volumeMaxM3, 3);
    expect(d.hours.some((h) => h.fraction > 0 && h.fraction < 1)).toBe(true);
  });
});
