/**
 * `plant-wind` M6 visual «річна смуга»: synthetic hourly wind for one year — AR(1) with hourly correlation 0.97,
 * a synoptic sinusoid with a 4-day period and ±15 % seasonal modulation (stronger in winter), scaled so the annual
 * mean equals v̄. Deterministic: the uniform RNG is injected (default: mulberry32 with a fixed seed).
 */
import { TURBINE_6MW, turbinePowerW, type TurbineSpec } from '../core/S3-sim/wind';

/** mulberry32 — tiny seeded uniform RNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface YearSeries {
  /** 8760 hourly speeds, m/s (mean = v̄). */
  speedMs: Float32Array;
  /** Hourly power of the turbine, W (before η_loss). */
  powerW: Float32Array;
}

export function syntheticYear(
  meanVMs: number,
  rng: () => number = mulberry32(2026),
  t: TurbineSpec = TURBINE_6MW,
): YearSeries {
  const n = 8760;
  const raw = new Float64Array(n);
  const rho = 0.97;
  const sd = Math.sqrt(1 - rho * rho);
  let x = 0;
  for (let h = 0; h < n; h++) {
    // Box–Muller standard normal.
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    x = rho * x + sd * z;
    const synoptic = Math.sin((2 * Math.PI * h) / 96);
    const day = h / 24;
    const season = 1 + 0.15 * Math.cos((2 * Math.PI * (day - 15)) / 365);
    raw[h] = Math.max(0, (1 + 0.35 * x + 0.25 * synoptic) * season);
  }
  let mean = 0;
  for (let h = 0; h < n; h++) mean += raw[h]!;
  mean /= n;
  const k = mean > 0 ? meanVMs / mean : 0;
  const speed = new Float32Array(n);
  const power = new Float32Array(n);
  for (let h = 0; h < n; h++) {
    speed[h] = raw[h]! * k;
    power[h] = turbinePowerW(t, speed[h]!);
  }
  return { speedMs: speed, powerW: power };
}

/** Wind histogram for the step 9 chart: counts of hours per 1 m/s bin 0…bins−1. */
export function histogram(speedMs: ArrayLike<number>, bins = 26): number[] {
  const out = new Array<number>(bins).fill(0);
  for (let i = 0; i < speedMs.length; i++) out[Math.min(bins - 1, Math.floor(speedMs[i]!))]!++;
  return out;
}
