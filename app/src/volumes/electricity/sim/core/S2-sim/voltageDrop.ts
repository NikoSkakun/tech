/**
 * Line / feeder voltage-drop and loss models.
 *  - Short-line approximation (grid §В): U_r = U_s − (R·P + X·Q)/U_s   (three-phase, U in kV, P in MW, Q in Mvar).
 *  - Line current of a three-phase connection: I = P/(√3·U·cos φ)       (transmission step 1, home §Ж.3).
 *  - Radial LV feeder with phase and neutral conductors (distribution Р3) — constant-current loads.
 */
import { cAbs, cAdd, complex, cPolar, cScale, cSub, type Complex } from '@electricity/sim/core/S1-sim';

const ZERO: Complex = complex(0);

/** Receiving-end voltage of a short line [kV]: U_r = U_s − (R·P + X·Q)/U_s. */
export function shortLineReceivingKV(sendingKV: number, rOhm: number, xOhm: number, pMW: number, qMvar: number): number {
  return sendingKV - (rOhm * pMW + xOhm * qMvar) / sendingKV;
}

/** Three-phase line current [A]: I = P/(√3·U·cos φ). P in W, U (line-to-line) in V. */
export function threePhaseCurrentA(powerW: number, lineVoltageV: number, powerFactor = 1): number {
  return powerW / (Math.sqrt(3) * lineVoltageV * powerFactor);
}

/** Active power loss of a three-phase line [W]: 3·I²·R. */
export function threePhaseLossW(currentA: number, rPerPhaseOhm: number): number {
  return 3 * currentA * currentA * rPerPhaseOhm;
}

export type Phase = 0 | 1 | 2;

export interface FeederLoad {
  /** Index of the node (house) along the feeder, 0-based: house k sits after section k. */
  node: number;
  phase: Phase;
  /** Active power [W]; negative = generation. */
  powerW: number;
}

export interface RadialFeederParams {
  /** Phase voltage at the source bus [V] (phasors U_s·(1, a, a²), a = e^(−j120°)). */
  sourcePhaseV: number;
  /** Resistance of each section's phase conductor [Ω] (neutral is the same unless given). */
  sectionPhaseOhm: readonly number[];
  sectionNeutralOhm?: readonly number[];
  /** Nominal voltage used to convert powers to currents [V] (230). */
  nominalV: number;
  loads: readonly FeederLoad[];
}

export interface RadialFeederResult {
  /** |U| at each load in the input order [V]. */
  loadVoltageV: number[];
  /** Per section: phase current phasors and magnitudes, neutral current. */
  sectionPhaseCurrentA: number[][];
  sectionNeutralCurrentA: number[];
  /** Ohmic loss in phase + neutral conductors [W]. */
  lossW: number;
}

/** Unit phasor of phase p: a^p, a = e^(−j120°). */
export function phaseRotor(p: Phase): Complex {
  return cPolar(1, (-2 * Math.PI * p) / 3);
}

/**
 * Radial LV feeder (distribution Р3): each load is a current source I = (P/U_nom)·a^p (cos φ = 1, «constant current»,
 * no voltage iteration). Section current = sum of the downstream currents per phase; the neutral current returns
 * through the same sections, I_N = Σ_p I_p. U_k = |U_s·a^p − Σ_{s≤k} I_p,s·R_s − Σ_{s≤k} I_N,s·R_N,s|.
 */
export function solveRadialFeeder(p: RadialFeederParams): RadialFeederResult {
  const nSec = p.sectionPhaseOhm.length;
  const rN = p.sectionNeutralOhm ?? p.sectionPhaseOhm;
  const loadI = p.loads.map((l) => cScale(phaseRotor(l.phase), l.powerW / p.nominalV));
  // section currents per phase (phasors)
  const secI: Complex[][] = Array.from({ length: nSec }, () => [ZERO, ZERO, ZERO]);
  const secN: Complex[] = Array.from({ length: nSec }, () => ZERO);
  p.loads.forEach((l, i) => {
    for (let s = 0; s <= Math.min(l.node, nSec - 1); s++) {
      secI[s]![l.phase] = cAdd(secI[s]![l.phase]!, loadI[i]!);
      secN[s] = cAdd(secN[s]!, loadI[i]!);
    }
  });
  const loadVoltageV = p.loads.map((l) => {
    let u = cScale(phaseRotor(l.phase), p.sourcePhaseV);
    for (let s = 0; s <= Math.min(l.node, nSec - 1); s++) {
      u = cSub(u, cScale(secI[s]![l.phase]!, p.sectionPhaseOhm[s]!));
      u = cSub(u, cScale(secN[s]!, rN[s]!));
    }
    return cAbs(u);
  });
  let loss = 0;
  for (let s = 0; s < nSec; s++) {
    for (let ph = 0; ph < 3; ph++) loss += cAbs(secI[s]![ph]!) ** 2 * p.sectionPhaseOhm[s]!;
    loss += cAbs(secN[s]!) ** 2 * rN[s]!;
  }
  return {
    loadVoltageV,
    sectionPhaseCurrentA: secI.map((row) => row.map(cAbs)),
    sectionNeutralCurrentA: secN.map(cAbs),
    lossW: loss,
  };
}
