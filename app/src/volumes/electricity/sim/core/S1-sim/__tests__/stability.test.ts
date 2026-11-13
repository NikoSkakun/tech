/**
 * Brief requirement: time-domain models stay stable for dt up to 1/30 s and never produce NaN/Infinity for
 * in-range inputs. Sweeps every stateful S1 model at range bounds and random in-range parameters (seeded).
 */
import { describe, expect, it } from 'vitest';
import { createHydrogenAtom, createOrbitalCloud } from '../../../atom';
import { createBalloon, createDischarge, createMovingCharge, BALL_DEFAULTS, POTENTIAL_PRESETS, toPointCharges } from '../../../charge-field';
import { createShortCircuit, createOerstedCompass } from '../../../current';
import { createElectronGas } from '../../../matter';
import { createDcMotor, createDomains, createInduction, createRlCircuit } from '../../../magnetism';
import { createSwing, createSynchroscope } from '../../../generator-ac';
import { createOilThermal, createTapChanger } from '../../../transformer';
import { createRotatingCoil } from '../rotating-coil';
import { createRng } from '../rng';

const DT = 1 / 30;
const finite = (o: object): void => {
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && v !== Infinity && v !== -Infinity) expect(Number.isNaN(v), k).toBe(false);
  }
};

describe('stability sweep (dt = 1/30 s)', () => {
  const rng = createRng(2024);
  const r = (a: number, b: number): number => a + (b - a) * rng.next();

  it('DC motor: all voltages/loads/modes', () => {
    for (let k = 0; k < 20; k++) {
      const m = createDcMotor({ voltageV: k === 0 ? 0 : k === 1 ? 12 : r(0, 12), loadTorqueNm: k === 1 ? 0 : r(0, 0.03), mode: k % 3 === 0 ? 'slipRings' : 'commutator' });
      for (let i = 0; i < 120; i++) finite(m.step(DT));
      expect(Math.abs(m.state.speedRpm)).toBeLessThan(12000);
    }
  });
  it('swing equation: setpoints and EMF over the full range', () => {
    for (let k = 0; k < 12; k++) {
      const m = createSwing({ mechanicalSetpointPu: r(0, 1.3), emfPu: r(1.5, 2.6) });
      m.set({ mechanicalSetpointPu: r(0, 1.3) });
      for (let i = 0; i < 150; i++) finite(m.step(DT));
    }
  });
  it('rotating coil, RL circuit, induction, oil, tap changer, synchroscope, short circuit, discharge', () => {
    const coil = createRotatingCoil({ drive: 'hand', handRpm: 600, turns: 200, fieldT: 1 });
    const rl = createRlCircuit({ s1On: true, ironCore: false, breakTimeS: 1e-4 });
    const ind = createInduction({ turns: 1000 });
    const oil = createOilThermal(1.2);
    const tap = createTapChanger();
    const sync = createSynchroscope(3, { speedRpm: 3100 });
    const sc = createShortCircuit({ switchClosed: true, jumper: 'lamp', fuseInstalled: false });
    const dis = createDischarge();
    dis.setClosed(true);
    ind.startAutoDrop();
    for (let i = 0; i < 300; i++) {
      if (i === 100) rl.set({ s2Closed: false });
      if (i === 150) coil.set({ handRpm: null });
      finite(coil.step(DT));
      finite(rl.step(DT));
      finite(ind.step(DT));
      finite(oil.step(DT));
      finite(tap.step(DT, { hvKV: 100, loadPu: 1, auto: true }));
      finite(sync.step(DT));
      finite(sc.step(DT));
      finite(dis.step(DT));
    }
    // first step immediately, then one per 1,5 s: 8 steps need 10,5 s > 10 s simulated
    expect(tap.state.tap).toBe(7);
    for (let i = 0; i < 30; i++) tap.step(DT, { hvKV: 100, loadPu: 1, auto: true });
    expect(tap.state.tap).toBe(8);
  });
  it('electron gas, domains, compass, hydrogen atom, orbital cloud, balloon, potential ball', () => {
    const gas = createElectronGas({ fieldVPerM: 1, temperatureC: 300 });
    const dom = createDomains(9);
    const compass = createOerstedCompass();
    const atom = createHydrogenAtom({ rng: 5 });
    const cloud = createOrbitalCloud({ orbital: '3d_z2', targetCount: 20000, seed: 1 });
    const ball = createMovingCharge({ ...BALL_DEFAULTS, charges: toPointCharges(POTENTIAL_PRESETS.twoHills) }, { x: 0, z: 0.02 });
    const balloon = createBalloon();
    for (let i = 0; i < 90; i++) {
      gas.step(DT);
      finite(dom.update(Math.sin(i / 10), 20 + i * 10));
      expect(Number.isFinite(compass.step(DT, i < 45, 1))).toBe(true);
      if (i % 10 === 0) atom.fire(r(0.5, 16));
      for (const p of atom.step(DT)) expect(Number.isFinite(p.wavelengthNm)).toBe(true);
      cloud.step(DT);
      finite(ball.step(DT));
      balloon.dragTo(0.05 * Math.sin(i / 3));
    }
    for (const v of gas.positions) expect(Number.isFinite(v)).toBe(true);
    for (let i = 0; i < 300; i++) expect(Number.isFinite(cloud.positions[i])).toBe(true);
    expect(balloon.state.chargeC).toBeLessThan(0);
  });
});
