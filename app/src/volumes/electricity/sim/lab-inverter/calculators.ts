/**
 * `lab-inverter` small calculators: switch vs «tap» (step 2, §M5), LC filter warnings (step 5), UPS hold-up
 * (step 10), VFD pump (step 11).
 */
import { lcResonance } from '../core/S3-sim/inverter';

/* ---------------------------------------------- step 2 (§M5) ---------------------------------------------- */

/** Switch parameters (§M5): R_on = 0.04 Ω, t_sw = t_on + t_off = 100 ns. */
export const SWITCH_PARAMS = { rOnOhm: 0.04, tSwS: 100e-9 } as const;

export interface LossResult {
  pOutW: number;
  pLossW: number;
  efficiency: number;
  /** Per conducting switch: conduction and switching parts (switch mode only), W. */
  conductionW?: number;
  switchingW?: number;
}

/** «Кран» (linear regulator): P_loss = (U_dc − U)·I, η = U/U_dc. */
export function tapLosses(uOutV: number, iA: number, udcV = 400): LossResult {
  const u = Math.min(Math.max(uOutV, 0), udcV);
  const pOut = u * iA;
  const pLoss = (udcV - u) * iA;
  return { pOutW: pOut, pLossW: pLoss, efficiency: udcV > 0 ? u / udcV : 0 };
}

/**
 * «Ключ»: P_loss = 2·(I²·R_on + ½·U_dc·I·t_sw·f_sw) — two switches conduct in the bridge.
 * Control: 400 V, 10 A, 20 kHz → 4 + 4 = 8 W per switch, 16 W per bridge.
 */
export function switchLosses(uOutV: number, iA: number, fSwHz: number, udcV = 400): LossResult {
  const cond = iA * iA * SWITCH_PARAMS.rOnOhm;
  const sw = 0.5 * udcV * iA * SWITCH_PARAMS.tSwS * fSwHz;
  const pOut = Math.max(0, uOutV) * iA;
  const pLoss = 2 * (cond + sw);
  return {
    pOutW: pOut,
    pLossW: pLoss,
    efficiency: pOut > 0 ? pOut / (pOut + pLoss) : 0,
    conductionW: cond,
    switchingW: sw,
  };
}

/* ---------------------------------------------- step 5 ---------------------------------------------------- */

export type FilterWarning = 'too-small' | 'oversized' | null;

/** Amber warnings: f₀ > f_c/10 → «фільтр замалий»; f₀ < 10·f₁ = 500 Hz → «фільтр зайвий і важкий». */
export function filterWarning(lH: number, cF: number, fcHz: number): FilterWarning {
  const { f0Hz } = lcResonance(lH, cF);
  if (f0Hz > fcHz / 10) return 'too-small';
  if (f0Hz < 500) return 'oversized';
  return null;
}

/* ---------------------------------------------- step 10 --------------------------------------------------- */

/** UPS transfer times of the three samples, s. */
export const UPS_TRANSFER_S = { offline: 0.008, lineInteractive: 0.004, online: 0 } as const;
/** PC power supply bulk capacitor: 270 μF discharged from 390 V to 320 V (6.71 J). */
export const PSU_HOLDUP = { cF: 270e-6, u1V: 390, u2V: 320 } as const;

/** Hold-up time t_hold = ½·C·(U₁² − U₂²)/P (300 W → 22.4 ms). */
export function holdUpTimeS(pLoadW: number): number {
  const w = 0.5 * PSU_HOLDUP.cF * (PSU_HOLDUP.u1V ** 2 - PSU_HOLDUP.u2V ** 2);
  return pLoadW > 0 ? w / pLoadW : Infinity;
}

/** The PC survives the transfer if t_tr ≤ t_hold. */
export function pcSurvives(transferS: number, pLoadW: number): boolean {
  return transferS <= holdUpTimeS(pLoadW);
}

export type UpsKind = 'offline' | 'lineInteractive' | 'online';

/** «Просідання до 190 V»: offline → battery; line-interactive → AVR boost +15 %; online — unaffected. */
export function upsSagResponse(
  kind: UpsKind,
  uGridV = 190,
): { source: 'grid' | 'battery' | 'avr'; uOutV: number } {
  if (kind === 'online') return { source: 'grid', uOutV: 230 };
  if (kind === 'lineInteractive') return { source: 'avr', uOutV: uGridV * 1.15 };
  return { source: 'battery', uOutV: 230 };
}

/* ---------------------------------------------- step 11 --------------------------------------------------- */

/** VFD pump: 4-pole motor (p = 2), no slip: n = 60·f/p; P = P_nom·(f/50)³ (11 kW nominal). */
export function vfdPump(fHz: number, pNomW = 11000, polePairs = 2): { rpm: number; powerW: number } {
  return { rpm: (60 * fHz) / polePairs, powerW: pNomW * (fHz / 50) ** 3 };
}

/** MMC level choices of step 11. */
export const MMC_LEVELS = [2, 3, 5, 9, 21, 101] as const;
