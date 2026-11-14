/**
 * Points of the T–s charts (steps 5 and 6) — illustrative, for the shape of the cycles only; every number shown
 * as a readout comes from `@electricity/sim/plants`. No three.js.
 *
 * Water: the saturation dome from steam tables (IAPWS-IF97 rounded: s′ / s″ in kJ/(kg·K) at t °C) and the three
 * Rankine contours of plants M2 (16 MPa, condenser 30 °C, real turbine): the exhaust entropy follows from the
 * exhaust moisture of `RANKINE_IAPWS` (s₄ = s′ + (1 − y)(s″ − s′) at 30 °C); superheat to 540 °C at 16 MPa
 * (s ≈ 6,42), reheat at 3,5 MPa to 540 °C (s ≈ 7,25).
 * Air: the ideal Brayton cycle, T₂ = T₁·r^((γ−1)/γ), heating at constant pressure to the turbine-inlet
 * temperature, Δs = c_p·ln(T/T₀) along an isobar (c_p = 1,005 kJ/(kg·K)).
 */
import { RANKINE_IAPWS, type RankineConfig } from '@electricity/sim/plants';

export type Pt = [number, number];

/** Saturation dome: liquid line up to the critical point, then the vapour line back down. */
export const DOME: readonly Pt[] = [
  [0.437, 30], [1.307, 100], [1.842, 150], [2.331, 200], [2.793, 250], [3.253, 300], [3.659, 340], [3.915, 360], [4.407, 373.9],
  [4.927, 362], [5.053, 360], [5.336, 340], [5.706, 300], [6.072, 250], [6.43, 200], [6.838, 150], [7.355, 100], [8.452, 30],
];
const SF30 = 0.437;
const SG30 = 8.452;
const exhaust = (c: RankineConfig): number => SF30 + (1 - RANKINE_IAPWS[c].moisture) * (SG30 - SF30);

/** Superheating along the 16 MPa isobar (convex). */
const superheat = (from: Pt, s1: number, t1: number): Pt[] =>
  Array.from({ length: 7 }, (_, i) => {
    const k = (i + 1) / 7;
    return [from[0] + (s1 - from[0]) * k, from[1] + (t1 - from[1]) * k * k] as Pt;
  });

/** The cycle contour 1 → 2 → 3 → 4 → 1 and the index where each leg starts (pump, boiler, turbine, condenser). */
export function rankineContour(c: RankineConfig): { pts: Pt[]; legs: [number, number, number, number] } {
  const heat: Pt[] = [[0.44, 31.5], [1.31, 101], [2.33, 201], [3.25, 301], [3.746, 347.4]];
  const boil: Pt = [5.247, 347.4];
  const pts: Pt[] = [[SF30, 30], ...heat, boil];
  if (c !== 'saturated') pts.push(...superheat(boil, 6.42, 540));
  const turbine = pts.length - 1;
  if (c === 'reheat') pts.push([6.5, 305], ...superheat([6.5, 305], 7.25, 540).map(([s, t]) => [s, t] as Pt));
  pts.push([exhaust(c), 30]);
  const condenser = pts.length - 1;
  pts.push([SF30, 30]);
  return { pts, legs: [0, 1, turbine, condenser] };
}

const GAMMA = 1.4;
const CP = 1.005;
const T0 = 288.15;

/** Ideal Brayton contour in (s, t °C) for pressure ratio r and turbine-inlet temperature `titC`. */
export function braytonContour(r: number, titC = 1600): Pt[] {
  const t2 = T0 * r ** ((GAMMA - 1) / GAMMA);
  const t3 = titC + 273.15;
  const t4 = t3 / r ** ((GAMMA - 1) / GAMMA);
  const sHigh = (t: number): number => CP * Math.log(t / t2);
  const sLow = (t: number): number => CP * Math.log(t / T0);
  const pts: Pt[] = [[0, T0 - 273.15], [0, t2 - 273.15]];
  for (let i = 1; i <= 10; i++) {
    const t = t2 + ((t3 - t2) * i) / 10;
    pts.push([sHigh(t), t - 273.15]);
  }
  pts.push([sLow(t4), t4 - 273.15]);
  for (let i = 1; i <= 10; i++) {
    const t = t4 + ((T0 - t4) * i) / 10;
    pts.push([sLow(t), t - 273.15]);
  }
  return pts;
}

/** Point at fraction u (0…1) along a polyline (by vertex index, enough for a moving state dot). */
export function along(pts: readonly Pt[], from: number, to: number, u: number): Pt {
  const f = from + (to - from) * Math.min(1, Math.max(0, u));
  const i = Math.min(pts.length - 2, Math.floor(f));
  const k = f - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}
