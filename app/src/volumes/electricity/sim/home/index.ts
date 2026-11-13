/** Simulation models of the `home` chapter (home.md «Модель симуляції» §А…§З). */
export {
  createMcb,
  mcbTripTime,
  MCB_MAGNETIC_BAND,
  MCB_MAGNETIC_MULTIPLE,
  type Mcb,
  type McbCurve,
  type McbState,
} from '@electricity/sim/core/S2-sim/protection';
export { shockZone, curveIbA, curveIc1A } from '@electricity/sim/core/S2-sim/shock';
export { APPLIANCES, CIRCUITS, TARIFF_UAH_PER_KWH } from '@electricity/sim/core/S2-sim/house';
export * from './cable';
export * from './shock';
export * from './appliances';
export * from './smps';
export * from './lighting';
export * from './finale';
export * from './backup';

/** Step 3 «Коротке замикання»: I = 250·In, limited to 4000 A. */
export function shortCircuitCurrentA(ratedA: number): number {
  return Math.min(250 * ratedA, 4000);
}

/** Step 3 compressor 2,2 kW: 12 A running, ×6 = 72 A for 0,3 s. */
export const COMPRESSOR = { runA: 12, inrushA: 72, inrushS: 0.3 } as const;
