/**
 * Hybrid-home 24 h model — parameters and §M4 defaults (`lab-hybrid-home`, `_shared-house.md` §4).
 */
import { DEFAULT_APPLIANCES, OUTAGES, type ApplianceId, type OutagePreset } from './loads';
import type { Season, Weather } from './pv';

/** backup — keep the battery full for outages; self_use — cover the house from the battery; tou — night tariff. */
export type HomeMode = 'backup' | 'self_use' | 'tou';

export interface HomeParams {
  /** PV peak power, kWp (default 5). */
  kwp: number;
  /** Battery capacity, kWh (0 = no battery; default 10.24). */
  batKwh: number;
  /** Inverter AC power, kW (default 6). */
  invKw: number;
  season: Season;
  weather: Weather;
  /** Preset or custom windows [start, end) in hours without grid. */
  outage: OutagePreset | readonly (readonly [number, number])[];
  mode: HomeMode;
  enabled: readonly ApplianceId[];
  /** «Весь будинок» on the backup output (otherwise non-critical loads are shed in an island). */
  wholeHomeBackup: boolean;
  exportAllowed: boolean;
  exportKw: number;
  reservePct: number;
  socMinPct: number;
  /** Battery power limit, kW; null → min(P_inv, 0.5·W_bat/1 h). */
  pbatKw: number | null;
  gridChargeKw: number;
  /** Generator power, kW (0 = none; lab option 3 kW). */
  genKw: number;
  genStartPct: number;
  genStopPct: number;
  idleKw: number;
  etaPv: number;
  etaCh: number;
  etaDis: number;
  soc0Pct: number;
  /** Simulated days (outages only in the last unless multiDay). */
  days: number;
  tariffDay: number;
  tariffNight: number;
  /** «Блекаут кілька діб»: outages in every simulated day. */
  multiDay: boolean;
}

/** §M4 defaults; the UI default scenario is CP1 (winter, overcast, two_queues, backup). */
export const HOME_DEFAULTS: Readonly<HomeParams> = Object.freeze({
  kwp: 5,
  batKwh: 10.24,
  invKw: 6,
  season: 'winter',
  weather: 'overcast',
  outage: 'two_queues',
  mode: 'backup',
  enabled: DEFAULT_APPLIANCES,
  wholeHomeBackup: false,
  exportAllowed: true,
  exportKw: 5,
  reservePct: 30,
  socMinPct: 10,
  pbatKw: null,
  gridChargeKw: 2,
  genKw: 0,
  genStartPct: 20,
  genStopPct: 80,
  idleKw: 0.05,
  etaPv: 0.97,
  etaCh: 0.95,
  etaDis: 0.95,
  soc0Pct: 50,
  days: 3,
  tariffDay: 4.32,
  tariffNight: 2.16,
  multiDay: false,
} satisfies HomeParams);

export interface HomeParamsResolved extends Omit<HomeParams, 'pbatKw' | 'enabled' | 'outage'> {
  pbatKw: number;
  enabled: ReadonlySet<ApplianceId>;
  outageWindows: readonly (readonly [number, number])[];
}

/** Battery power rule P_bat,max = min(P_inv, 0.5·W_bat / 1 h) (0.5 C recommended by the BMS, DECISIONS §24). */
export function batteryPowerKw(invKw: number, batKwh: number): number {
  return Math.min(invKw, 0.5 * batKwh);
}

export function resolveHomeParams(p: Partial<HomeParams> = {}): HomeParamsResolved {
  const m: HomeParams = { ...HOME_DEFAULTS, ...p };
  const { pbatKw, enabled, outage, ...rest } = m;
  return {
    ...rest,
    kwp: Math.max(0, m.kwp),
    batKwh: Math.max(0, m.batKwh),
    pbatKw: pbatKw ?? batteryPowerKw(m.invKw, Math.max(0, m.batKwh)),
    enabled: new Set(enabled),
    outageWindows: typeof outage === 'string' ? OUTAGES[outage] : outage,
    days: Math.max(1, Math.round(m.days)),
  };
}
