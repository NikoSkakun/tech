/**
 * Moving things along paths on the engine clock: a sampler that turns a polyline into "position + heading at
 * distance s", looped or ping-pong. Used by vehicles, trains, people and boats; chapters can use it for their
 * own movers. Everything derives from the `t` passed to `update`, so it is deterministic and seekable.
 */
import { Vector3, type Object3D } from 'three';
import { pathAt, pathLength } from '../core/geo';

export interface PathSampler {
  readonly length: number;
  /** Position and unit tangent at distance `s` (wrapped / reflected according to the mode). Returns travel direction sign. */
  at(s: number, position: Vector3, tangent: Vector3): 1 | -1;
}

/** `loop`: the path is a closed circuit (first point = last point); `pingpong`: there and back again. */
export function samplePath(points: readonly Vector3[], mode: 'loop' | 'pingpong' = 'loop'): PathSampler {
  const length = pathLength(points);
  return {
    length,
    at(s, position, tangent) {
      let d = ((s % (mode === 'loop' ? length : 2 * length)) + (mode === 'loop' ? length : 2 * length)) % (mode === 'loop' ? length : 2 * length);
      let dir: 1 | -1 = 1;
      if (mode === 'pingpong' && d > length) {
        d = 2 * length - d;
        dir = -1;
      }
      pathAt(points, d, position, tangent);
      if (dir < 0) tangent.negate();
      return dir;
    },
  };
}

const P = new Vector3();
const T = new Vector3();

/**
 * Place `object` on the path at distance `s`, facing along it (the model's forward axis is +Z; set `forwardX`
 * for models built facing +X). Pitch follows the slope.
 */
export function placeOnPath(object: Object3D, path: PathSampler, s: number, o: { forwardX?: boolean; lift?: number } = {}): void {
  path.at(s, P, T);
  object.position.set(P.x, P.y + (o.lift ?? 0), P.z);
  object.rotation.order = 'YXZ';
  object.rotation.y = Math.atan2(T.x, T.z) - (o.forwardX ? Math.PI / 2 : 0);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, T.y)));
  if (o.forwardX) object.rotation.set(0, object.rotation.y, -pitch);
  else object.rotation.set(pitch, object.rotation.y, 0);
}

/** A circle as a closed path (boats on a lake, birds, a car on a ring road). */
export function circlePath(cx: number, y: number, cz: number, r: number, segments = 48): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
  }
  return pts;
}
