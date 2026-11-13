/**
 * Small home wiring devices at real size (metres — scale the group up for close-ups): Schuko socket (CEE 7/3),
 * Schuko plug (CEE 7/4), Europlug (CEE 7/16), rocker switch, incandescent and LED lamps (E27), and a cable
 * with L / N / PE cores in IEC 60445 colours (brown / blue / green-yellow).
 * Wall devices: origin on the wall, front toward +Z. Plugs: pins toward −Z (they push into a socket at z = 0).
 */
import { Mesh, Vector3 } from 'three';
import { K, SEMANTIC, col, type ColorLike, type KGlowMaterial } from '@/style';
import { Builder, type KitModel, type V3 } from '../core/builder';
import * as G from '../core/geo';
import { roundPath } from '../core/geo';

/** Schuko socket. Anchors: `l`, `n` (contact holes), `pe` (earthing clips), `screw`. */
export function addSchukoSocket(b: Builder, color: ColorLike = 'white'): void {
  const c = col(color);
  b.box(0.081, 0.081, 0.012, { r: 0.008, mid: true, slot: 'gloss', c: [c.clone().multiplyScalar(0.9), c], at: [0, 0, 0.006] });
  // recessed well (drawn as a darker ring wall + floor), two holes 19 mm apart, earth clips top and bottom
  b.add(G.revolve([[0.0195, 0], [0.024, 0], [0.024, 0.014], [0.0195, 0.014]], { seg: 28 }).shell, { slot: 'gloss', c, rot: [Math.PI / 2, 0, 0], at: [0, 0, 0.012] });
  b.cyl(0.0195, 0.002, { axis: 'z', seg: 24, slot: 'gloss', c: c.clone().multiplyScalar(0.8), at: [0, 0, 0.004], bevel: 0 });
  for (const [name, x] of [['l', -0.0095], ['n', 0.0095]] as const) {
    b.cyl(0.0027, 0.002, { axis: 'z', seg: 10, slot: 'gloss', c: 'ink', at: [x, 0, 0.0055], bevel: 0 });
    b.anchor(name, x, 0, 0.006);
  }
  for (const s of [-1, 1]) b.box(0.006, 0.004, 0.014, { r: 0, mid: true, slot: 'metal', c: 'mist', at: [0, s * 0.018, 0.019] });
  b.cyl(0.002, 0.001, { axis: 'z', seg: 8, slot: 'metal', c: 'steel', at: [0, 0, 0.0062], bevel: 0 });
  b.anchor('pe', 0, 0.018, 0.02);
  b.anchor('screw', 0, 0, 0.007);
}

/** Schuko plug (two 4.8 mm pins, earth contacts on the sides) or flat Europlug (two 4 mm sleeved pins). Anchor `cable`. */
export function addPlug(b: Builder, kind: 'schuko' | 'euro' = 'schuko', color: ColorLike = 'slate'): void {
  const c = col(color);
  if (kind === 'schuko') {
    b.cyl(0.019, 0.02, { axis: 'z', seg: 24, slot: 'gloss', c, at: [0, 0, 0], bevel: 0.002 });
    b.lathe([[0.019, 0], [0.021, 0.004], [0.02, 0.022], [0.009, 0.04], [0.006, 0.05], [0, 0.05]], { axis: 'z', seg: 24, slot: 'gloss', c: [c.clone().multiplyScalar(0.85), c], at: [0, 0, 0.02], crease: 50 });
    for (const x of [-0.0095, 0.0095]) b.cyl(0.0024, 0.019, { axis: 'z', seg: 10, slot: 'metal', c: 'mist', at: [x, 0, -0.019], bevel: 0.0008 });
    for (const s of [-1, 1]) b.box(0.006, 0.002, 0.014, { r: 0, mid: true, slot: 'metal', c: 'mist', at: [0, s * 0.0185, 0.008] });
    b.anchor('cable', 0, 0, 0.07);
    return;
  }
  b.box(0.035, 0.013, 0.012, { r: 0.004, mid: true, slot: 'gloss', c, at: [0, 0, 0.006] });
  b.box(0.022, 0.011, 0.026, { r: 0.004, mid: true, slot: 'gloss', c: [c.clone().multiplyScalar(0.85), c], at: [0, 0, 0.024] });
  for (const x of [-0.0093, 0.0093]) {
    b.cyl(0.002, 0.009, { axis: 'z', seg: 8, slot: 'metal', c: 'mist', at: [x, 0, -0.019], bevel: 0.0006 });
    b.cyl(0.0021, 0.01, { axis: 'z', seg: 8, slot: 'gloss', c: 'ink', at: [x, 0, -0.01], bevel: 0 });
  }
  b.anchor('cable', 0, 0, 0.04);
}

export interface SwitchModel extends KitModel {
  setOn(on: boolean): void;
}

/** Rocker light switch; the rocker is a part. */
export function lightSwitch(color: ColorLike = 'white'): SwitchModel {
  const c = col(color);
  const b = new Builder('switch');
  b.box(0.081, 0.081, 0.01, { r: 0.008, mid: true, slot: 'gloss', c: [c.clone().multiplyScalar(0.9), c], at: [0, 0, 0.005] });
  const rocker = b.part('rocker', { at: [0, 0, 0.01] });
  rocker.box(0.054, 0.054, 0.008, { r: 0.004, mid: true, slot: 'gloss', c, at: [0, 0, 0.003] });
  rocker.box(0.004, 0.012, 0.002, { r: 0, mid: true, slot: 'gloss', c: 'steel.light', at: [0, 0.016, 0.0075] });
  const model = b.build();
  const sw: SwitchModel = Object.assign(model, { setOn: (on: boolean): void => void (model.part('rocker').rotation.x = on ? -0.11 : 0.11) });
  sw.setOn(false);
  return sw;
}

export interface LampModel extends KitModel {
  /** Brightness 0 … 1 (tweenable through a proxy value). */
  setPower(p: number): void;
  readonly glow: KGlowMaterial;
}

/** E27 lamp standing on its base contact, bulb up. `incandescent`: glass bulb with a glowing filament; `led`: milky dome over a heat-sink body. */
export function lamp(kind: 'incandescent' | 'led' = 'led'): LampModel {
  const b = new Builder(`lamp-${kind}`);
  // screw base with thread ridges and the bottom contact
  b.cyl(0.013, 0.024, { seg: 16, slot: 'metal', c: 'mist', at: [0, 0.004, 0], bevel: 0.001 });
  for (let i = 0; i < 4; i++) b.ring(0.0135, 0.0012, { seg: 16, tubeSeg: 4, slot: 'metal', c: 'steel.light', at: [0, 0.008 + i * 0.005, 0] });
  b.cyl(0.006, 0.004, { seg: 10, slot: 'metal', c: 'steel', at: [0, 0, 0] });
  const glow = K.glow({ color: kind === 'led' ? 'white' : 'yellow', core: kind === 'led' ? 'white' : 'yellow.light', intensity: 0.3, falloff: kind === 'led' ? 0.4 : 0 });
  if (kind === 'incandescent') {
    b.add(G.lathe([[0.012, 0.028], [0.014, 0.04], [0.027, 0.062], [0.03, 0.078], [0.024, 0.098], [0.01, 0.108], [0, 0.11]], { seg: 24, crease: 80 }), { slot: 'glass' });
    b.cyl(0.004, 0.028, { rTop: 0.002, seg: 8, slot: 'gloss', c: 'white', at: [0, 0.028, 0] });
    for (const s of [-1, 1]) b.rod([s * 0.002, 0.05, 0], [s * 0.01, 0.076, 0], 0.0004, { slot: 'metal', c: 'steel', seg: 4 });
    const filament = new Mesh(G.tube([new Vector3(-0.01, 0.076, 0), new Vector3(-0.005, 0.08, 0), new Vector3(0, 0.076, 0), new Vector3(0.005, 0.08, 0), new Vector3(0.01, 0.076, 0)], 0.0007, { seg: 5 }), glow);
    b.attach(filament);
  } else {
    b.lathe([[0.013, 0.028], [0.022, 0.04], [0.028, 0.06], [0.029, 0.066]], { seg: 24, slot: 'gloss', c: ['mist', 'white'] });
    for (let i = 0; i < 12; i++) b.box(0.0015, 0.03, 0.004, { r: 0, slot: 'gloss', c: 'mist', at: [Math.cos((i / 12) * 6.283) * 0.024, 0.034, Math.sin((i / 12) * 6.283) * 0.024], rot: [0, -(i / 12) * 6.283, 0.3] });
    const dome = new Mesh(G.dome(0.03, 0.042, 24, false), glow);
    dome.position.y = 0.066;
    b.attach(dome);
  }
  b.anchor('top', 0, 0.11, 0);
  b.anchor('contact', 0, 0, 0);
  const model = b.build();
  return Object.assign(model, { glow, setPower: (p: number): void => void (glow.intensity = 0.3 + p * (kind === 'led' ? 1.9 : 2.6)) });
}

/**
 * Cable along a path with its three cores exposed at the far end: L brown, N blue, PE green-yellow rings,
 * each with a bare copper tip. Anchors: `l`, `n`, `pe` (core tips), `start`.
 */
export function addCable(b: Builder, points: readonly V3[], o: { radius?: number; strip?: number; sheath?: ColorLike } = {}): void {
  const r = o.radius ?? 0.005;
  const strip = o.strip ?? r * 14;
  const path = roundPath(points.map((p) => new Vector3(...p)), r * 6, 6);
  const end = path[path.length - 1]!;
  const dir = end.clone().sub(path[path.length - 2]!).normalize();
  b.tube(path, r, { seg: 10, slot: 'gloss', c: o.sheath ?? 'white' });
  b.anchor('start', points[0]![0], points[0]![1], points[0]![2]);
  const side = new Vector3(0, 1, 0).cross(dir);
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  side.normalize();
  const up = dir.clone().cross(side);
  (['l', 'n', 'pe'] as const).forEach((name, i) => {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const off = side.clone().multiplyScalar(Math.cos(a) * r * 0.45).addScaledVector(up, Math.sin(a) * r * 0.45);
    const fan = off.clone().multiplyScalar(2.2);
    const p0 = end.clone().add(off);
    const p1 = end.clone().addScaledVector(dir, strip * 0.8).add(off).add(fan);
    const tip = p1.clone().addScaledVector(dir, strip * 0.3);
    const core = [p0, end.clone().addScaledVector(dir, strip * 0.4).add(off).addScaledVector(fan, 0.5), p1];
    if (name === 'pe') {
      // green-yellow: alternating rings baked along the core
      const stripes = G.tube(core, r * 0.36, { seg: 8 });
      b.add(stripes, { slot: 'gloss', c: (p, _n, out) => out.copy(col(Math.floor(p.distanceTo(p0) / (r * 1.2)) % 2 ? SEMANTIC.wirePEStripe : SEMANTIC.wirePE)) });
    } else b.tube(core, r * 0.36, { seg: 8, slot: 'gloss', c: name === 'l' ? SEMANTIC.wireL : SEMANTIC.wireN });
    b.tube([p1, tip], r * 0.2, { seg: 6, slot: 'metal', c: 'orange' });
    b.anchor(name, tip.x, tip.y, tip.z);
  });
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const schukoSocket = (color?: ColorLike): KitModel => wrap('schuko-socket', (b) => addSchukoSocket(b, color));
export const plug = (kind: 'schuko' | 'euro' = 'schuko', color?: ColorLike): KitModel => wrap(`plug-${kind}`, (b) => addPlug(b, kind, color));
export const cable = (points: readonly V3[], o: Parameters<typeof addCable>[2] = {}): KitModel => wrap('cable', (b) => addCable(b, points, o));
