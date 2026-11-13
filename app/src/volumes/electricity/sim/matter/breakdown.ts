/**
 * `matter` «Модель симуляції» §4 (step `insulators`): E = U/d, d = 1 mm fixed; E_b (kV/mm): air 3, oil 15,
 * glass 13, PVC 25, PTFE 60, mica 120. U slider 0,1…200 kV (log), default 1 kV. Avalanches at E/E_b ≥ 0,85
 * (random chains of 3–8 flashes, rate ∝ (E/E_b − 0,85)), breakdown at E ≥ E_b. Margin gauge green → amber → red.
 */
import { clamp } from '../core/S1-sim/math';
import { randomInt, type RandomSource } from '../core/S1-sim/rng';

export type InsulatorId = 'air' | 'oil' | 'glass' | 'pvc' | 'ptfe' | 'mica';

/** Breakdown strength, kV/mm (= MV/m). */
export const INSULATORS: Readonly<Record<InsulatorId, number>> = { air: 3, oil: 15, glass: 13, pvc: 25, ptfe: 60, mica: 120 };

export const BREAKDOWN = {
  gapMm: 1,
  voltageKV: { min: 0.1, max: 200, default: 1 },
  avalancheOnsetRatio: 0.85,
  /** Avalanche chains per second at E = E_b (scene choice; rate grows linearly from 0 at 0,85). */
  maxAvalancheRatePerS: 6,
} as const;

export interface BreakdownState {
  fieldKVPerMm: number;
  /** E/E_b. */
  ratio: number;
  /** 1 − E/E_b (safety margin, may be negative). */
  margin: number;
  zone: 'safe' | 'warning' | 'danger';
  avalanches: boolean;
  avalancheRatePerS: number;
  breakdown: boolean;
}

export function breakdownState(material: InsulatorId, voltageKV: number): BreakdownState {
  const u = clamp(voltageKV, BREAKDOWN.voltageKV.min, BREAKDOWN.voltageKV.max);
  const e = u / BREAKDOWN.gapMm;
  // compare in integer-friendly kV/mm with a tiny tolerance: 3,0 kV on air is exactly the breakdown point
  const ratio = e / INSULATORS[material];
  const breakdown = ratio >= 1 - 1e-12;
  const aval = ratio >= BREAKDOWN.avalancheOnsetRatio;
  return {
    fieldKVPerMm: e,
    ratio,
    margin: 1 - ratio,
    zone: ratio < 0.6 ? 'safe' : ratio < BREAKDOWN.avalancheOnsetRatio ? 'warning' : 'danger',
    avalanches: aval && !breakdown,
    avalancheRatePerS: aval ? (BREAKDOWN.maxAvalancheRatePerS * clamp(ratio - BREAKDOWN.avalancheOnsetRatio, 0, 0.15)) / 0.15 : 0,
    breakdown,
  };
}

/** Length of one avalanche chain: 3…8 flashes (seeded). */
export const avalancheChainLength = (rng: RandomSource): number => randomInt(rng, 3, 8);
