/**
 * The plus strip's way UNDER the battery (owner 2026-11-19: «може пустити цю частину дроту знизу, під
 * батарейкою?»): from the contact plate on the «+» nub down in front of the «+» end, back along the housing's
 * bottom under the can, up its far side beside the slider as a band (out of the reader's sight), onto the top and
 * into the slider's contact. Never over the «+» end: lifted with the slider, a strip that came over it read as
 * cutting the can.
 *
 * In the unfolding the slider rides forward along the battery's top (`unfold.ts`) and the band rides with it, so
 * the run under the can only gets shorter. At the can's front end the band stays; the slider goes on, out in front
 * of «+» and down to its block, and the strip follows it the way a tape comes off a reel: it always leaves the can
 * right beside the slider's contact, so as the slider comes down the band unwinds behind the «+» end — no loop
 * ever forms in the open — until all that is left is one soft hook from the plate to the slider (`hook`), which
 * draws straight as both come down on their terminals. On the way the strip rounds into a wire (`round`).
 *
 * On the can the way is runs along the axis and circles round it only: on those the strip's flat side, carried
 * along, stays toward the can. Its bends are rounded on the can's unrolled surface and rolled back on. All of it in
 * the battery's own frame; a pure function of its inputs.
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
const onCan = (round: number): number => BATTERY.radius + 0.0135 + THIN + (WIRE.core - THIN) * round;
/** The band rides this far ahead of the slider's contact (the strip turns back into the contact from the front). */
const LEAD = 0.12;
/** … but no farther forward than this (from the battery's centre): the whole band stays on the can. */
const BAND = L / 2 - 0.08;
/** Past this the strip is off the can's front end, free. */
const RIM = L / 2 + 0.03;
/** The band has unwound once the slider's contact is this far past the can's end. */
const UNWOUND = 0.62;
/** Radius of the strip's bends on the can. */
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

export interface PlusWay {
  /**
   * Lay the piece (`out`: its two ends already on the parts; the slider stands as the battery does). `round` 0…1:
   * strip … wire (it needs more room on the can). Returns the normal of its flat side at its start.
   */
  apply(out: Vector3[], battery: Object3D, round: number): Vector3;
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
   * The piece free of the can, hanging from the plate (`A`) to the slider's contact (`B`) in the upright plane
   * through both: while the contact is still near the plate it leaves the plate downward, as it lay on the «+» end,
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
    apply(out, battery, round) {
      const n = out.length;
      inv.copy(battery.quaternion).invert();
      toLocal(out[0]!, battery, A);
      toLocal(out[n - 1]!, battery, B);
      const R = onCan(round);
      // where round the axis the slider's contact is: on the top at first, down the far side as the slider steps
      // down in front of «+» — the strip leaves the can there, so the band (bottom → far side → there) unwinds
      let side = Math.atan2(B.y, B.z);
      if (side < 0) side += TAU;
      // (… and sooner than that once the contact is off the can's end: the strip never leaves the can higher
      // than the contact is, and by `UNWOUND` beyond the end the band has gone round behind the «+» end to the
      // bottom — the wire comes to the slider from under the battery, not over it)
      const off = smooth((B.x - RIM) / 0.08);
      const level = Math.PI - Math.asin(Math.min(Math.max((B.y + 0.012) / R, -1), 1));
      const drawn = side + (DOWN - side) * smooth((B.x - RIM) / UNWOUND);
      // (the greater of the two, without a corner where one overtakes the other)
      const lower = 0.5 * (level + drawn + Math.hypot(level - drawn, 12 * DEG));
      const end = Math.min(side + Math.max(lower - side, 0) * off, DOWN);
      // the band: beside the slider (a little ahead of its contact), at the can's front end once the slider is
      // past it; as it gets short it slips forward under the «+» end to the foot of the drop from the plate
      const slip = smooth((end - 160 * DEG) / (100 * DEG));
      let x = Math.min(B.x + LEAD, BAND);
      x += (A.x - x) * slip;
      const way = [A.clone()];
      // the drop from the plate and the bend under the can, in the plane through the axis
      const foot = at(A.x, DOWN, R);
      const drop = A.distanceTo(foot);
      const d0 = Math.min(BEND, 0.45 * Math.max(A.x - x, 0));
      bend(
        way,
        foot.clone().lerp(A, Math.min(BEND, 0.48 * drop) / Math.max(drop, 1e-6)),
        foot,
        at(A.x - d0, DOWN, R),
        5,
      );
      // on the can: (along the axis, round it, from the axis) — the unrolled surface. Under the slider the strip is
      // at the contact's own height; off the top it lies on the can
      const top = Math.max(Math.hypot(B.y, B.z), R);
      const high = R + (top - R) * (1 - off);
      const flat = (px: number, a: number, r: number): Vector3 => new Vector3(px, a * R, r);
      const mid = DOWN + (end - DOWN) * 0.6;
      const free = B.x > RIM;
      const rolled = G.roundPath(
        [
          flat(A.x - d0, DOWN, R),
          flat(x, DOWN, R),
          flat(x, mid, R),
          flat(x, end, high),
          flat(free ? Math.max(RIM, x) : B.x, end, high),
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
          way.push(at(tmp.x, tmp.y / R, tmp.z));
        }
      }
      // off the can's end: on, straight ahead at first, and in one soft bend to the contact
      if (free) {
        const from = way[way.length - 1]!;
        const ahead = Math.min(0.5 * (B.x - from.x), 0.3);
        bend(way, from, from.clone().setX(from.x + ahead), B, 10);
      }
      resample(way, n, pts);
      // the band has unwound: what is left opens into the hook
      const open = smooth((end - 212 * DEG) / (56 * DEG));
      const ahead = open > 0 ? hook(n) : 0;
      for (let i = 0; i < n; i++)
        out[i]!.copy(pts[i]!)
          .lerp(hung[i] ?? pts[i]!, open)
          .applyQuaternion(battery.quaternion)
          .add(battery.position);
      // flat side toward the «+» end at the plate (as in the torch), carried round the can; the hook's flat side
      // turns up as it leaves the plate forward
      return normal
        .set(1, 0, 0)
        .lerp(tmp.set(0, 1, 0), open * ahead)
        .normalize()
        .applyQuaternion(battery.quaternion);
    },
  };
}
