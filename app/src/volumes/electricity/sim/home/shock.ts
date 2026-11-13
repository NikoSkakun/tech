/**
 * home §В (steps 5, 6) — fault to the enclosure, current through the body, RCD. TN-C-S, constant resistances.
 *  Z_ext = 0,30 Ω; R_L = R_PE = ρ·l/A = 0,0175·20/2,5 = 0,14 Ω; Z_s = 0,58 Ω → I_f = 396,6 A, U_t = I_f·R_PE = 55,5 V,
 *  C16 clears in 0,01 s (I_f ≥ 112 A). PE broken: enclosure at 230 V, I_body = 230/(R_body + R_ext), R_body 1000 Ω.
 *  RCD: I_Δ = I_body + I_bg ≥ 0,75·IΔn → 0,025 s. Touching L and N: I_Δ = I_bg only. Scenario length 5 s.
 */
import { mcbTripTime, RCD_TRIP_TIME_S, rcdTrips } from '@electricity/sim/core/S2-sim/protection';
import { LET_GO_A, shockZone, timeToFibrillationZoneS, type ShockZone } from '@electricity/sim/core/S2-sim/shock';

export const FAULT_LOOP = { phaseV: 230, zExtOhm: 0.3, lengthM: 20, areaMm2: 2.5, rhoCu: 0.0175, breakerA: 16 } as const;
export const R_PE_OHM = (FAULT_LOOP.rhoCu * FAULT_LOOP.lengthM) / FAULT_LOOP.areaMm2;
export const R_BODY_OHM = 1000;
export const SCENARIO_S = 5;

export type Person = 'none' | 'dryShoes' | 'wetBarefoot' | 'tap' | 'lineNeutral';
/** External resistance of the current path [Ω] (tap and L+N: hand-to-hand, R_ext = 0). */
export const R_EXT_OHM: Readonly<Record<Exclude<Person, 'none'>, number>> = { dryShoes: 100000, wetBarefoot: 200, tap: 0, lineNeutral: 0 };

export interface ShockParams {
  peConnected: boolean;
  person: Person;
  /** RCD rated residual current [A] or null (no RCD). */
  rcdA: number | null;
  /** Background leakage of the appliances [A] (0…25 mA). */
  backgroundA: number;
}

export interface ShockResult {
  faultCurrentA: number;
  touchVoltageV: number;
  bodyCurrentA: number;
  residualA: number;
  rcdTrips: boolean;
  /** Who interrupts and when [s] (Infinity = nobody within the scenario → «до кінця сценарію»). */
  clearedBy: 'mcb' | 'rcd' | null;
  clearTimeS: number;
  /** Exposure of the person [s] (capped at the 5 s scenario). */
  exposureS: number;
  zone: ShockZone;
  cannotLetGo: boolean;
  /** Time at which the point enters AC-4 (Infinity if never within the exposure). */
  fibrillationAtS: number;
}

export function shockScenario(p: ShockParams): ShockResult {
  const zs = FAULT_LOOP.zExtOhm + 2 * R_PE_OHM;
  const touching = p.person !== 'none';
  const rExt = p.person === 'none' ? Infinity : R_EXT_OHM[p.person];
  let faultA = 0;
  let uT = 0;
  let bodyA: number;
  let mcbS = Infinity;
  if (p.person === 'lineNeutral') {
    // body between L and N: an ordinary load for the RCD
    bodyA = FAULT_LOOP.phaseV / R_BODY_OHM;
  } else if (p.peConnected) {
    faultA = FAULT_LOOP.phaseV / zs;
    uT = faultA * R_PE_OHM;
    mcbS = mcbTripTime(faultA, FAULT_LOOP.breakerA, 'C').timeS;
    // with PE the tap and the enclosure are bonded: 0 V between them
    bodyA = touching && p.person !== 'tap' ? uT / (R_BODY_OHM + rExt) : 0;
  } else {
    uT = FAULT_LOOP.phaseV;
    bodyA = touching ? FAULT_LOOP.phaseV / (R_BODY_OHM + rExt) : 0;
  }
  const residualA = (p.person === 'lineNeutral' ? 0 : bodyA) + p.backgroundA;
  const rcd = p.rcdA !== null && rcdTrips(residualA, p.rcdA);
  const rcdS = rcd ? RCD_TRIP_TIME_S : Infinity;
  const clearTimeS = Math.min(mcbS, rcdS);
  const clearedBy = !Number.isFinite(clearTimeS) ? null : mcbS <= rcdS ? 'mcb' : 'rcd';
  const exposureS = touching ? Math.min(SCENARIO_S, clearTimeS) : 0;
  const t4 = timeToFibrillationZoneS(bodyA);
  return {
    faultCurrentA: faultA,
    touchVoltageV: uT,
    bodyCurrentA: bodyA,
    residualA,
    rcdTrips: rcd,
    clearedBy,
    clearTimeS,
    exposureS,
    zone: shockZone(bodyA, Math.max(exposureS, 1e-3)),
    cannotLetGo: bodyA >= LET_GO_A,
    fibrillationAtS: t4 <= exposureS ? t4 : Infinity,
  };
}

/** RCD «TEST» button: artificial leakage 2·IΔn → trips. */
export function rcdTest(rcdA: number): boolean {
  return rcdTrips(2 * rcdA, rcdA);
}
