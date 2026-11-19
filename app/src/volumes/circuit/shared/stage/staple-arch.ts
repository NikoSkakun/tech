/**
 * The staples' arches close over the wire only once it lies in them (owner 2026-11-19: «самі скоби радіально
 * з'являлись коли дріт вже ліг»): the pedestal grows with the other mounts as before, the steel arch appears by
 * sweeping round the wire — from the foot on the far side, over the wire, down to the other foot. The arch is the
 * staple's `metal` mesh (`mounts.ts`: a ring round the wire's axis, its lower part inside the pedestal); its
 * triangles are put in the order of that sweep once, and the draw range shows the swept part. At 1 the whole
 * mesh is drawn, exactly as before.
 */
import type { Group, Mesh } from 'three';
import { LOOP } from './layout';

/** Centre of the arch in the staple's own frame (`mounts.ts`: the ring at the wire's height − 0.02, round x). */
const CENTRE_Y = LOOP.y - 0.02;
/** Where the arch meets the pedestal's top (angle round x from +z, toward +y): its two feet. */
const FOOT = Math.asin((LOOP.y - 0.075 - CENTRE_Y) / 0.1);
const START = Math.PI - FOOT;
const SWEEP = START - FOOT;
const TAU = Math.PI * 2;

export interface StapleArch {
  /** 0 = no arch … 1 = the whole staple as built. */
  set(k: number): void;
}

export function stapleArch(staple: Group): StapleArch {
  const mesh = staple.children.find((c): c is Mesh => (c as Mesh).isMesh && c.name.endsWith(':metal'));
  const index = mesh?.geometry.index;
  if (!mesh || !index) return { set() {} };
  const pos = mesh.geometry.getAttribute('position');
  const n = index.count / 3;
  // each triangle's place along the sweep: angle from the far foot, over the top, to the near one (then the hidden
  // lower part inside the pedestal)
  const key = (t: number): number => {
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      const v = index.getX(3 * t + k);
      y += pos.getY(v) / 3;
      z += pos.getZ(v) / 3;
    }
    return (((START - Math.atan2(y - CENTRE_Y, z)) % TAU) + TAU) % TAU;
  };
  const tris = Array.from({ length: n }, (_, t) => ({ t, k: key(t) })).sort((a, b) => a.k - b.k);
  const src = Array.from(index.array as ArrayLike<number>);
  tris.forEach(({ t }, i) => {
    for (let k = 0; k < 3; k++) index.setX(3 * i + k, src[3 * t + k]!);
  });
  index.needsUpdate = true;
  const edges = tris.map(({ k }) => k);
  let last = -1;
  return {
    set(k) {
      if (k === last) return;
      last = k;
      if (k >= 1) {
        mesh.geometry.setDrawRange(0, Infinity);
        mesh.visible = true;
        return;
      }
      const upTo = SWEEP * Math.max(k, 0);
      let count = 0;
      while (count < n && edges[count]! <= upTo) count++;
      mesh.visible = count > 0;
      mesh.geometry.setDrawRange(0, 3 * count);
    },
  };
}
