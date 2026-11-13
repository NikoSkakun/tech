/**
 * Hybrid-home 24 h model — §M2 appliances and §M3 outage schedules (`lab-hybrid-home`; constants = column
 * «Симулятор» of `_shared-house.md` §3; oracle `home_model.py`).
 * Windows are [start, end) in clock hours; the load of a 5-min step is taken at the start of the step.
 */
import type { Season } from './pv';

export type ApplianceId =
  | 'fridge'
  | 'router'
  | 'boiler_pump'
  | 'lights'
  | 'tv_laptops'
  | 'laptop_work'
  | 'kettle'
  | 'stove'
  | 'washer'
  | 'water_heater'
  | 'air_cond'
  | 'ev';

export interface HomeAppliance {
  id: ApplianceId;
  /** Average power over the schedule, kW. */
  kw: number;
  windows: readonly (readonly [number, number])[];
  critical: boolean;
  seasons: readonly Season[];
}

const ALL: readonly Season[] = ['winter', 'spring', 'summer'];

export const HOME_APPLIANCES: readonly HomeAppliance[] = [
  { id: 'fridge', kw: 0.06, windows: [[0, 24]], critical: true, seasons: ALL },
  { id: 'router', kw: 0.02, windows: [[0, 24]], critical: true, seasons: ALL },
  { id: 'boiler_pump', kw: 0.08, windows: [[0, 24]], critical: true, seasons: ['winter'] },
  {
    id: 'lights',
    kw: 0.15,
    windows: [
      [6, 8],
      [17, 23],
    ],
    critical: true,
    seasons: ALL,
  },
  { id: 'tv_laptops', kw: 0.15, windows: [[18, 23]], critical: true, seasons: ALL },
  { id: 'laptop_work', kw: 0.1, windows: [[9, 17]], critical: true, seasons: ALL },
  {
    id: 'kettle',
    kw: 2.0,
    // Same float expressions as the oracle (7 + 5/60 …) so the step boundaries agree bit-for-bit.
    windows: [
      [7, 7 + 5 / 60],
      [13, 13 + 5 / 60],
      [19, 19 + 5 / 60],
    ],
    critical: false,
    seasons: ALL,
  },
  { id: 'stove', kw: 1.5, windows: [[18, 19]], critical: false, seasons: ALL },
  { id: 'washer', kw: 0.8, windows: [[10, 11.5]], critical: false, seasons: ALL },
  { id: 'water_heater', kw: 2.0, windows: [[13, 15]], critical: false, seasons: ALL },
  { id: 'air_cond', kw: 0.9, windows: [[12, 18]], critical: false, seasons: ['summer'] },
  {
    id: 'ev',
    kw: 3.7,
    windows: [
      [22, 24],
      [0, 2],
    ],
    critical: false,
    seasons: ALL,
  },
];

/** Appliances enabled by default (§M2 «Типово»). */
export const DEFAULT_APPLIANCES: readonly ApplianceId[] = [
  'fridge',
  'router',
  'boiler_pump',
  'lights',
  'tv_laptops',
  'laptop_work',
  'kettle',
  'stove',
  'washer',
];

export type OutagePreset = 'none' | 'two_queues' | 'hard_day' | 'day12' | 'blackout';

/** Outage windows (hours without grid), §M3. */
export const OUTAGES: Record<OutagePreset, readonly (readonly [number, number])[]> = {
  none: [],
  two_queues: [
    [8, 12],
    [18, 22],
  ],
  hard_day: [
    [6, 10],
    [14, 18],
    [22, 24],
    [0, 2],
  ],
  day12: [[6, 18]],
  blackout: [[0, 24]],
};

export function inWindows(h: number, windows: readonly (readonly [number, number])[]): boolean {
  return windows.some(([a, b]) => a <= h && h < b);
}

/** A custom schedule as 24 booleans (true = grid off in that hour) → windows. */
export function outageFromHours(hoursOff: readonly boolean[]): [number, number][] {
  const out: [number, number][] = [];
  hoursOff.forEach((off, h) => off && out.push([h, h + 1]));
  return out;
}

/** Critical and non-critical load at clock minute t, kW (without the inverter idle power). */
export function homeLoadsKw(
  tMin: number,
  season: Season,
  enabled: ReadonlySet<ApplianceId>,
): { crit: number; non: number } {
  const h = tMin / 60;
  let crit = 0;
  let non = 0;
  for (const a of HOME_APPLIANCES) {
    if (enabled.has(a.id) && a.seasons.includes(season) && inWindows(h, a.windows)) {
      if (a.critical) crit += a.kw;
      else non += a.kw;
    }
  }
  return { crit, non };
}
