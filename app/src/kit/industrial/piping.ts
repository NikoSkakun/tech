/**
 * Piping: pipe runs with smooth elbows, flanges and supports, valves (gate / butterfly / control), a
 * centrifugal pump set, and a multi-tier pipe rack. Pipe colours follow the semantic code (STYLE_GUIDE §2.2):
 * pass `sky` / `blue` for water, `orange` / `red` for hot media, `violet` for gas, `mist` for steam lines.
 * Flow effects belong to `fx`: every run is exported as a path. Units: metres.
 */
import { Vector3 } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel, type V3 } from '../core/builder';
import { pathAt, pathLength, roundPath } from '../core/geo';

const dark = () => col('slate').lerp(col('steel'), 0.3);

export interface PipeOptions {
  radius?: number;
  color?: ColorLike;
  /** Elbow radius. Default 2.5 × pipe radius. */
  bend?: number;
  /** Flange pairs along the run, roughly every this many metres (0 = only at the ends). Default 6. */
  flangeEvery?: number;
  /** Supports down to y = 0 every this many metres (0 = none). */
  supportEvery?: number;
  /** Name of the exported path. */
  name?: string;
}

/** Pipe through the given points (current frame). Returns the centre line (also stored in `model.paths`). */
export function addPipe(b: Builder, points: readonly V3[], o: PipeOptions = {}): Vector3[] {
  const r = o.radius ?? 0.3;
  const c = col(o.color ?? 'mist');
  const path = roundPath(points.map((p) => new Vector3(...p)), o.bend ?? r * 2.5, 6);
  b.tube(path, r, { seg: 12, slot: 'gloss', c });
  const length = pathLength(path);
  const flange = (s: number): void => {
    const p = new Vector3();
    const t = new Vector3();
    pathAt(path, s, p, t);
    const up = Math.abs(t.y) > 0.9;
    b.frame({ at: [p.x, p.y, p.z], rot: up ? [0, 0, 0] : [0, Math.atan2(t.x, t.z), 0] }, () => {
      b.cyl(r * 1.45, r * 0.5, { axis: up ? 'y' : 'z', seg: 12, slot: 'metal', c: dark(), at: up ? [0, -r * 0.25, 0] : [0, 0, -r * 0.25] });
    });
  };
  flange(r * 0.3);
  flange(length - r * 0.3);
  const every = o.flangeEvery ?? 6;
  if (every > 0) for (let s = every; s < length - every * 0.5; s += every) flange(s);
  if (o.supportEvery) {
    const p = new Vector3();
    for (let s = o.supportEvery / 2; s < length; s += o.supportEvery) {
      pathAt(path, s, p);
      if (p.y < r * 3) continue;
      b.beam([p.x, 0, p.z], [p.x, p.y - r, p.z], r * 0.7, { slot: 'metal', c: dark() });
      b.box(r * 2.6, r * 0.4, r * 1.2, { r: 0, slot: 'metal', c: dark(), at: [p.x, p.y - r * 1.3, p.z] });
      b.box(r * 2.4, 0.25, r * 2.4, { r: 0.05, slot: 'matte', c: 'mist', at: [p.x, -0.1, p.z] });
    }
  }
  if (o.name) b.path(o.name, path);
  return path;
}

export interface ValveOptions {
  /** Pipe radius the valve sits in. */
  radius?: number;
  kind?: 'gate' | 'butterfly' | 'control';
  color?: ColorLike;
}

/** Valve centred on the frame origin, pipe axis along Z, stem up. Anchor `handle`. */
export function addValve(b: Builder, o: ValveOptions = {}): void {
  const r = o.radius ?? 0.3;
  const c = col(o.color ?? 'steel.light');
  const kind = o.kind ?? 'gate';
  for (const s of [-1, 1]) b.cyl(r * 1.5, r * 0.45, { axis: 'z', seg: 12, slot: 'metal', c: dark(), at: [0, 0, s * r * 1.3 - r * 0.22] });
  if (kind === 'butterfly') {
    b.cyl(r * 1.25, r * 0.9, { axis: 'z', seg: 14, slot: 'gloss', c, at: [0, 0, -r * 0.45] });
    b.cyl(r * 0.2, r * 1.6, { seg: 6, slot: 'metal', c: dark(), at: [0, r, 0] });
    b.box(r * 2.6, r * 0.25, r * 0.4, { r: r * 0.08, slot: 'gloss', c: 'red', at: [r * 0.9, r * 2.6, 0] });
    b.anchor('handle', r * 0.9, r * 2.8, 0);
    return;
  }
  b.sphere(r * 1.35, { seg: 14, slot: 'gloss', c, at: [0, 0, 0], s: [1, 1, 1.1] });
  b.cyl(r * 0.9, r * 1.4, { rTop: r * 0.6, seg: 10, slot: 'gloss', c, at: [0, r * 0.9, 0] });
  if (kind === 'control') {
    // pneumatic diaphragm actuator on a yoke
    for (const s of [-1, 1]) b.beam([s * r * 0.5, r * 2.2, 0], [s * r * 0.5, r * 4, 0], r * 0.16, { slot: 'metal', c: dark() });
    b.cyl(r * 1.9, r * 0.9, { seg: 16, slot: 'gloss', c: 'coral', at: [0, r * 4, 0], bevel: r * 0.3 });
    b.anchor('handle', 0, r * 5, 0);
    return;
  }
  b.cyl(r * 0.14, r * 2.6, { seg: 6, slot: 'metal', c: 'mist', at: [0, r * 2.2, 0], bevel: 0 });
  b.ring(r * 1.3, r * 0.14, { seg: 16, tubeSeg: 5, slot: 'gloss', c: 'red', at: [0, r * 4.6, 0] });
  for (let i = 0; i < 3; i++) b.beam([0, r * 4.6, 0], [Math.cos(i * 2.094) * r * 1.3, r * 4.6, Math.sin(i * 2.094) * r * 1.3], r * 0.12, { slot: 'gloss', c: 'red' });
  b.anchor('handle', 0, r * 4.8, 0);
}

/** Centrifugal pump set on a base frame: motor, coupling guard, volute. Anchors `suction` (−X end), `discharge` (up). */
export function addPump(b: Builder, o: { size?: number; color?: ColorLike } = {}): void {
  const s = o.size ?? 1;
  const c = col(o.color ?? 'blue');
  b.box(3.0 * s, 0.25 * s, 1.1 * s, { r: 0.06 * s, slot: 'matte', c: ['steel', 'mist'], at: [0, 0, 0] });
  b.box(2.7 * s, 0.14 * s, 0.9 * s, { r: 0.03 * s, slot: 'metal', c: dark(), at: [0, 0.25 * s, 0] });
  // motor with cooling fins and a fan cowl
  b.cyl(0.42 * s, 1.2 * s, { axis: 'x', seg: 18, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0.15 * s, 0.85 * s, 0] });
  for (let i = 0; i < 10; i++) b.box(1.0 * s, 0.05 * s, 0.05 * s, { r: 0, slot: 'gloss', c: 'teal.dark', at: [0.75 * s, 0.82 * s + Math.sin((i / 10) * 6.283) * 0.44 * s, Math.cos((i / 10) * 6.283) * 0.44 * s] });
  b.cyl(0.46 * s, 0.3 * s, { axis: 'x', seg: 18, slot: 'gloss', c: 'slate', at: [1.3 * s, 0.85 * s, 0] });
  b.box(0.36 * s, 0.26 * s, 0.4 * s, { r: 0.04 * s, slot: 'gloss', c: 'slate', at: [0.7 * s, 1.25 * s, 0] });
  b.box(0.5 * s, 0.4 * s, 0.5 * s, { r: 0.2 * s, slot: 'gloss', c: 'yellow', at: [-0.2 * s, 0.65 * s, 0] });
  // volute casing with suction and discharge flanges
  b.cyl(0.62 * s, 0.4 * s, { axis: 'x', seg: 20, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [-0.95 * s, 0.85 * s, 0], bevel: 0.1 * s });
  b.cyl(0.24 * s, 0.5 * s, { axis: 'x', seg: 10, slot: 'gloss', c, at: [-1.45 * s, 0.85 * s, 0] });
  b.cyl(0.36 * s, 0.1 * s, { axis: 'x', seg: 12, slot: 'metal', c: dark(), at: [-1.5 * s, 0.85 * s, 0] });
  b.cyl(0.2 * s, 0.7 * s, { seg: 10, slot: 'gloss', c, at: [-0.75 * s, 1.2 * s, 0.25 * s] });
  b.cyl(0.32 * s, 0.1 * s, { seg: 12, slot: 'metal', c: dark(), at: [-0.75 * s, 1.85 * s, 0.25 * s] });
  b.anchor('suction', -1.5 * s, 0.85 * s, 0);
  b.anchor('discharge', -0.75 * s, 1.95 * s, 0.25 * s);
}

/** Pipe rack: steel bents carrying tiers of colour-coded pipes along X. Paths `pipe0…` per pipe. */
export function addPipeRack(b: Builder, o: { length?: number; height?: number; tiers?: number; colors?: readonly ColorLike[] } = {}): void {
  const L = o.length ?? 30;
  const H = o.height ?? 6;
  const tiers = o.tiers ?? 2;
  const colors = o.colors ?? ['sky', 'orange', 'mist', 'violet', 'blue', 'yellow'];
  const w = 4;
  const bents = Math.max(2, Math.round(L / 6) + 1);
  for (let i = 0; i < bents; i++) {
    const x = (i / (bents - 1) - 0.5) * L;
    for (const s of [-1, 1]) {
      b.beam([x, 0, (s * w) / 2], [x, H + 0.3, (s * w) / 2], 0.28, { slot: 'metal', c: dark() });
      b.box(0.8, 0.3, 0.8, { r: 0.06, slot: 'matte', c: 'mist', at: [x, -0.1, (s * w) / 2] });
    }
    for (let t = 0; t < tiers; t++) b.beam([x, H - t * 1.8, -w / 2 - 0.4], [x, H - t * 1.8, w / 2 + 0.4], 0.24, { slot: 'metal', c: dark() });
    if (i < bents - 1 && i % 2 === 0) b.beam([x, 0.4, w / 2], [x + L / (bents - 1), H - 0.4, w / 2], 0.12, { slot: 'metal', c: dark() });
  }
  let n = 0;
  for (let t = 0; t < tiers; t++) {
    for (let k = 0; k < 4; k++) {
      const r = 0.22 + ((k + t) % 3) * 0.08;
      const z = -w / 2 + 0.5 + k * 1.0;
      addPipe(b, [[-L / 2 - 1, H - t * 1.8 + 0.12 + r, z], [L / 2 + 1, H - t * 1.8 + 0.12 + r, z]], { radius: r, color: colors[n % colors.length], flangeEvery: 9, name: `pipe${n}` });
      n++;
    }
  }
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const valve = (o: ValveOptions = {}): KitModel => wrap('valve', (b) => addValve(b, o));
export const pump = (o: Parameters<typeof addPump>[1] = {}): KitModel => wrap('pump', (b) => addPump(b, o));
export const pipeRack = (o: Parameters<typeof addPipeRack>[1] = {}): KitModel => wrap('pipe-rack', (b) => addPipeRack(b, o));
