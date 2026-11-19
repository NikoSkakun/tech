/**
 * The plus piece: from the contact plate on the battery's «+» nub to the slider's contact.
 *
 * IN THE FLASHLIGHT it is a flat strip that goes UNDER the battery (owner 2026-11-19: «може пустити цю частину
 * дроту знизу, під батарейкою?»): down in front of the «+» end, back along the housing's bottom under the can, up
 * its far side beside the slider as a band, onto the top and into the slider's contact — runs along the axis and
 * circles round it only, on which a strip's flat side, carried along, stays toward the can.
 *
 * IN THE UNFOLDING it is a short flexible wire that simply follows the slider, never moving faster than its own
 * two ends (owner 2026-11-19: «якось дивно заанімований самий маленький шматочок дроту (котрий іде з батарейкового
 * +)» — it used to stay wound under the battery until the slider had left, and then whip round after it):
 *   1  `settle` — once the housing no longer holds it flat under the battery it rounds into a wire and draws itself
 *      the short way: the drop from the plate turns from down to the far side (out of the reader's sight behind the
 *      «+» end), the corners of its way on the can straighten, and it lies as a band of rubber would, from the «+»
 *      end slantwise up the can's far side to the slider;
 *   2  the slider rides forward along the battery: the wire only gets shorter, and as the slider comes to the can's
 *      end it turns up after it, so that it comes from the plate almost straight to the slider's contact;
 *   3  the slider steps off in front of «+» (`RIM`): the wire is free — one soft curve from the plate to the
 *      contact, as long as the two are apart and a little more, leaving the plate forward and coming to the contact
 *      level as the slider goes ahead; both down on their terminals, it is the stand's straight piece.
 *
 * Its way on the can is laid on the can's unrolled surface (along the axis, round it) and rolled back on, so every
 * bend and every slant stays on the can. All of it in the battery's own frame; a pure function of its inputs.
 */
import { CubicBezierCurve3, Quaternion, Vector3, type Object3D } from 'three';
import { G } from '@/kit';
import { BATTERY, WIRE } from './layout';
import { resample } from './dyn-tube';

const L = BATTERY.length;
/** Half the thickness of the flat strip (`wires.ts`: 0.3 of the wire's radius). */
const THIN = WIRE.core * 0.3;
/**
 * Distance of the piece's middle from the axis where it lies on the can: the can's metal ring (radius + 0.007),
 * half its own thickness (a strip's … the round wire's radius), and a little air: round a bend on the can a strip's
 * flat side, carried along, leans a few degrees off the can, and its edge must still clear it.
 */
export const onCan = (round: number): number => BATTERY.radius + 0.0135 + THIN + (WIRE.core - THIN) * round;
/** In the torch the band rides this far ahead of the slider's contact (the strip turns back into it from the front). */
const LEAD = 0.12;
/** Past this the slider's contact is off the can's front end and the piece is free; it eases free over `FREES`. */
const RIM = L / 2 + 0.03;
const FREES = 0.18;
/** Radius of the piece's bends on the can. */
const BEND = 0.06;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

// angles round the axis: 0 = toward the reader's side (+z), 90° = up, 180° = far side, 270° = down
const DOWN = 270 * DEG;
/**
 * Where the piece leaves the plate for the can once it has settled: to the far side, a little below level — out of
 * the reader's sight behind the «+» end; and by how much it then turns up toward the slider's own side as the
 * slider comes to the can's end (the slider's contact is `NEAR` short of it): at the end the piece comes from the
 * plate almost straight to the contact.
 */
const FAR = 190 * DEG;
const NEAR = 28 * DEG;

export interface PlusWay {
  /**
   * Lay the piece (`out`: its two ends already on the parts; the slider stands as the battery does). `round` 0…1:
   * strip … wire (it needs more room on the can). `settle` 0…1: from its way under the battery in the torch to the
   * short way of a wire. Returns the normal of its flat side at its start.
   */
  apply(out: Vector3[], battery: Object3D, round: number, settle: number): Vector3;
}

export function createPlusWay(): PlusWay {
  const inv = new Quaternion();
  const A = new Vector3();
  const B = new Vector3();
  const tmp = new Vector3();
  const chord = new Vector3();
  const normal = new Vector3();
  const pts: Vector3[] = [];
  const loose: Vector3[] = [];
  const curve = new CubicBezierCurve3(A, new Vector3(), new Vector3(), B);
  const toLocal = (p: Vector3, b: Object3D, o: Vector3): Vector3 =>
    o.copy(p).sub(b.position).applyQuaternion(inv);
  const at = (x: number, a: number, r: number): Vector3 => new Vector3(x, r * Math.sin(a), r * Math.cos(a));
  /** Quadratic bend from `a` to `c` with its corner at `b`, appended to `way` (without `a`). */
  const bend = (way: Vector3[], a: Vector3, b: Vector3, c: Vector3, steps: number): void => {
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      way.push(
        new Vector3()
          .addScaledVector(a, (1 - t) * (1 - t))
          .addScaledVector(b, 2 * t * (1 - t))
          .addScaledVector(c, t * t),
      );
    }
  };
  /**
   * The piece free of the can: one soft curve from the plate (`A`) to the slider's contact (`B`). It leaves the
   * plate along the «+» end's face, the way `from` (round the axis) it left it on the can, and the more the contact
   * is ahead of the plate, the more it leaves it forward; it comes to the contact from the plate's side, and level
   * once the contact is ahead. Both ends level and ahead: a straight piece.
   */
  const free = (n: number, from: number): void => {
    chord.copy(B).sub(A);
    const reach = Math.max(0.05, 0.36 * chord.length());
    const ahead = smooth((chord.x - 0.02) / 0.42);
    chord.normalize();
    tmp.set(ahead, Math.sin(from) * (1 - ahead), Math.cos(from) * (1 - ahead)).normalize();
    curve.v1.copy(A).addScaledVector(tmp, reach);
    tmp.set(-ahead - chord.x * (1 - ahead), -chord.y * (1 - ahead), -chord.z * (1 - ahead)).normalize();
    curve.v2.copy(B).addScaledVector(tmp, reach);
    resample(curve.getPoints(40), n, loose);
  };

  return {
    apply(out, battery, round, settle) {
      const n = out.length;
      inv.copy(battery.quaternion).invert();
      toLocal(out[0]!, battery, A);
      toLocal(out[n - 1]!, battery, B);
      const R = onCan(round);
      // where round the axis the slider's contact is (on the battery's top, a little to the far side)
      let side = Math.atan2(B.y, B.z);
      if (side < 0) side += TAU;
      // where the piece leaves the plate for the can: down in the torch; settled, to the far side; then up toward
      // the contact's own side as the slider comes to the can's end
      const coming = smooth((B.x - (L / 2 - 0.5)) / 0.5);
      const from = DOWN + (FAR - DOWN) * settle + (Math.min(side + NEAR, FAR) - FAR) * settle * coming;
      const gone = smooth((B.x - RIM) / FREES);
      if (gone < 1) {
        const way = [A.clone()];
        // (along the axis, round it, from the axis): the can's unrolled surface. Under the slider the piece is at
        // the contact's own height
        const flat = (px: number, a: number, r: number): Vector3 => new Vector3(px, a * R, r);
        const high = Math.max(Math.hypot(B.y, B.z), R);
        // in the torch: back under the can to beside the slider, the band up the far side, back along the top into
        // the contact (a little ahead of it: the bit seen under the slider of the closed flashlight); settled: one
        // slant from the «+» end to the contact — the two corners drawn onto it, as a band of rubber would lie
        const band = B.x + LEAD * (1 - settle);
        const first = flat(A.x, from, R);
        const last = flat(B.x, side, high);
        const corner1 = flat(band, from, R).lerp(tmp.copy(first).lerp(last, 1 / 3), settle);
        const corner2 = flat(band, side, high).lerp(tmp.copy(first).lerp(last, 2 / 3), settle);
        // the drop from the plate along the «+» end's face and the bend onto the can, in the plane through the axis
        const foot = at(A.x, from, R);
        const drop = A.distanceTo(foot);
        const d0 = Math.min(BEND, 0.45 * Math.max(A.x - corner1.x, 0));
        first.lerp(corner1, d0 / Math.max(first.distanceTo(corner1), 1e-6));
        bend(
          way,
          foot.clone().lerp(A, Math.min(BEND, 0.48 * drop) / Math.max(drop, 1e-6)),
          foot,
          at(first.x, first.y / R, first.z),
          5,
        );
        const rolled = G.roundPath([first, corner1, corner2, last], BEND, 5);
        for (let i = 1; i < rolled.length; i++) {
          const p = rolled[i - 1]!;
          const q = rolled[i]!;
          const pieces = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 0.03));
          for (let k = 1; k <= pieces; k++) {
            tmp.copy(p).lerp(q, k / pieces);
            way.push(at(tmp.x, tmp.y / R, tmp.z));
          }
        }
        way.push(B.clone());
        resample(way, n, pts);
      }
      if (gone > 0) free(n, from);
      for (let i = 0; i < n; i++) {
        const p = out[i]!;
        if (gone >= 1) p.copy(loose[i]!);
        else if (gone <= 0) p.copy(pts[i]!);
        else p.copy(pts[i]!).lerp(loose[i]!, gone);
        p.applyQuaternion(battery.quaternion).add(battery.position);
      }
      // flat side toward the «+» end at the plate (as in the torch), carried along; it is a wire when it is free
      return normal.set(1, 0, 0).applyQuaternion(battery.quaternion);
    },
  };
}
