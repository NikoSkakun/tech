/**
 * grid §Б.3 — fleet of the model country, prices, CO₂ factors, scenarios and events of «Диспетчер на добу».
 * Prices and parameters are illustrative (orders of magnitude 2024–2026).
 */
import type { PvWeather, Season, WindRegime } from '@electricity/sim/core/S2-sim/profiles';

/** Model step Δt = 5 min (288 steps per day). */
export const STEP_MIN = 5;
export const STEP_H = STEP_MIN / 60;
export const STEPS_PER_DAY = 288;

export const FLEET = {
  nuclear: { units: 7, unitMW: 1000, price: 10, co2: 0 },
  chp: { maxMW: 1500, mustRunMW: { winter: 900, summer: 300 } as Record<Season, number>, rampMWPerMin: 15, price: 90, co2: 0.45 },
  coal: { units: 6, maxMW: 300, minMW: 180, rampMWPerMin: 6, startMin: 180, price: 110, co2: 1.0 },
  gas: { units: 10, maxMW: 100, minMW: 30, rampMWPerMin: 50, startMin: 10, price: 160, co2: 0.55 },
  hydro: { maxMW: 3000, rampMWPerMin: 300, price: 20, co2: 0, waterMWh: { normal: 20000, hard: 14000 } },
  psh: { genMW: 1500, pumpMW: 1600, rampMWPerMin: 500, modeChangeMin: 10, reservoirMWh: 9000, startMWh: 4000, pumpEff: 0.75, price: 0 },
  bess: { maxMW: 500, capacityMWh: 1000, startSoc: 0.5, etaCharge: 0.94, etaDischarge: 0.94, price: 0 },
  import: { maxMW: { normal: 2100, hard: 1000 } },
  dr: { maxMW: 500, maxHours: 4, rampMWPerMin: 50, price: 300 },
  /** Outage-schedule queues (ГПВ): each = 5 % of the current load; penalised at VoLL. */
  queues: { max: 6, share: 0.05, voll: 3000 },
} as const;

/** Import price p_imp(h) [€/MWh]. */
export function importPrice(hour: number): number {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h < 6) return 70;
  if (h < 9) return 120;
  if (h < 16) return 90;
  if (h < 21) return 180;
  return 110;
}

export type DayMode = 'normal' | 'hard';

export interface DispatcherScenario {
  season: Season;
  mode: DayMode;
  pvInstalledMW: number;
  windInstalledMW: number;
  wind: WindRegime;
  weather: PvWeather;
  /** Connected to ENTSO-E (λ_ext = 15 000 MW/Hz). Both day modes of the document are connected. */
  connected: boolean;
  /** Optional forecast noise AR(1) (off in tests): seed of the deterministic RNG. */
  noiseSeed: number | null;
}

export const DEFAULT_SCENARIO: DispatcherScenario = {
  season: 'winter',
  mode: 'normal',
  pvInstalledMW: 6000,
  windInstalledMW: 1500,
  wind: 'windy',
  weather: 'clear',
  connected: true,
  noiseSeed: null,
};

export type DayEvent =
  | { kind: 'coalTrip'; atMin: number }
  | { kind: 'nuclearTrip'; atMin: number }
  | { kind: 'clouds'; fromMin: number; toMin: number; factor: number }
  | { kind: 'coldSnap'; fromMin: number; factor: number };

/** Events of the two day modes (grid step 6). */
export function dayEvents(mode: DayMode): DayEvent[] {
  const base: DayEvent[] = [
    { kind: 'coalTrip', atMin: 8 * 60 + 20 },
    { kind: 'clouds', fromMin: 13 * 60, toMin: 14 * 60, factor: 0.5 },
    { kind: 'coldSnap', fromMin: 17 * 60 + 30, factor: 1.03 },
  ];
  return mode === 'hard' ? [...base, { kind: 'nuclearTrip', atMin: 19 * 60 + 10 }] : base;
}
