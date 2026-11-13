/**
 * `transformer` Т2 (step `why-high-voltage`): 100 km three-phase line, R = 10 Ω/phase, cos φ = 1, P delivered
 * (10…500 MW), U line voltage at the city: I = P/(√3U), P_loss = 3I²R, loss % = P_loss/P, ΔU = √3IR/U;
 * ΔU > 15 % → «неможливо». Wire colour T = 20 °C + 50 K·min(1, P_loss/P_loss,110kV).
 * Т3 (step `anatomy`, IEC 60076-7 steady state, ONAN): θ_oil = θ_amb + Δθ_or·((1 + Rβ²)/(1 + R))^x, Δθ_or = 55 K,
 * R = 5, x = 0,8, θ_amb = 20 °C; fans (ONAF) on when the fan-less value > 70 °C, off below 65 °C (hysteresis),
 * fans scale Δθ_or by 0,75; the thermometer approaches the target exponentially with τ = 3 s (scene).
 */
import { clamp } from '../core/S1-sim/math';

export const TRANSMISSION = {
  phaseOhm: 10,
  voltagesKV: [10, 35, 110, 220, 330, 500, 750] as const,
  powerRangeMW: { min: 10, max: 500, step: 10, default: 100 },
  maxDropFraction: 0.15,
  referenceKV: 110,
} as const;

export interface TransmissionResult {
  currentA: number;
  lossW: number;
  lossFraction: number;
  dropFraction: number;
  /** ΔU > 15 %: the line cannot deliver this power (do not show P_loss). */
  impossible: boolean;
  stationW: number;
  wireTemperatureC: number;
}

function rawTransmission(powerW: number, lineKV: number): { i: number; loss: number; drop: number } {
  const u = lineKV * 1e3;
  const i = powerW / (Math.sqrt(3) * u);
  return { i, loss: 3 * i * i * TRANSMISSION.phaseOhm, drop: (Math.sqrt(3) * i * TRANSMISSION.phaseOhm) / u };
}

export function transmission(powerMW: number, lineKV: number): TransmissionResult {
  const p = clamp(powerMW, TRANSMISSION.powerRangeMW.min, TRANSMISSION.powerRangeMW.max) * 1e6;
  const r = rawTransmission(p, lineKV);
  const ref = rawTransmission(p, TRANSMISSION.referenceKV).loss;
  return {
    currentA: r.i,
    lossW: r.loss,
    lossFraction: r.loss / p,
    dropFraction: r.drop,
    impossible: r.drop > TRANSMISSION.maxDropFraction,
    stationW: p + r.loss,
    wireTemperatureC: 20 + 50 * Math.min(1, r.loss / ref),
  };
}

export const OIL = { ambientC: 20, topOilRiseK: 55, lossRatio: 5, exponent: 0.8, fanFactor: 0.75, fanOnC: 70, fanOffC: 65, thermometerTauS: 3, loadRange: { min: 0, max: 1.2, step: 0.05, default: 0.6 } } as const;

/** Steady top-oil temperature, °C. */
export function topOilTemperatureC(loadPu: number, fans: boolean): number {
  const b = Math.max(loadPu, 0);
  return OIL.ambientC + OIL.topOilRiseK * (fans ? OIL.fanFactor : 1) * Math.pow((1 + OIL.lossRatio * b * b) / (1 + OIL.lossRatio), OIL.exponent);
}

export interface OilState {
  loadPu: number;
  fansOn: boolean;
  /** Steady-state target, °C. */
  targetC: number;
  /** Thermometer reading, °C. */
  thermometerC: number;
}

export interface OilModel {
  readonly state: OilState;
  step(dt: number): OilState;
  setLoad(loadPu: number): void;
}

export function createOilThermal(loadPu: number = OIL.loadRange.default): OilModel {
  const state = { loadPu, fansOn: false, targetC: 0, thermometerC: 0 } as OilState;
  const update = (): void => {
    const noFan = topOilTemperatureC(state.loadPu, false);
    if (!state.fansOn && noFan > OIL.fanOnC) state.fansOn = true;
    else if (state.fansOn && noFan < OIL.fanOffC) state.fansOn = false;
    state.targetC = topOilTemperatureC(state.loadPu, state.fansOn);
  };
  update();
  state.thermometerC = state.targetC;
  return {
    state,
    step(dt: number): OilState {
      update();
      state.thermometerC = state.targetC + (state.thermometerC - state.targetC) * Math.exp(-Math.max(dt, 0) / OIL.thermometerTauS);
      return state;
    },
    setLoad(b: number): void {
      state.loadPu = clamp(b, OIL.loadRange.min, OIL.loadRange.max);
      update();
    },
  };
}
