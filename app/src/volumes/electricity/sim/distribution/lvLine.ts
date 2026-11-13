/**
 * distribution Р3 (steps 4, 8): 0,4 kV overhead line (СІП), 6 sections × 50 m, one house after each section.
 * R₀ = ρ/S with ρ_Al = 0,0310 Ω·mm²/m (stranding and temperature included); neutral = phase; X neglected.
 * Houses are constant-current sources I = (P/230 V)·a^p, cos φ = 1 (core `solveRadialFeeder`).
 */
import { solveRadialFeeder, type Phase } from '@electricity/sim/core/S2-sim/voltageDrop';

/** Conductor resistance [Ω/km] by cross-section [mm²] (document table). */
export const SIP_OHM_PER_KM: Readonly<Record<number, number>> = { 25: 1.24, 35: 0.886, 50: 0.62, 70: 0.443, 95: 0.326, 120: 0.258 };
export const SECTION_M = 50;
export const HOUSES = 6;
/** Voltage corridor [V] (outside → red). */
export const VOLTAGE_CORRIDOR_V = [207, 253] as const;

export interface House {
  phase: Phase;
  /** Net power [W]; negative = generation. */
  powerW: number;
}

export interface LvLineParams {
  sourceV: number;
  crossSectionMm2: number;
  houses: readonly House[];
}

export interface LvLineResult {
  voltagesV: number[];
  /** Phase currents in the first section [A] (L1, L2, L3) and neutral current. */
  headPhaseA: number[];
  headNeutralA: number;
  lossW: number;
  outOfCorridor: boolean[];
}

export function solveLvLine(p: LvLineParams): LvLineResult {
  const r = (SIP_OHM_PER_KM[p.crossSectionMm2] ?? SIP_OHM_PER_KM[70]!) * (SECTION_M / 1000);
  const res = solveRadialFeeder({
    sourcePhaseV: p.sourceV,
    sectionPhaseOhm: Array.from({ length: HOUSES }, () => r),
    nominalV: 230,
    loads: p.houses.map((h, k) => ({ node: k, phase: h.phase, powerW: h.powerW })),
  });
  return {
    voltagesV: res.loadVoltageV,
    headPhaseA: res.sectionPhaseCurrentA[0]!,
    headNeutralA: res.sectionNeutralCurrentA[0]!,
    lossW: res.lossW,
    outOfCorridor: res.loadVoltageV.map((u) => u < VOLTAGE_CORRIDOR_V[0] || u > VOLTAGE_CORRIDOR_V[1]),
  };
}

const PH: readonly Phase[] = [0, 1, 2, 0, 1, 2];
const at = (kw: number) => PH.map((phase) => ({ phase, powerW: kw * 1000 }));

/** Step 4 presets (houses 1…6 from the TP). */
export const LV_PRESETS: Readonly<Record<'symmetric' | 'morning' | 'evening' | 'allOnL1' | 'uneven', readonly House[]>> = {
  symmetric: at(3),
  morning: at(1),
  evening: at(5),
  allOnL1: PH.map(() => ({ phase: 0 as Phase, powerW: 3000 })),
  uneven: [
    { phase: 0, powerW: 5000 },
    { phase: 0, powerW: 5000 },
    { phase: 0, powerW: 5000 },
    { phase: 1, powerW: 1000 },
    { phase: 2, powerW: 1000 },
    { phase: 1, powerW: 1000 },
  ],
};
