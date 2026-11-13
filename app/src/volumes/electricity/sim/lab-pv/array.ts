/**
 * `lab-pv` §M4 (steps 4, 9, 11): cell assembly, string design checks against the «ЛІ-6» MPPT inputs,
 * degradation and cumulative energy.
 */
import { LM440 } from '../core/S3-sim/pv';
import { KYIV_OPTIMUM_YIELD } from './orientation';

/** Model MPP of ЛМ-440 at STC (the fitted single-diode model, §M1): 33.06 V, 13.31 A. */
export const LM440_MODEL_MPP = { vmpV: 33.06, impA: 13.31, pmpW: 439.9 } as const;

/** «ЛІ-6» PV input limits per MPPT (`_shared-house.md` §4, DECISIONS §24). */
export const LI6_MPPT_INPUT = {
  maxDcV: 500,
  windowMinV: 125,
  windowMaxV: 425,
  startV: 150,
  operatingCurrentA: 16,
  shortCircuitCurrentA: 20,
} as const;

/* ---------------------------------------------- step 4 ---------------------------------------------------- */

/** Step 4 «Збери модуль»: toy cells 0.7 V, 7 A; nSeries × nParallel. */
export function cellAssembly(nSeries: number, nParallel: number, cellV = 0.7, cellA = 7) {
  const s = Math.max(0, Math.round(nSeries));
  const p = Math.max(0, Math.round(nParallel));
  const voltageV = s * cellV;
  const currentA = p * cellA;
  return { voltageV, currentA, powerW: voltageV * currentA };
}

/* ---------------------------------------------- step 9 ---------------------------------------------------- */

/** String V_oc at temperature T: N·Voc·(1 + β·(T − 25)). */
export function stringVocV(nModules: number, tC: number): number {
  return nModules * LM440.vocV * (1 + LM440.betaPerC * (tC - 25));
}

/** String V_mp at temperature T: N·Vmp·(1 + β_mp·(T − 25)), β_mp = −0.0031 1/°C. */
export function stringVmpV(nModules: number, tC: number): number {
  return nModules * LM440_MODEL_MPP.vmpV * (1 + LM440.betaMpPerC * (tC - 25));
}

export type ArrayWarning =
  | 'overvoltage' // red: V_oc(T_min) > 500 V
  | 'below-mppt-window-hot' // amber: V_mp(T_max) < 125 V
  | 'below-start-voltage' // amber: V_mp(T_max) < 150 V
  | 'above-mppt-window' // amber: V_mp(25 °C) > 425 V
  | 'short-circuit-current' // red: N_par·Isc·1.25 > 20 A
  | 'operating-current-clipping' // red/clipping: N_par·Imp > 16 A
  | 'mixed-orientation'; // amber: modules with different orientation on one MPPT

export interface StringDesignInput {
  /** Modules in series (1…14 on the roof). */
  nSeries: number;
  /** Parallel strings on this MPPT (1 or 2). */
  nParallel?: number;
  /** Minimum ambient/cell temperature, °C (−35…0, default −20). */
  tMinC?: number;
  /** Maximum cell temperature, °C (50…80, default 70). */
  tMaxC?: number;
  /** Orientation keys of the modules on this MPPT (any distinct values → mixed). */
  orientations?: readonly string[];
}

export interface StringDesignResult {
  vocColdV: number;
  vmpHotV: number;
  vmpStcV: number;
  /** Total MPP current on the input, A. */
  impTotalA: number;
  /** Design short-circuit current N_par·Isc·1.25, A. */
  iscDesignA: number;
  warnings: ArrayWarning[];
  /** Worst severity for the frame colour. */
  severity: 'ok' | 'amber' | 'red';
}

/** Step 9 checks (§M4). Control: N = 6 → 263.0 V / 170.7 V ✓; N = 11 → 482.2 V ✓; N = 12 → 526.0 V ✗. */
export function checkString(input: StringDesignInput): StringDesignResult {
  const n = Math.max(0, Math.round(input.nSeries));
  const np = Math.max(1, Math.round(input.nParallel ?? 1));
  const tMin = input.tMinC ?? -20;
  const tMax = input.tMaxC ?? 70;
  const vocCold = stringVocV(n, tMin);
  const vmpHot = stringVmpV(n, tMax);
  const vmpStc = stringVmpV(n, 25);
  const impTotal = np * LM440_MODEL_MPP.impA;
  const iscDesign = np * LM440.iscA * 1.25;
  const w: ArrayWarning[] = [];
  const red = new Set<ArrayWarning>(['overvoltage', 'short-circuit-current', 'operating-current-clipping']);
  if (vocCold > LI6_MPPT_INPUT.maxDcV) w.push('overvoltage');
  if (n > 0 && vmpHot < LI6_MPPT_INPUT.windowMinV) w.push('below-mppt-window-hot');
  else if (n > 0 && vmpHot < LI6_MPPT_INPUT.startV) w.push('below-start-voltage');
  if (vmpStc > LI6_MPPT_INPUT.windowMaxV) w.push('above-mppt-window');
  if (iscDesign > LI6_MPPT_INPUT.shortCircuitCurrentA) w.push('short-circuit-current');
  if (impTotal > LI6_MPPT_INPUT.operatingCurrentA) w.push('operating-current-clipping');
  if (input.orientations && new Set(input.orientations).size > 1) w.push('mixed-orientation');
  const severity = w.some((x) => red.has(x)) ? 'red' : w.length ? 'amber' : 'ok';
  return {
    vocColdV: vocCold,
    vmpHotV: vmpHot,
    vmpStcV: vmpStc,
    impTotalA: impTotal,
    iscDesignA: iscDesign,
    warnings: w,
    severity,
  };
}

/* ---------------------------------------------- step 11 --------------------------------------------------- */

export const DEGRADATION = {
  TOPCon: { firstYear: 0.01, perYear: 0.004 },
  PERC: { firstYear: 0.02, perYear: 0.0055 },
} as const;
export type CellTechnology = keyof typeof DEGRADATION;

/** P(t)/P0: 1 at t = 0; 1 − d1 − d·(t − 1) for t ≥ 1 (years). */
export function relativePower(years: number, tech: CellTechnology = 'TOPCon'): number {
  const d = DEGRADATION[tech];
  if (years < 1) return 1 - d.firstYear * Math.max(0, years);
  return 1 - d.firstYear - d.perYear * (years - 1);
}

/** Cumulative energy of 1 kWp in Kyiv: W_cum(N) = Σ_{t=1..N} 1114·P(t)/P0 [kWh]. TOPCon 25 → 26 235 kWh. */
export function cumulativeEnergyKwh(
  years: number,
  tech: CellTechnology = 'TOPCon',
  yieldKwhPerKwp = KYIV_OPTIMUM_YIELD,
): number {
  let s = 0;
  for (let t = 1; t <= Math.floor(years); t++) s += yieldKwhPerKwp * relativePower(t, tech);
  return s;
}

/** «Розібрати» chip: material masses of a 21 kg module (rounded, step 11); silver 440 W × ≈12 mg/W. */
export const MODULE_MATERIALS_KG = {
  glass: 15,
  aluminium: 2.5,
  polymers: 2,
  silicon: 0.7,
  copper: 0.2,
  silver: 0.44 * 0.012,
} as const;
