/**
 * distribution step 3 — 400 kVA KTP 10/0,4 kV: LV incomer current I = β·577 A (400 kVA/(√3·0,4 kV)), five feeders
 * I/5 each, top-oil temperature by the simplified `transformer` Т3 law θ = 20 °C + 55 K·((1 + 5β²)/6)^0,8.
 */
import { transformerTopOilC } from '@electricity/sim/core/S2-sim/thermal';

export const KTP = { ratedKVA: 400, lvKV: 0.4, feeders: 5 } as const;
export const KTP_RATED_A = (KTP.ratedKVA * 1000) / (Math.sqrt(3) * KTP.lvKV * 1000);

export interface KtpResult {
  incomerA: number;
  feederA: number;
  oilC: number;
  /** β > 1 → amber «Перевантаження», β ≥ 1,2 → red. */
  level: 'normal' | 'overload' | 'severe';
}

/** β = district load share 0…1,2 (slider 0…120 %). */
export function solveKtp(loadShare: number): KtpResult {
  const b = Math.min(1.2, Math.max(0, loadShare));
  const i = b * KTP_RATED_A;
  return {
    incomerA: i,
    feederA: i / KTP.feeders,
    oilC: transformerTopOilC(b),
    level: b >= 1.2 - 1e-9 ? 'severe' : b > 1 ? 'overload' : 'normal',
  };
}
