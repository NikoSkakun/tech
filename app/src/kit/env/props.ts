/**
 * Fences and street lamps. Lamps use the `lamp` slot (dim by day, bright with `model.night = 1`) and expose
 * `light` anchors where a chapter may add its few permanent `PointLight`s. Units: metres.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import type { Pt } from '../core/geo';
import { drape, offsetPath, stations, type DrapeOptions } from './ribbon';

const mix = (a: ColorLike, b: ColorLike, t: number) => col(a).lerp(col(b), t);

export interface FenceOptions extends DrapeOptions {
  route: readonly Pt[];
  /**
   * `picket` garden fence · `rail` two-bar ranch fence · `mesh` industrial post-and-wire fence (substations,
   * plants) · `wall` precast concrete panels.
   */
  kind?: 'picket' | 'rail' | 'mesh' | 'wall';
  height?: number;
  color?: ColorLike;
}

/** Add a fence along a route. */
export function addFence(b: Builder, o: FenceOptions): void {
  const kind = o.kind ?? 'picket';
  const h = o.height ?? (kind === 'mesh' ? 2.4 : kind === 'wall' ? 2.2 : kind === 'rail' ? 1.2 : 1.1);
  const pts = drape(o.route, { step: 0.5, bend: 0.5, ...o });
  if (kind === 'picket') {
    const c = col(o.color ?? 'white');
    stations(pts, 0.42, (p, heading) => {
      b.box(0.24, h, 0.07, { r: 0.03, c: [c.clone().multiplyScalar(0.85), c], at: [p.x, p.y - 0.05, p.z], rot: [0, heading + Math.PI / 2, 0] });
    });
    for (const y of [h * 0.3, h * 0.72]) b.tube(offsetPath(pts, 0.05, y), 0.045, { seg: 4, c: c.clone().multiplyScalar(0.9), caps: false });
    return;
  }
  if (kind === 'rail') {
    const c = col(o.color ?? mix('wireBrown', 'yellow.light', 0.25));
    stations(pts, 2.6, (p) => b.cyl(0.11, h + 0.15, { seg: 6, c: c.clone().multiplyScalar(0.8), at: [p.x, p.y - 0.15, p.z] }));
    for (const y of [h * 0.45, h * 0.85]) b.tube(offsetPath(pts, 0, y), 0.06, { seg: 5, c });
    return;
  }
  if (kind === 'mesh') {
    const c = col(o.color ?? mix('steel', 'slate', 0.4));
    stations(pts, 3, (p) => {
      b.cyl(0.07, h + 0.2, { seg: 6, slot: 'metal', c, at: [p.x, p.y - 0.2, p.z] });
      b.box(0.3, 0.16, 0.3, { r: 0.04, slot: 'matte', c: 'mist', at: [p.x, p.y - 0.06, p.z] });
    });
    for (let i = 0; i < 5; i++) b.tube(offsetPath(pts, 0, 0.25 + (i / 4) * (h - 0.35)), i === 4 ? 0.04 : 0.018, { seg: 4, slot: 'metal', c, caps: false });
    // barbed-wire outrigger: one more wire carried outward on short arms
    b.tube(offsetPath(pts, 0.22, h + 0.2), 0.016, { seg: 4, slot: 'metal', c, caps: false });
    return;
  }
  const c = col(o.color ?? mix('mist', 'steel.light', 0.3));
  stations(pts, 3, (p, heading, i, count) => {
    b.box(0.3, h + 0.15, 0.3, { r: 0.05, slot: 'matte', c: c.clone().multiplyScalar(0.86), at: [p.x, p.y - 0.1, p.z], rot: [0, heading, 0] });
    if (i === count - 1) return;
    b.frame({ at: [p.x, p.y, p.z], rot: [0, heading, 0] }, () => {
      b.box(0.14, h - 0.15, 2.8, { r: 0.05, slot: 'matte', c: [c.clone().multiplyScalar(0.9), c], at: [0, 0.1, 1.5] });
      for (const z of [0.85, 2.15]) b.box(0.19, h * 0.5, 0.75, { r: 0.06, slot: 'matte', c, at: [0, h * 0.28, z] });
    });
  });
}

export function fence(o: FenceOptions): KitModel {
  const b = new Builder('fence');
  addFence(b, o);
  return b.build();
}

export interface LampOptions {
  /** `road` tall mast with an arm · `double` two arms · `park` short post with a globe. */
  kind?: 'road' | 'double' | 'park';
  height?: number;
  color?: ColorLike;
  /** Colour of the light. Default warm yellow. */
  light?: ColorLike;
}

/** Add a street lamp at the builder's current frame; the arm points along local +X. Anchors: `light` (`light2`). */
export function addStreetLamp(b: Builder, o: LampOptions = {}): void {
  const kind = o.kind ?? 'road';
  const h = o.height ?? (kind === 'park' ? 3.6 : 8);
  const c = col(o.color ?? mix('slate', 'steel', 0.35));
  const light = col(o.light ?? mix('yellow', 'white', 0.35));
  b.cyl(0.22, 0.5, { rTop: 0.14, seg: 10, slot: 'metal', c: c.clone().multiplyScalar(0.85) });
  b.cyl(0.11, h - 0.4, { rTop: 0.07, seg: 8, slot: 'metal', c, at: [0, 0.4, 0], bevel: 0 });
  if (kind === 'park') {
    b.cyl(0.16, 0.12, { seg: 10, slot: 'metal', c, at: [0, h - 0.05, 0] });
    b.sphere(0.34, { seg: 14, slot: 'lamp', c: light, at: [0, h + 0.36, 0] });
    b.cyl(0.2, 0.07, { seg: 10, slot: 'metal', c, at: [0, h + 0.68, 0] });
    b.anchor('light', 0, h + 0.36, 0);
    return;
  }
  const arms = kind === 'double' ? [1, -1] : [1];
  arms.forEach((dir, i) => {
    b.frame({ at: [0, h - 0.1, 0], s: [dir, 1, 1] }, () => {
      // swan-neck arm, luminaire head, lens underneath
      b.beam([0, -0.5, 0], [0.5, 0.25, 0], 0.09, { slot: 'metal', c });
      b.beam([0.45, 0.25, 0], [1.6, 0.42, 0], 0.09, { slot: 'metal', c });
      b.box(1.0, 0.16, 0.42, { r: 0.07, slot: 'metal', c: c.clone().multiplyScalar(1.15), at: [1.9, 0.36, 0] });
      b.box(0.72, 0.07, 0.3, { r: 0.03, slot: 'lamp', c: light, at: [1.95, 0.3, 0] });
    });
    b.anchor(i === 0 ? 'light' : 'light2', dir * 1.95, h + 0.1, 0);
  });
  b.sphere(0.1, { seg: 8, slot: 'metal', c, at: [0, h, 0] });
}

export function streetLamp(o: LampOptions = {}): KitModel {
  const b = new Builder('lamp');
  addStreetLamp(b, o);
  return b.build();
}
