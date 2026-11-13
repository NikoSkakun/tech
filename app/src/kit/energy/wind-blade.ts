/**
 * Wind-turbine blade as a lofted solid: circular root → widest chord at ~20 % of the span → slender tip, with a
 * real aerofoil section (NACA 4-digit thickness law) and aerodynamic twist (steep at the root, flat at the
 * tip). Span along +Y starting at `rootRadius`, chord along X (leading edge toward +X), thickness along Z;
 * the pitch axis is the Y axis, at 30 % of the chord.
 */
import { Vector3, type BufferGeometry } from 'three';
import { loft } from '../core/geo';
import { smoothstep } from '../core/noise';

export interface BladeOptions {
  /** Distance of the tip from the rotor axis. */
  tipRadius: number;
  /** Distance of the blade root flange from the rotor axis. */
  rootRadius: number;
  /** Multiplies chord and thickness (toy proportions; 1 = slender real blade). Default 1.5. */
  chunk?: number;
  /** Twist at the root in radians (0 at the tip). Default 14°. */
  twist?: number;
  sections?: number;
}

/** Half-thickness of a NACA 00xx section at chord fraction x (0 = leading edge), for unit chord and thickness t. */
const nacaThickness = (x: number, t: number): number =>
  5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);

/** Chord at span fraction s (0 = root flange, 1 = tip) for a blade of tip radius R. */
export function bladeChord(s: number, R: number, chunk = 1.5): number {
  const max = 0.082 * R * chunk;
  const root = 0.042 * R * chunk;
  const tip = 0.018 * R * chunk;
  return s < 0.2 ? root + (max - root) * smoothstep(0, 0.2, s) : max + (tip - max) * Math.pow((s - 0.2) / 0.8, 0.9);
}

/** Lofted blade geometry (≈ 700 triangles). */
export function bladeGeometry(o: BladeOptions): BufferGeometry {
  const n = o.sections ?? 22;
  const m = 14;
  const chunk = o.chunk ?? 1.5;
  const twist0 = o.twist ?? (14 * Math.PI) / 180;
  const rootDia = 0.042 * o.tipRadius * chunk;
  const rings: Vector3[][] = [];
  for (let i = 0; i <= n; i++) {
    // sections bunch up toward the root (where the shape changes fastest) and the tip
    const s = i / n;
    const span = s < 0.985 ? s : 0.985 + (s - 0.985) * 0.6;
    const y = o.rootRadius + span * (o.tipRadius - o.rootRadius);
    const chord = bladeChord(span, o.tipRadius, chunk) * (i === n ? 0.35 : 1);
    const blend = smoothstep(0.02, 0.2, span); // 0 = cylinder, 1 = aerofoil
    const thickness = 0.42 - 0.24 * smoothstep(0.1, 0.6, span);
    const twist = twist0 * Math.pow(1 - span, 1.6);
    const cos = Math.cos(twist);
    const sin = Math.sin(twist);
    const ring: Vector3[] = [];
    for (let k = 0; k < m; k++) {
      const u = k / m;
      const upper = u <= 0.5;
      // cosine spacing along the chord: more points at the leading and trailing edges
      const xc = 0.5 * (1 - Math.cos(Math.PI * (upper ? 1 - 2 * u : 2 * u - 1)));
      const zt = nacaThickness(xc, thickness) * (upper ? 1 : -1);
      const ax = (0.3 - xc) * chord;
      const az = zt * chord;
      const phi = upper ? Math.PI * (1 - 2 * u) : -Math.PI * (2 * u - 1);
      const cx = (Math.cos(phi) * rootDia) / 2;
      const cz = (Math.sin(phi) * rootDia) / 2;
      const x = cx + (ax - cx) * blend;
      const z = cz + (az - cz) * blend;
      ring.push(new Vector3(x * cos + z * sin, y, -x * sin + z * cos));
    }
    rings.push(ring);
  }
  return loft(rings, true);
}
