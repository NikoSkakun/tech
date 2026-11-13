/**
 * Sun-tracking equipment: single-axis PV tracker (a row of modules on a torque tube), heliostat (two-axis
 * mirror for a solar tower) and parabolic trough (line-focus collector with its receiver tube).
 * Each has moving parts and an aiming method. Units: metres.
 */
import { Vector3 } from 'three';
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { PV_MODULE, addPvModule } from './pv';

export interface Tracker extends KitModel {
  /** Rotation of the table about the north–south tube, radians (−π/3 = facing east … +π/3 = facing west). */
  setAngle(angle: number): void;
}

/** Single-axis tracker: torque tube along Z (north–south), `modules` portrait modules. Part: `table`. */
export function pvTracker(o: { modules?: number; height?: number } = {}): Tracker {
  const n = o.modules ?? 10;
  const h = o.height ?? 1.9;
  const pitch = PV_MODULE.width + 0.03;
  const len = n * pitch;
  const alu = col('mist').lerp(col('steel'), 0.35);
  const b = new Builder('pv-tracker');
  const posts = Math.max(2, Math.round(len / 4.5) + 1);
  for (let i = 0; i < posts; i++) {
    const z = (i / (posts - 1) - 0.5) * (len - 0.6);
    b.box(0.14, h + 0.4, 0.14, { r: 0.02, slot: 'metal', c: alu, at: [0, -0.4, z] });
    b.cyl(0.13, 0.2, { axis: 'z', seg: 10, slot: 'metal', c: 'slate', at: [0, h, z - 0.1] });
  }
  b.box(0.4, 0.5, 0.5, { r: 0.06, slot: 'gloss', c: 'yellow', at: [0.2, h - 0.6, 0] });
  const table = b.part('table', { at: [0, h, 0] });
  table.cyl(0.07, len + 0.3, { axis: 'z', seg: 8, slot: 'metal', c: alu, at: [0, 0, -len / 2 - 0.15] });
  for (let i = 0; i < n; i++) {
    // portrait across the tube: the module's long side runs east–west
    table.frame({ at: [0, 0.13, (i + 0.5) * pitch - len / 2], rot: [0, Math.PI / 2, 0] }, () => addPvModule(table), `m${i + 1}.`);
    table.box(1.5, 0.05, 0.05, { r: 0, slot: 'metal', c: alu, at: [0, 0.04, (i + 0.5) * pitch - len / 2] });
  }
  const model = b.build();
  const tracker: Tracker = Object.assign(model, { setAngle: (angle: number): void => void (model.part('table').rotation.z = -angle) });
  tracker.setAngle(0.5);
  return tracker;
}

export interface Heliostat extends KitModel {
  /** Aim the mirror so that sunlight coming from `sunDir` (unit vector toward the sun) is reflected to `target` (in the model's parent space). */
  aim(sunDir: Vector3, target: Vector3): void;
}

/** Heliostat: pedestal, azimuth yoke, tilting mirror of 3 × 2 facets. Parts: `yoke` › `mirror`. Anchor `mirror`. */
export function heliostat(o: { size?: number } = {}): Heliostat {
  const s = o.size ?? 1;
  const b = new Builder('heliostat');
  b.cyl(0.5 * s, 0.3, { seg: 14, slot: 'gloss', c: 'mist' });
  b.cyl(0.16 * s, 3.2 * s, { seg: 10, slot: 'gloss', c: 'steel', at: [0, 0.2, 0] });
  const yoke = b.part('yoke', { at: [0, 3.4 * s, 0] });
  yoke.box(0.5 * s, 0.4 * s, 0.5 * s, { r: 0.08 * s, mid: true, slot: 'gloss', c: 'yellow' });
  yoke.cyl(0.09 * s, 3.4 * s, { axis: 'x', seg: 8, slot: 'gloss', c: 'steel', at: [-1.7 * s, 0, 0] });
  const mirror = yoke.part('mirror');
  const glass = col('sky.light').lerp(col('white'), 0.35);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      mirror.box(1.56 * s, 1.56 * s, 0.05 * s, { r: 0.03 * s, mid: true, slot: 'gloss', c: [glass.clone().multiplyScalar(0.85), glass], at: [(i - 1) * 1.62 * s, (j - 0.5) * 1.62 * s, 0.12 * s] });
    }
  }
  mirror.box(4.9 * s, 0.1 * s, 0.08 * s, { r: 0, mid: true, slot: 'gloss', c: 'steel', at: [0, 0, 0.06 * s] });
  for (const x of [-1.62, 0, 1.62]) mirror.box(0.08 * s, 3.2 * s, 0.06 * s, { r: 0, mid: true, slot: 'gloss', c: 'steel', at: [x * s, 0, 0.06 * s] });
  mirror.anchor('mirror', 0, 0, 0.15 * s);
  const model = b.build();
  const centre = new Vector3();
  const n = new Vector3();
  const helio: Heliostat = Object.assign(model, {
    aim(sunDir: Vector3, target: Vector3): void {
      // mirror normal bisects the directions to the sun and to the target
      model.group.updateMatrixWorld(true);
      centre.set(0, 3.4 * s, 0).applyMatrix4(model.group.matrix);
      n.copy(target).sub(centre).normalize().add(sunDir).normalize();
      model.part('yoke').rotation.y = Math.atan2(n.x, n.z) - model.group.rotation.y;
      model.part('mirror').rotation.x = -Math.asin(Math.max(-1, Math.min(1, n.y)));
    },
  });
  helio.aim(new Vector3(0.3, 0.8, 0.5).normalize(), new Vector3(0, 30, 40));
  return helio;
}

export interface Trough extends KitModel {
  /** Rotation of the reflector about its axis, radians (0 = looking straight up). */
  setAngle(angle: number): void;
}

/** Parabolic trough along Z: reflector part (`trough`) with the receiver tube at its focal line. Anchors `in`, `out` (receiver ends). */
export function parabolicTrough(o: { length?: number; aperture?: number } = {}): Trough {
  const L = o.length ?? 12;
  const A = o.aperture ?? 5;
  const f = A * 0.3; // focal length of the parabola y = x² / 4f
  const b = new Builder('trough');
  const pivot = f * 0.55 + 1.6;
  for (const z of [-L / 2, 0, L / 2]) {
    b.box(0.9, 0.3, 0.9, { r: 0.06, slot: 'matte', c: 'mist', at: [0, -0.1, z] });
    b.beam([-0.5, 0.1, z], [0, pivot, z], 0.14, { slot: 'metal', c: 'steel' });
    b.beam([0.5, 0.1, z], [0, pivot, z], 0.14, { slot: 'metal', c: 'steel' });
  }
  const trough = b.part('trough', { at: [0, pivot, 0] });
  // mirror: the parabola as a thin extruded strip; pivot near its centre of mass
  const outline: G.Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const x = (i / 16 - 0.5) * A;
    outline.push([x, (x * x) / (4 * f) - f * 0.55]);
  }
  for (let i = 16; i >= 0; i--) {
    const x = (i / 16 - 0.5) * A;
    outline.push([x, (x * x) / (4 * f) - f * 0.55 - 0.08]);
  }
  const glass = col('sky.light').lerp(col('white'), 0.3);
  trough.add(G.extrude(outline, L - 0.2), { slot: 'gloss', c: [glass.clone().multiplyScalar(0.8), glass] });
  for (const z of [-L / 2 + 0.1, 0, L / 2 - 0.1]) {
    for (const sx of [-1, 1]) trough.beam([sx * A * 0.3, (A * 0.3) ** 2 / (4 * f) - f * 0.55, z], [0, f * 0.45, z], 0.06, { slot: 'metal', c: 'steel' });
  }
  // receiver: dark absorber tube inside a glass envelope, exactly on the focal line
  trough.cyl(0.07, L, { axis: 'z', seg: 10, slot: 'gloss', c: 'ink', at: [0, f * 0.45, -L / 2] });
  trough.add(G.cyl(0.12, L - 0.4, { seg: 12, open: true }), { slot: 'glass', at: [0, f * 0.45, -L / 2 + 0.2], rot: [Math.PI / 2, 0, 0] });
  trough.anchor('in', 0, f * 0.45, -L / 2);
  trough.anchor('out', 0, f * 0.45, L / 2);
  const model = b.build();
  const t: Trough = Object.assign(model, { setAngle: (angle: number): void => void (model.part('trough').rotation.z = -angle) });
  t.setAngle(0.45);
  return t;
}
