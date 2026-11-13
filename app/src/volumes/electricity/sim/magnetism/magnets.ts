/**
 * `magnetism` «Модель симуляції» М1 (step `magnet-field`, compass carpet of all steps): a bar magnet of length l
 * is two Gilbert "magnetic charges" ±q_m = ±m/l at its poles; B = (μ₀/4π)·Σ q_m(r − r_i)/|r − r_i|³; scene magnet
 * m = 2 A·m², l = 0,1 m. Earth B_E = (0, 20 μT) in the table plane (north = +Y). Compasses follow the horizontal
 * projection of B_total with a critically damped turn (τ = 0,12 s). Field lines: 12–16 seeds around each N pole,
 * RK4 step 2 mm, ≤ 400 steps, stop at an S pole or the table edge (radius 0,4 m). Pole-pair forces
 * F = (μ₀/4π)·q₁q₂/r², total limited to 5 N. Cutting a magnet → two magnets m/2, l/2 (same q_m).
 * Table plane: x east, y north (2D, z = 0).
 */
import { MU_0_H_PER_M } from '../core/S1-sim/constants';
import { poleField, traceStreamline, vec3, type MagneticPole, type Streamline, type Vec3 } from '../core/S1-sim/field';
import { criticalFollowerParams, createFollower, type Follower } from '../core/S1-sim/oscillator';

export const MAGNETS = {
  momentAm2: 2,
  lengthM: 0.1,
  earthT: 20e-6,
  compassTauS: 0.12,
  seedsPerPole: 14,
  seedRadiusM: 0.006,
  lineStepM: 0.002,
  lineMaxSteps: 400,
  tableRadiusM: 0.4,
  sinkRadiusM: 0.005,
  maxForceN: 5,
  /** Released closer than this, magnets snap together or bounce apart (animation). */
  snapDistanceM: 0.08,
} as const;

export interface BarMagnet {
  /** Centre on the table, m. */
  x: number;
  y: number;
  /** Direction of the S→N axis, rad from +x. */
  angleRad: number;
  momentAm2: number;
  lengthM: number;
}

export const barMagnet = (x: number, y: number, angleRad: number, momentAm2: number = MAGNETS.momentAm2, lengthM: number = MAGNETS.lengthM): BarMagnet => ({ x, y, angleRad, momentAm2, lengthM });

/** N and S poles of a magnet (q_m = m/l, A·m). */
export function magnetPoles(m: BarMagnet): [MagneticPole, MagneticPole] {
  const q = m.momentAm2 / m.lengthM;
  const dx = (Math.cos(m.angleRad) * m.lengthM) / 2;
  const dy = (Math.sin(m.angleRad) * m.lengthM) / 2;
  return [
    { position: vec3(m.x + dx, m.y + dy), strengthAm: q },
    { position: vec3(m.x - dx, m.y - dy), strengthAm: -q },
  ];
}

/** «Розрізати магніт»: two halves, each m/2 and l/2, placed end to end with a gap. */
export function cutMagnet(m: BarMagnet, gapM = 0.01): [BarMagnet, BarMagnet] {
  const off = m.lengthM / 4 + gapM / 2;
  const cx = Math.cos(m.angleRad) * off;
  const cy = Math.sin(m.angleRad) * off;
  return [barMagnet(m.x + cx, m.y + cy, m.angleRad, m.momentAm2 / 2, m.lengthM / 2), barMagnet(m.x - cx, m.y - cy, m.angleRad, m.momentAm2 / 2, m.lengthM / 2)];
}

/** «Перевернути»: rotate by 180°. */
export const flipMagnet = (m: BarMagnet): BarMagnet => ({ ...m, angleRad: m.angleRad + Math.PI });

/** Total horizontal field at (x, y), T (magnets + optional Earth field). */
export function magnetField(magnets: readonly BarMagnet[], x: number, y: number, includeEarth = true): Vec3 {
  const b = poleField(magnets.flatMap(magnetPoles), vec3(x, y));
  if (includeEarth) b.y += MAGNETS.earthT;
  return b;
}

/** Compass heading target: angle of B from +x, rad. */
export const compassAngleRad = (b: Vec3): number => Math.atan2(b.y, b.x);

/** A compass needle (critically damped, τ = 0,12 s, shortest-way rotation). */
export const createCompass = (initialRad = Math.PI / 2): Follower => createFollower(criticalFollowerParams(MAGNETS.compassTauS, true), initialRad);

/** Field lines from every N pole (Earth field excluded — lines of the magnets only). */
export function traceMagnetLines(magnets: readonly BarMagnet[], seedsPerPole: number = MAGNETS.seedsPerPole): Streamline[] {
  const poles = magnets.flatMap(magnetPoles);
  const field = (p: Vec3): Vec3 => poleField(poles, p);
  const sPoles = poles.filter((p) => p.strengthAm < 0);
  const lines: Streamline[] = [];
  for (const n of poles.filter((p) => p.strengthAm > 0)) {
    for (let k = 0; k < seedsPerPole; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / seedsPerPole;
      const seed = vec3(n.position.x + MAGNETS.seedRadiusM * Math.cos(a), n.position.y + MAGNETS.seedRadiusM * Math.sin(a));
      lines.push(
        traceStreamline(field, seed, {
          stepM: MAGNETS.lineStepM,
          maxSteps: MAGNETS.lineMaxSteps,
          stop: (p) => {
            if (sPoles.some((s) => Math.hypot(p.x - s.position.x, p.y - s.position.y) < MAGNETS.sinkRadiusM)) return 'sink';
            return Math.hypot(p.x, p.y) > MAGNETS.tableRadiusM ? 'boundary' : null;
          },
        }),
      );
    }
  }
  return lines;
}

/** Net force on magnet `b` from magnet `a` (pole pairs, Coulomb-like), N; magnitude limited to 5 N. */
export function magnetForce(a: BarMagnet, b: BarMagnet): Vec3 {
  const k = MU_0_H_PER_M / (4 * Math.PI);
  let fx = 0;
  let fy = 0;
  for (const pa of magnetPoles(a)) {
    for (const pb of magnetPoles(b)) {
      const dx = pb.position.x - pa.position.x;
      const dy = pb.position.y - pa.position.y;
      const r2 = Math.max(dx * dx + dy * dy, 1e-6);
      const f = (k * pa.strengthAm * pb.strengthAm) / r2;
      const r = Math.sqrt(r2);
      fx += (f * dx) / r;
      fy += (f * dy) / r;
    }
  }
  const mag = Math.hypot(fx, fy);
  const s = mag > MAGNETS.maxForceN ? MAGNETS.maxForceN / mag : 1;
  return vec3(fx * s, fy * s);
}

