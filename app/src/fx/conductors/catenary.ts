/**
 * Catenary — the true shape of a hanging wire: y = a·cosh(x / a). Pure math, unit-tested.
 *
 * For supports at the same height, span L (horizontal) and sag s (drop at mid-span):
 *   s = a·(cosh(L / 2a) − 1)            → solved for the parameter a by Newton iteration
 *   wire length  S = 2a·sinh(L / 2a)
 * Supports at different heights use the same curve shifted so that it passes through both points.
 */
import { Vector3 } from 'three';

/** Catenary parameter a (m) for a level span `span` with mid-span sag `sag`. */
export function catenaryParameter(span: number, sag: number): number {
  if (sag <= 1e-9 || span <= 1e-9) return Infinity;
  // parabola approximation a ≈ L² / 8s is an excellent starting point
  let a = (span * span) / (8 * sag);
  for (let i = 0; i < 24; i++) {
    const x = span / (2 * a);
    const f = a * (Math.cosh(x) - 1) - sag;
    const df = Math.cosh(x) - 1 - x * Math.sinh(x);
    const next = a - f / df;
    if (!Number.isFinite(next) || next <= 0) break;
    if (Math.abs(next - a) < 1e-10 * a) {
      a = next;
      break;
    }
    a = next;
  }
  return a;
}

/** Length of wire in a level span. */
export function catenaryLength(span: number, sag: number): number {
  const a = catenaryParameter(span, sag);
  return Number.isFinite(a) ? 2 * a * Math.sinh(span / (2 * a)) : span;
}

/**
 * Points of a wire hanging between `from` and `to` (any heights). `sag` is the drop below the straight
 * chord at mid-span, in the same units. Returns `segments + 1` points.
 */
export function catenaryPoints(from: Vector3, to: Vector3, sag: number, segments = 24): Vector3[] {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const span = Math.hypot(dx, dz);
  const h = to.y - from.y;
  const out: Vector3[] = [];
  const a = catenaryParameter(span, sag);
  if (!Number.isFinite(a) || span < 1e-9) {
    for (let i = 0; i <= segments; i++) out.push(from.clone().lerp(to, i / segments));
    return out;
  }
  // inclined span: lowest point x0 from  h = a·(cosh((L − x0)/a) − cosh(x0/a))
  //   ⇒ x0 = L/2 − a·asinh( h / (2a·sinh(L / 2a)) )
  const x0 = span / 2 - a * Math.asinh(h / (2 * a * Math.sinh(span / (2 * a))));
  const y0 = from.y - a * Math.cosh(-x0 / a);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * span;
    out.push(new Vector3(from.x + dx * t, y0 + a * Math.cosh((x - x0) / a), from.z + dz * t));
  }
  // remove the rounding error at the far end so chained spans meet exactly
  out[segments]!.copy(to);
  return out;
}
