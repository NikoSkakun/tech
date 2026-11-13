/** Simulation models of the `plant-gas` chapter (plant-gas.md «Модель симуляції» M1…M6). */
export * from './gasTurbine';
export * from './combined';
export * from './startRace';
export * from './engines';
export * from './emissions';

/** Step 2 «1 m³ газу»: ≈ 9,9 kWh of heat → electricity at a given efficiency (CCGT 0,57 → 5,7; GT 0,35 → 3,5 kWh). */
export const GAS_KWH_PER_M3 = 9.9;
export function electricityFromCubicMetreKWh(eta: number): number {
  return GAS_KWH_PER_M3 * eta;
}
