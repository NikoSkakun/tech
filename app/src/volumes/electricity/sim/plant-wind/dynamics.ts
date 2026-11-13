/**
 * `plant-wind` step 7 time-domain turbine (gust, storm, pitch lag), step 6 drivetrain readouts.
 *
 * Gust (M4): v(t) = v₀ + 6·sin(π·t/2 s) for t < 1 s, then v₀ + 6·exp(−(t − 1 s)/1.5 s); P limited to P_r;
 * pitch follows its target with a first-order lag τ = 0.5 s. Storm: v rises smoothly to 28 m/s (rate not specified
 * by the document — 5 s smoothstep, see audit).
 */
import { TURBINE_6MW, pitchDeg, rotorRpm, turbinePowerW, type TurbineSpec } from '../core/S3-sim/wind';

export const GUST_DV = 6;
export const PITCH_TAU_S = 0.5;
export const STORM_TARGET_MS = 28;
export const STORM_RAMP_S = 5;

/** Gust increment Δv(t) after the button press, m/s (t = 0.5 → 4.24, 1 → 6.00, 2.5 → 2.21). */
export function gustIncrement(tS: number): number {
  if (tS < 0) return 0;
  if (tS < 1) return GUST_DV * Math.sin((Math.PI * tS) / 2);
  return GUST_DV * Math.exp(-(tS - 1) / 1.5);
}

export interface TurbineSimState {
  timeS: number;
  vMs: number;
  powerW: number;
  rpm: number;
  /** Actual pitch (lagged), degrees. */
  pitchDeg: number;
  pitchTargetDeg: number;
  /** Zone of the power curve: I below cut-in, II partial load, III rated, IV storm/cut-out. */
  zone: 'I' | 'II' | 'III' | 'IV';
}

export function createTurbineSim(init: { vMs?: number; stormControl?: boolean; turbine?: TurbineSpec } = {}) {
  const t = init.turbine ?? TURBINE_6MW;
  let v0 = init.vMs ?? 7;
  let storm = init.stormControl ?? false;
  let gustT = -1;
  let stormT = -1;
  let stormFrom = v0;
  const state: TurbineSimState = {
    timeS: 0,
    vMs: v0,
    powerW: 0,
    rpm: 0,
    pitchDeg: 0,
    pitchTargetDeg: 0,
    zone: 'I',
  };

  function windNow(): number {
    let v = v0;
    if (stormT >= 0) {
      const x = Math.min(1, (state.timeS - stormT) / STORM_RAMP_S);
      v = stormFrom + (STORM_TARGET_MS - stormFrom) * x * x * (3 - 2 * x);
    }
    if (gustT >= 0) v += gustIncrement(state.timeS - gustT);
    return v;
  }

  function readout(): void {
    const v = state.vMs;
    state.powerW = turbinePowerW(t, v, storm);
    state.rpm = rotorRpm(t, v, storm);
    state.pitchTargetDeg = pitchDeg(t, v, storm);
    state.zone = v < t.vInMs ? 'I' : v >= t.vOutMs ? 'IV' : state.powerW < t.ratedW - 1 ? 'II' : 'III';
  }

  state.vMs = windNow();
  readout();
  state.pitchDeg = state.pitchTargetDeg;

  return {
    state,
    step(dt: number): void {
      let rem = dt;
      while (rem > 1e-12) {
        const h = Math.min(rem, 0.02);
        rem -= h;
        state.timeS += h;
        if (gustT >= 0 && state.timeS - gustT > 12) gustT = -1;
        state.vMs = windNow();
        readout();
        state.pitchDeg += (state.pitchTargetDeg - state.pitchDeg) * (1 - Math.exp(-h / PITCH_TAU_S));
      }
    },
    setWind(vMs: number): void {
      v0 = Math.max(0, vMs);
      stormT = -1;
    },
    setStormControl(on: boolean): void {
      storm = on;
    },
    gust(): void {
      gustT = state.timeS;
    },
    storm(): void {
      stormFrom = v0;
      stormT = state.timeS;
    },
    reset(): void {
      gustT = -1;
      stormT = -1;
      state.timeS = 0;
      state.vMs = windNow();
      readout();
      state.pitchDeg = state.pitchTargetDeg;
    },
  };
}

/* ------------------------------------------------ step 6 drivetrains ------------------------------------- */

/**
 * Illustrative drivetrain constants (the document fixes only f = p·n/60, «hundreds of pole pairs» for direct drive,
 * ~1:30–40 for medium speed, converter ≈ ⅓ for DFIG): see audit.
 */
export const DRIVETRAINS = {
  A_DFIG: { gearRatio: 120, polePairs: 2, converterShare: 0.3, label: 'DFIG' },
  B_DIRECT: { gearRatio: 1, polePairs: 100, converterShare: 1, label: 'Direct drive PMSG' },
  C_MEDIUM: { gearRatio: 35, polePairs: 12, converterShare: 1, label: 'Medium-speed PMSG' },
} as const;
export type DrivetrainId = keyof typeof DRIVETRAINS;

/** Rotor rpm, generator rpm, raw generator frequency f = p·n/60 (DFIG: rotor-circuit slip frequency), output 50 Hz. */
export function drivetrain(id: DrivetrainId, vMs: number, t: TurbineSpec = TURBINE_6MW) {
  const d = DRIVETRAINS[id];
  const rotor = rotorRpm(t, vMs);
  const gen = rotor * d.gearRatio;
  const fGen = (d.polePairs * gen) / 60;
  const rawHz = id === 'A_DFIG' ? Math.abs(50 - fGen) : fGen;
  return {
    rotorRpm: rotor,
    generatorRpm: gen,
    rawFrequencyHz: rawHz,
    outputHz: rotor > 0 ? 50 : 0,
    converterShare: d.converterShare,
  };
}
