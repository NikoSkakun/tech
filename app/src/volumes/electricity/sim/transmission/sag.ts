/**
 * transmission ЛЕП-2 (step 4): conductor heating and sag of a 220 kV span (one АС-300/39 per phase, I_rated 710 A).
 *   θ = θ_air + k·(I/710 A)², k = 45 K (calm) or 25 K (wind 2 m/s); sun and radiation neglected
 *   L₀ = S + 8·D₀²/(3S) (S = 300 m, D₀ = 7 m at 15 °C, 0 A);  L(θ) = L₀·(1 + α·(θ − 15)), α = 19×10⁻⁶ 1/K
 *   D(θ) = √(3·S·(L − S)/8)  («inextensible conductor» simplification: overstates the change, mostly in frost)
 *   D_max = 10 m (clearance 7 m under H = 17 m), overgrown corridor 9,4 m; D > D_max → flashover, trip.
 */
import { clamp, interp1 } from '@electricity/sim/core/S2-sim/math';
import { steadyTempC } from '@electricity/sim/core/S2-sim/thermal';

export const SPAN = {
  spanM: 300,
  sag0M: 7,
  refTempC: 15,
  alphaPerK: 19e-6,
  ratedA: 710,
  riseCalmK: 45,
  riseWindK: 25,
  attachHeightM: 17,
  clearanceM: 7,
  overgrownExtraM: 0.6,
} as const;

export const SPAN_LENGTH0_M = SPAN.spanM + (8 * SPAN.sag0M ** 2) / (3 * SPAN.spanM);

export interface SagParams {
  /** 0…1000 A. */
  currentA: number;
  /** −20…+40 °C. */
  airTempC: number;
  wind: boolean;
  overgrown: boolean;
}

export interface SagResult {
  conductorTempC: number;
  sagM: number;
  maxSagM: number;
  /** Remaining clearance margin D_max − D [m] (negative → violation). */
  marginM: number;
  violation: boolean;
  /** Conductor colour stop 0…3: sky ≤ 0 °C → white 40 °C → orange 70 °C → red ≥ 100 °C (interpolate between). */
  colorStop: number;
}

export function solveSag(p: SagParams): SagResult {
  const I = clamp(p.currentA, 0, 1000);
  const theta = steadyTempC(p.airTempC, p.wind ? SPAN.riseWindK : SPAN.riseCalmK, I, SPAN.ratedA);
  const L = SPAN_LENGTH0_M * (1 + SPAN.alphaPerK * (theta - SPAN.refTempC));
  const sag = Math.sqrt(Math.max(0, (3 * SPAN.spanM * (L - SPAN.spanM)) / 8));
  const maxSag = SPAN.attachHeightM - SPAN.clearanceM - (p.overgrown ? SPAN.overgrownExtraM : 0);
  return {
    conductorTempC: theta,
    sagM: sag,
    maxSagM: maxSag,
    marginM: maxSag - sag,
    violation: sag > maxSag,
    colorStop: interp1([0, 40, 70, 100], [0, 1, 2, 3], theta),
  };
}
