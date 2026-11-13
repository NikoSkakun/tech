/**
 * `atom` «Модель симуляції» §2 (step `models`) — real hydrogen orbitals, ρ = |ψ|², r in units of a₀.
 * ψ = P(x,y,z)·g(r): the angular parts are written in Cartesian form (r·cosθ = z, r²(3cos²θ − 1) = 3z² − r²,
 * r²·sinθcosθcosφ = xz, r²·sin²θ·sin2φ = 2xy), p_x / p_y are the rotated p_z.
 * Sampling: rejection sampling in the cube [−R, R]³ with acceptance ρ/ρ_max (R = 6 for 1s, 15 for n = 2,
 * 25 for n = 3), seeded RNG → deterministic clouds for QA.
 */
import { argmax } from '../core/S1-sim/math';
import { toRandomSource, type RandomSource } from '../core/S1-sim/rng';

export type OrbitalId =
  | '1s'
  | '2s'
  | '2p_x'
  | '2p_y'
  | '2p_z'
  | '3s'
  | '3p_x'
  | '3p_y'
  | '3p_z'
  | '3d_z2'
  | '3d_xz'
  | '3d_xy';

export const ORBITAL_IDS: readonly OrbitalId[] = ['1s', '2s', '2p_x', '2p_y', '2p_z', '3s', '3p_x', '3p_y', '3p_z', '3d_z2', '3d_xz', '3d_xy'];

interface OrbitalDef {
  n: 1 | 2 | 3;
  l: 0 | 1 | 2;
  /** Radial polynomial × exponential, as a function of r (the r^l factor lives in `angular`). */
  radial: (r: number) => number;
  /** Homogeneous polynomial of degree l in x, y, z. */
  angular: (x: number, y: number, z: number) => number;
  /** max |angular| on the unit sphere. */
  angularMax: number;
}

const s = (): number => 1;
const DEFS: Record<OrbitalId, OrbitalDef> = {
  '1s': { n: 1, l: 0, radial: (r) => Math.exp(-r), angular: s, angularMax: 1 },
  '2s': { n: 2, l: 0, radial: (r) => (2 - r) * Math.exp(-r / 2), angular: s, angularMax: 1 },
  '2p_x': { n: 2, l: 1, radial: (r) => Math.exp(-r / 2), angular: (x) => x, angularMax: 1 },
  '2p_y': { n: 2, l: 1, radial: (r) => Math.exp(-r / 2), angular: (_x, y) => y, angularMax: 1 },
  '2p_z': { n: 2, l: 1, radial: (r) => Math.exp(-r / 2), angular: (_x, _y, z) => z, angularMax: 1 },
  '3s': { n: 3, l: 0, radial: (r) => (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3), angular: s, angularMax: 1 },
  '3p_x': { n: 3, l: 1, radial: (r) => (6 - r) * Math.exp(-r / 3), angular: (x) => x, angularMax: 1 },
  '3p_y': { n: 3, l: 1, radial: (r) => (6 - r) * Math.exp(-r / 3), angular: (_x, y) => y, angularMax: 1 },
  '3p_z': { n: 3, l: 1, radial: (r) => (6 - r) * Math.exp(-r / 3), angular: (_x, _y, z) => z, angularMax: 1 },
  '3d_z2': { n: 3, l: 2, radial: (r) => Math.exp(-r / 3), angular: (x, y, z) => 3 * z * z - (x * x + y * y + z * z), angularMax: 2 },
  '3d_xz': { n: 3, l: 2, radial: (r) => Math.exp(-r / 3), angular: (x, _y, z) => x * z, angularMax: 0.5 },
  '3d_xy': { n: 3, l: 2, radial: (r) => Math.exp(-r / 3), angular: (x, y) => 2 * x * y, angularMax: 1 },
};

export function orbitalQuantumNumbers(id: OrbitalId): { n: number; l: number } {
  return { n: DEFS[id].n, l: DEFS[id].l };
}

/** Half-size R of the sampling cube, a₀. */
export function samplingHalfSizeA0(id: OrbitalId): number {
  return DEFS[id].n === 1 ? 6 : DEFS[id].n === 2 ? 15 : 25;
}

/** Unnormalised ψ at (x, y, z) in a₀. */
export function orbitalPsi(id: OrbitalId, x: number, y: number, z: number): number {
  const d = DEFS[id];
  return d.angular(x, y, z) * d.radial(Math.hypot(x, y, z));
}

/** Unnormalised probability density |ψ|². */
export function orbitalDensity(id: OrbitalId, x: number, y: number, z: number): number {
  const p = orbitalPsi(id, x, y, z);
  return p * p;
}

const maxCache = new Map<OrbitalId, number>();
/**
 * ρ_max over the sampling cube = max_r [r^l·|radial(r)|]² × (angular max)², from a fine radial scan
 * (analytic separation, exact up to the 0,05 % scan step; a 1 % safety margin keeps acceptance ≤ 1).
 */
export function orbitalDensityMax(id: OrbitalId): number {
  const cached = maxCache.get(id);
  if (cached !== undefined) return cached;
  const d = DEFS[id];
  const rMax = samplingHalfSizeA0(id) * Math.sqrt(3);
  let best = 0;
  for (let i = 0; i <= 4000; i++) {
    const r = (rMax * i) / 4000;
    best = Math.max(best, Math.abs(Math.pow(r, d.l) * d.radial(r)));
  }
  const value = (best * d.angularMax) ** 2 * 1.01;
  maxCache.set(id, value);
  return value;
}

/** Draws one point (a₀) from |ψ|² by rejection sampling. */
export function sampleOrbitalPoint(id: OrbitalId, rng: RandomSource): [number, number, number] {
  const R = samplingHalfSizeA0(id);
  const max = orbitalDensityMax(id);
  for (;;) {
    const x = (2 * rng.next() - 1) * R;
    const y = (2 * rng.next() - 1) * R;
    const z = (2 * rng.next() - 1) * R;
    if (rng.next() * max < orbitalDensity(id, x, y, z)) return [x, y, z];
  }
}

/** `count` points as a flat xyz array (a₀), deterministic for a given seed. */
export function sampleOrbital(id: OrbitalId, count: number, rngOrSeed: RandomSource | number = 1): Float32Array {
  const rng = toRandomSource(rngOrSeed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) out.set(sampleOrbitalPoint(id, rng), i * 3);
  return out;
}

/** Most probable radius: argmax of r²·|R_nl(r)|² (1s → 1 a₀, 2p → 4 a₀, 3d → 9 a₀). */
export function mostProbableRadiusA0(id: OrbitalId): number {
  const d = DEFS[id];
  const radialProb = (r: number): number => (r * Math.pow(r, d.l) * d.radial(r)) ** 2;
  // s-orbitals with nodes have several maxima: scan, then refine around the global one.
  const rMax = samplingHalfSizeA0(id) * 1.5;
  let bestR = 0;
  let best = -1;
  for (let i = 1; i <= 3000; i++) {
    const r = (rMax * i) / 3000;
    const v = radialProb(r);
    if (v > best) {
      best = v;
      bestR = r;
    }
  }
  const h = rMax / 3000;
  return argmax(radialProb, Math.max(bestR - h, 0), bestR + h);
}

/** Bohr orbit radius r_n = n²·a₀. */
export const bohrRadiusA0 = (n: number): number => n * n;

/** Measurement slider range «Вимірювань» (log). */
export const ORBITAL_POINTS_RANGE = { min: 100, max: 20000, default: 3000 } as const;
/** Lifetime of a point in the cloud, s (alpha fades over 6 s, new points at N/6 per second). */
export const CLOUD_POINT_LIFETIME_S = 6;

export interface OrbitalCloud {
  /** xyz in a₀ for `capacity` points. */
  readonly positions: Float32Array;
  /** Age of each point, s (alpha = 1 − age/6). */
  readonly ages: Float32Array;
  /** Number of live points. */
  readonly count: () => number;
  step(dt: number): void;
  set(params: { orbital?: OrbitalId; targetCount?: number }): void;
}

/**
 * Animated cloud: holds ≈ N points; every point lives 6 s, replaced at N/6 points per second (§2). When the
 * orbital changes, the cloud is refilled progressively (old points expire naturally).
 */
export function createOrbitalCloud(options: { orbital: OrbitalId; targetCount: number; seed?: number }): OrbitalCloud {
  const rng = toRandomSource(options.seed ?? 7);
  const capacity = ORBITAL_POINTS_RANGE.max;
  const positions = new Float32Array(capacity * 3);
  const ages = new Float32Array(capacity).fill(Infinity);
  let orbital = options.orbital;
  let target = Math.min(Math.max(Math.round(options.targetCount), ORBITAL_POINTS_RANGE.min), capacity);
  let spawnDebt = 0;
  let cursor = 0;
  // Pre-fill with staggered ages so the cloud starts full and steady.
  for (let i = 0; i < target; i++) {
    positions.set(sampleOrbitalPoint(orbital, rng), i * 3);
    ages[i] = (CLOUD_POINT_LIFETIME_S * i) / target;
  }
  cursor = target % capacity;
  return {
    positions,
    ages,
    count: () => {
      let n = 0;
      for (let i = 0; i < capacity; i++) if (ages[i] < CLOUD_POINT_LIFETIME_S) n++;
      return n;
    },
    step(dt: number): void {
      for (let i = 0; i < capacity; i++) if (ages[i] !== Infinity) ages[i] += dt;
      spawnDebt += (target / CLOUD_POINT_LIFETIME_S) * Math.max(dt, 0);
      let spawn = Math.floor(spawnDebt);
      spawnDebt -= spawn;
      spawn = Math.min(spawn, capacity);
      for (let k = 0; k < spawn; k++) {
        // reuse the oldest slot (ring buffer over expired-or-oldest)
        let slot = cursor;
        for (let probe = 0; probe < capacity; probe++) {
          const j = (cursor + probe) % capacity;
          if (!(ages[j] < CLOUD_POINT_LIFETIME_S)) {
            slot = j;
            break;
          }
        }
        positions.set(sampleOrbitalPoint(orbital, rng), slot * 3);
        ages[slot] = 0;
        cursor = (slot + 1) % capacity;
      }
    },
    set(params): void {
      if (params.orbital) orbital = params.orbital;
      if (params.targetCount !== undefined) target = Math.min(Math.max(Math.round(params.targetCount), ORBITAL_POINTS_RANGE.min), capacity);
    },
  };
}
