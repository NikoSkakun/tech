/**
 * Two-pole turbogenerator (3000 rpm, 50 Hz). The stator frame and core are built with a cutaway window, so
 * the inside reads at a glance: laminated core, three-phase stator winding (bars coloured L1 yellow / L2 green
 * / L3 red, end windings at both ends), and the cylindrical rotor whose two poles are marked N coral / S blue;
 * brushless exciter on the free end, line terminals in phase colours underneath.
 * Shaft along X: turbine coupling at x = 0, exciter toward +X. Units: metres (stator ≈ 7 m long).
 *
 * Parts: `rotor` (spins about X). Anchors: `coupling`, `u`, `v`, `w` (line terminals), `stator`, `core`,
 * `winding`, `pole.n`, `pole.s` (on the rotor), `exciter`.
 */
import { SEMANTIC, col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { addBearing, addCoupling } from './common';

export interface TurbogeneratorOptions {
  /** Angle of the cutaway window in radians (0 = closed machine). Default 2.0. */
  cut?: number;
  /** Height of the shaft axis above the floor. Default 3.2 (matches `steamTurbine`). */
  axisHeight?: number;
  /** Size multiplier. Default 1. */
  scale?: number;
}

export interface Turbogenerator extends KitModel {
  /** Rotor speed in rad/s for `update` (real: 314 rad/s — show it slowed down). */
  speed: number;
  readonly length: number;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addTurbogenerator(b: Builder, o: TurbogeneratorOptions = {}): { length: number; rotor: string } {
  const k = o.scale ?? 1;
  const ay = o.axisHeight ?? 3.2;
  const cut = o.cut ?? 2.0;
  const L = 7 * k; // stator frame length
  const R = 2.3 * k; // frame radius
  const rCore = 1.75 * k;
  const rBore = 0.98 * k;
  const rRotor = 0.9 * k;
  const shaftR = 0.3 * k;
  const x0 = 2.2 * k; // start of the frame (after the turbine-end bearing)
  const frame = col('teal');
  const rot = [0, 0, -Math.PI / 2] as const;
  // window faces the viewer (+Z) and up: lathe φ = π/2 is +Z, φ = π is up (see machines/common)
  const win = { phiStart: Math.PI * 0.72 + cut / 2, phiLength: Math.PI * 2 - cut };
  const section = (r0: number, r1: number, xa: number, xb: number): G.Pt[] => [[r0, xa], [r1, xa], [r1, xb], [r0, xb]];
  const rotorName = b.fullName('rotor');
  const rotor = b.part('rotor', { at: [0, ay, 0] });
  b.frame({ at: [0, ay, 0] }, () => {
    // frame shell with end bells, stiffening rings, cooler domes on top
    const f = G.revolve(section(R - 0.12 * k, R, x0, x0 + L), { seg: 40, ...win });
    b.add(f.shell, { slot: 'gloss', c: [frame.clone().multiplyScalar(0.78), frame], rot });
    if (f.caps) b.add(f.caps, { slot: 'gloss', c: col('coral').lerp(col('white'), 0.45), rot });
    for (const [xa, dir] of [[x0, -1], [x0 + L, 1]] as const) {
      b.lathe([[shaftR + 0.2 * k, 0], [R * 0.55, 0.15 * k], [R, 0.9 * k], [R, 0.95 * k]], { axis: 'x', seg: 36, slot: 'gloss', c: frame, at: [xa + dir * 0.9 * k, 0, 0], s: [-dir, 1, 1], crease: 40 });
    }
    for (let i = 1; i < 5; i++) b.ring(R, 0.07 * k, { axis: 'x', seg: 40, tubeSeg: 5, slot: 'gloss', c: frame.clone().multiplyScalar(0.85), at: [x0 + (i / 5) * L, 0, 0] });
    for (const x of [x0 + L * 0.25, x0 + L * 0.75]) b.box(1.6 * k, 0.8 * k, 1.8 * k, { r: 0.25 * k, slot: 'gloss', c: frame.clone().multiplyScalar(0.9), at: [x, R - 0.25 * k, -0.4 * k] });
    b.anchor('stator', x0 + L / 2, R + 0.6 * k, 0);
    // laminated core (a few packets separated by vent ducts)
    for (let i = 0; i < 6; i++) {
      const xa = x0 + 0.9 * k + (i / 6) * (L - 1.8 * k);
      const c = G.revolve(section(rBore, rCore, xa, xa + (L - 1.8 * k) / 6 - 0.07 * k), { seg: 36, ...win });
      b.add(c.shell, { slot: 'metal', c: col('slate').lerp(col('steel'), i % 2 ? 0.5 : 0.25), rot });
      if (c.caps) b.add(c.caps, { slot: 'metal', c: 'steel.light', rot });
    }
    b.anchor('core', x0 + L / 2, rCore, rCore * 0.6);
    // stator winding: bars in the slots along the bore and looping end windings, phase-coloured in belts
    const bars = 36;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2;
      // skip the bars that would hang in the open window (lathe angle of this bar: φ = π − a)
      const d = Math.PI - a - Math.PI * 0.72;
      const inWindow = cut > 0 && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < cut / 2;
      const c = PHASE[Math.floor(i / (bars / 6)) % 3]!;
      const y = Math.cos(a) * (rBore + 0.07 * k);
      const z = Math.sin(a) * (rBore + 0.07 * k);
      if (!inWindow) b.cyl(0.045 * k, L - 1.5 * k, { axis: 'x', seg: 5, slot: 'gloss', c, at: [x0 + 0.75 * k, y, z], bevel: 0 });
      for (const [xe, dir] of [[x0 + 0.75 * k, -1], [x0 + L - 0.75 * k, 1]] as const) {
        b.rod([xe, y, z], [xe + dir * 0.55 * k, y * 1.45, z * 1.45], 0.05 * k, { slot: 'gloss', c, seg: 5 });
      }
    }
    for (const xe of [x0 + 0.2 * k, x0 + L - 0.2 * k]) b.ring(rBore * 1.48, 0.07 * k, { axis: 'x', seg: 36, tubeSeg: 5, slot: 'gloss', c: 'orange', at: [xe, 0, 0] });
    b.anchor('winding', x0 + 0.3 * k, rBore * 1.5, 0);
    // rotor: forging with slot wedges, pole faces N / S, retaining rings, fans, shaft
    rotor.cyl(rRotor, L - 1.7 * k, { axis: 'x', seg: 32, slot: 'metal', c: 'steel.light', at: [x0 + 0.85 * k, 0, 0], bevel: 0.03 * k });
    for (const [sign, c, name] of [[1, SEMANTIC.proton, 'pole.n'], [-1, 'blue', 'pole.s']] as const) {
      rotor.add(G.lathe([[rRotor + 0.012 * k, 0], [rRotor + 0.012 * k, L - 2.1 * k]], { seg: 10, phiStart: -0.5, phiLength: 1.0 }), { slot: 'gloss', c, at: [x0 + 1.05 * k, 0, 0], rot: [sign > 0 ? 0 : Math.PI, 0, -Math.PI / 2] });
      rotor.anchor(name, x0 + L / 2, -sign * (rRotor + 0.1 * k), 0);
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      if (Math.abs(Math.cos(a)) > 0.86) continue; // pole faces carry no slots
      rotor.box(L - 2.1 * k, 0.03 * k, 0.07 * k, { r: 0, mid: true, slot: 'metal', c: 'orange', at: [x0 + L / 2, Math.cos(a) * (rRotor + 0.005 * k), Math.sin(a) * (rRotor + 0.005 * k)], rot: [a, 0, 0] });
    }
    for (const xe of [x0 + 0.62 * k, x0 + L - 0.62 * k]) rotor.cyl(rRotor * 1.04, 0.5 * k, { axis: 'x', seg: 28, slot: 'metal', c: 'mist', at: [xe - 0.25 * k, 0, 0], bevel: 0.05 * k });
    const total = x0 + L + 4.4 * k;
    rotor.cyl(shaftR, total - 0.1, { axis: 'x', seg: 14, slot: 'metal', c: 'mist', at: [0.05, 0, 0], bevel: 0.03 });
    addCoupling(rotor, 0.2 * k, shaftR);
    addBearing(b, 1.1 * k, ay, shaftR);
    addBearing(b, x0 + L + 1.3 * k, ay, shaftR);
    // brushless exciter with cooling fins
    const xe = x0 + L + 2.4 * k;
    b.cyl(0.95 * k, 1.5 * k, { axis: 'x', seg: 24, slot: 'gloss', c: ['amber', 'yellow'], at: [xe, 0, 0], bevel: 0.1 * k });
    for (let i = 0; i < 5; i++) b.ring(0.96 * k, 0.05 * k, { axis: 'x', seg: 24, tubeSeg: 4, slot: 'gloss', c: 'amber', at: [xe + 0.2 * k + i * 0.28 * k, 0, 0] });
    b.box(1.2 * k, ay - 0.6 * k, 1.5 * k, { r: 0.12 * k, slot: 'matte', c: ['steel', 'mist'], at: [xe + 0.75 * k, -ay, 0] });
    b.anchor('exciter', xe + 0.75 * k, 1.1 * k, 0);
    b.anchor('coupling', 0, 0, 0);
    // feet and line terminals (bushings under the frame, exciter end)
    for (const x of [x0 + 0.8 * k, x0 + L - 0.8 * k]) b.box(1.0 * k, ay - R * 0.55, R * 2.3, { r: 0.12 * k, slot: 'matte', c: ['steel', 'mist'], at: [x, -ay, 0] });
    (['u', 'v', 'w'] as const).forEach((name, i) => {
      const z = (i - 1) * 0.9 * k;
      b.cyl(0.2 * k, 1.1 * k, { seg: 10, slot: 'gloss', c: col('wireBrown').lerp(col('coral.dark'), 0.45), at: [x0 + L - 1.9 * k, -R - 0.9 * k, z] });
      b.cyl(0.26 * k, 0.16 * k, { seg: 10, slot: 'gloss', c: PHASE[i]!, at: [x0 + L - 1.9 * k, -R - 1.05 * k, z] });
      b.anchor(name, x0 + L - 1.9 * k, -R - 1.1 * k, z);
    });
  });
  return { length: x0 + L + 4.4 * k, rotor: rotorName };
}

export function turbogenerator(o: TurbogeneratorOptions = {}): Turbogenerator {
  const b = new Builder('turbogenerator');
  const info = addTurbogenerator(b, o);
  const model = b.build();
  const gen: Turbogenerator = Object.assign(model, { speed: 2.5, length: info.length });
  gen.update = (dt) => {
    model.part(info.rotor).rotation.x += gen.speed * dt;
  };
  return gen;
}
