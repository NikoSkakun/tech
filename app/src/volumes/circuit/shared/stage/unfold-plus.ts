/**
 * The plus strip's way UNDER the battery (owner 2026-11-19: «може пустити цю частину дроту знизу, під
 * батарейкою?»): from the contact plate on the «+» nub down in front of the «+» end, back under the can's front
 * end, up its far side as a band, and back along the battery's top to the slider's contact. Never over the «+»
 * end: lifted with the slider, a strip that came over it read as cutting the can.
 *
 * In the unfolding the slider rides forward along the battery's top (`unfold.ts`), so the strip only gets shorter
 * under it: the run along the top goes; the slider's contact then pushes the band forward off the can's end, and as
 * the slider steps off in front of «+» the band opens into what is left — one soft hook hanging from the plate to
 * the slider (`hook`), which draws straight as both come down on their terminals.
 *
 * On the can the way is runs along the axis and circles round it only: on those the strip's flat side, carried
 * along, stays toward the can. All of it in the battery's own frame; a pure function of its inputs.
 */
import { CubicBezierCurve3, Quaternion, Vector3, type Object3D } from 'three';
import { G } from '@/kit';
import { BATTERY } from './layout';
import { resample } from './dyn-tube';

const L = BATTERY.length;
/**
 * Distance of the strip's middle from the axis where it lies on the can: the can's metal ring (radius + 0.007),
 * half the strip's thickness, a hair of air.
 */
export const ON_CAN = BATTERY.radius + 0.0185;
/**
 * Where the band goes up the far side (from the battery's centre): round the can's very front end. There the
 * housing has begun to flare, so the minus strip on its far wall passes outside the band with air between them
 * (`torchPath`); beside the slider the two would have to lie one on the other.
 */
export const BAND = L / 2 - 0.065;
/**
 * The slider's contact pushes the band off the can: the band begins to move as the contact comes within `PUSH` of
 * it, and has come to rest `OFF` in front of the plate once the contact has gone `PUSHED` farther (eased at both
 * ends: it is nudged, not struck).
 */
const PUSH = 0.12;
const PUSHED = 0.36;
const OFF = 0.02;
/** The band opens into the hook while the contact goes this far on, from a little behind the plate. */
const OPENS = 0.45;
/** Radius of the strip's bends on the can. */
const BEND = 0.09;
const DEG = Math.PI / 180;
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// angles round the axis: 0 = toward the reader's side (+z), 90° = up, 180° = far side, 270° = down

export interface PlusWay {
  /**
   * Lay the strip (`out`: its two ends already on the parts; the slider stands as the battery does). Returns the
   * normal of the strip's flat side at its start.
   */
  apply(out: Vector3[], battery: Object3D): Vector3;
}

export function createPlusWay(): PlusWay {
  const inv = new Quaternion();
  const A = new Vector3();
  const B = new Vector3();
  const tmp = new Vector3();
  const normal = new Vector3();
  const pts: Vector3[] = [];
  const hung: Vector3[] = [];
  const curve = new CubicBezierCurve3(A, new Vector3(), new Vector3(), B);
  const toLocal = (p: Vector3, b: Object3D, o: Vector3): Vector3 =>
    o.copy(p).sub(b.position).applyQuaternion(inv);
  const at = (x: number, a: number, r: number): Vector3 => new Vector3(x, r * Math.sin(a), r * Math.cos(a));
  /**
   * The strip free of the can, hanging from the plate (`A`) to the slider's contact (`B`) in the upright plane
   * through both: while the slider is still over the plate it leaves the plate downward, as it lay on the «+» end,
   * and curls up to the contact; the farther ahead the slider is, the more it leaves the plate forward and comes to
   * the contact level — at the end both ends are level and it is the stand's straight piece. Returns how far it has
   * turned from down to forward, 0…1.
   */
  const hook = (n: number): number => {
    const ahead = smooth((B.x - A.x - 0.08) / 0.34);
    const reach = Math.max(0.08, 0.42 * A.distanceTo(B));
    const a = (ahead * Math.PI) / 2;
    curve.v1.set(A.x + Math.sin(a) * reach, A.y - Math.cos(a) * reach, A.z);
    // (to the contact from below and a little from the front at first: the curl stays in front of the «+» end)
    const b = (1 - ahead) * 105 * DEG;
    curve.v2.set(B.x - Math.cos(b) * reach, B.y - Math.sin(b) * reach, B.z);
    resample(curve.getPoints(40), n, hung);
    return ahead;
  };

  return {
    apply(out, battery) {
      const n = out.length;
      inv.copy(battery.quaternion).invert();
      toLocal(out[0]!, battery, A);
      toLocal(out[n - 1]!, battery, B);
      // on the can: down from the plate, back under the front end, the band up the far side to the slider's own
      // height and side, back along the top into the contact (the bit seen under the slider of the closed
      // flashlight). Past the can's end the contact pushes the band ahead of it, off the can
      const x = BAND + (A.x + OFF - BAND) * smooth((B.x - (BAND - PUSH)) / PUSHED);
      // (every run in a plane through the axis or square to it — straight down from the plate, straight back along
      // the top beside the lamp strip: on a slanted run the flat side, carried along, would tilt off the can)
      const down = 270 * DEG;
      const end = Math.atan2(B.y, B.z);
      const top = Math.hypot(B.y, B.z);
      // the bend from the «+» end's face under the can, in the plane through the axis
      const foot = at(A.x, down, ON_CAN);
      const drop = A.distanceTo(foot);
      const d0 = Math.min(BEND, 0.45 * Math.max(A.x - x, 0));
      const way = [A.clone()];
      const from = foot.clone().lerp(A, Math.min(BEND, 0.48 * drop) / Math.max(drop, 1e-6));
      const to = at(A.x - d0, down, ON_CAN);
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        way.push(
          new Vector3()
            .addScaledVector(from, (1 - t) * (1 - t))
            .addScaledVector(foot, 2 * t * (1 - t))
            .addScaledVector(to, t * t),
        );
      }
      // the rest lies on the can: its corners are rounded on the can's unrolled surface (along the axis, round it;
      // the distance from the axis rides along as the third number) and rolled back on — so every bend stays on
      // the can and the flat side, carried along, stays toward it
      const flat = (px: number, a: number, r: number): Vector3 => new Vector3(px, a * ON_CAN, r);
      const mid = down + (end - down) * 0.6;
      const rolled = G.roundPath(
        [
          flat(A.x - d0, down, ON_CAN),
          flat(x, down, ON_CAN),
          flat(x, mid, ON_CAN),
          flat(x, end, top),
          flat(B.x, end, top),
        ],
        BEND,
        5,
      );
      for (let i = 1; i < rolled.length; i++) {
        const p = rolled[i - 1]!;
        const q = rolled[i]!;
        const pieces = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 0.03));
        for (let k = 1; k <= pieces; k++) {
          tmp.copy(p).lerp(q, k / pieces);
          way.push(at(tmp.x, tmp.y / ON_CAN, tmp.z));
        }
      }
      resample(way, n, pts);
      // the slider stepping off in front of «+»: the band, off the can by now, opens into the hook
      const open = smooth((B.x - (A.x - 0.06)) / OPENS);
      const ahead = open > 0 ? hook(n) : 0;
      for (let i = 0; i < n; i++)
        out[i]!
          .copy(pts[i]!)
          .lerp(hung[i] ?? pts[i]!, open)
          .applyQuaternion(battery.quaternion)
          .add(battery.position);
      // flat side toward the «+» end at the plate (as in the torch), carried round the can; the hook's flat side
      // turns up as it leaves the plate forward (it hangs like a ribbon, its face to the reader above)
      return normal
        .set(1, 0, 0)
        .lerp(tmp.set(0, 1, 0), open * ahead)
        .normalize()
        .applyQuaternion(battery.quaternion);
    },
  };
}
