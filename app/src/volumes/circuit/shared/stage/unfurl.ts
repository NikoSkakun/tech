/**
 * How a wire gets from its shape in the flashlight to its shape on the stand (owner 2026-11-19: «щоб він зробив
 * анімацію провода гарно … головне, щоб це було естетично гарно заанімовано»): it UNROLLS, the way a springy metal
 * strip does when a careful hand lays it out. Every piece of it turns from the direction it has in the torch to the
 * direction it has on the stand and grows to its length there, and the wire is laid piece after piece from its
 * start. So nothing in it ever shrinks, folds or kinks: a straight strip opens into the stand's rounded corner as a
 * clock spring opens, each point of it travelling on one smooth arc.
 *
 * Why not a rope with weight: a hanging rope makes exactly what reads as computed here — a plumb riser under the
 * lamp and a tight bend where it meets the board. A strip of spring metal keeps wide arcs and leaves its contacts
 * in the direction they hold it; that is what this draws. It is a pure function of its inputs (the dev scrub and
 * «Назад» show any moment directly), and one pass over the points per frame.
 */
import { Vector3, type Quaternion } from 'three';

export interface Unfurl {
  /** Points of the wire. */
  readonly n: number;
  /**
   * Lay the wire from `start`: `w` 0 = its shape in the torch (turned by `torch`, the flashlight's frame now) …
   * 1 = its shape on the stand. `out` gets `n` points. `normal` (optional) gets the normal of the strip's flat
   * side at its start: the one it has in the torch (`flat`), carried through the turns of its first piece.
   */
  lay(start: Vector3, torch: Quaternion, w: number, out: Vector3[], normal?: Vector3): void;
}

const d = new Vector3();
const k = new Vector3();
const Y = new Vector3(0, 1, 0);
/** The share of the unrolling over which the strip's bent tips straighten (`eased`). */
const EASED_BY = 0.1;

/** Axis (unit, square to `a`) and angle of the turn that takes the direction `a` to `b`. */
function turnOf(a: Vector3, b: Vector3, up: Vector3): { axis: Vector3; angle: number } {
  const axis = new Vector3().crossVectors(a, b);
  const s = axis.length();
  // (two pieces head-on against each other have no axis of their own: they turn in the board's plane)
  if (s < 1e-6) {
    axis.copy(up);
    axis.addScaledVector(a, -axis.dot(a)).normalize();
  } else axis.divideScalar(s);
  return { axis, angle: Math.atan2(s, a.dot(b)) };
}

/**
 * `from`: the wire in the torch's own frame; `to`: on the stand (board frame), the same number of points, both
 * even in length. `home`: the torch's frame once it hovers level over the board — the turn of every piece is
 * measured from there, so all of them turn the same way round. `eased` (optional, torch frame, as `from`): the
 * strip as it lies once nothing presses its tips onto their contacts — in the torch a strip's tip is bent sharply
 * onto the lamp; drawn out, such a bend would ride along as a claw at the end of a long wire, so it straightens
 * first, over the very beginning of the unrolling, and the wire unrolls from that. `flat` (optional, torch frame):
 * the normal of the strip's flat side at its start.
 */
export function createUnfurl(
  from: readonly Vector3[],
  to: readonly Vector3[],
  home: Quaternion,
  eased?: readonly Vector3[],
  flat?: Vector3,
): Unfurl {
  const n = from.length;
  const back = home.clone().invert();
  const up = Y.clone().applyQuaternion(back);
  // per piece: its direction and length in the torch, the turn that eases it, the turn from there onto the stand
  // (axes in the torch's frame, as the torch hovers), its growth
  const pieces: { dir: Vector3; ease: ReturnType<typeof turnOf>; turn: ReturnType<typeof turnOf> }[] = [];
  const len: number[] = [];
  const grow: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = from[i + 1]!.clone().sub(from[i]!);
    const b = to[i + 1]!.clone().sub(to[i]!).applyQuaternion(back);
    len.push(a.length());
    grow.push(b.length() - a.length());
    a.normalize();
    b.normalize();
    const mid = eased ? eased[i + 1]!.clone().sub(eased[i]!).normalize() : a;
    pieces.push({ dir: a, ease: turnOf(a, mid, up), turn: turnOf(mid, b, up) });
  }
  // all pieces turn the same way round: next to a piece that goes the long way (more than half a turn), its
  // neighbour must not take the short way the other way round — the wire would fold between them. From the far
  // end (where the turns are small) each piece takes, of its two ways, the one nearer its neighbour's
  // (a way = its axis scaled by its angle; the long way round is the opposite axis by the rest of the full turn)
  const short = new Vector3();
  const long = new Vector3();
  const near = new Vector3();
  for (let i = n - 3; i >= 0; i--) {
    const t = pieces[i]!.turn;
    const next = pieces[i + 1]!.turn;
    near.copy(next.axis).multiplyScalar(next.angle);
    short.copy(t.axis).multiplyScalar(t.angle);
    long.copy(t.axis).multiplyScalar(t.angle - Math.PI * 2);
    if (long.distanceToSquared(near) < short.distanceToSquared(near)) {
      t.axis.negate();
      t.angle = Math.PI * 2 - t.angle;
    }
  }
  /** Turn `v` by `angle` about the unit `axis` (Rodrigues' formula). */
  const turned = (v: Vector3, axis: Vector3, angle: number): Vector3 => {
    const c = Math.cos(angle);
    const along = axis.dot(v) * (1 - c);
    k.crossVectors(axis, v);
    return v.multiplyScalar(c).addScaledVector(k, Math.sin(angle)).addScaledVector(axis, along);
  };
  return {
    n,
    lay(start, torch, w, out, normal) {
      (out[0] ??= new Vector3()).copy(start);
      const x = Math.min(Math.max(w / EASED_BY, 0), 1);
      const e = x * x * (3 - 2 * x);
      for (let i = 0; i < n - 1; i++) {
        const p = pieces[i]!;
        d.copy(p.dir);
        if (p.ease.angle > 1e-6) turned(d, p.ease.axis, p.ease.angle * e);
        if (w > 0) turned(d, p.turn.axis, p.turn.angle * w);
        d.applyQuaternion(torch);
        if (i === 0 && normal && flat) {
          normal.copy(flat);
          if (p.ease.angle > 1e-6) turned(normal, p.ease.axis, p.ease.angle * e);
          if (w > 0) turned(normal, p.turn.axis, p.turn.angle * w);
          normal.applyQuaternion(torch);
        }
        (out[i + 1] ??= new Vector3()).copy(out[i]!).addScaledVector(d, len[i]! + grow[i]! * w);
      }
      out.length = n;
    },
  };
}

/**
 * Bring the wire's far end onto `end` (its x and z) without changing its shape: the whole of it turns about its
 * start and scales in the board's plane (a similarity), so every bend keeps its form — the miss is never pushed
 * into one stretch as a kink. The wire keeps every height it has (`liftEnd`).
 */
export function fitEndFlat(out: Vector3[], end: Vector3): void {
  const n = out.length;
  const o = out[0]!;
  const ax = out[n - 1]!.x - o.x;
  const az = out[n - 1]!.z - o.z;
  const bx = end.x - o.x;
  const bz = end.z - o.z;
  const aa = ax * ax + az * az;
  if (aa < 1e-10) return;
  // complex division b / a: the turn and the scale in one
  const re = (bx * ax + bz * az) / aa;
  const im = (bz * ax - bx * az) / aa;
  for (let i = 1; i < n; i++) {
    const x = out[i]!.x - o.x;
    const z = out[i]!.z - o.z;
    out[i]!.x = o.x + x * re - z * im;
    out[i]!.z = o.z + x * im + z * re;
  }
}

/**
 * Raise (or lower) the wire's far end by `dy`, the last `share` of it following in one soft sweep that leaves the
 * level stretch without a corner and arrives level — the way a wire comes up to a part held above the board.
 */
export function liftEnd(out: Vector3[], dy: number, share: number): void {
  const n = out.length;
  const first = Math.floor((n - 1) * (1 - share));
  for (let i = first + 1; i < n; i++) {
    const x = (i - first) / (n - 1 - first);
    out[i]!.y += dy * x * x * (3 - 2 * x);
  }
}
