/**
 * Simulation models of the `grid` chapter (grid.md «Модель симуляції» §А…§Е). Pure TypeScript, no three.js.
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

// §А — the shared frequency model (core) with the grid scenarios
export {
  continentScenario,
  createFrequencyModel,
  frequencyBand,
  futureGridScenario,
  inertiaForInverterShare,
  initialRocofHzPerS,
  islandScenario,
  kineticEnergyMWs,
  sampleAt,
  simulateFrequency,
  ukraineInCeScenario,
  type FrequencyModel,
  type FrequencyParams,
  type FrequencyState,
} from '@electricity/sim/core/S2-sim/frequency';
export * from './blackStart';
export * from './synchroscope';
export * from './lineVoltage';
export * from './auction';
export * from './n1Cascade';
export * from './deficitEvening';
export { createDispatcher, dayReport, type DayReport, type Dispatcher, type DispatcherState } from './dispatcher';

/** Step 2 «ваги»: tilt angle = clamp(ΔP/2000 MW·12°, ±12°). */
export function balanceTiltDeg(imbalanceMW: number): number {
  return clamp((imbalanceMW / 2000) * 12, -12, 12);
}

/** Step 2 pauses the run when f leaves 49,0…51,0 Hz («Тут уже спрацювала б автоматика»). */
export function step2ShouldPause(fHz: number): boolean {
  return fHz < 49.0 || fHz > 51.0;
}
