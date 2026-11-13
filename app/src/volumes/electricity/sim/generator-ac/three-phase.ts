/**
 * `generator-ac` Г3 (steps `three-phase`, `star-delta`): u_k(t) = √2·U_ph·sin(ωt − (k−1)·120°); resistive phase
 * currents I_k (sliders 0…16 A); neutral current I_N = |I₁ + I₂·a + I₃·a²|, a = e^(−j120°). Power: single-phase
 * p(t) = 2UI·sin²(ωt) (mean UI, 100 Hz ripple), symmetric three-phase p = 3UI (constant).
 * Г3b «Без нейтралі»: Millman U_N' = ΣU_kY_k/ΣY_k, Y_k = I_k/U_ph; load voltages U_k − U_N'; ΣY = 0 → U_N' = 0.
 * star-delta: U_L = √3·U_ph; motor windings rated 230 V: on a 400 V network Y is correct, Δ overheats.
 */
import { cAbs, cAdd, cPolar, cScale, cSub, complex, type Complex } from '../core/S1-sim/complex';
import { threePhase } from '../core/S1-sim/waveform';

export const THREE_PHASE = { phaseV: 230, frequencyHz: 50, loadRangeA: { min: 0, max: 16, step: 0.5, default: 10 }, phaseRangeV: { min: 100, max: 250, step: 5, default: 230 } } as const;

const A = cPolar(1, (-2 * Math.PI) / 3);
const A2 = cPolar(1, (-4 * Math.PI) / 3);

/** Phase phasors (RMS) of a symmetric set, phase k lagging by (k−1)·120°. */
export const phasePhasors = (phaseV: number = THREE_PHASE.phaseV): [Complex, Complex, Complex] => [complex(phaseV), cScale(A, phaseV), cScale(A2, phaseV)];

/** Neutral current phasor and magnitude for resistive phase currents I₁, I₂, I₃ (in phase with their voltages). */
export function neutralCurrent(i1: number, i2: number, i3: number): { phasor: Complex; magnitudeA: number } {
  const s = cAdd(cAdd(complex(i1), cScale(A, i2)), cScale(A2, i3));
  return { phasor: s, magnitudeA: cAbs(s) };
}

/** Instantaneous phase voltages and currents (resistive). */
export function threePhaseInstant(tS: number, currentsA: [number, number, number], phaseV: number = THREE_PHASE.phaseV): { voltagesV: [number, number, number]; currentsA: [number, number, number]; neutralA: number } {
  const u = threePhase(phaseV, THREE_PHASE.frequencyHz, tS);
  const i = u.map((v, k) => (v / phaseV) * currentsA[k]) as [number, number, number];
  return { voltagesV: u, currentsA: i, neutralA: i[0] + i[1] + i[2] };
}

/** p(t): single-phase 2UI·sin²(ωt); three-phase symmetric = 3UI (sum of the three sin² terms). */
export function instantaneousPower(mode: 'single' | 'three', rmsV: number, rmsA: number, tS: number): number {
  const wt = 2 * Math.PI * THREE_PHASE.frequencyHz * tS;
  if (mode === 'single') return 2 * rmsV * rmsA * Math.sin(wt) ** 2;
  let p = 0;
  for (let k = 0; k < 3; k++) p += 2 * rmsV * rmsA * Math.sin(wt - (k * 2 * Math.PI) / 3) ** 2;
  return p;
}

/** Г3b: neutral shift and load voltages without the neutral wire. */
export function floatingNeutral(currentsA: [number, number, number], phaseV: number = THREE_PHASE.phaseV): { neutralShift: Complex; neutralShiftV: number; loadVoltagesV: [number, number, number] } {
  const u = phasePhasors(phaseV);
  const y = currentsA.map((i) => i / phaseV);
  const ySum = y[0] + y[1] + y[2];
  const shift = ySum > 0 ? cScale(cAdd(cAdd(cScale(u[0], y[0]), cScale(u[1], y[1])), cScale(u[2], y[2])), 1 / ySum) : complex(0);
  return { neutralShift: shift, neutralShiftV: cAbs(shift), loadVoltagesV: u.map((uk) => cAbs(cSub(uk, shift))) as [number, number, number] };
}

export type Connection = 'star' | 'delta';

/** Line voltage U_L = √3·U_ph. */
export const lineVoltage = (phaseV: number): number => Math.sqrt(3) * phaseV;

/**
 * Motor with 230 V windings on a network of line voltage U_L: star → each winding gets U_L/√3, delta → U_L.
 * Overheats if the winding voltage exceeds its rating by > 10 %.
 */
export function motorConnection(connection: Connection, networkLineV = 400, windingRatedV = 230): { windingV: number; ok: boolean } {
  const w = connection === 'star' ? networkLineV / Math.sqrt(3) : networkLineV;
  return { windingV: w, ok: w <= windingRatedV * 1.1 };
}
