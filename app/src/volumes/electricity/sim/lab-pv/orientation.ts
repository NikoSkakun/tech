/**
 * `lab-pv` §M3: annual specific yield vs orientation for Kyiv (PVGIS-SARAH3, 14 % system loss), step 8.
 * Bilinear interpolation over (tilt β, |azimuth γ|); the east side uses the same table by |γ| (PVGIS gives
 * 1–2 % more for the east — neglected, as documented).
 */
import { bilinear } from '../core/S3-sim/num';

export const YIELD_TILTS_DEG = [0, 15, 30, 37, 45, 60, 75, 90] as const;
export const YIELD_AZIMUTHS_DEG = [0, 45, 90, 135, 180] as const;
/** kWh/kWp·year, rows = tilt, columns = |azimuth| from south. */
export const YIELD_TABLE: readonly (readonly number[])[] = [
  [938, 938, 938, 938, 938],
  [1049, 1011, 920, 825, 784],
  [1106, 1039, 882, 701, 622],
  [1114, 1037, 858, 648, 547],
  [1107, 1022, 826, 592, 465],
  [1052, 960, 749, 497, 337],
  [940, 852, 650, 405, 252],
  [775, 707, 536, 316, 188],
];

/** Optimum (37°/0°) specific yield, kWh/kWp·year. */
export const KYIV_OPTIMUM_YIELD = 1114;

/** Monthly yield at 37°/0°, kWh/kWp (sum 1114). */
export const KYIV_MONTHLY_37 = [
  36.8, 56.2, 95.3, 118.6, 136.1, 139.6, 140.4, 135.8, 111.9, 80.1, 35.9, 27.4,
] as const;
/** Fixed PVGIS data for 60°/0° (misconception chip; NOT obtained by scaling), sum 1052. */
export const KYIV_MONTHLY_60 = [
  41.0, 59.7, 95.1, 110.4, 119.0, 118.0, 120.8, 123.4, 109.9, 84.3, 39.3, 30.8,
] as const;

/** «Порівняти міста» (optimum tilt), kWh/kWp·year. */
export const CITY_YIELDS = [
  { city: 'Львів', yield: 1086, optimumTiltDeg: 38 },
  { city: 'Київ', yield: 1114, optimumTiltDeg: 37 },
  { city: 'Одеса', yield: 1264, optimumTiltDeg: 36 },
] as const;

/** Wrap an azimuth into −180…+180°. */
function wrapAzimuth(deg: number): number {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (a === -180 && deg > 0) a = 180;
  return a;
}

export interface OrientationYield {
  /** kWh/kWp·year. */
  specificYield: number;
  /** Share of the optimum Y/1114 (0…1). */
  fractionOfOptimum: number;
  /** Monthly histogram, kWh/kWp: the 37°/0° shape scaled by Y/1114 («наближено»). */
  monthly: number[];
}

/** Steps 8: tilt β 0…90°, azimuth γ −180…+180° (from south, + west). */
export function orientationYield(tiltDeg: number, azimuthDeg: number): OrientationYield {
  const g = Math.abs(wrapAzimuth(azimuthDeg));
  const y = bilinear(YIELD_TILTS_DEG, YIELD_AZIMUTHS_DEG, YIELD_TABLE, tiltDeg, g);
  const f = y / KYIV_OPTIMUM_YIELD;
  return { specificYield: y, fractionOfOptimum: f, monthly: KYIV_MONTHLY_37.map((m) => m * f) };
}

/** Snow/dust toggle: snow stays on modules flatter than 30°, slides off from 35°; in between it slides slowly. */
export function snowBehaviour(tiltDeg: number): 'stays' | 'slides-slowly' | 'slides' {
  if (tiltDeg < 30) return 'stays';
  if (tiltDeg < 35) return 'slides-slowly';
  return 'slides';
}
