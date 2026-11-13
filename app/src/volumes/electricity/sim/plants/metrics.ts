/**
 * plants M5 (step 8) — energy and capacity factor: W_TWh = P_MW·8760·CF/10⁶; homes = W·10⁹/3000 kWh (illustrative).
 * Day tiles (365): deterministic PRNG seeded per type. Nuclear: one 35-day refuelling block + 3–5 random outage days,
 * other days full; wind: 1-D value noise (smoothstep) rescaled to the mean CF; solar: 0,14·(1 + 0,6·cos(2π(d − 172)/365))
 * with daily noise. Tile value = daily capacity factor 0…1.
 */
import { clamp, seededRandom } from '@electricity/sim/core/S2-sim/math';

export const HOURS_PER_YEAR = 8760;
export const HOME_KWH_PER_YEAR = 3000;

export function annualEnergyTWh(powerMW: number, capacityFactor: number): number {
  return (powerMW * HOURS_PER_YEAR * clamp(capacityFactor, 0, 1)) / 1e6;
}

export function homesSupplied(energyTWh: number): number {
  return (energyTWh * 1e9) / HOME_KWH_PER_YEAR;
}

/** Preset buttons «АЕС / ВЕС / СЕС 1000 MW». */
export const CF_PRESETS = { nuclear: 0.85, wind: 0.35, solar: 0.14 } as const;
export type TileType = keyof typeof CF_PRESETS;
const SEEDS: Record<TileType, number> = { nuclear: 101, wind: 202, solar: 303 };

export function dayTiles(type: TileType, meanCf: number = CF_PRESETS[type]): number[] {
  const rand = seededRandom(SEEDS[type]);
  const days = 365;
  if (type === 'nuclear') {
    const start = Math.floor(rand() * (days - 35));
    const extra = 3 + Math.floor(rand() * 3);
    const tiles: number[] = Array.from({ length: days }, (_, d) => (d >= start && d < start + 35 ? 0 : 1));
    for (let k = 0; k < extra; k++) tiles[Math.floor(rand() * days)] = 0;
    // scale the online days so that the year average equals the requested CF (≤ 1)
    const on = tiles.reduce((a, b) => a + b, 0);
    const level = clamp((meanCf * days) / Math.max(1, on), 0, 1);
    return tiles.map((t) => t * level);
  }
  if (type === 'solar') {
    const raw = Array.from({ length: days }, (_, d) => 0.14 * (1 + 0.6 * Math.cos((2 * Math.PI * (d - 172)) / 365)) * (0.6 + 0.8 * rand()));
    const mean = raw.reduce((a, b) => a + b, 0) / days;
    return raw.map((x) => clamp((x * meanCf) / mean, 0, 1));
  }
  // wind: value noise with knots every 4 days
  const knots = Array.from({ length: Math.ceil(days / 4) + 2 }, () => rand());
  const raw = Array.from({ length: days }, (_, d) => {
    const x = d / 4;
    const i = Math.floor(x);
    const t = x - i;
    const s = t * t * (3 - 2 * t);
    return knots[i]! * (1 - s) + knots[i + 1]! * s;
  });
  const mean = raw.reduce((a, b) => a + b, 0) / days;
  return raw.map((x) => clamp((x * meanCf) / mean, 0, 1));
}
