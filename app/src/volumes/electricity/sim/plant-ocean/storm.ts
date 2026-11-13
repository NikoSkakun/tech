/**
 * `plant-ocean` step 7 «Шторм» (illustrative, numbers chosen by S3-sim — the document gives none):
 * H_s ramps 2 → 10 m over 10 s; mooring load ∝ H_s² relative to the design limit reached at H_s = 6 m; survival
 * mode (device locked / submerged) cuts the load to 30 % and the power to zero above H_s = 5 m.
 */
import { wavePowerWPerM } from './sea';

export const STORM = {
  fromHs: 2,
  toHs: 10,
  rampS: 10,
  limitHs: 6,
  survivalLoad: 0.3,
  survivalFromHs: 5,
} as const;

export function stormHs(tS: number): number {
  const x = Math.min(1, Math.max(0, tS / STORM.rampS));
  return STORM.fromHs + (STORM.toHs - STORM.fromHs) * x;
}

export interface StormState {
  hsM: number;
  /** Mooring load relative to the limit (> 1 → damage). */
  loadRel: number;
  damaged: boolean;
  /** Device power capture relative to calm operation (0 in survival mode). */
  capture: number;
  /** Incident wave power, kW/m. */
  waveKwPerM: number;
}

export function createStorm(survival: boolean) {
  let surv = survival;
  const state: StormState & { timeS: number } = {
    timeS: 0,
    hsM: STORM.fromHs,
    loadRel: 0,
    damaged: false,
    capture: 1,
    waveKwPerM: 0,
  };
  function update(): void {
    state.hsM = stormHs(state.timeS);
    const protectedMode = surv && state.hsM >= STORM.survivalFromHs;
    state.loadRel = (state.hsM / STORM.limitHs) ** 2 * (protectedMode ? STORM.survivalLoad : 1);
    if (state.loadRel > 1) state.damaged = true;
    state.capture = protectedMode || state.damaged ? 0 : 1;
    state.waveKwPerM = wavePowerWPerM(state.hsM, 8) / 1000;
  }
  update();
  return {
    state,
    step(dt: number): void {
      state.timeS += Math.max(0, dt);
      update();
    },
    setSurvival(on: boolean): void {
      surv = on;
      update();
    },
    /** «Відновити». */
    repair(): void {
      state.timeS = 0;
      state.damaged = false;
      update();
    },
  };
}
