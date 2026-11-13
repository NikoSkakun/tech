/**
 * Where to pin the «вузлова поверхня» hotspot of step `models`: a point that lies exactly on a nodal surface
 * of the orbital on screen, found numerically from the sim's wave function (`orbitalPsi`) — the chapter does
 * not re-derive the node positions.
 *
 * The scene shows the cloud with the sim's z axis up, so the picture plane is the sim's x–z plane (y = 0).
 * In that plane we walk an arc around the nucleus and take the place where ψ changes sign (an angular node:
 * a plane or a cone). If ψ keeps its sign on the arc (s orbitals) we walk outward along a ray instead and take
 * the outermost sign change (a radial node: a sphere). If ψ is zero on the whole arc, the picture plane itself
 * is a nodal plane (p_y, d_xy) and any point of it will do.
 */
import { orbitalPsi, orbitalQuantumNumbers, type OrbitalId } from '@electricity/sim/atom';

/** A point of the picture plane, in Bohr radii: `x` to the right, `up` along the sim's z axis. */
export interface NodalPoint {
  x: number;
  up: number;
  /** What kind of surface it lies on (for the marker drawn in the scene). */
  kind: 'sphere' | 'surface' | 'picture-plane';
  /** Radius of the nodal sphere, a₀ (`kind === 'sphere'`). */
  radius?: number;
}

/** Radius of the search arc per shell, a₀: inside the bulk of the cloud, away from the nucleus. */
const ARC_RADIUS = [0, 0, 3, 7] as const;
const RAY_ANGLE = Math.PI / 4;
/** Range of the search arc, radians from the +x axis. */
const ARC = [-1.4, 1.7] as const;
const STEPS = 240;

/** Root of f on [a, b] by bisection; f(a) and f(b) must differ in sign. */
function bisect(f: (s: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 48; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** Sign changes of f sampled on [a, b], refined; in order of s. */
function signChanges(f: (s: number) => number, a: number, b: number): number[] {
  const roots: number[] = [];
  let s0 = a;
  let f0 = f(a);
  for (let i = 1; i <= STEPS; i++) {
    const s1 = a + ((b - a) * i) / STEPS;
    const f1 = f(s1);
    if (f0 * f1 < 0) roots.push(bisect(f, s0, s1));
    s0 = s1;
    f0 = f1;
  }
  return roots;
}

/** A point on a nodal surface of the orbital, or null when it has none (1s). */
export function nodalPoint(id: OrbitalId): NodalPoint | null {
  const { n, l } = orbitalQuantumNumbers(id);
  if (n === 1) return null;
  const radius = ARC_RADIUS[n]!;
  if (l > 0) {
    // angular node: walk the right-hand side of a circle around the nucleus (−80° … +97° from the x axis),
    // which crosses the plane z = 0, the plane x = 0 and the cones of d_z²
    const onArc = (a: number): number => orbitalPsi(id, radius * Math.cos(a), 0, radius * Math.sin(a));
    let peak = 0;
    for (let i = 0; i <= STEPS; i++)
      peak = Math.max(peak, Math.abs(onArc(ARC[0] + (i / STEPS) * (ARC[1] - ARC[0]))));
    if (peak < 1e-9)
      return { x: radius * Math.cos(RAY_ANGLE), up: radius * Math.sin(RAY_ANGLE), kind: 'picture-plane' };
    // of several crossings take the one nearest the upper-right diagonal: clear of the dock and of the axes
    const angle = signChanges(onArc, ARC[0], ARC[1]).sort(
      (a, b) => Math.abs(a - RAY_ANGLE) - Math.abs(b - RAY_ANGLE),
    )[0];
    if (angle !== undefined)
      return { x: radius * Math.cos(angle), up: radius * Math.sin(angle), kind: 'surface' };
  }
  // radial node: outward along a ray, the outermost sign change
  const onRay = (r: number): number => orbitalPsi(id, r * Math.cos(RAY_ANGLE), 0, r * Math.sin(RAY_ANGLE));
  const r = signChanges(onRay, 0.2, 16).pop();
  return r === undefined
    ? null
    : { x: r * Math.cos(RAY_ANGLE), up: r * Math.sin(RAY_ANGLE), kind: 'sphere', radius: r };
}
