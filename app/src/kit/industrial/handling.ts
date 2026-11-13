/**
 * Bulk handling: belt conveyor on trestles with lumps of material riding the belt (animated in `update`), and
 * a rail-mounted gantry crane with a travelling trolley and hook (parts). Units: metres.
 */
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, type KitModel, type V3 } from '../core/builder';
import * as G from '../core/geo';
import { noise2 } from '../core/noise';

const dark = () => col('slate').lerp(col('steel'), 0.3);

export interface ConveyorOptions {
  /** Tail (loading) and head (discharge) points: centre of the belt surface. */
  from: V3;
  to: V3;
  width?: number;
  /** Material on the belt: colour of the lumps (coal `ink`, biomass `wireBrown`, ash `mist`), or false for an empty belt. */
  load?: ColorLike | false;
  /** Lumps per metre of belt. Default 1.6. */
  density?: number;
}

export interface Conveyor extends KitModel {
  /** Belt speed in m/s used by `update` (2–5 m/s on real coal conveyors; slower reads better). */
  speed: number;
}

/** Anchors: `tail`, `head` (material leaves the belt here). */
export function conveyor(o: ConveyorOptions): Conveyor {
  const b = new Builder('conveyor');
  const w = o.width ?? 1.4;
  const a = new Vector3(...o.from);
  const e = new Vector3(...o.to);
  const len = a.distanceTo(e);
  const dir = e.clone().sub(a).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const pitch = -Math.asin(dir.y);
  b.frame({ at: o.from, rot: [0, yaw, 0] }, () => {
    b.frame({ rot: [pitch, 0, 0] }, () => {
      // belt (top strand slightly troughed by its side strips), return strand, stringers, idlers, pulleys
      b.box(w, 0.06, len, { r: 0, slot: 'matte', c: col('ink').lerp(col('slate'), 0.3), at: [0, -0.06, len / 2] });
      b.box(w, 0.04, len, { r: 0, slot: 'matte', c: col('ink').lerp(col('slate'), 0.2), at: [0, -0.5, len / 2] });
      for (const s of [-1, 1]) {
        b.box(0.1, 0.22, len, { r: 0, slot: 'metal', c: 'yellow', at: [s * (w / 2 + 0.12), -0.3, len / 2] });
        b.box(0.14, 0.1, len, { r: 0, slot: 'matte', c: col('ink').lerp(col('slate'), 0.4), at: [s * (w / 2 - 0.05), -0.02, len / 2], rot: [0, 0, -s * 0.5] });
      }
      for (let z = 0.6; z < len; z += 1.5) b.cyl(0.09, w + 0.1, { axis: 'x', seg: 8, slot: 'metal', c: 'steel.light', at: [-w / 2 - 0.05, -0.17, z], bevel: 0 });
      for (const z of [0, len]) b.cyl(0.3, w + 0.2, { axis: 'x', seg: 14, slot: 'metal', c: dark(), at: [-w / 2 - 0.1, -0.28, z] });
      b.box(w + 0.9, 0.8, 1.2, { r: 0.1, slot: 'gloss', c: 'yellow', at: [0, -0.5, len + 0.2] });
      b.box(0.6, 0.6, 0.9, { r: 0.1, slot: 'gloss', c: 'teal', at: [w / 2 + 0.75, -0.5, len] });
      b.anchor('tail', 0, 0.1, 0);
      b.anchor('head', 0, 0, len + 0.6);
    });
    // trestles down to the ground
    const n = Math.max(1, Math.round(len / 8));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const z = Math.cos(pitch) * len * t;
      const y = dir.y * len * t - 0.45;
      const ground = -o.from[1];
      if (y - ground < 0.6) continue;
      for (const s of [-1, 1]) b.beam([s * (w / 2 + 0.12), y, z], [s * (w / 2 + 0.5 + (y - ground) * 0.08), ground, z], 0.16, { slot: 'metal', c: dark() });
      b.beam([-(w / 2 + 0.3), (y + ground) / 2, z], [w / 2 + 0.3, (y + ground) / 2, z], 0.1, { slot: 'metal', c: dark() });
    }
  });
  const model = b.build() as Conveyor;
  model.speed = 1.2;
  if (o.load === false) return model;
  // lumps: one instanced mesh, positions wrap around the belt length
  const count = Math.max(4, Math.round(len * (o.density ?? 1.6)));
  const lump = new InstancedMesh(G.facet(0.16, 0), model.mats.get('facet'), count);
  lump.name = 'conveyor:load';
  lump.castShadow = true;
  const tint = col(o.load ?? 'ink');
  for (let i = 0; i < count; i++) lump.setColorAt(i, tint.clone().lerp(col('slate'), noise2(i, 3.3) * 0.5));
  model.group.add(lump);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  let travel = 0;
  model.update = (dt) => {
    travel = (travel + model.speed * dt) % len;
    for (let i = 0; i < count; i++) {
      const d = ((i / count) * len + travel + noise2(i, 9.1) * 0.5) % len;
      const k = 0.7 + noise2(i, 1.7) * 0.8;
      p.copy(a).addScaledVector(dir, d).addScaledVector(side, (noise2(i, 5.2) - 0.5) * (w - 0.5));
      p.y += 0.08 * k;
      q.setFromAxisAngle(side, i * 1.3);
      lump.setMatrixAt(i, m.compose(p, q, s.set(k, k * 0.75, k)));
    }
    lump.instanceMatrix.needsUpdate = true;
  };
  model.update(0, 0);
  return model;
}

export interface GantryCrane extends KitModel {
  /** Trolley position across the span, −1 … 1. */
  setTrolley(x: number): void;
  /** Hook height: 0 = fully lowered to the ground, 1 = raised to the girder. */
  setHook(h: number): void;
}

/** Rail-mounted gantry crane spanning along X, travelling along Z. Parts: `trolley` › `hook`. Anchors: `hook`, `cab`. */
export function gantryCrane(o: { span?: number; height?: number; color?: ColorLike } = {}): GantryCrane {
  const span = o.span ?? 24;
  const H = o.height ?? 14;
  const c = col(o.color ?? 'yellow');
  const b = new Builder('gantry-crane');
  for (const s of [-1, 1]) {
    const x = (s * span) / 2;
    b.box(0.3, 0.16, 16, { r: 0, slot: 'metal', c: dark(), at: [x, 0, 0] });
    b.box(1.0, 0.9, 7, { r: 0.15, slot: 'gloss', c: [c.clone().multiplyScalar(0.8), c], at: [x, 0.3, 0] });
    for (const z of [-2.6, 2.6]) {
      b.cyl(0.4, 0.3, { axis: 'x', seg: 12, slot: 'metal', c: dark(), at: [x - 0.15, 0.5, z] });
      b.beam([x, 1.1, z], [x, H, z * 0.25], 0.6, { r: 0.1, slot: 'gloss', c });
    }
    b.beam([x, H * 0.55, -1.5], [x, H * 0.55, 1.5], 0.3, { slot: 'gloss', c });
  }
  b.box(span + 3, 1.6, 1.4, { r: 0.2, seg: 2, slot: 'gloss', c: [c.clone().multiplyScalar(0.82), c], at: [0, H, 0] });
  for (let i = 0; i < 8; i++) b.box(0.5, 0.5, 0.06, { r: 0, slot: 'gloss', c: i % 2 ? 'ink' : 'yellow', at: [-span / 2 + 0.5 + i * 0.5, H + 0.2, 0.73] });
  b.box(2.2, 2.0, 2.0, { r: 0.2, slot: 'gloss', c: 'white', at: [-span / 2 + 2.5, H - 2.2, 1.4] });
  b.box(2.0, 0.9, 0.1, { r: 0.05, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.35), at: [-span / 2 + 2.5, H - 1.6, 2.42] });
  b.anchor('cab', -span / 2 + 2.5, H - 1.2, 2.6);
  b.sphere(0.25, { seg: 8, slot: 'glow', c: 'amber', at: [span / 2, H + 1.9, 0] });
  const trolley = b.part('trolley', { at: [0, H, 0] });
  trolley.box(2.4, 0.7, 2.2, { r: 0.12, slot: 'gloss', c: 'coral', at: [0, 1.6, 0] });
  trolley.cyl(0.4, 1.4, { axis: 'x', seg: 12, slot: 'metal', c: dark(), at: [-0.7, 1.4, 0] });
  // hoist ropes: a unit-length part stretched to the hook by `setHook`
  const rope = trolley.part('rope');
  for (const s of [-1, 1]) rope.cyl(0.03, 1, { seg: 4, slot: 'metal', c: 'slate', at: [s * 0.25, -1, 0], bevel: 0 });
  const hook = trolley.part('hook', { at: [0, -H * 0.5, 0] });
  hook.box(0.9, 0.7, 0.5, { r: 0.12, slot: 'gloss', c: 'yellow', at: [0, 0, 0] });
  hook.ring(0.3, 0.09, { axis: 'z', seg: 14, tubeSeg: 6, slot: 'metal', c: dark(), at: [0, -0.35, 0] });
  hook.anchor('hook', 0, -0.7, 0);
  const model = b.build();
  const crane: GantryCrane = Object.assign(model, {
    setTrolley: (x: number): void => void (model.part('trolley').position.x = (x * (span - 4)) / 2),
    setHook: (h: number): void => {
      const y = -(H - 1.2) * (1 - h) - 0.4;
      model.part('hook').position.y = y;
      model.part('rope').scale.y = -y - 0.6;
    },
  });
  crane.setHook(0.5);
  return crane;
}
