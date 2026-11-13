/**
 * Hydro-turbine runners, shaft along Y (vertical machines), origin at the runner centre:
 *  - Francis: crown and band with a ring of curved blades between them (medium heads, radial inflow);
 *  - Kaplan: hub with a few adjustable propeller blades (low heads) — the blades are parts, `setPitch`;
 *  - Pelton: wheel with double-cup buckets struck by a jet (high heads) — axis along Z, jet along +X.
 * Units: metres for a runner of the given `radius`.
 */
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';

/** Francis runner. Anchors: `inlet` (rim, where water enters), `outlet` (below, into the draft tube), `shaft`. */
export function addFrancisRunner(b: Builder, o: { radius?: number; blades?: number; color?: ColorLike } = {}): void {
  const r = o.radius ?? 1.6;
  const n = o.blades ?? 13;
  const c = col(o.color ?? col('mist').lerp(col('sky.light'), 0.3));
  // crown (upper disc curving down into the hub) and band (lower ring)
  b.lathe([[0, r * 0.05], [r * 0.3, r * 0.02], [r * 0.6, r * 0.2], [r * 0.98, r * 0.42], [r, r * 0.5], [r * 0.3, r * 0.52], [0, r * 0.52]], { seg: 32, slot: 'metal', c, crease: 50 });
  b.add(G.revolve([[r * 0.62, -r * 0.5], [r * 0.7, -r * 0.5], [r * 1.0, -r * 0.02], [r * 0.94, -r * 0.02]], { seg: 32 }).shell, { slot: 'metal', c });
  // blades: curved plates swept back from the rim to the outlet
  const outline: G.Pt[] = [];
  for (let i = 0; i <= 8; i++) outline.push([r * (0.98 - 0.62 * (i / 8)), -Math.sin((i / 8) * 1.25) * r * 0.42]);
  for (let i = 8; i >= 0; i--) outline.push([r * (0.98 - 0.62 * (i / 8)) + r * 0.012, -Math.sin((i / 8) * 1.25) * r * 0.42 - r * 0.035]);
  const blade = G.extrude(outline, r * 0.5, { bevel: r * 0.008 });
  for (let i = 0; i < n; i++) {
    // the extrusion (XY outline, thickness along Z) is laid flat so the curve lies in plan view, then turned to its station
    b.frame({ rot: [0, (i / n) * Math.PI * 2, 0] }, () => {
      b.add(blade, { slot: 'metal', c: c.clone().multiplyScalar(0.92), rot: [-Math.PI / 2, 0, 0], at: [0, -r * 0.02, 0] });
    });
  }
  b.cyl(r * 0.2, r * 0.9, { seg: 14, slot: 'metal', c: 'mist', at: [0, r * 0.5, 0] });
  b.cyl(r * 0.34, r * 0.14, { seg: 16, slot: 'metal', c: 'steel', at: [0, r * 0.5, 0] });
  b.anchor('inlet', r * 1.05, r * 0.2, 0);
  b.anchor('outlet', 0, -r * 0.6, 0);
  b.anchor('shaft', 0, r * 1.4, 0);
}

export interface KaplanRunner extends KitModel {
  /** Blade angle in radians (0 = flat / closed, ~0.6 = fully open). */
  setPitch(angle: number): void;
}

/** Kaplan runner: bullet hub and adjustable blades (parts `bladeN`). Anchors: `outlet`, `shaft`. */
export function kaplanRunner(o: { radius?: number; blades?: number; color?: ColorLike } = {}): KaplanRunner {
  const r = o.radius ?? 1.8;
  const n = o.blades ?? 5;
  const c = col(o.color ?? col('mist').lerp(col('sky.light'), 0.3));
  const b = new Builder('kaplan');
  b.lathe([[0, -r * 0.85], [r * 0.16, -r * 0.7], [r * 0.34, -r * 0.3], [r * 0.38, 0.0], [r * 0.36, r * 0.3], [r * 0.2, r * 0.42], [0, r * 0.42]], { seg: 24, slot: 'metal', c, crease: 60 });
  b.cyl(r * 0.16, r * 1.0, { seg: 14, slot: 'metal', c: 'mist', at: [0, r * 0.4, 0] });
  // one blade: a fan-shaped plate, thicker at the root, with its pivot on the hub surface
  const pts: G.Pt[] = [[r * 0.3, -r * 0.16], [r * 0.7, -r * 0.42], [r * 1.0, -r * 0.3], [r * 1.0, r * 0.3], [r * 0.7, r * 0.42], [r * 0.3, r * 0.16]];
  const blade = G.extrude(G.polyShape(pts, r * 0.12), r * 0.05, { bevel: r * 0.015 });
  for (let i = 0; i < n; i++) {
    const p = b.part(`blade${i}`, { rot: [0, (i / n) * Math.PI * 2, 0] });
    p.add(blade, { slot: 'metal', c: c.clone().multiplyScalar(0.92), rot: [-Math.PI / 2, 0, 0] });
    p.cyl(r * 0.1, r * 0.08, { axis: 'x', seg: 10, slot: 'metal', c: 'steel', at: [r * 0.34, 0, 0] });
  }
  b.anchor('outlet', 0, -r, 0);
  b.anchor('shaft', 0, r * 1.4, 0);
  const model = b.build();
  const runner: KaplanRunner = Object.assign(model, {
    setPitch(angle: number): void {
      for (let i = 0; i < n; i++) {
        const g = model.part(`blade${i}`);
        // azimuth around the shaft first, then pitch about the blade's own radial (X) axis
        g.rotation.order = 'YXZ';
        g.rotation.set(angle, (i / n) * Math.PI * 2, 0);
      }
    },
  });
  runner.setPitch(0.42);
  return runner;
}

/** Pelton wheel in the XY plane (axis Z) with its nozzle. Anchors: `nozzle`, `jet` (where the jet hits), `shaft`. */
export function addPeltonRunner(b: Builder, o: { radius?: number; buckets?: number; color?: ColorLike } = {}): void {
  const r = o.radius ?? 1.5;
  const n = o.buckets ?? 18;
  const c = col(o.color ?? col('mist').lerp(col('sky.light'), 0.3));
  b.cyl(r * 0.78, r * 0.16, { axis: 'z', seg: 32, slot: 'metal', c, at: [0, 0, -r * 0.08] });
  b.cyl(r * 0.26, r * 0.4, { axis: 'z', seg: 16, slot: 'metal', c: 'steel', at: [0, 0, -r * 0.2] });
  b.cyl(r * 0.12, r * 1.6, { axis: 'z', seg: 12, slot: 'metal', c: 'mist', at: [0, 0, -r * 0.8] });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.frame({ rot: [0, 0, a] }, () => {
      // double cup with the splitter ridge between the halves
      for (const s of [-1, 1]) b.sphere(r * 0.105, { seg: 10, slot: 'metal', c: c.clone().multiplyScalar(0.92), at: [0, r * 0.9, s * r * 0.09], s: [0.8, 1.2, 1] });
      b.box(r * 0.03, r * 0.24, r * 0.03, { r: 0, mid: true, slot: 'metal', c: 'steel', at: [r * 0.06, r * 0.9, 0] });
      b.box(r * 0.1, r * 0.16, r * 0.14, { r: r * 0.02, mid: true, slot: 'metal', c, at: [0, r * 0.76, 0] });
    });
  }
  // nozzle with a needle valve, aimed tangentially at the lowest buckets
  b.cyl(r * 0.16, r * 0.9, { rTop: r * 0.07, axis: 'x', seg: 14, slot: 'gloss', c: 'blue', at: [-r * 1.9, -r * 0.9, 0] });
  b.cone(r * 0.05, r * 0.2, { axis: 'x', seg: 8, slot: 'metal', c: 'mist', at: [-r * 1.05, -r * 0.9, 0] });
  b.cyl(r * 0.22, r * 0.12, { axis: 'x', seg: 14, slot: 'metal', c: 'slate', at: [-r * 1.95, -r * 0.9, 0] });
  b.anchor('nozzle', -r * 0.95, -r * 0.9, 0);
  b.anchor('jet', 0, -r * 0.9, 0);
  b.anchor('shaft', 0, 0, r * 0.8);
}

const wrap = (name: string, fn: (b: Builder) => void): KitModel => {
  const b = new Builder(name);
  fn(b);
  return b.build();
};
export const francisRunner = (o: Parameters<typeof addFrancisRunner>[1] = {}): KitModel => wrap('francis', (b) => addFrancisRunner(b, o));
export const peltonRunner = (o: Parameters<typeof addPeltonRunner>[1] = {}): KitModel => wrap('pelton', (b) => addPeltonRunner(b, o));
