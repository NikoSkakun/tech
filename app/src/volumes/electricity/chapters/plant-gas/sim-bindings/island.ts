/**
 * Illustrative output of the island (document, step 1): the CCGT's full output comes from the combined-cycle
 * model (M3 at r = 20, TIT = 1600 °C, 3 pressure levels: ≈ 811 MW); the peaker is 50 MW and each gas engine
 * 10 MW (scene values of the document). Base: CCGT ≈ 490 MW + 3 engines ≈ 520 MW; peak: 811 + 50 + 80 ≈ 940 MW.
 */
import { combinedCycle } from '@electricity/sim/plant-gas';
import type { Live } from '../state';

export const CCGT_FULL_MW = combinedCycle({ pressureRatio: 20, titC: 1600, levels: 3, hrsg: true, firingMW: 0 }).totalMW;
export const PEAKER_MW = 50;
export const ENGINE_MW = 10;
/** CCGT load of the night base (≈ 490 MW of ≈ 811). */
export const BASE_LOAD = 490 / CCGT_FULL_MW;

export function islandPowerMW(live: Pick<Live, 'gt' | 'peaker' | 'engines'>): number {
  return CCGT_FULL_MW * live.gt + PEAKER_MW * live.peaker + ENGINE_MW * live.engines;
}
