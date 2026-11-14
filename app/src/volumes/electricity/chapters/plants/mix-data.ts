/**
 * Generation mix of step 10 — the document's «Цифри і факти» and «Примітки щодо фактів» (plants.md step 10):
 * world 2025 (Ember, Global Electricity Review 2026), world 2015 (Ember/IEA, ±1 pp, shown with «≈»), Ukraine 2021
 * (Міненерго / Euracoal, rounded), Ukraine 2025 (estimate: НКРЕКП, Енергоатом, УВЕА — midpoints of the ranges).
 * Shares in %, totals in TWh. Pure data (a request asks the sim library to own it).
 */
import type { ColorToken } from '@/style';
import type { PlantId } from './plants-data';

export type Sector = 'coal' | 'gas' | 'otherFossil' | 'thermalUa' | 'nuclear' | 'hydro' | 'wind' | 'solar' | 'bio' | 'renewablesUa';

export interface Mix {
  totalTWh: number;
  shares: Partial<Record<Sector, number>>;
  /** Estimate or rounded series: label with «≈», dashed rim. */
  approx: boolean;
}

export const SECTOR_COLOR: Record<Sector, ColorToken> = {
  coal: 'plantType.coal',
  gas: 'plantType.gas',
  otherFossil: 'ink',
  thermalUa: 'plantType.coal',
  nuclear: 'plantType.nuclear',
  hydro: 'plantType.hydro',
  wind: 'plantType.wind',
  solar: 'plantType.solar',
  bio: 'plantType.bio',
  renewablesUa: 'plantType.bio',
};

/** The island each sector's ray points to (none for «other fossil»). */
export const SECTOR_ISLAND: Partial<Record<Sector, PlantId>> = {
  coal: 'coal', gas: 'gas', thermalUa: 'coal', nuclear: 'nuclear', hydro: 'hydro', wind: 'wind', solar: 'solar', bio: 'geoBio', renewablesUa: 'solar',
};

export const SECTORS: readonly Sector[] = ['coal', 'thermalUa', 'gas', 'otherFossil', 'nuclear', 'hydro', 'wind', 'solar', 'bio', 'renewablesUa'];

export const MIX = {
  world2025: { totalTWh: 31700, approx: false, shares: { coal: 33.0, gas: 21.8, otherFossil: 2.6, nuclear: 8.9, hydro: 14, wind: 8.5, solar: 8.7, bio: 2.6 } },
  world2015: { totalTWh: 24300, approx: true, shares: { coal: 39, gas: 23, otherFossil: 4, nuclear: 10.6, hydro: 16, wind: 3.5, solar: 1.1, bio: 2.5 } },
  ua2021: { totalTWh: 156, approx: true, shares: { nuclear: 55, thermalUa: 30, hydro: 7, renewablesUa: 8 } },
  // no official annual total for 2025 (wartime statistics): TWh are not shown
  ua2025: { totalTWh: 0, approx: true, shares: { nuclear: 52, thermalUa: 28, hydro: 9, renewablesUa: 11 } },
} as const satisfies Record<string, Mix>;
export type MixId = keyof typeof MIX;
