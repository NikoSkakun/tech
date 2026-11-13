/**
 * Storage vessels: vertical tank (spiral stair, roof railing, manhole, nozzle, bund), horizontal pressure
 * vessel on saddles, spherical tank on legs with a stair tower, silo with a conical hopper.
 * Units: metres. Origin: centre of the footprint on the ground.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { addLadder, addRingRailing, addSpiralStair } from './structures';

const dark = () => col('slate').lerp(col('steel'), 0.3);

export interface TankOptions {
  radius?: number;
  height?: number;
  color?: ColorLike;
  /** Coloured band (content code: water `sky`, fuel `violet`, oil `amber`…). */
  band?: ColorLike;
}

/** Anchors: `top`, `inlet`, `outlet` (nozzles), `manhole`. */
export function addVerticalTank(b: Builder, o: TankOptions & { bund?: boolean } = {}): void {
  const r = o.radius ?? 6;
  const h = o.height ?? 10;
  const c = col(o.color ?? 'white');
  if (o.bund ?? true) {
    b.cyl(r * 1.75, 0.2, { seg: 40, slot: 'matte', c: col('mist').lerp(col('steel.light'), 0.4), at: [0, -0.1, 0] });
    b.ring(r * 1.72, 0.35, { seg: 40, tubeSeg: 6, slot: 'matte', c: 'mist', at: [0, 0.2, 0], s: [1, 1.6, 1] });
  }
  b.cyl(r * 1.04, 0.4, { seg: 36, slot: 'matte', c: 'steel', at: [0, 0, 0] });
  // shell with a shallow cone roof; plate courses as thin rings
  b.lathe([[0, 0], [r, 0], [r, h], [r * 0.96, h + 0.15], [r * 0.12, h + r * 0.16], [0, h + r * 0.17]], { seg: 36, slot: 'gloss', c: [c.clone().multiplyScalar(0.84), c], at: [0, 0.4, 0], crease: 40 });
  for (let y = 2.4; y < h; y += 2.4) b.ring(r * 1.002, 0.05, { seg: 36, tubeSeg: 4, slot: 'gloss', c: c.clone().multiplyScalar(0.9), at: [0, 0.4 + y, 0] });
  b.ring(r * 1.0, 0.3, { seg: 36, tubeSeg: 6, slot: 'gloss', c: o.band ?? 'sky', at: [0, 0.4 + h * 0.72, 0], s: [1, 2.6, 1] });
  b.ring(r, 0.12, { seg: 36, tubeSeg: 5, slot: 'metal', c: dark(), at: [0, 0.4 + h, 0] });
  addSpiralStair(b, r + 0.05, h + 0.4, { start: 0.6 });
  addRingRailing(b, r - 0.15, 0.4 + h + 0.12);
  b.cyl(0.5, 0.5, { seg: 12, slot: 'metal', c: dark(), at: [r * 0.4, 0.4 + h + r * 0.1, 0] });
  b.cyl(0.6, 0.12, { axis: 'z', seg: 14, slot: 'metal', c: dark(), at: [0, 1.5, r - 0.02] });
  b.anchor('manhole', 0, 1.5, r + 0.3);
  for (const [name, a, y] of [['inlet', 2.2, h * 0.85], ['outlet', 3.6, 1.0]] as const) {
    b.cyl(0.32, 1.2, { axis: 'x', seg: 10, slot: 'metal', c: dark(), at: [Math.cos(a) * (r - 0.1), 0.4 + y, Math.sin(a) * (r - 0.1)], rot: [0, -a, 0] });
    b.anchor(name, Math.cos(a) * (r + 1.2), 0.4 + y, Math.sin(a) * (r + 1.2));
  }
  b.anchor('top', 0, 0.4 + h + r * 0.17, 0);
}

/** Horizontal pressure vessel («bullet») on two saddles, axis along X. Anchors: `top`, `inlet`, `outlet`. */
export function addHorizontalTank(b: Builder, o: TankOptions & { length?: number } = {}): void {
  const r = o.radius ?? 1.6;
  const L = o.length ?? 9;
  const c = col(o.color ?? 'white');
  const y = r + 1.1;
  b.capsule(r, L, { axis: 'x', seg: 22, slot: 'gloss', c: [c.clone().multiplyScalar(0.82), c], at: [0, y, 0] });
  for (const x of [-L * 0.28, L * 0.28]) {
    b.box(0.7, y - r * 0.35, r * 1.7, { r: 0.08, slot: 'matte', c: ['steel', 'mist'], at: [x, 0, 0] });
    b.ring(r * 1.01, 0.09, { axis: 'x', seg: 24, tubeSeg: 5, slot: 'metal', c: dark(), at: [x, y, 0] });
  }
  b.ring(r * 1.005, 0.2, { axis: 'x', seg: 24, tubeSeg: 6, slot: 'gloss', c: o.band ?? 'violet', at: [0, y, 0], s: [1, 1, 1] });
  b.cyl(0.35, 0.6, { seg: 10, slot: 'metal', c: dark(), at: [L * 0.15, y + r - 0.1, 0] });
  b.sphere(0.2, { seg: 8, slot: 'gloss', c: 'red', at: [L * 0.15, y + r + 0.7, 0] });
  b.frame({ at: [-L * 0.2, 0, r * 0.75] }, () => addLadder(b, y + r * 0.7, { cage: false }));
  for (const [name, x] of [['inlet', -L * 0.36], ['outlet', L * 0.36]] as const) {
    b.cyl(0.18, y - r + 0.3, { seg: 8, slot: 'metal', c: dark(), at: [x, 0, -r * 0.3] });
    b.anchor(name, x, 0.3, -r * 0.3);
  }
  b.anchor('top', 0, y + r, 0);
}

/** Spherical gas tank on a ring of legs with cross-bracing and a stair tower. Anchors: `top`, `outlet`. */
export function addSphericalTank(b: Builder, o: TankOptions = {}): void {
  const r = o.radius ?? 6;
  const c = col(o.color ?? 'white');
  const y = r * 1.45;
  b.sphere(r, { seg: 32, slot: 'gloss', c: (p, _n, out) => out.copy(c).multiplyScalar(0.8 + 0.2 * Math.min(Math.max((p.y + r) / (2 * r), 0), 1)), at: [0, y, 0] });
  b.ring(r * 1.003, 0.25, { seg: 36, tubeSeg: 6, slot: 'gloss', c: o.band ?? 'violet', at: [0, y, 0], s: [1, 2.4, 1] });
  const legs = 8;
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * Math.PI * 2;
    const a2 = ((i + 1) / legs) * Math.PI * 2;
    const p = [Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97];
    const q = [Math.cos(a2) * r * 0.97, Math.sin(a2) * r * 0.97];
    b.cyl(0.28, y + 0.2, { seg: 8, slot: 'metal', c: dark(), at: [p[0]!, -0.2, p[1]!] });
    b.cyl(0.6, 0.3, { seg: 8, slot: 'matte', c: 'mist', at: [p[0]!, -0.1, p[1]!] });
    b.rod([p[0]!, 0.4, p[1]!], [q[0]!, y * 0.62, q[1]!], 0.07, { slot: 'metal', c: dark(), seg: 5 });
    b.rod([q[0]!, 0.4, q[1]!], [p[0]!, y * 0.62, p[1]!], 0.07, { slot: 'metal', c: dark(), seg: 5 });
  }
  addRingRailing(b, r * 0.3, y + r * 0.95, { posts: 10 });
  b.cyl(0.4, 0.8, { seg: 10, slot: 'metal', c: dark(), at: [0, y + r - 0.1, 0] });
  b.frame({ at: [0, 0, r * 1.02] }, () => addLadder(b, y + r * 0.2));
  b.cyl(0.3, y - r + 0.2, { seg: 8, slot: 'metal', c: dark(), at: [0, 0, 0] });
  b.anchor('outlet', 0, 0.4, 0);
  b.anchor('top', 0, y + r, 0);
}

/** Silo: cylinder with a conical hopper on a leg frame, roof cone, filling pipe, ladder. Anchors: `top`, `outlet`. */
export function addSilo(b: Builder, o: TankOptions = {}): void {
  const r = o.radius ?? 2.4;
  const h = o.height ?? 9;
  const c = col(o.color ?? col('mist').lerp(col('white'), 0.5));
  const y0 = r * 1.5 + 0.8;
  b.lathe([[0.3, 0.8], [r, y0], [r, y0 + h], [r * 0.2, y0 + h + r * 0.45], [0, y0 + h + r * 0.47]], { seg: 28, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], crease: 30 });
  for (let y = 1.5; y < h; y += 1.5) b.ring(r * 1.004, 0.05, { seg: 28, tubeSeg: 4, slot: 'gloss', c: c.clone().multiplyScalar(0.88), at: [0, y0 + y, 0] });
  b.ring(r, 0.2, { seg: 28, tubeSeg: 6, slot: 'gloss', c: o.band ?? 'amber', at: [0, y0 + h * 0.8, 0], s: [1, 2.4, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.beam([Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95], [Math.cos(a) * r * 0.95, y0 + 0.3, Math.sin(a) * r * 0.95], 0.22, { slot: 'metal', c: dark() });
    const a2 = a + Math.PI / 2;
    b.beam([Math.cos(a) * r * 0.95, 0.3, Math.sin(a) * r * 0.95], [Math.cos(a2) * r * 0.95, y0 * 0.8, Math.sin(a2) * r * 0.95], 0.1, { slot: 'metal', c: dark() });
  }
  b.cyl(0.35, 0.5, { seg: 10, slot: 'metal', c: dark(), at: [0, 0.4, 0] });
  b.anchor('outlet', 0, 0.4, 0);
  b.frame({ at: [0, 0, r] }, () => addLadder(b, y0 + h));
  b.anchor('top', 0, y0 + h + r * 0.47, 0);
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const verticalTank = (o: Parameters<typeof addVerticalTank>[1] = {}): KitModel => wrap('tank', (b) => addVerticalTank(b, o));
export const horizontalTank = (o: Parameters<typeof addHorizontalTank>[1] = {}): KitModel => wrap('bullet-tank', (b) => addHorizontalTank(b, o));
export const sphericalTank = (o: TankOptions = {}): KitModel => wrap('sphere-tank', (b) => addSphericalTank(b, o));
export const silo = (o: TankOptions = {}): KitModel => wrap('silo', (b) => addSilo(b, o));
