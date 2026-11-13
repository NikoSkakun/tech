/**
 * Three-phase induction motor (totally enclosed, fan-cooled): finned frame, end shields, fan cowl, terminal
 * box, feet, shaft with key. A cutaway window shows the stator winding (phase colours) and the squirrel-cage
 * rotor (aluminium bars and end rings). Shaft along X toward +X; origin under the centre, on the floor.
 * Units: metres (frame ≈ 0.9 m long at scale 1 — a 30–50 kW machine).
 *
 * Parts: `rotor` (spins about X). Anchors: `shaft` (drive end), `terminals`, `stator`, `cage`, `fan`.
 */
import { SEMANTIC, col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

export interface MotorOptions {
  scale?: number;
  /** Cutaway window, radians (0 = closed). Default 1.9. */
  cut?: number;
  color?: ColorLike;
}

export interface Motor extends KitModel {
  /** Rotor speed in rad/s for `update` (real: ≈ 150 rad/s for a 4-pole motor at 50 Hz — slow it down). */
  speed: number;
}

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;

export function addMotor(b: Builder, o: MotorOptions = {}): string {
  const k = o.scale ?? 1;
  const cut = o.cut ?? 1.9;
  const c = col(o.color ?? 'blue');
  const R = 0.32 * k;
  const L = 0.7 * k;
  const ay = R + 0.12 * k;
  const rot = [0, 0, -Math.PI / 2] as const;
  const win = { phiStart: Math.PI * 0.72 + cut / 2, phiLength: Math.PI * 2 - cut };
  const section = (r0: number, r1: number, xa: number, xb: number): G.Pt[] => [[r0, xa], [r1, xa], [r1, xb], [r0, xb]];
  const rotorName = b.fullName('rotor');
  const rotor = b.part('rotor', { at: [0, ay, 0] });
  b.frame({ at: [0, ay, 0] }, () => {
    const f = G.revolve(section(R * 0.84, R, -L / 2, L / 2), { seg: 32, ...win });
    b.add(f.shell, { slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], rot });
    if (f.caps) b.add(f.caps, { slot: 'gloss', c: col('coral').lerp(col('white'), 0.45), rot });
    // cooling fins along the frame (not across the window)
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const d = Math.PI - a - Math.PI * 0.72;
      if (cut > 0 && Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < cut / 2 + 0.08) continue;
      b.box(L * 0.92, 0.07 * k, 0.018 * k, { r: 0, mid: true, slot: 'gloss', c: c.clone().multiplyScalar(0.9), at: [0, Math.cos(a) * (R + 0.03 * k), Math.sin(a) * (R + 0.03 * k)], rot: [a, 0, 0] });
    }
    // stator core and winding with end turns
    const core = G.revolve(section(R * 0.56, R * 0.84, -L * 0.36, L * 0.36), { seg: 32, ...win });
    b.add(core.shell, { slot: 'metal', c: col('slate').lerp(col('steel'), 0.35), rot });
    if (core.caps) b.add(core.caps, { slot: 'metal', c: 'steel.light', rot });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.ring(R * (0.6 + i * 0.08), 0.03 * k, { axis: 'x', seg: 24, tubeSeg: 5, slot: 'gloss', c: PHASE[i]!, at: [s * (L * 0.36 + 0.035 * k + i * 0.012 * k), 0, 0] });
    }
    b.anchor('stator', 0, R * 0.9, R * 0.5);
    // end shields, fan cowl with slots, terminal box, feet, lifting eye
    for (const s of [-1, 1]) b.dome(R, 0.1 * k, { axis: 'x', seg: 32, slot: 'gloss', c, at: [s * (L / 2), 0, 0], s: [s, 1, 1] });
    b.cyl(R * 1.04, 0.22 * k, { axis: 'x', seg: 32, slot: 'gloss', c: 'slate', at: [-L / 2 - 0.3 * k, 0, 0], bevel: 0.04 * k });
    for (let i = 0; i < 5; i++) b.ring(R * (0.25 + i * 0.16), 0.008 * k, { axis: 'x', seg: 20, tubeSeg: 3, slot: 'gloss', c: 'ink', at: [-L / 2 - 0.3 * k, 0, 0] });
    b.anchor('fan', -L / 2 - 0.35 * k, 0, 0);
    b.box(0.24 * k, 0.14 * k, 0.22 * k, { r: 0.03 * k, slot: 'gloss', c: c.clone().multiplyScalar(0.9), at: [-L * 0.12, R * 0.95, 0] });
    b.cyl(0.03 * k, 0.06 * k, { axis: 'z', seg: 8, slot: 'gloss', c: 'ink', at: [-L * 0.12, R * 0.95 + 0.07 * k, 0.11 * k] });
    b.anchor('terminals', -L * 0.12, R + 0.22 * k, 0);
    for (const s of [-1, 1]) b.box(0.12 * k, 0.1 * k, R * 2.5, { r: 0.02 * k, slot: 'gloss', c: c.clone().multiplyScalar(0.8), at: [s * L * 0.32, -ay, 0] });
    b.ring(0.04 * k, 0.012 * k, { axis: 'z', seg: 12, tubeSeg: 4, slot: 'metal', c: 'steel', at: [L * 0.2, R + 0.05 * k, 0] });
    // rotor: laminated body with skewed cage bars and end rings, internal fan, shaft with key
    rotor.cyl(R * 0.53, L * 0.72, { axis: 'x', seg: 28, slot: 'metal', c: 'steel', at: [-L * 0.36, 0, 0], bevel: 0.01 * k });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      rotor.box(L * 0.7, 0.012 * k, 0.03 * k, { r: 0, mid: true, slot: 'metal', c: 'mist', at: [0, Math.cos(a) * R * 0.535, Math.sin(a) * R * 0.535], rot: [a, 0.12, 0] });
    }
    for (const s of [-1, 1]) rotor.ring(R * 0.47, 0.03 * k, { axis: 'x', seg: 24, tubeSeg: 5, slot: 'metal', c: 'mist', at: [s * (L * 0.36 + 0.02 * k), 0, 0] });
    rotor.anchor('cage', 0, R * 0.55, 0);
    rotor.cyl(0.06 * k, L + 0.75 * k, { axis: 'x', seg: 12, slot: 'metal', c: 'mist', at: [-L / 2 - 0.25 * k, 0, 0], bevel: 0.008 * k });
    rotor.box(0.14 * k, 0.02 * k, 0.03 * k, { r: 0, mid: true, slot: 'metal', c: 'slate', at: [L / 2 + 0.35 * k, 0.06 * k, 0] });
    rotor.anchor('shaft', L / 2 + 0.5 * k, 0, 0);
  });
  return rotorName;
}

export function motor(o: MotorOptions = {}): Motor {
  const b = new Builder('motor');
  const rotorName = addMotor(b, o);
  const model = b.build();
  const m: Motor = Object.assign(model, { speed: 4 });
  m.update = (dt) => {
    model.part(rotorName).rotation.x += m.speed * dt;
  };
  return m;
}
