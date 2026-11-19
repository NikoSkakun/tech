/**
 * The plus strip's way UNDER the battery (owner 2026-11-19: «може пустити цю частину дроту знизу, під
 * батарейкою?»). It used to go from the contact plate in front of the «+» nub up the battery's end and back along
 * its top to the slider; lifted with the slider during the unfolding, that stretch hung over the «+» end and read as
 * cutting it. Now it goes the other way round, in the torch already: from the plate down in front of the «+» end,
 * back along the housing's bottom under the can, up its far wall to the slider. As the strips rise it lifts off the
 * wall to a clear gap round the can; while the battery travels (lifted) and the slider follows behind it, it stays
 * under the battery; once the slider has come round the «+» end to its block, the way under folds away and the strip
 * is the stand's straight piece.
 *
 * All of it in the battery's own frame, at a set distance from its axis, so it goes round the can, never through it.
 */
import { Quaternion, Vector3, type Object3D } from 'three';
import { G } from '@/kit';
import { BATTERY } from './layout';
import { resample } from './dyn-tube';

const L = BATTERY.length;
/** Distance of the way from the axis in the torch: on the housing's bottom and far wall, like the minus strip. */
export const IN_TORCH = 0.303;
/** … and once lifted off the wall: the can's radius + a clear gap (the strip's half width fits in it). */
export const CLEAR = BATTERY.radius + 0.09;
/** Least distance from the axis anywhere along the can (radius + the strip's half width and thickness) and the nub. */
const KEEP = BATTERY.radius + 0.08;
const NUB_KEEP = 0.105 + 0.08;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// angles round the axis: 0 = toward the reader's side (+z), 90° = up, 180° = far side, 270° = down

export interface PlusWay {
  /**
   * Lay the strip (`out`: its two ends already on the parts) on the way under the battery. `clear`: its distance
   * from the battery's axis (`IN_TORCH` on the housing's wall … `CLEAR` once lifted off it); `straight` 0…1: the
   * drop under the «+» end folds into the stand's straight piece (both parts in place). Returns the normal of the
   * strip's flat side at its start. `into`: a point the strip passes just before its end (from under the slider).
   */
  apply(out: Vector3[], battery: Object3D, clear: number, straight: number, into: Vector3): Vector3;
}

export function createPlusWay(): PlusWay {
  const inv = new Quaternion();
  const A = new Vector3();
  const B = new Vector3();
  const In = new Vector3();
  const tmp = new Vector3();
  const normal = new Vector3();
  const toLocal = (p: Vector3, b: Object3D, o: Vector3): Vector3 =>
    o.copy(p).sub(b.position).applyQuaternion(inv);
  const at = (x: number, a: number, r: number): Vector3 => new Vector3(x, r * Math.sin(a), r * Math.cos(a));

  return {
    apply(out, battery, clear, straight, into) {
      const n = out.length;
      inv.copy(battery.quaternion).invert();
      toLocal(out[0]!, battery, A);
      toLocal(out[n - 1]!, battery, B);
      // straight runs along the axis and circles round it only: on those the strip's flat side, carried along,
      // stays toward the can (on a slanted winding it would turn edge-on into it). Down from the plate in front of
      // the «+» end, back under the can to the slider's x, round the far side up to the slider. The slider past
      // the «+» end: nothing to go under any more, the run back folds away
      toLocal(into, battery, In);
      const fold = smooth((In.x - (L / 2 - 0.2)) / 0.5);
      const back = Math.min(Math.max(In.x, -L / 2 + 0.3), L / 2 - 0.25);
      const x = back + (A.x - back) * fold;
      // round the far side at the set distance up to the slider's own angle, if it is there or near the can (in the
      // torch: inside the housing, up its far wall onto the top); if the slider is high above (lifted), only to the
      // far side, then straight up the far side to its height and over to it — the minus strip, sweeping over the
      // battery's top meanwhile, passes under that, not through a climb in the middle
      let side = Math.atan2(In.y, In.z);
      if (side < -Math.PI / 4) side += TAU;
      const down = (3 * Math.PI) / 2;
      const high = Math.hypot(In.y, In.z) > clear + 0.05 && In.y > 0;
      // (past the «+» end there is nothing to go round: the circle folds away with the run back, or it would loop in
      // front of the nub)
      const end = Math.min(Math.max(side, high ? Math.PI : 0), down) * (1 - fold) + down * fold;
      const way = [A.clone(), new Vector3(A.x, -clear, 0), at(x, down, clear)];
      const steps = Math.ceil((down - end) / (10 * DEG));
      // (in the torch the circle ends on the slider's way in: its last part widens to that distance, in its plane)
      const reach = high ? 0 : (Math.hypot(In.y, In.z) - clear) * (1 - fold);
      for (let k = 1; k <= steps; k++)
        way.push(at(x, down + ((end - down) * k) / steps, clear + reach * smooth((k / steps - 0.6) / 0.4)));
      if (high && side < Math.PI) way.push(new Vector3(x, In.y, -clear));
      way.push(In.clone(), B.clone());
      const pts = resample(G.roundPath(way, 0.09, 4), n);
      for (let i = 0; i < n; i++) {
        const c = pts[i]!;
        // both parts in place: the stand's straight piece
        c.lerp(tmp.copy(A).lerp(B, i / (n - 1)), straight);
        // whatever a frame between two ways does, the strip keeps clear of the can and of the nub
        const keep = c.x < L / 2 + 0.01 ? Math.min(KEEP, clear - 0.01) : c.x < L / 2 + 0.11 ? NUB_KEEP : 0;
        const r = Math.hypot(c.y, c.z);
        if (r < keep && r > 1e-6) c.multiply(tmp.set(1, keep / r, keep / r));
        out[i]!.copy(c).applyQuaternion(battery.quaternion).add(battery.position);
      }
      // flat side toward the «+» end at the plate (as in the torch), then carried round; once the slider is past the
      // «+» end, toward the slider (so that, carried down the drop and over to it, the strip lies flat, not on edge);
      // down on the stand
      tmp.set(In.x - A.x, 0, In.z);
      if (tmp.lengthSq() > 1e-8) normal.set(1, 0, 0).lerp(tmp.normalize(), fold);
      else normal.set(1, 0, 0);
      if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0);
      return normal
        .normalize()
        .lerp(tmp.set(0, -1, 0), straight)
        .normalize()
        .applyQuaternion(battery.quaternion);
    },
  };
}
