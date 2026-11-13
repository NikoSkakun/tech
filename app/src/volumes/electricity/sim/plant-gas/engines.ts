/**
 * plant-gas M5 (step 8) — gas-engine cogeneration: η_el = 0,45, η_th,max = 0,42, Q = u·η_th,max·P_fuel,
 * ε = η_el + u·η_th,max (u = heat utilisation 0…1). District map: one 200 MW plant vs 20 × 10 MW units; an outage
 * event removes one unit (5 % of the district for distributed units, 100 % for the single plant).
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export const ENGINE = { etaEl: 0.45, etaThMax: 0.42 } as const;

export function engineChp(heatUse: number, fuelMW = 1): { electricMW: number; heatMW: number; fuelUtilisation: number } {
  const u = clamp(heatUse, 0, 1);
  return { electricMW: ENGINE.etaEl * fuelMW, heatMW: u * ENGINE.etaThMax * fuelMW, fuelUtilisation: ENGINE.etaEl + u * ENGINE.etaThMax };
}

export type DistrictLayout = 'single200' | 'twenty10';

/** Share of consumers without power after `outages` unit failures. */
export function districtOutageShare(layout: DistrictLayout, outages: number): number {
  const n = Math.max(0, Math.floor(outages));
  return layout === 'single200' ? (n > 0 ? 1 : 0) : Math.min(1, n * 0.05);
}
