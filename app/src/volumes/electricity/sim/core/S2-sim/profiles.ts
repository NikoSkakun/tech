/**
 * Daily profiles of the model country (grid.md §Б.1–Б.2): load, PV and wind. Hours are decimal (0…24).
 */
import { clamp, interp1 } from './math';

export type Season = 'winter' | 'summer';

const HOURS = Array.from({ length: 25 }, (_, h) => h);

/** grid §Б.1 hourly load points [GW], h = 0…24 (linear interpolation between them). */
export const LOAD_PROFILE_GW: Readonly<Record<Season, readonly number[]>> = {
  winter: [
    11.0, 10.5, 10.2, 10.0, 10.0, 10.3, 11.2, 12.6, 13.6, 14.0, 14.0, 13.8, 13.6, 13.5, 13.4, 13.5, 14.0, 15.2, 16.0, 16.0,
    15.6, 14.8, 13.6, 12.2, 11.0,
  ],
  summer: [
    9.0, 8.6, 8.3, 8.1, 8.1, 8.3, 9.0, 10.0, 10.8, 11.2, 11.4, 11.5, 11.5, 11.4, 11.4, 11.3, 11.3, 11.4, 11.7, 12.0, 12.4,
    12.5, 11.8, 10.4, 9.0,
  ],
};

/** Wrap an hour into [0, 24]. */
export function wrapHour(h: number): number {
  const w = h % 24;
  return w < 0 ? w + 24 : w;
}

/** Load P_L(t) [MW] (grid §Б.1); hours beyond 24 wrap to the next day. */
export function gridLoadMW(season: Season, hour: number): number {
  const h = hour === 24 ? 24 : wrapHour(hour);
  return interp1(HOURS, LOAD_PROFILE_GW[season], h) * 1000;
}

export interface PvSeasonParams {
  sunriseH: number;
  sunsetH: number;
  /** Peak fraction a of the installed power at solar noon in clear weather. */
  peakFraction: number;
}

export const PV_SEASON: Readonly<Record<Season, PvSeasonParams>> = {
  winter: { sunriseH: 7.75, sunsetH: 16.25, peakFraction: 0.35 },
  summer: { sunriseH: 5.0, sunsetH: 21.0, peakFraction: 0.7 },
};

/** Weather factor w (grid §Б.2): clear 1,0; variable 0,6; overcast 0,2 (event «хмарність» multiplies by 0,5). */
export const PV_WEATHER = { clear: 1.0, variable: 0.6, overcast: 0.2 } as const;
export type PvWeather = keyof typeof PV_WEATHER;

/**
 * PV output [MW] (grid §Б.2): P_inst · a · max(0, sin(π·(t − t_r)/(t_s − t_r)))^1,3 · w.
 * The exponent 1,3 narrows the bell (air mass and angle of incidence in the morning and evening).
 */
export function pvOutputMW(installedMW: number, season: Season, hour: number, weatherFactor = 1): number {
  const s = PV_SEASON[season];
  const h = wrapHour(hour);
  if (h <= s.sunriseH || h >= s.sunsetH) return 0;
  const shape = Math.sin((Math.PI * (h - s.sunriseH)) / (s.sunsetH - s.sunriseH));
  return Math.max(0, installedMW) * s.peakFraction * Math.max(0, shape) ** 1.3 * clamp(weatherFactor, 0, 1);
}

/** Wind regimes of grid §Б.2: c0 + c1·cos(2π(t − 3)/24) (night maximum at 03:00). */
export const WIND_REGIME = {
  windy: { c0: 0.35, c1: 0.1 },
  calm: { c0: 0.08, c1: 0.03 },
} as const;
export type WindRegime = keyof typeof WIND_REGIME;

export function windOutputMW(installedMW: number, regime: WindRegime, hour: number): number {
  const { c0, c1 } = WIND_REGIME[regime];
  return Math.max(0, installedMW) * (c0 + c1 * Math.cos((2 * Math.PI * (hour - 3)) / 24));
}
