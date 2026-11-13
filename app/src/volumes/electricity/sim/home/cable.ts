/**
 * home §Б (step 4) — cable heating: θ_ss = θ_amb + ΔT_n·(I/I_z)², θ_amb 30 °C, ΔT_n 40 K (PVC: 70 °C at I = I_z);
 * first-order transient τ = 600 s (UI ×20). Poor joint: P_c = I²·0,05 Ω, hot spot θ_hot = θ_c + 4 °C/W·P_c.
 * I_z [A] (IEC 60364-5-52, PVC, 2 loaded conductors, 30 °C) by cable and installation method A1 / B1 / C.
 * The breaker is the MCB of §А (curve C; the thermal release is the same for all curves).
 */
import { createMcb, mcbTripTime, type Mcb } from '@electricity/sim/core/S2-sim/protection';
import { firstOrderStep, steadyTempC } from '@electricity/sim/core/S2-sim/thermal';

export type CableType = 'cu1.5' | 'cu2.5' | 'cu6' | 'al2.5';
export type Installation = 'A1' | 'B1' | 'C';

export const CABLE_IZ_A: Readonly<Record<CableType, Readonly<Record<Installation, number>>>> = {
  'cu1.5': { A1: 14.5, B1: 17.5, C: 19.5 },
  'cu2.5': { A1: 19.5, B1: 24, C: 27 },
  'cu6': { A1: 34, B1: 41, C: 46 },
  'al2.5': { A1: 15, B1: 18.5, C: 21 },
};
export const CABLE_THERMAL = { ambientC: 30, ratedRiseK: 40, tauS: 600, uiSpeedup: 20, jointOhm: 0.05, hotSpotKPerW: 4 } as const;
export const BREAKER_RATINGS_A = [6, 10, 16, 20, 25, 32, 40] as const;

export type InsulationState = 'normal' | 'ageing' | 'softening' | 'destroying';

/** ≤ 70 normal; 70–100 accelerated ageing (orange); > 100 softening (red); > 160 destruction / fire risk (red blinking). */
export function insulationState(tempC: number): InsulationState {
  if (tempC > 160) return 'destroying';
  if (tempC > 100) return 'softening';
  if (tempC > 70) return 'ageing';
  return 'normal';
}

export interface CableSteady {
  izA: number;
  steadyC: number;
  jointLossW: number;
  hotSpotC: number;
  state: InsulationState;
  /** Breaker trip time from cold [s] (Infinity = does not trip). */
  breakerTripS: number;
  /** Breaker larger than the cable allows and the cable overheats without a trip → «Пожежна небезпека». */
  oversizedBreaker: boolean;
}

export function cableSteady(cable: CableType, inst: Installation, breakerA: number, currentA: number, badJoint: boolean): CableSteady {
  const iz = CABLE_IZ_A[cable][inst];
  const th = steadyTempC(CABLE_THERMAL.ambientC, CABLE_THERMAL.ratedRiseK, currentA, iz);
  const pj = badJoint ? currentA * currentA * CABLE_THERMAL.jointOhm : 0;
  const hot = th + CABLE_THERMAL.hotSpotKPerW * pj;
  const trip = mcbTripTime(currentA, breakerA, 'C').timeS;
  return {
    izA: iz,
    steadyC: th,
    jointLossW: pj,
    hotSpotC: hot,
    state: insulationState(Math.max(th, hot)),
    breakerTripS: trip,
    oversizedBreaker: !Number.isFinite(trip) && th > 70,
  };
}

/** Time-domain cable + breaker for the scene (model time; the UI shows it ×20). */
export function createCableCircuit(cable: CableType, inst: Installation, breakerA: number) {
  let tempC: number = CABLE_THERMAL.ambientC;
  const mcb: Mcb = createMcb(breakerA, 'C');
  return {
    get tempC() {
      return tempC;
    },
    get breaker() {
      return mcb.state;
    },
    step(dtS: number, loadA: number) {
      mcb.step(dtS, loadA);
      const i = mcb.state.closed ? loadA : 0;
      tempC = firstOrderStep(tempC, steadyTempC(CABLE_THERMAL.ambientC, CABLE_THERMAL.ratedRiseK, i, CABLE_IZ_A[cable][inst]), CABLE_THERMAL.tauS, dtS);
    },
    resetBreaker() {
      mcb.close();
    },
  };
}
