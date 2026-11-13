/**
 * `charge-field` «Модель симуляції» §7 (step `bridge-to-matter`): supercapacitor 10 F at U₀ = 2,7 V discharging
 * through a lamp R = 2 Ω: U(t) = U₀·e^(−t/τ), τ = RC = 20 s; scene time ×4 (chip «прискорено ×4»).
 * Lamp brightness ∝ (U/U₀)² (= P/P₀), visually off below 0,03. Switch open → U holds; «Зарядити знову» → U₀.
 */
import { rcDischarge } from '../core/S1-sim/transient';

export const SUPERCAP = { initialV: 2.7, resistanceOhm: 2, capacitanceF: 10, sceneSpeedup: 4, lampOffBrightness: 0.03 } as const;

export interface DischargeState {
  closed: boolean;
  /** Model time since the last recharge (counts only while closed), s. */
  modelTimeS: number;
  voltageV: number;
  currentA: number;
  powerW: number;
  /** (U/U₀)² = P/P₀. */
  brightness: number;
  lampOn: boolean;
}

export interface Discharge {
  readonly state: DischargeState;
  /** dt in scene seconds; model time advances ×4. */
  step(dtScene: number): DischargeState;
  setClosed(closed: boolean): void;
  recharge(): void;
}

export function createDischarge(): Discharge {
  const state = {} as DischargeState;
  let closed = false;
  let t = 0;
  const publish = (): void => {
    const u = rcDischarge(SUPERCAP.initialV, SUPERCAP.resistanceOhm, SUPERCAP.capacitanceF, t);
    const b = (u / SUPERCAP.initialV) ** 2;
    Object.assign(state, {
      closed,
      modelTimeS: t,
      voltageV: u,
      currentA: closed ? u / SUPERCAP.resistanceOhm : 0,
      powerW: closed ? (u * u) / SUPERCAP.resistanceOhm : 0,
      brightness: closed ? b : 0,
      lampOn: closed && b >= SUPERCAP.lampOffBrightness,
    });
  };
  publish();
  return {
    state,
    step(dtScene: number): DischargeState {
      if (closed) t += Math.max(dtScene, 0) * SUPERCAP.sceneSpeedup;
      publish();
      return state;
    },
    setClosed(c: boolean): void {
      closed = c;
      publish();
    },
    recharge(): void {
      t = 0;
      publish();
    },
  };
}
