import { describe, expect, it } from 'vitest';
import {
  IDLE_KWH_PER_DAY,
  LI6_LOSSES,
  boostDuty,
  clippedPoint,
  createGridTie,
  createHBridge,
  createLoadTester,
  createMpptController,
  dispatchPQ,
  eastWestMismatch,
  efficiency,
  euroEfficiency,
  filterWarning,
  holdUpTimeS,
  inrushCurrentA,
  pcSurvives,
  peakEfficiency,
  phasorFromPQ,
  phasorFromPU,
  pllLockTimeS,
  stringCurve,
  switchLosses,
  syncCheck,
  tapLosses,
  upsSagResponse,
  vfdPump,
} from '..';

describe('lab-inverter §M1 H-bridge', () => {
  it('valid pairs give +U / −U / 0; lamp current = U/R', () => {
    const b = createHBridge({ udcV: 325, keys: [true, false, false, true] });
    expect(b.state.uLoadV).toBe(325);
    expect(b.state.polarity).toBe('+U');
    b.step(0.001);
    expect(b.state.iLoadA).toBeCloseTo(325 / 26.45, 9);
    expect(b.state.conducting).toEqual(['S1', 'S4']);
    b.set({ keys: [false, true, true, false] });
    b.step(0.001);
    expect(b.state.uLoadV).toBe(-325);
    b.set({ keys: [true, false, true, false] });
    b.step(0.001);
    expect(b.state.uLoadV).toBe(0);
    expect(b.state.polarity).toBe('0');
  });

  it('shoot-through: blocked with protection; with protection off → fault, burnt for 1.5 s, then repaired', () => {
    const b = createHBridge({ keys: [true, false, false, true] });
    b.set({ keys: [true, true, false, true] });
    expect(b.state.blocked).toBe(true);
    expect(b.state.fault).toBe(false);
    expect(b.state.gates).toEqual([true, false, false, true]);
    b.set({ protection: false, keys: [true, true, false, false] });
    expect(b.state.fault).toBe(true);
    expect(b.state.gates).toEqual([false, false, false, false]);
    b.step(1.0);
    expect(b.state.fault).toBe(true);
    b.step(0.6);
    expect(b.state.fault).toBe(false);
    expect(b.state.burntRemainingS).toBe(0);
  });

  it('auto 50 Hz square with RL motor: current follows the exact RL response; freewheels through diodes in dead time', () => {
    const b = createHBridge({ mode: 'auto50', load: 'motor', udcV: 325, deadTimeS: 5e-6 });
    // advance in frame-sized steps for several periods
    for (let k = 0; k < 30; k++) b.step(1 / 30);
    // Steady-state square-wave RL current: peak at the end of each half-period i = (U/R)·tanh(T/(4τ))
    const tau = 0.05 / 26.45;
    const ipk = (325 / 26.45) * Math.tanh(0.02 / (4 * tau));
    // go to just before a positive edge's dead-time: t = 1.0 s is an edge (k = 100, positive half)
    const b2 = createHBridge({ mode: 'auto50', load: 'motor', udcV: 325, deadTimeS: 5e-6 });
    for (let k = 0; k < 99; k++) b2.step(0.01);
    b2.step(0.01 - 1e-7);
    expect(Math.abs(b2.state.iLoadA)).toBeCloseTo(ipk, 1);
    const iBefore = b2.state.iLoadA; // negative half just ended → i < 0
    expect(iBefore).toBeLessThan(0);
    b2.step(2e-6); // inside the dead time
    expect(b2.state.inDeadTime).toBe(true);
    expect(b2.state.conducting).toEqual(['D1', 'D4']);
    expect(b2.state.uLoadV).toBe(325); // i < 0: leg A top diode (U_dc), leg B bottom diode (0)
    expect(Math.abs(b2.state.iLoadA)).toBeLessThan(Math.abs(iBefore));
    b2.step(5e-6);
    expect(b2.state.inDeadTime).toBe(false);
    expect(b2.state.conducting).toEqual(['D1', 'D4']); // still negative current but S1/S4 gated: diodes conduct
    for (const v of [b.state.iLoadA, b.state.uLoadV]) expect(Number.isFinite(v)).toBe(true);
  });

  it('lamp in dead time: both legs floating → u = 0, i = 0', () => {
    const b = createHBridge({ mode: 'auto50', load: 'lamp', deadTimeS: 5e-6 });
    b.step(0.01 + 2e-6);
    expect(b.state.inDeadTime).toBe(true);
    expect(b.state.uLoadV).toBe(0);
    expect(b.state.iLoadA).toBe(0);
  });
});

describe('lab-inverter §M5 losses, efficiency, boost', () => {
  it('switch vs tap: 400 V, 10 A, 20 kHz → 8 W per switch, 16 W per bridge; tap at 230 V → 1700 W', () => {
    const s = switchLosses(230, 10, 20000);
    expect(s.conductionW).toBeCloseTo(4, 9);
    expect(s.switchingW).toBeCloseTo(4, 9);
    expect(s.pLossW).toBeCloseTo(16, 9);
    const t = tapLosses(230, 10);
    expect(t.pLossW).toBe(1700);
    expect(t.efficiency).toBeCloseTo(0.575, 9);
    expect(switchLosses(230, 10, 200000).switchingW).toBeCloseTo(40, 9);
  });
  it('ЛІ-6 efficiency curves', () => {
    const pv = LI6_LOSSES.pvToAc;
    const bat = LI6_LOSSES.batToAc;
    const pct = (x: number) => Math.round(x * 10000) / 100;
    expect([100, 600, 3000, 6000].map((p) => pct(efficiency(p, pv)))).toEqual([82.5, 95.58, 97.74, 97.62]);
    expect([100, 600, 3000, 6000].map((p) => pct(efficiency(p, bat)))).toEqual([65.78, 90.49, 95.63, 95.57]);
    expect(Math.round(peakEfficiency(pv).pW)).toBe(3651);
    expect(pct(peakEfficiency(pv).eta)).toBe(97.76);
    expect(Math.round(peakEfficiency(bat).pW)).toBe(4082);
    expect(pct(peakEfficiency(bat).eta)).toBe(95.74);
    expect(pct(euroEfficiency(pv))).toBe(97.32);
    expect(pct(euroEfficiency(bat))).toBe(94.67);
    expect(efficiency(0, pv)).toBe(0);
  });
  it('boost duty: 250 → 0.375; 150 → 0.625; 48 → 0.880; ≥ 400 → 0', () => {
    expect(boostDuty(250)).toBeCloseTo(0.375, 9);
    expect(boostDuty(150)).toBeCloseTo(0.625, 9);
    expect(boostDuty(48)).toBeCloseTo(0.88, 9);
    expect(boostDuty(450)).toBe(0);
  });
});

describe('lab-inverter §M6 grid tie', () => {
  it('phasors with U_inv = U: δ = 1.02/3.06/6.14°, Q = −9/−80/−322 var', () => {
    const r = [1000, 3000, 6000].map((p) => phasorFromPU(p, 230));
    expect(r.map((x) => Math.round(x.deltaDeg * 100) / 100)).toEqual([1.02, 3.06, 6.14]);
    expect(r.map((x) => Math.round(x.qVar))).toEqual([-9, -80, -322]);
    const a = phasorFromPU(3000, 232);
    expect(a.deltaDeg).toBeCloseTo(3.04, 2);
    expect(Math.round(a.qVar)).toBe(409);
    expect(Math.round(phasorFromPU(3000, 235).qVar)).toBe(1142);
    const q0 = phasorFromPQ(3000, 0);
    expect(q0.uInvV).toBeCloseTo(230.33, 2);
    expect(q0.deltaDeg).toBeCloseTo(3.06, 2);
  });
  it('apparent power limit clips Q', () => {
    const d = dispatchPQ(5000, 4000);
    expect(d.qLimited).toBe(true);
    expect(Math.hypot(d.pW, d.qVar)).toBeCloseTo(6000, 6);
    expect(dispatchPQ(3000, 1000).qLimited).toBe(false);
  });
  it('PLL lock from 90°: 0.303 s (K_p 2), 0.121 s (5), 0.061 s (10)', () => {
    expect(pllLockTimeS(90, 2)).toBeCloseTo(0.303, 3);
    expect(pllLockTimeS(90, 5)).toBeCloseTo(0.121, 3);
    expect(pllLockTimeS(90, 10)).toBeCloseTo(0.061, 3);
  });
  it('sync check limits', () => {
    expect(syncCheck(0.1, 10, 0.05).inSync).toBe(true);
    expect(syncCheck(0.11, 0, 0).inSync).toBe(false);
    expect(syncCheck(0, 10.5, 0).inSync).toBe(false);
    expect(syncCheck(0, 0, 0.06).inSync).toBe(false);
  });
  it('time-domain: PLL locks, soft close; out-of-sync close → inrush; islanding trip at 0.6 s', () => {
    const g = createGridTie();
    expect(g.state.sync.inSync).toBe(false);
    const bad = inrushCurrentA(90);
    expect(bad).toBeGreaterThan(300);
    g.enablePll();
    g.step(0.5);
    expect(Math.abs(g.state.dphiDeg)).toBeLessThan(2);
    expect(g.state.sync.inSync).toBe(true);
    expect(g.closeRelay().soft).toBe(true);
    g.setGrid(false);
    for (let k = 0; k < 30; k++) g.step(1 / 30);
    expect(g.state.islandingDetected).toBe(true);
    expect(g.state.tripTimeS).toBeCloseTo(0.6, 3);
    expect(g.state.relayClosed).toBe(false);
    expect(g.state.outputOn).toBe(false);
    const f = createGridTie({ control: 'grid-forming' });
    f.setPhaseErrorDeg(45);
    expect(f.closeRelay().soft).toBe(false);
    f.setGrid(false);
    f.step(1);
    expect(f.state.outputOn).toBe(true);
    expect(f.state.fInvHz).toBe(50);
  });
});

describe('lab-inverter §M7 load tester (step 12)', () => {
  it('kettle + microwave + fridge start = 3950 W ≤ 12 kW, 3350 W ≤ 6 kW → OK', () => {
    const t = createLoadTester();
    t.add('kettle');
    t.add('microwave');
    t.add('fridge');
    expect(t.state.pW).toBe(3950);
    t.step(0.31);
    expect(t.state.pW).toBe(3350);
    t.step(20);
    expect(t.state.status).toBe('ok');
  });
  it('3 kettles + pump start → 11 000 W peak, 7000 W running → trip after 10 s; restart 5 s after load reduced', () => {
    const t = createLoadTester();
    t.add('kettle');
    t.add('kettle');
    const k3 = t.add('kettle');
    t.add('well_pump');
    expect(t.state.pW).toBe(11000);
    expect(t.state.status).toBe('ok');
    t.step(0.6);
    expect(t.state.pW).toBe(7000);
    expect(t.state.status).toBe('overload-timer');
    t.step(9.3);
    expect(t.state.status).toBe('overload-timer');
    t.step(0.2);
    expect(t.state.status).toBe('tripped');
    expect(t.state.tripReason).toBe('overload-10s');
    t.step(6);
    expect(t.state.status).toBe('tripped'); // load not reduced
    t.remove(k3);
    t.step(0.02);
    expect(t.state.status).toBe('ok');
  });
  it('instant trip above the 12 kW peak', () => {
    const t = createLoadTester();
    for (let k = 0; k < 6; k++) t.add('kettle');
    t.add('well_pump');
    expect(t.state.status).toBe('tripped');
    expect(t.state.tripReason).toBe('peak');
  });
  it('idle consumption 50 W × 24 h = 1.2 kWh', () => {
    expect(IDLE_KWH_PER_DAY).toBeCloseTo(1.2, 9);
  });
});

describe('lab-inverter step 7 MPPT controller', () => {
  it('STC, 6 modules: V_mp ≈ 198.4 V → D ≈ 0.504, P ≈ 2639 W; auto P&O reaches it', () => {
    const c = stringCurve(1000, 25);
    expect(c.mpp.vV).toBeCloseTo(198.4, 0);
    expect(c.mpp.pW).toBeCloseTo(2639, -1);
    const m = createMpptController({ dutyManual: 0.3 });
    for (let k = 0; k < 40 * 30; k++) m.step(1 / 30);
    expect(m.state.mppDuty).toBeCloseTo(0.504, 2);
    expect(Math.abs(m.state.duty - 0.504)).toBeLessThan(0.02);
    expect(m.state.powerW).toBeGreaterThan(2620);
  });
  it('east 800 / west 200: one MPPT loses a little vs two MPPTs', () => {
    const r = eastWestMismatch();
    expect(r.oneMpptW).toBeLessThanOrEqual(r.twoMpptW);
    expect(r.lossFraction).toBeGreaterThanOrEqual(0);
    expect(r.lossFraction).toBeLessThan(0.02);
  });
  it('clipping: 8 kWp on 6 kW → operating point right of the MPP at 6 kW', () => {
    const m = createMpptController({ clipping: true, dutyManual: 0.5 });
    for (let k = 0; k < 60 * 30; k++) m.step(1 / 30);
    const cp = clippedPoint(m.curve(), 6000);
    expect(cp.clipped).toBe(true);
    expect(cp.vV).toBeGreaterThan(m.curve().mpp.vV);
    expect(m.state.powerW).toBeLessThanOrEqual(6000);
    expect(m.state.powerW).toBeGreaterThan(5800);
    expect(m.state.pvVoltageV).toBeGreaterThan(m.curve().mpp.vV);
  });
});

describe('lab-inverter calculators (steps 5, 10, 11)', () => {
  it('filter warnings', () => {
    expect(filterWarning(1.5e-3, 10e-6, 20000)).toBeNull();
    expect(filterWarning(0.2e-3, 1e-6, 20000)).toBe('too-small');
    expect(filterWarning(5e-3, 50e-6, 20000)).toBe('oversized');
  });
  it('UPS hold-up: 400 W 16.8 ms, 300 W 22.4 ms, 200 W 33.5 ms, 100 W 67.1 ms', () => {
    expect(holdUpTimeS(400) * 1000).toBeCloseTo(16.8, 1);
    expect(holdUpTimeS(300) * 1000).toBeCloseTo(22.4, 1);
    expect(holdUpTimeS(200) * 1000).toBeCloseTo(33.5, 1);
    expect(holdUpTimeS(100) * 1000).toBeCloseTo(67.1, 1);
    expect(pcSurvives(0.01, 300)).toBe(true);
    expect(pcSurvives(0.03, 300)).toBe(false);
    expect(pcSurvives(0.008, 300)).toBe(true);
    expect(upsSagResponse('lineInteractive').uOutV).toBeCloseTo(218.5, 9);
    expect(upsSagResponse('offline').source).toBe('battery');
  });
  it('VFD pump: 10 Hz → 300 rpm, 50 Hz → 1500 rpm, 25 Hz → 1.4 kW', () => {
    expect(vfdPump(10).rpm).toBe(300);
    expect(vfdPump(50).rpm).toBe(1500);
    expect(vfdPump(25).powerW / 1000).toBeCloseTo(1.375, 9);
  });
});
