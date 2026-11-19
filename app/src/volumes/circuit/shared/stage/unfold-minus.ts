/**
 * The minus strip's way LOW, under the parts (owner 2026-11-19: «тей дріт, котрий згори … щоб його низом пустити»).
 * It used to rise with the other strips and arch high over the battery and the spring from the minus end to the
 * lamp. Now, once the housing has opened, it drops off the torch: straight down from the spring's contact (behind
 * the coil, never through it), along the board under where the torch was, and straight up to the lamp's thread. It
 * stays down there while the battery, the slider and the lamp travel over it, sliding along the board to the left and
 * far sides, where the stand's wire lies — the same height as the stand's wire (`LOOP.y`), on the staples' pedestals.
 *
 * Its two ends stay on their parts; only the stretch between them is laid low. A pure function of its inputs.
 */
import { Vector3 } from 'three';
import { G } from '@/kit';
import { LOOP } from './layout';
import { resample } from './dyn-tube';

/** Height of the low stretch above the board: the stand's own wire height, so it simply stays there. */
export const MINUS_LOW = LOOP.y;
/** Every this many samples of the moving path, one corner of the low polyline (it is rounded again). */
const STRIDE = 5;
/** Corners of the low way are rounded with this radius (the drops from the parts included). */
const BEND = 0.1;
/** Low points closer than this (horizontally) to the foot of a drop are dropped: the drop turns in one bend. */
const FOOT = 0.14;
const smooth = (x: number): number => {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * (3 - 2 * c);
};

export interface MinusWay {
  /**
   * Lay `out` (the strip's moving path, its ends already on the spring and the lamp) low: `drop` 0…1 how far its
   * stretch between the ends has gone down to `MINUS_LOW`. Returns the normal of the strip's flat side at its start
   * that lays the low stretch flat on the board (`fallback` while it has not dropped). `offA`, `offB`: where the feet of
   * the two drops stand off their parts — back off the spring's coil (horizontal), out from the lamp's thread.
   */
  apply(out: Vector3[], drop: number, fallback: Vector3, offA: Vector3, offB: Vector3): Vector3;
}

export function createMinusWay(): MinusWay {
  const normal = new Vector3();
  const h = new Vector3();
  const up = new Vector3();
  const flat = (p: Vector3, q: Vector3): number => Math.hypot(p.x - q.x, p.z - q.z);

  return {
    apply(out, drop, fallback, offA, offB) {
      const n = out.length;
      if (drop <= 0) return normal.copy(fallback);
      const A = out[0]!.clone();
      const B = out[n - 1]!.clone();
      const lowY = (y: number): number => y + (MINUS_LOW - y) * drop;
      // the feet stand off the parts at once (a sixth of the drop), so the drops never slant into them
      const off = Math.min(1, 6 * drop);
      const footA = new Vector3(A.x, lowY(A.y), A.z).addScaledVector(offA, off);
      const outB = B.clone().addScaledVector(offB, off);
      const footB = new Vector3(outB.x, lowY(outB.y), outB.z);
      // the stretch between: the moving path, lowered; points next to a drop's foot would kink it
      const way = [A, footA];
      for (let i = STRIDE; i < n - 1; i += STRIDE) {
        const p = out[i]!;
        const q = new Vector3(p.x, lowY(p.y), p.z);
        // (near the spring the low stretch stands back off the coil with the foot)
        q.addScaledVector(offA, off * Math.max(0, 1 - flat(q, A) / 0.6));
        if (flat(q, footA) < FOOT || flat(q, footB) < FOOT) continue;
        way.push(q);
      }
      // up to the lamp, then in to its thread from the side
      way.push(footB, outB, B);
      const pts = resample(G.roundPath(way, BEND, 4), n);
      for (let i = 0; i < n; i++) out[i]!.copy(pts[i]!);
      // the strip starts straight down; its flat side, carried round the bend at the foot, lies on the board when it
      // faces the way the low stretch first goes (ahead of the bend). Without a drop (the spring down on the board)
      // it simply faces up. While dropping it turns from the torch's own
      h.set(way[2]!.x - footA.x, 0, way[2]!.z - footA.z);
      if (h.lengthSq() < 1e-8) return normal.copy(fallback);
      const leg = smooth(A.distanceTo(footA) / (2 * BEND));
      h.normalize().multiplyScalar(leg).add(up.set(0, 1 - leg, 0)).normalize();
      return normal.copy(fallback).lerp(h, drop).normalize();
    },
  };
}

const wrap = (a: number): number => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));

/**
 * The low stretch's plan view while it moves from the torch's way to the stand's (`w` 0…1), as a rope would go: each
 * piece of it turns from its direction in the torch to its direction on the stand and stretches to its length there,
 * all turning the same way round (the way the lamp's end turns least), laid piece after piece from the spring's
 * end. A plain blend of the two ways would fold the stretch at the spring, which heads to the lamp in the torch and
 * the other way on the stand, into a crumpled hairpin. The far end is then drawn onto the lamp's (`B`), the miss
 * spread along the strip (most of it near the lamp, as the pinned ends do). Only x and z of `out` are set.
 */
export function ropeBetween(from: readonly Vector3[], to: readonly Vector3[], w: number, out: Vector3[]): void {
  const n = out.length;
  const turn: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = Math.atan2(from[i + 1]!.z - from[i]!.z, from[i + 1]!.x - from[i]!.x);
    const b = Math.atan2(to[i + 1]!.z - to[i]!.z, to[i + 1]!.x - to[i]!.x);
    turn.push(wrap(b - a));
  }
  // continuous along the strip, anchored at the lamp's end
  for (let i = n - 3; i >= 0; i--) turn[i] = turn[i + 1]! + wrap(turn[i]! - turn[i + 1]!);
  const A = out[0]!;
  const B = out[n - 1]!;
  let x = A.x;
  let z = A.z;
  const xs = [x];
  const zs = [z];
  for (let i = 0; i < n - 1; i++) {
    const dx = from[i + 1]!.x - from[i]!.x;
    const dz = from[i + 1]!.z - from[i]!.z;
    const a = Math.atan2(dz, dx) + turn[i]! * w;
    const len = Math.hypot(dx, dz) + (Math.hypot(to[i + 1]!.x - to[i]!.x, to[i + 1]!.z - to[i]!.z) - Math.hypot(dx, dz)) * w;
    x += len * Math.cos(a);
    z += len * Math.sin(a);
    xs.push(x);
    zs.push(z);
  }
  const ex = B.x - x;
  const ez = B.z - z;
  for (let i = 1; i < n - 1; i++) {
    const s = (i / (n - 1)) ** 2;
    out[i]!.x = xs[i]! + ex * s;
    out[i]!.z = zs[i]! + ez * s;
  }
}
