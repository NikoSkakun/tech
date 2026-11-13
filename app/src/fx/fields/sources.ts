/**
 * Ready-made vector and scalar fields (pure math, unit-tested; no WebGL). Units are free: the constants
 * (k = 1/4πε₀, μ₀/4π) are folded into the source strengths, because the visualisations only use direction
 * and relative magnitude.
 */
import { Vector3 } from 'three';

/** A vector field: writes the field at `p` into `out` and returns it. */
export type VectorField = (p: Vector3, out: Vector3) => Vector3;
/** A scalar field (potential). */
export type ScalarField = (p: Vector3) => number;

export interface PointCharge {
  position: Vector3;
  /** Charge (sign matters; magnitude in arbitrary units). */
  q: number;
}

const _d = new Vector3();
const _t = new Vector3();
const EPS = 1e-4;

/** Electric field of point charges: E = Σ q·r̂ / r². */
export function pointChargesField(charges: readonly PointCharge[]): VectorField {
  return (p, out) => {
    out.set(0, 0, 0);
    for (const c of charges) {
      _d.subVectors(p, c.position);
      const r2 = Math.max(_d.lengthSq(), EPS);
      out.addScaledVector(_d, c.q / (r2 * Math.sqrt(r2)));
    }
    return out;
  };
}

/** Potential of point charges: φ = Σ q / r. */
export function pointChargesPotential(charges: readonly PointCharge[], softening = 0.05): ScalarField {
  return (p) => {
    let phi = 0;
    for (const c of charges) phi += c.q / Math.max(p.distanceTo(c.position), softening);
    return phi;
  };
}

/**
 * Bar magnet as two magnetic poles (N = +, S = −) a distance apart — outside the magnet this is the dipole
 * field, with lines leaving N and entering S.
 */
export function barMagnetField(north: Vector3, south: Vector3, strength = 1): VectorField {
  return pointChargesField([
    { position: north, q: strength },
    { position: south, q: -strength },
  ]);
}

/** Ideal magnetic dipole m at `position`: B = (3(m·r̂)r̂ − m) / r³. */
export function dipoleField(position: Vector3, moment: Vector3): VectorField {
  return (p, out) => {
    _d.subVectors(p, position);
    const r = Math.max(_d.length(), 0.01);
    _d.divideScalar(r);
    return out
      .copy(_d)
      .multiplyScalar(3 * moment.dot(_d))
      .sub(moment)
      .divideScalar(r * r * r);
  };
}

/** Infinite straight wire through `point` along `direction` with current I: B = I·(d̂ × r) / r² (∝ 1/r). */
export function straightWireField(point: Vector3, direction: Vector3, current = 1): VectorField {
  const dir = direction.clone().normalize();
  return (p, out) => {
    _d.subVectors(p, point);
    _d.addScaledVector(dir, -_d.dot(dir)); // radial vector from the wire
    const r2 = Math.max(_d.lengthSq(), EPS);
    return out.crossVectors(dir, _d).multiplyScalar(current / r2);
  };
}

/** Circular current loop (Biot–Savart, summed over `segments` straight pieces): dB = I·dl × r / r³. */
export function currentLoopField(center: Vector3, normal: Vector3, radius: number, current = 1, segments = 32): VectorField {
  const n = normal.clone().normalize();
  const u = new Vector3(Math.abs(n.y) < 0.99 ? 0 : 1, Math.abs(n.y) < 0.99 ? 1 : 0, 0).cross(n).normalize();
  const v = new Vector3().crossVectors(n, u);
  const pts: Vector3[] = [];
  const dls: Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = ((i + 0.5) / segments) * Math.PI * 2;
    pts.push(center.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(v, Math.sin(a) * radius));
    const len = (2 * Math.PI * radius) / segments;
    dls.push(u.clone().multiplyScalar(-Math.sin(a) * len).addScaledVector(v, Math.cos(a) * len));
  }
  return (p, out) => {
    out.set(0, 0, 0);
    for (let i = 0; i < segments; i++) {
      _d.subVectors(p, pts[i]!);
      const r2 = Math.max(_d.lengthSq(), EPS);
      out.addScaledVector(_t.crossVectors(dls[i]!, _d), current / (r2 * Math.sqrt(r2)));
    }
    return out;
  };
}

/** Solenoid as a stack of `loops` current loops along `axis` (a few loops reproduce the field shape). */
export function solenoidField(center: Vector3, axis: Vector3, radius: number, length: number, current = 1, loops = 9): VectorField {
  const a = axis.clone().normalize();
  const parts = Array.from({ length: loops }, (_, i) =>
    currentLoopField(center.clone().addScaledVector(a, ((i + 0.5) / loops - 0.5) * length), a, radius, current / loops, 20),
  );
  return superpose(...parts);
}

/** Uniform field. */
export function uniformField(value: Vector3): VectorField {
  return (_p, out) => out.copy(value);
}

/** Sum of fields. */
export function superpose(...fields: VectorField[]): VectorField {
  const tmp = new Vector3();
  return (p, out) => {
    out.set(0, 0, 0);
    for (const f of fields) {
      f(p, tmp);
      out.add(tmp);
    }
    return out;
  };
}
