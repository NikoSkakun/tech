/**
 * Wires and cables: tube geometry whose U coordinate is in *world units* along the wire, so `K.energy`'s
 * `repeat` means "pulses per unit length" on every wire regardless of its length; catenary spans; bundles of
 * phase conductors with pulses in the phase colours, 120° apart.
 */
import { CatmullRomCurve3, type Curve, Group, Mesh, TubeGeometry, type Vector3 } from 'three';
import { K, SEMANTIC, type ColorLike, type KToonMaterial } from '@/style';
import { catenaryPoints } from './catenary';

export interface WireOptions {
  /** Tube radius, units. Default 0.03. */
  radius?: number;
  /** Body (insulation / metal) colour. Default `ink`. */
  color?: ColorLike;
  /** Pulse colour. Default `yellow` (current / energy flow). */
  pulseColor?: ColorLike;
  /** Pulses per unit length. Default 0.8. */
  repeat?: number;
  /** Pulse speed, units/s (sign = direction). Default 1.5. */
  speed?: number;
  /** 0…1+ brightness ∝ power. Default 1. */
  power?: number;
  /** Pulse tail length as a fraction of the spacing. Default 0.45. */
  length?: number;
  /** Peak emissive multiplier. Default 3.2. */
  intensity?: number;
  /** Shift of the pulse train along the wire, in pulse spacings (0…1) — phase conductors use 0, ⅓, ⅔. */
  phase?: number;
  /** Segments around the tube. Default 10. */
  radialSegments?: number;
  /** Segments per unit length along the tube. Default 6 (min 8 in total). */
  detail?: number;
  castShadow?: boolean;
}

/** A wire mesh with direct access to its energy material. */
export interface Wire extends Mesh<TubeGeometry, KToonMaterial> {
  /** Length of the wire in local units. */
  readonly wireLength: number;
}

/** Tube geometry along `curve` with `uv.x` = distance along the wire (+ `phase` offset in U units). */
export function wireGeometry(curve: Curve<Vector3>, o: WireOptions = {}, uOffset = 0): TubeGeometry {
  const length = curve.getLength();
  const tubular = Math.max(8, Math.ceil(length * (o.detail ?? 6)));
  const geometry = new TubeGeometry(curve, tubular, o.radius ?? 0.03, o.radialSegments ?? 10, false);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length + uOffset);
  return geometry;
}

/** A smooth curve through points (centripetal Catmull-Rom: no overshoot at sharp turns). */
export function curveThrough(points: readonly Vector3[], closed = false): CatmullRomCurve3 {
  return new CatmullRomCurve3([...points], closed, 'centripetal');
}

/**
 * A wire along a curve or through points, carrying `K.energy` pulses. Tween `wire.material.power` and
 * `.speed` (brightness ∝ power, STYLE_GUIDE §2.2); a negative speed reverses the flow.
 */
export function createWire(path: Curve<Vector3> | readonly Vector3[], o: WireOptions = {}): Wire {
  const curve = Array.isArray(path) ? curveThrough(path as readonly Vector3[]) : (path as Curve<Vector3>);
  const repeat = o.repeat ?? 0.8;
  const material = K.energy({
    color: o.color ?? 'ink',
    pulseColor: o.pulseColor ?? SEMANTIC.current,
    repeat,
    speed: (o.speed ?? 1.5) * repeat, // K.energy's speed is in U·repeat units: convert from units/s
    length: o.length ?? 0.45,
    intensity: o.intensity ?? 3.2,
    power: o.power ?? 1,
  });
  const mesh = new Mesh(wireGeometry(curve, o, (o.phase ?? 0) / repeat), material) as unknown as Wire;
  mesh.name = 'wire';
  mesh.castShadow = o.castShadow ?? true;
  mesh.receiveShadow = true;
  (mesh as { wireLength: number }).wireLength = curve.getLength();
  return mesh;
}

/** A wire hanging between two supports with a true catenary sag (units below the chord at mid-span). */
export function createSpan(from: Vector3, to: Vector3, sag: number, o: WireOptions = {}): Wire {
  return createWire(curveThrough(catenaryPoints(from, to, sag, 20)), { detail: 3, ...o });
}

export interface BundleOptions extends WireOptions {
  /** Pulse colours per conductor. Default: phases L1 / L2 / L3 (`yellow` / `green` / `red`). */
  colors?: readonly ColorLike[];
  /** Sag of every span, units. Default 0 (straight). */
  sag?: number;
}

export interface Bundle extends Group {
  readonly wires: Wire[];
  /** Set power (brightness) of all conductors. */
  setPower(power: number): void;
  /** Set pulse speed of all conductors, units/s. */
  setSpeed(speed: number): void;
}

/**
 * Multi-phase bundle: conductor `i` runs from `from[i]` to `to[i]`; pulses use the phase colours and are
 * shifted by 1/n of the spacing from conductor to conductor (three phases → 120° apart).
 */
export function createBundle(from: readonly Vector3[], to: readonly Vector3[], o: BundleOptions = {}): Bundle {
  const group = new Group() as Bundle;
  group.name = 'wire-bundle';
  const colors = o.colors ?? [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3];
  const n = Math.min(from.length, to.length);
  const repeat = o.repeat ?? 0.8;
  const wires = Array.from({ length: n }, (_, i) =>
    createSpan(from[i]!, to[i]!, o.sag ?? 0, { ...o, pulseColor: colors[i % colors.length], phase: i / n }),
  );
  group.add(...wires);
  (group as { wires: Wire[] }).wires = wires;
  group.setPower = (power) => wires.forEach((w) => (w.material.power = power));
  group.setSpeed = (speed) => wires.forEach((w) => (w.material.speed = speed * repeat));
  return group;
}
