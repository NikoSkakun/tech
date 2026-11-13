/**
 * distribution Р4 (step 5) — broken neutral. Three resistive loads R_k = (230 V)²/P_k (P_k = 0 → open branch) on the
 * source 230 V·(1, a, a²). Neutral-point shift U_N' = Σ(U_k/R_k)/Σ(1/R_k); load voltage |U_k − U_N'|.
 * Appliance burns if U > 280 V for longer than 0,5 s; the voltage relay disconnects a house at U > 255 V or
 * U < 170 V after 0,2 s. Loads are constant resistors (real electronics differs, but the trends are the same).
 */
import { cAbs, cAdd, complex, cScale, cSub, type Complex } from '@electricity/sim/core/S1-sim';
import { phaseRotor, type Phase } from '@electricity/sim/core/S2-sim/voltageDrop';

const ZERO: Complex = complex(0);

export const NEUTRAL = { phaseV: 230, burnV: 280, burnS: 0.5, relayHighV: 255, relayLowV: 170, relayS: 0.2 } as const;

export interface NeutralBreakResult {
  /** Voltage across each load [V] (for an open branch: the voltage that would appear across it, |U_k − U_N'|). */
  loadV: number[];
  neutralShiftV: number;
  /** Lamp brightness ∝ U² relative to 230 V (0 for an open branch). */
  brightness: number[];
}

/** `brokenNeutral = false` → every load sits at 230 V. */
export function solveNeutralBreak(powersW: readonly [number, number, number], brokenNeutral = true): NeutralBreakResult {
  const src = ([0, 1, 2] as Phase[]).map((p) => cScale(phaseRotor(p), NEUTRAL.phaseV));
  let num: Complex = ZERO;
  let den = 0;
  powersW.forEach((p, k) => {
    if (p > 0) {
      const g = p / NEUTRAL.phaseV ** 2;
      num = cAdd(num, cScale(src[k]!, g));
      den += g;
    }
  });
  const un = brokenNeutral && den > 0 ? cScale(num, 1 / den) : ZERO;
  const loadV = src.map((u) => cAbs(cSub(u, un)));
  return {
    loadV,
    neutralShiftV: cAbs(un),
    brightness: loadV.map((u, k) => (powersW[k]! > 0 ? (u / NEUTRAL.phaseV) ** 2 : 0)),
  };
}

export interface NeutralHouseState {
  voltageV: number;
  /** Disconnected by the voltage relay. */
  relayTripped: boolean;
  /** Appliance destroyed (> 280 V for > 0,5 s). */
  burnt: boolean;
  overTimerS: number;
  relayTimerS: number;
}

/** Time-domain watcher for the three houses (relay and damage timers). */
export function createNeutralWatch(relayEnabled: boolean) {
  const fresh = (): NeutralHouseState => ({ voltageV: NEUTRAL.phaseV, relayTripped: false, burnt: false, overTimerS: 0, relayTimerS: 0 });
  let houses = [fresh(), fresh(), fresh()];
  return {
    get houses(): readonly NeutralHouseState[] {
      return houses;
    },
    step(dtS: number, voltagesV: readonly number[]) {
      houses = houses.map((h, k) => {
        const u = h.relayTripped ? 0 : voltagesV[k]!;
        const n = { ...h, voltageV: u };
        if (u > NEUTRAL.burnV) n.overTimerS += dtS;
        else n.overTimerS = 0;
        if (n.overTimerS > NEUTRAL.burnS) n.burnt = true;
        const bad = u > NEUTRAL.relayHighV || (u > 0 && u < NEUTRAL.relayLowV);
        n.relayTimerS = relayEnabled && bad ? n.relayTimerS + dtS : 0;
        if (n.relayTimerS >= NEUTRAL.relayS) n.relayTripped = true;
        return n;
      });
    },
    reset() {
      houses = [fresh(), fresh(), fresh()];
    },
  };
}
