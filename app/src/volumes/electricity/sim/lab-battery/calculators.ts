/**
 * `lab-battery` §M8 calculators (steps 3, 4, 12).
 */

/** Step 4: specific energy of the cells only, Wh/kg, and the usable depth of discharge. */
export const SPECIFIC_ENERGY = {
  leadAcid: { whPerKg: 40, usableDod: 0.5 },
  lfp: { whPerKg: 160, usableDod: 0.9 },
  nmc: { whPerKg: 250, usableDod: 0.9 },
} as const;
export type MassChemistry = keyof typeof SPECIFIC_ENERGY;

/** m = W/w; «корисні» m = W/(w·DoD_use). Control 5 kWh: 125 / 31.25 / 20 kg; usable 250 / 34.7 / 22.2 kg. */
export function cellMassKg(energyKwh: number, chem: MassChemistry): { raw: number; usable: number } {
  const s = SPECIFIC_ENERGY[chem];
  const wh = energyKwh * 1000;
  return { raw: wh / s.whPerKg, usable: wh / (s.whPerKg * s.usableDod) };
}

/** Step 12 «Скільки протягне?»: t = W·DoD·η/P, η = 0.95 (10 kWh, 90 %, 0.3 kW → 28.5 h). */
export function runtimeHours(energyKwh: number, dodPct: number, loadKw: number, eta = 0.95): number {
  return loadKw > 0 ? (energyKwh * (dodPct / 100) * eta) / loadKw : Infinity;
}

/**
 * Average pack price, $/kWh in 2025 dollars (BNEF; intermediate years approximate — UI label «наближено»).
 * The 2022 increase is real (lithium price spike) and stays on the chart.
 */
export const PACK_PRICE_USD_PER_KWH: Readonly<Record<number, number>> = {
  2010: 1474,
  2011: 1140,
  2012: 900,
  2013: 820,
  2014: 730,
  2015: 470,
  2016: 365,
  2017: 270,
  2018: 225,
  2019: 195,
  2020: 170,
  2021: 160,
  2022: 170,
  2023: 147,
  2024: 118,
  2025: 108,
};
/** Stationary packs, 2025, $/kWh. */
export const STATIONARY_PRICE_2025 = 70;

/** cost = W·price(year) (10 kWh: 14 740 $ in 2010, 1080 $ in 2025; stationary 2025 → 700 $). */
export function packCostUsd(energyKwh: number, year: number, stationary = false): number {
  const y = Math.min(2025, Math.max(2010, Math.round(year)));
  const price = stationary && y === 2025 ? STATIONARY_PRICE_2025 : PACK_PRICE_USD_PER_KWH[y]!;
  return energyKwh * price;
}

/** Step 3: SOC rate dSOC/dt = I/Q in %/s for a current given as C-rate (×600 slow-motion is the builder's). */
export function socRatePctPerS(cRate: number): number {
  return (cRate * 100) / 3600;
}
