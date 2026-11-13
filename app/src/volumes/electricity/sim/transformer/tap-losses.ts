/**
 * `transformer` Т4 (step `tap-changer`): 115/11 kV, taps n ∈ [−9, 9], Δ = 1,78 % (linearised 1 + Δn),
 * U_LV = U_HV·(11/115)·(1 + Δn) − 0,05·β·10,5 kV. Regulator: set point 10,5 kV ± 1 %; > 10,605 → n −= 1,
 * < 10,395 → n += 1; 1,5 s between steps (scene). Manual mode: ▲/▼.
 * Т5 (step `losses-efficiency`): η(β) = βS_n·cos φ/(βS_n·cos φ + P₀ + β²P_k), S_n = 400 kVA, cos φ = 0,95;
 * old P₀ = 0,9 kW, P_k = 5,5 kW; modern P₀ = 0,387 kW, P_k = 3,25 kW; optimum β = √(P₀/P_k); annual no-load
 * losses P₀·8760 h. Eddy losses (classical, thin sheet): p = π²σd²f²B²/(6ρ_m) W/kg, σ = 2,08×10⁶ S/m,
 * B = 1,7 T, f = 50 Hz, ρ_m = 7650 kg/m³ ("оцінка" above 1 mm, skin effect ignored).
 */
import { clamp } from '../core/S1-sim/math';

export const TAP = { ratio: 11 / 115, stepFraction: 0.0178, minTap: -9, maxTap: 9, dropKVPerPu: 0.05 * 10.5, setpointKV: 10.5, bandFraction: 0.01, stepDelayS: 1.5, hvRangeKV: { min: 100, max: 121, step: 0.5, default: 115 }, loadRange: { min: 0, max: 1, step: 0.05, default: 0.5 } } as const;

export const lowVoltageKV = (hvKV: number, loadPu: number, tap: number): number => hvKV * TAP.ratio * (1 + TAP.stepFraction * tap) - TAP.dropKVPerPu * loadPu;

const upper = TAP.setpointKV * (1 + TAP.bandFraction);
const lower = TAP.setpointKV * (1 - TAP.bandFraction);

/** One regulator decision: −1, 0 or +1 tap. */
export function regulatorDecision(lvKV: number, tap: number): -1 | 0 | 1 {
  if (lvKV > upper + 1e-12 && tap > TAP.minTap) return -1;
  if (lvKV < lower - 1e-12 && tap < TAP.maxTap) return 1;
  return 0;
}

/** Final tap reached by the automatic regulator starting from `tap0` (steady state, no delays). */
export function autoTapSteadyState(hvKV: number, loadPu: number, tap0 = 0): { tap: number; lvKV: number } {
  let tap = tap0;
  for (let k = 0; k < 40; k++) {
    const d = regulatorDecision(lowVoltageKV(hvKV, loadPu, tap), tap);
    if (d === 0) break;
    tap += d;
  }
  return { tap, lvKV: lowVoltageKV(hvKV, loadPu, tap) };
}

export interface TapChangerState {
  tap: number;
  lvKV: number;
  inBand: boolean;
  /** Seconds until the regulator may act again. */
  cooldownS: number;
  /** True on the step a tap change happened (click sound / selector animation). */
  changed: boolean;
}

export interface TapChanger {
  readonly state: TapChangerState;
  step(dt: number, inputs: { hvKV: number; loadPu: number; auto: boolean }): TapChangerState;
  /** Manual ▲/▼. */
  manual(direction: 1 | -1, inputs: { hvKV: number; loadPu: number }): TapChangerState;
}

export function createTapChanger(initialTap = 0): TapChanger {
  const state: TapChangerState = { tap: initialTap, lvKV: 0, inBand: true, cooldownS: 0, changed: false };
  const publish = (hv: number, load: number): void => {
    state.lvKV = lowVoltageKV(hv, load, state.tap);
    state.inBand = state.lvKV >= lower - 1e-12 && state.lvKV <= upper + 1e-12;
  };
  return {
    state,
    step(dt, { hvKV, loadPu, auto }): TapChangerState {
      state.changed = false;
      state.cooldownS = Math.max(state.cooldownS - Math.max(dt, 0), 0);
      publish(hvKV, loadPu);
      if (auto && state.cooldownS === 0) {
        const d = regulatorDecision(state.lvKV, state.tap);
        if (d !== 0) {
          state.tap += d;
          state.cooldownS = TAP.stepDelayS;
          state.changed = true;
          publish(hvKV, loadPu);
        }
      }
      return state;
    },
    manual(direction, { hvKV, loadPu }): TapChangerState {
      state.tap = clamp(state.tap + direction, TAP.minTap, TAP.maxTap);
      state.changed = true;
      publish(hvKV, loadPu);
      return state;
    },
  };
}

export const DISTRIBUTION_TRANSFORMERS = {
  old: { noLoadKW: 0.9, loadLossKW: 5.5 },
  modern: { noLoadKW: 0.387, loadLossKW: 3.25 },
} as const;
export const LOSSES_RATED_KVA = 400;
export const LOSSES_POWER_FACTOR = 0.95;
export type TransformerGeneration = keyof typeof DISTRIBUTION_TRANSFORMERS;

export function transformerEfficiency(generation: TransformerGeneration, loadPu: number): { efficiency: number; noLoadKW: number; loadLossKW: number; outputKW: number } {
  const t = DISTRIBUTION_TRANSFORMERS[generation];
  const out = loadPu * LOSSES_RATED_KVA * LOSSES_POWER_FACTOR;
  const pk = loadPu * loadPu * t.loadLossKW;
  return { efficiency: out > 0 ? out / (out + t.noLoadKW + pk) : 0, noLoadKW: t.noLoadKW, loadLossKW: pk, outputKW: out };
}

export function optimumLoad(generation: TransformerGeneration): { loadPu: number; efficiency: number; annualNoLoadKWh: number } {
  const t = DISTRIBUTION_TRANSFORMERS[generation];
  const b = Math.sqrt(t.noLoadKW / t.loadLossKW);
  return { loadPu: b, efficiency: transformerEfficiency(generation, b).efficiency, annualNoLoadKWh: t.noLoadKW * 8760 };
}

export const EDDY_SHEET = { conductivitySPerM: 2.08e6, fluxDensityT: 1.7, frequencyHz: 50, densityKgM3: 7650, thicknessRangeMm: { min: 0.2, max: 3, step: 0.05, default: 0.25 }, estimateAboveMm: 1 } as const;

export function eddyLossWPerKg(thicknessMm: number): { wPerKg: number; estimateOnly: boolean } {
  const d = thicknessMm * 1e-3;
  const s = EDDY_SHEET;
  return { wPerKg: (Math.PI ** 2 * s.conductivitySPerM * d * d * s.frequencyHz ** 2 * s.fluxDensityT ** 2) / (6 * s.densityKgM3), estimateOnly: thicknessMm > s.estimateAboveMm };
}
