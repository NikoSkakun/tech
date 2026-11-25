/**
 * A camera rail between two shots for a scrubbed depth (as `water/prologue/dive`): the target slides, the distance
 * to it changes evenly on a logarithmic scale (a zoom that feels the same at every depth), the direction turns.
 * Feed `camera.go(railShot(a, b, k), { instant: true })` every frame while the slider moves.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';

const v = (a: readonly number[] | undefined): Vector3 => new Vector3(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0);

export function railShot(a: Shot, b: Shot, k: number): Shot {
  const ta = v(a.target as readonly number[]);
  const tb = v(b.target as readonly number[]);
  const da = v(a.position as readonly number[]).sub(ta);
  const db = v(b.position as readonly number[]).sub(tb);
  const dist = Math.exp(Math.log(da.length()) * (1 - k) + Math.log(db.length()) * k);
  const dir = da.normalize().lerp(db.normalize(), k).normalize();
  const t = ta.lerp(tb, k);
  const p = t.clone().addScaledVector(dir, dist);
  return {
    position: [p.x, p.y, p.z],
    target: [t.x, t.y, t.z],
    fov: a.fov ?? 27,
    fit: { center: [t.x, t.y, t.z], radius: dist * 0.3 },
    drift: 0,
    near: Math.min(a.near ?? dist * 0.02, b.near ?? dist * 0.02, dist * 0.02),
    far: Math.max(a.far ?? 2, b.far ?? 2),
  };
}
