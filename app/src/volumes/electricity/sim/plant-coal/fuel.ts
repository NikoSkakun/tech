/**
 * plant-coal M1 (steps 2, 5, 8, 9) — fuel. Coal as received (simplified): LHV, CO₂ emission factor (IPCC 2006),
 * sulphur and ash.
 *   P_fuel = P_net/η;  coal t/h = P_fuel·3,6/LHV;  wagons/day = t/h·24/70;  CO₂ t/h = P_fuel·3,6·EF/1000;
 *   CO₂ g/kWh = EF·3,6/η;  coal kg/MWh = 3600/(η·LHV)
 * Unburnt carbon in ash q4(f) (step 3, illustrative): piecewise linear (40 → 4,0 %), (75 → 0,5 %), (90 → 0,3 %).
 */
import { interp1 } from '@electricity/sim/core/S2-sim/math';

export type CoalType = 'lignite' | 'bituminous' | 'anthracite';

export const COALS: Readonly<Record<CoalType, { lhvMJkg: number; efKgPerGJ: number; sulphurPct: number; ashPct: number }>> = {
  lignite: { lhvMJkg: 10, efKgPerGJ: 101.0, sulphurPct: 1.0, ashPct: 10 },
  bituminous: { lhvMJkg: 25, efKgPerGJ: 94.6, sulphurPct: 1.0, ashPct: 15 },
  anthracite: { lhvMJkg: 27, efKgPerGJ: 98.3, sulphurPct: 1.5, ashPct: 20 },
};
export const WAGON_T = 70;

export interface FuelResult {
  fuelMW: number;
  coalTph: number;
  wagonsPerDay: number;
  co2Tph: number;
  co2GPerKWh: number;
  coalKgPerMWh: number;
}

export function fuelUse(coal: CoalType, netMW: number, eta: number): FuelResult {
  const c = COALS[coal];
  const fuelMW = netMW / eta;
  const coalTph = (fuelMW * 3.6) / c.lhvMJkg;
  return {
    fuelMW,
    coalTph,
    wagonsPerDay: (coalTph * 24) / WAGON_T,
    co2Tph: (fuelMW * 3.6 * c.efKgPerGJ) / 1000,
    co2GPerKWh: (c.efKgPerGJ * 3.6) / eta,
    coalKgPerMWh: 3600 / (eta * c.lhvMJkg),
  };
}

/** CO₂ per tonne of coal [kg] = LHV·EF. */
export function co2PerTonneKg(coal: CoalType): number {
  return COALS[coal].lhvMJkg * COALS[coal].efKgPerGJ;
}

/** CO₂ per MWh of heat [kg] = 3,6 GJ·EF. */
export function co2PerMWhHeatKg(coal: CoalType): number {
  return 3.6 * COALS[coal].efKgPerGJ;
}

/** Unburnt-carbon loss q4 [%] for the fineness f = share of particles < 75 μm [%] (slider 40…90). */
export function unburntLossPct(finenessPct: number): number {
  return interp1([40, 75, 90], [4.0, 0.5, 0.3], finenessPct);
}
