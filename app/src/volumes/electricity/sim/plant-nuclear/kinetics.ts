/**
 * plant-nuclear M3 (steps 4, 8, 9) — point kinetics (prompt jump, one delayed group) + primary heat balance; explicit
 * Euler with dt = 0,01 s (sub-stepped for any frame dt / time acceleration). M5 decay heat D(τ) (Way–Wigner).
 *   ρ = (scram ? ρ_scram : ρ_h·(h − h0)) + α·(T − T0), ρ ≤ 0,8β;  n = c·β/(β − ρ);  dc/dt = λ(n − c)
 *   auto scram: n > 1,07 or T > 330 °C;  P_th = scram ? P0·(0,94·n + D(t − t_s)) : P0·n
 *   Q = scram ? (cooling lost ? 0 : K·(T − T0)) : L·P0 + K·(T − T0)  (+ 50 MW for 600 s from the accumulators)
 *   dT/dt = (P_th − Q)/C_th;  P_e = scram ? 0 : 0,333·P_th;  T capped at 374 °C (critical point)
 *   D(τ) = 0,0622·(max(τ,1)^−0,2 − (max(τ,1) + T_op)^−0,2)
 * Rods move at 0,01 1/s; diesels restore Q 15 s after the button.
 */
import { clamp, FixedStepper } from '@electricity/sim/core/S2-sim/math';

export const REACTOR = {
  beta: 0.0065,
  lambda: 0.08,
  p0MW: 3000,
  cThMJperC: 1500,
  kMWperC: 100,
  alphaPerC: -3e-4,
  t0C: 305,
  rhoRods: 0.003,
  h0: 0.7,
  rodSpeed: 0.01,
  rhoScram: -0.05,
  tOperS: 3.1536e7,
  scramN: 1.07,
  scramTC: 330,
  boilingC: 345,
  uncoveringC: 370,
  maxTC: 374,
  dieselDelayS: 15,
  accumulatorMW: 50,
  accumulatorS: 600,
  dtS: 0.01,
} as const;

/** Decay heat fraction of the pre-scram power, Way–Wigner. */
export function decayHeatFraction(tauS: number): number {
  const t = Math.max(tauS, 1);
  return 0.0622 * (t ** -0.2 - (t + REACTOR.tOperS) ** -0.2);
}

/** Step 4 with delayed neutrons, constant ρ, no thermal feedback: n(t) = β/(β−ρ)·exp(λρt/(β−ρ)). */
export function delayedStepResponse(reactivityPcm: number, timeS: number): number {
  const rho = Math.min(reactivityPcm * 1e-5, 0.8 * REACTOR.beta);
  const b = REACTOR.beta;
  return (b / (b - rho)) * Math.exp((REACTOR.lambda * rho * timeS) / (b - rho));
}

export interface ReactorState {
  timeS: number;
  rodPosition: number;
  rodTarget: number;
  load: number;
  precursors: number;
  tempC: number;
  reactivity: number;
  n: number;
  thermalMW: number;
  heatRemovalMW: number;
  electricMW: number;
  scram: boolean;
  scramTimeS: number | null;
  scramReason: 'manual' | 'power' | 'temperature' | null;
  coolingLost: boolean;
  dieselsAtS: number | null;
  accumulatorUntilS: number | null;
  accumulatorUsed: boolean;
  alarm: 'none' | 'boiling' | 'uncovering';
}

function fresh(): ReactorState {
  const r = REACTOR;
  return {
    timeS: 0, rodPosition: r.h0, rodTarget: r.h0, load: 1, precursors: 1, tempC: r.t0C, reactivity: 0, n: 1,
    thermalMW: r.p0MW, heatRemovalMW: r.p0MW, electricMW: 0.333 * r.p0MW, scram: false, scramTimeS: null,
    scramReason: null, coolingLost: false, dieselsAtS: null, accumulatorUntilS: null, accumulatorUsed: false, alarm: 'none',
  };
}

export interface Reactor {
  readonly state: Readonly<ReactorState>;
  /** Rod lever h 0…1 (moves at 0,01 1/s) and load L 0,3…1. */
  set(p: { rodTarget?: number; load?: number }): void;
  scram(): void;
  loseCooling(): void;
  startDiesels(): void;
  /** Hydro-accumulators of the ECCS: +50 MW heat removal for 600 s, once. */
  accumulators(): void;
  /** «Відновити роботу»: back to 100 %, h = 0,70. */
  restore(): void;
  step(dtS: number): void;
}

export function createReactor(): Reactor {
  const r = REACTOR;
  let st = fresh();
  const stepper = new FixedStepper(r.dtS);
  const euler = (h: number) => {
    // rods
    const dh = clamp(st.rodTarget - st.rodPosition, -r.rodSpeed * h, r.rodSpeed * h);
    st.rodPosition += dh;
    if (st.dieselsAtS !== null && st.timeS >= st.dieselsAtS) {
      st.coolingLost = false;
      st.dieselsAtS = null;
    }
    const rho = Math.min((st.scram ? r.rhoScram : r.rhoRods * (st.rodPosition - r.h0)) + r.alphaPerC * (st.tempC - r.t0C), 0.8 * r.beta);
    const n = (st.precursors * r.beta) / (r.beta - rho);
    if (!st.scram && (n > r.scramN || st.tempC > r.scramTC)) {
      st.scram = true;
      st.scramTimeS = st.timeS;
      st.scramReason = n > r.scramN ? 'power' : 'temperature';
    }
    const p = st.scram ? r.p0MW * (0.94 * n + decayHeatFraction(st.timeS - st.scramTimeS!)) : r.p0MW * n;
    const acc = st.accumulatorUntilS !== null && st.timeS < st.accumulatorUntilS ? r.accumulatorMW : 0;
    const q = (st.scram ? (st.coolingLost ? 0 : r.kMWperC * (st.tempC - r.t0C)) : st.load * r.p0MW + r.kMWperC * (st.tempC - r.t0C)) + acc;
    st.precursors += h * r.lambda * (n - st.precursors);
    st.tempC = Math.min(r.maxTC, st.tempC + (h * (p - q)) / r.cThMJperC);
    st.reactivity = rho;
    st.n = n;
    st.thermalMW = p;
    st.heatRemovalMW = q;
    st.electricMW = st.scram ? 0 : 0.333 * p;
    st.timeS += h;
    st.alarm = st.tempC >= r.uncoveringC ? 'uncovering' : st.tempC >= r.boilingC ? 'boiling' : 'none';
  };
  const instantScram = (reason: ReactorState['scramReason']) => {
    if (st.scram) return;
    st.scram = true;
    st.scramTimeS = st.timeS;
    st.scramReason = reason;
    // prompt jump: the readouts change at once
    const rho = Math.min(r.rhoScram + r.alphaPerC * (st.tempC - r.t0C), 0.8 * r.beta);
    st.reactivity = rho;
    st.n = (st.precursors * r.beta) / (r.beta - rho);
    st.thermalMW = r.p0MW * (0.94 * st.n + decayHeatFraction(0));
    st.electricMW = 0;
  };
  return {
    get state() {
      return st;
    },
    set(p) {
      if (p.rodTarget !== undefined) st.rodTarget = clamp(p.rodTarget, 0, 1);
      if (p.load !== undefined) st.load = clamp(p.load, 0.3, 1);
    },
    scram: () => instantScram('manual'),
    loseCooling() {
      st.coolingLost = true;
      st.dieselsAtS = null;
    },
    startDiesels() {
      if (st.coolingLost && st.dieselsAtS === null) st.dieselsAtS = st.timeS + r.dieselDelayS;
    },
    accumulators() {
      if (!st.accumulatorUsed) {
        st.accumulatorUsed = true;
        st.accumulatorUntilS = st.timeS + r.accumulatorS;
      }
    },
    restore() {
      const t = st.timeS;
      st = fresh();
      st.timeS = t;
      stepper.reset();
    },
    step(dtS) {
      const k = stepper.advance(dtS);
      for (let i = 0; i < k; i++) euler(r.dtS);
    },
  };
}
