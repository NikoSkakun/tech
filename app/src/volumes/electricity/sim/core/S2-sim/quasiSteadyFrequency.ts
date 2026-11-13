/**
 * Quasi-steady frequency after the automatic reserves have acted (grid.md §Б.4, reused by §Е «Вечір дефіциту»).
 * Seconds-scale dynamics are in `frequency.ts`; here a 5-min (or 1-min) step only needs the settled deviation.
 *
 *   ΔP_bal  = generation − consumption              (> 0 surplus, < 0 deficit)          [MW]
 *   P_res   = clamp(−ΔP_bal, −pool, +pool)          automatic reserve pool FCR + aFRR (±600 MW)
 *   r       = ΔP_bal + P_res                        what the pool could not cover
 *   x = |Δf| solves g(x) = |r|,   g(x) = min(λ_F·x, R_F') + λ_L·x + min(λ_ext·x, X_ext)
 *           λ_F = R_F'/0,2 Hz (own FCR beyond the pool), λ_L = k_L·P_L (load self-regulation),
 *           λ_ext, X_ext — the interconnection (0 for an island)
 *   Δf = −sign(r)·x  (bisection on [0; 3] Hz)
 *   UFLS (f < 49,0 Hz): shed 5 % P_L, then 8 % steps while f < 49,0 (re-solving each time)
 *   f < 47,5 or f > 51,5 Hz → blackout.
 */
import { bisect, clamp } from './math';

export interface QuasiSteadyParams {
  /** Current load P_L [MW] (λ_L = k_L·P_L and UFLS fractions refer to it). */
  loadMW: number;
  /** Automatic reserve pool FCR + aFRR, symmetric [MW] (600). */
  poolMW: number;
  /** Own FCR beyond the pool R_F' [MW] (500), fully active at `fcrFullDeviationHz`. */
  fcrBeyondPoolMW: number;
  fcrFullDeviationHz: number;
  /** k_L [1/Hz] (0,01). */
  loadDampingPerHz: number;
  /** Interconnection stiffness λ_ext [MW/Hz] (15 000 when connected, 0 for an island). */
  extGainMWPerHz: number;
  /** Interconnection limit for deficits X_ext [MW] (2100 − scheduled import). */
  extLimitDeficitMW: number;
  /** Interconnection limit for surpluses [MW] (2100). */
  extLimitSurplusMW: number;
  /** UFLS enabled and its stages as fractions of P_L (threshold `uflsThresholdHz`). */
  ufls: boolean;
  uflsThresholdHz: number;
  uflsFractions: readonly number[];
  protectionMinHz: number;
  protectionMaxHz: number;
}

export const DEFAULT_QUASI_STEADY: Omit<QuasiSteadyParams, 'loadMW'> = {
  poolMW: 600,
  fcrBeyondPoolMW: 500,
  fcrFullDeviationHz: 0.2,
  loadDampingPerHz: 0.01,
  extGainMWPerHz: 0,
  extLimitDeficitMW: 0,
  extLimitSurplusMW: 0,
  ufls: true,
  uflsThresholdHz: 49.0,
  uflsFractions: [0.05, 0.08, 0.08, 0.08, 0.08, 0.08],
  protectionMinHz: 47.5,
  protectionMaxHz: 51.5,
};

export interface QuasiSteadyResult {
  /** Imbalance after UFLS shedding [MW]. */
  imbalanceMW: number;
  /** Pool output P_res [MW] (positive = up-regulation). */
  poolOutputMW: number;
  /** Unused pool in the direction of the imbalance [MW] («запас на наступну аварію»). */
  poolMarginMW: number;
  /** Residual r [MW]. */
  residualMW: number;
  deltaFHz: number;
  fHz: number;
  /** Own FCR beyond the pool [MW]. */
  fcrMW: number;
  /** Load self-regulation [MW]. */
  loadReliefMW: number;
  /** Unscheduled exchange through the interconnection λ_ext·x [MW] (sign: + import). */
  unscheduledMW: number;
  /** UFLS stages tripped and load shed [MW]. */
  uflsStages: number;
  uflsShedMW: number;
  blackout: boolean;
}

/** g(x) of §Б.4 for one direction (limit = the interconnection limit in that direction). */
function supportMW(p: QuasiSteadyParams, x: number, extLimit: number): number {
  const lambdaF = p.fcrBeyondPoolMW / p.fcrFullDeviationHz;
  return Math.min(lambdaF * x, p.fcrBeyondPoolMW) + p.loadDampingPerHz * p.loadMW * x + Math.min(p.extGainMWPerHz * x, extLimit);
}

/** Deviation |Δf| for a residual r (no UFLS), bisection on [0; 3] Hz as in the document. */
export function deviationForResidualHz(p: QuasiSteadyParams, residualMW: number): number {
  if (residualMW === 0) return 0;
  const extLimit = residualMW < 0 ? p.extLimitDeficitMW : p.extLimitSurplusMW;
  return bisect((x) => supportMW(p, x, Math.max(0, extLimit)), Math.abs(residualMW), 0, 3, 60);
}

/** Solve the settled frequency for an imbalance ΔP_bal [MW] (> 0 surplus), including UFLS. */
export function solveQuasiSteady(imbalanceMW: number, p: QuasiSteadyParams): QuasiSteadyResult {
  let bal = Number.isFinite(imbalanceMW) ? imbalanceMW : 0;
  let shed = 0;
  let stages = 0;
  const evaluate = () => {
    const pool = clamp(-bal, -p.poolMW, p.poolMW);
    const r = bal + pool;
    const x = deviationForResidualHz(p, r);
    const df = r < 0 ? -x : r > 0 ? x : 0;
    return { pool, r, x, df };
  };
  let e = evaluate();
  while (p.ufls && 50 + e.df < p.uflsThresholdHz && stages < p.uflsFractions.length) {
    const s = p.uflsFractions[stages]! * p.loadMW;
    shed += s;
    bal += s;
    stages++;
    e = evaluate();
  }
  const f = 50 + e.df;
  const extLimit = e.r < 0 ? p.extLimitDeficitMW : p.extLimitSurplusMW;
  const lambdaF = p.fcrBeyondPoolMW / p.fcrFullDeviationHz;
  return {
    imbalanceMW: bal,
    poolOutputMW: e.pool,
    poolMarginMW: p.poolMW - Math.abs(e.pool),
    residualMW: e.r,
    deltaFHz: e.df,
    fHz: f,
    fcrMW: -Math.sign(e.df) * Math.min(lambdaF * e.x, p.fcrBeyondPoolMW),
    loadReliefMW: -p.loadDampingPerHz * p.loadMW * e.df,
    unscheduledMW: -Math.sign(e.df) * Math.min(p.extGainMWPerHz * e.x, Math.max(0, extLimit)),
    uflsStages: stages,
    uflsShedMW: shed,
    blackout: f < p.protectionMinHz || f > p.protectionMaxHz,
  };
}
