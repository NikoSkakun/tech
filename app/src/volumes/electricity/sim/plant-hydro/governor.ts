/**
 * plant-hydro M5 (step 6) — hydro turbine response to the gate (non-minimum phase, water inertia T_w = 1,5 s):
 *   dy/dt = (G − y)/(0,5·T_w), P_m = 3y − 2G  (= (1 − T_w s)/(1 + 0,5 T_w s)); opening 0,8 → 0,9 at t = 0 («різко»)
 *   or as a 10 s ramp («плавно»). Generator speed n = 3000/p rpm. Black-start scenario (step 6, ≈ 90 s).
 */
import { clamp, FixedStepper } from '@electricity/sim/core/S2-sim/math';

export const WATER_TIME_S = 1.5;

/** Analytic response to a gate step g0 → g1 at t = 0. */
export function stepResponse(g0: number, g1: number, tS: number): number {
  if (tS < 0) return g0;
  const y = g1 + (g0 - g1) * Math.exp(-tS / (0.5 * WATER_TIME_S));
  return 3 * y - 2 * g1;
}

/** Time-domain governor: set the gate (or a ramp) and step; fixed 0,5 ms internal step. */
export function createHydroTurbine(initialGate = 0.8) {
  const h = 0.0005;
  const stepper = new FixedStepper(h);
  let y = initialGate;
  let gate = initialGate;
  let rampFrom = initialGate;
  let rampTo = initialGate;
  let rampS = 0;
  let t = 0;
  let rampStart = 0;
  const gateAt = (time: number) => (rampS <= 0 ? rampTo : rampFrom + (rampTo - rampFrom) * clamp((time - rampStart) / rampS, 0, 1));
  return {
    get timeS() {
      return t;
    },
    get gate() {
      return gate;
    },
    get mechanicalPower() {
      return 3 * y - 2 * gate;
    },
    /** Move the gate to `target` over `rampS` seconds (0 = instantaneous). */
    command(target: number, rampSeconds = 0) {
      rampFrom = gate;
      rampTo = clamp(target, 0, 1);
      rampS = Math.max(0, rampSeconds);
      rampStart = t;
      if (rampS === 0) gate = rampTo;
    },
    step(dtS: number) {
      const n = stepper.advance(dtS);
      for (let i = 0; i < n; i++) {
        gate = gateAt(t);
        y += (h * (gate - y)) / (0.5 * WATER_TIME_S);
        t += h;
        gate = gateAt(t);
      }
    },
  };
}

/** n = 60·f/p = 3000/p rpm at 50 Hz. */
export function generatorRpm(polePairs: number): number {
  return 3000 / Math.max(1, Math.round(polePairs));
}

export type BlackStartPhase = 'diesel' | 'spinUp' | 'excitation' | 'synchronised' | 'restoring' | 'done';

/** Black-start scenario state at t [s]: phase, gate opening, speed [%], substations energised (0…5). */
export function blackStartScenario(tS: number): { phase: BlackStartPhase; gate: number; speedPct: number; substations: number } {
  const speed = tS <= 2 ? 0 : 100 * (1 - Math.exp(-(tS - 2) / 8));
  const gate = tS <= 2 ? 0 : 0.15 * clamp((tS - 2) / 28, 0, 1);
  const substations = tS < 40 ? 0 : Math.min(5, Math.floor((tS - 40) / 10) + 1);
  const phase: BlackStartPhase =
    tS < 2 ? 'diesel' : tS < 30 ? 'spinUp' : tS < 35 ? 'excitation' : tS < 40 ? 'synchronised' : tS < 90 ? 'restoring' : 'done';
  return { phase, gate, speedPct: speed, substations };
}
