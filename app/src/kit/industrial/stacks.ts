/**
 * Tall plant silhouettes: the flue-gas stack (red / white aviation bands, platforms, lights) and the natural-
 * draught hyperboloid cooling tower (thin shell on a ring of V-columns over a water basin, with the fill pack,
 * spray pipes and riser inside — visible through an optional cut). Steam plumes belong to `fx`: use the `top`
 * anchors. Units: metres.
 */
import { CircleGeometry, Mesh } from 'three';
import { K, col, type ColorLike } from '@/style';
import { bandGeometry } from '../core/bands';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { addRingRailing } from './structures';

export interface StackOptions {
  height?: number;
  /** Base radius (top radius is 55 % of it). Default height / 22. */
  radius?: number;
  /** Number of red bands at the top. Default 3. */
  bands?: number;
  color?: ColorLike;
}

/** Anchors: `top` (smoke), `inlet` (flue duct), `light1…4`. */
export function addStack(b: Builder, o: StackOptions = {}): void {
  const H = o.height ?? 120;
  const rb = o.radius ?? H / 22;
  const rt = rb * 0.55;
  const body = col(o.color ?? col('mist').lerp(col('steel.light'), 0.3));
  const red = col('red');
  const white = col('white');
  const bands = o.bands ?? 3;
  const bandH = H * 0.055;
  const rAt = (y: number): number => rb + (rt - rb) * Math.pow(y / H, 0.8);
  const profile: G.Pt[] = [[0, 0]];
  for (let i = 0; i <= 12; i++) profile.push([rAt((i / 12) * H), (i / 12) * H]);
  profile.push([rt * 0.8, H], [rt * 0.8, H - 1.5]);
  // crisp aviation bands: the shell is cut along heights
  const stops: [number, typeof body][] = [[H - bandH * (2 * bands - 1), body]];
  for (let i = 0; i < 2 * bands - 1; i++) stops.push([H - bandH * (2 * bands - 2 - i), i % 2 === 0 ? red : white]);
  b.add(bandGeometry(G.lathe(profile, { seg: 28, crease: 50 }), (_x, y) => y, stops, red), { slot: 'matte' });
  b.cyl(rb * 1.25, 1.2, { rTop: rb * 1.1, seg: 28, slot: 'matte', c: 'steel', at: [0, -0.4, 0] });
  for (const k of [0.5, 0.82]) {
    const y = H * k;
    const r = rAt(y);
    b.cyl(r + 1.3, 0.25, { seg: 28, slot: 'metal', c: 'slate', at: [0, y - 0.25, 0], bevel: 0.05 });
    addRingRailing(b, r + 1.2, y, { posts: 12 });
    for (let i = 0; i < 4; i++) b.sphere(0.45, { seg: 8, slot: 'glow', c: 'red', at: [Math.cos((i / 4) * 6.283 + 0.4) * (r + 1.2), y + 1.5, Math.sin((i / 4) * 6.283 + 0.4) * (r + 1.2)] });
  }
  for (let i = 0; i < 4; i++) b.anchor(`light${i + 1}`, Math.cos((i / 4) * 6.283 + 0.4) * (rAt(H * 0.82) + 1.2), H * 0.82 + 1.5, Math.sin((i / 4) * 6.283 + 0.4) * (rAt(H * 0.82) + 1.2));
  // flue duct entering near the base, ladder rail up the shaft
  b.box(rb * 1.1, rb * 1.3, rb * 2.2, { r: 0.4, slot: 'metal', c: ['slate', 'steel'], at: [0, H * 0.06, rb * 1.6] });
  b.anchor('inlet', 0, H * 0.06 + rb * 0.65, rb * 2.8);
  b.beam([rb * 0.99, 0, 0], [rAt(H * 0.82) + 0.15, H * 0.82, 0], 0.3, { h: 0.5, slot: 'metal', c: 'slate' });
  b.anchor('top', 0, H + 1, 0);
}

export interface CoolingTowerOptions {
  height?: number;
  /** Angle of the cutaway window in radians (0 = closed shell). */
  cut?: number;
  color?: ColorLike;
}

/** Anchors: `top` (plume), `basin`, `inlet` (hot water riser), `outlet` (cold water from the basin). */
export function addCoolingTower(b: Builder, o: CoolingTowerOptions = {}): void {
  const H = o.height ?? 110;
  const cut = o.cut ?? 0;
  const c = col(o.color ?? col('mist').lerp(col('white'), 0.35));
  const leg = H * 0.075;
  const rBase = H * 0.4;
  const rThroat = H * 0.225;
  const yThroat = H * 0.74;
  // hyperbola r² = rThroat² + ((y − yThroat)/a)², fitted to the base radius
  const a = (yThroat - leg) / Math.sqrt(rBase * rBase - rThroat * rThroat);
  const rAt = (y: number): number => Math.sqrt(rThroat * rThroat + ((y - yThroat) / a) ** 2);
  const t = H * 0.012;
  const outer: G.Pt[] = [];
  const inner: G.Pt[] = [];
  for (let i = 0; i <= 18; i++) {
    const y = leg + (i / 18) * (H - leg);
    outer.push([rAt(y), y]);
    inner.push([rAt(y) - t * (1.6 - i / 18), y]);
  }
  outer.push([rAt(H) + t * 0.6, H], [rAt(H) + t * 0.6, H + t]);
  const section = [...outer, [rAt(H) - t, H + t] as G.Pt, ...inner.reverse()];
  const { shell, caps } = G.revolve(section, { seg: 48, phiStart: Math.PI / 2 + cut / 2, phiLength: Math.PI * 2 - cut, crease: 40 });
  b.add(shell, { slot: 'matte', c: (p, _n, out) => out.copy(c).multiplyScalar(0.78 + 0.22 * Math.min(p.y / H, 1)) });
  if (caps) b.add(caps, { slot: 'matte', c: col('coral').lerp(col('white'), 0.35) });
  // ring of V-columns between the basin and the shell lip
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 0.5) / n) * Math.PI * 2;
    const a2 = ((i + 1) / n) * Math.PI * 2;
    const top: [number, number, number] = [Math.cos(a1) * (rBase - t), leg + 0.3, Math.sin(a1) * (rBase - t)];
    for (const ab of [a0, a2]) b.rod([Math.cos(ab) * (rBase + t * 1.5), 0.5, Math.sin(ab) * (rBase + t * 1.5)], top, t * 0.42, { slot: 'matte', c: c.clone().multiplyScalar(0.8), seg: 5 });
  }
  // basin with water, fill pack, spray header pipes and the central riser
  b.cyl(rBase * 1.16, 1.6, { seg: 48, slot: 'matte', c: ['steel', 'mist'], at: [0, -0.8, 0], bevel: 0.2 });
  const water = new Mesh(new CircleGeometry(rBase * 1.1, 48), K.water({ shallow: 'sky', deep: 'blue', scale: H * 0.07, glints: 0.7, foamAmount: 0.6 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.86;
  water.receiveShadow = true;
  b.attach(water);
  b.cyl(rBase * 0.93, leg * 0.5, { seg: 40, slot: 'matte', c: ['teal.dark', 'teal'], at: [0, leg * 1.15, 0], bevel: 0.2 });
  for (let i = 0; i < 12; i++) b.cyl(t * 0.3, rBase * 0.9, { axis: 'x', seg: 6, slot: 'metal', c: 'slate', at: [0, leg * 1.85, 0], rot: [0, (i / 12) * Math.PI * 2, 0] });
  b.cyl(t * 1.1, leg * 1.9, { seg: 12, slot: 'metal', c: 'blue', at: [0, 0, 0] });
  b.anchor('inlet', 0, leg * 1.9, 0);
  b.anchor('basin', 0, 1, rBase * 1.1);
  b.anchor('outlet', rBase * 1.16, 0.5, 0);
  for (let i = 0; i < 4; i++) b.sphere(H * 0.008, { seg: 8, slot: 'glow', c: 'red', at: [Math.cos(i * 1.571) * (rAt(H) + t), H + t * 1.6, Math.sin(i * 1.571) * (rAt(H) + t)] });
  b.anchor('top', 0, H + 2, 0);
}

export function stack(o: StackOptions = {}): KitModel {
  const b = new Builder('stack');
  addStack(b, o);
  return b.build();
}

export function coolingTower(o: CoolingTowerOptions = {}): KitModel {
  const b = new Builder('cooling-tower');
  addCoolingTower(b, o);
  return b.build();
}
