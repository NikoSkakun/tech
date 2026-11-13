/**
 * `lab-battery` §M7 — illustrative thermal-runaway model of one cell (oracle `thermal_model.py`).
 *
 * dT/dt = (T_oven − T)/τ + Σ_k ΔT_k·dα_k/dt,  dα_k/dt = r_k·exp(min(50, (T − T_k)/θ))·(1 − α_k) for T > T_k;
 * τ = 300 s, θ = 12 °C, explicit Euler dt = 0.5 s (model time; the UI accelerates ×30).
 * Runaway when T ≥ T_cathode ∧ self-heating > 10 °C/min; afterwards
 * T(t) = T_on + (T_peak − T_on)·(1 − exp(−(t − t_on)/τ_rise)).
 */
import type { Chemistry } from '../core/S3-sim/battery';

export const THERMAL_TAU_S = 300;
export const THERMAL_THETA_C = 12;
export const THERMAL_DT_S = 0.5;

export interface ThermalChem {
  /** Exothermic stages: onset T_k (°C), rate r_k (1/s), adiabatic rise ΔT_k (°C). */
  stages: readonly { tK: number; r: number; dT: number }[];
  separatorC: number;
  ventC: number;
  peakC: number;
  tauRiseS: number;
}

export const THERMAL_CHEM: Record<Chemistry, ThermalChem> = {
  NMC: {
    stages: [
      { tK: 90, r: 2e-5, dT: 30 },
      { tK: 165, r: 0.002, dT: 600 },
    ],
    separatorC: 130,
    ventC: 140,
    peakC: 750,
    tauRiseS: 5,
  },
  LFP: {
    stages: [
      { tK: 90, r: 1e-5, dT: 25 },
      { tK: 240, r: 0.001, dT: 250 },
    ],
    separatorC: 130,
    ventC: 180,
    peakC: 450,
    tauRiseS: 30,
  },
};

export type ThermalEvent = 'sei' | 'separator' | 'vent' | 'cathode' | 'runaway';

/** One cell; `step` advances by dt with a given ambient (oven) temperature and optional external heating. */
export class ThermalCell {
  readonly chem: Chemistry;
  timeS = 0;
  tempC: number;
  alpha: number[];
  /** Self-heating rate of the last step, °C/s. */
  selfHeatingCPerS = 0;
  /** Model time at which each event was first reached (start of the step, as in the oracle). */
  events: Partial<Record<ThermalEvent, number>> = {};
  /** T at runaway onset. */
  onsetC: number | null = null;

  constructor(chem: Chemistry, t0C = 25) {
    this.chem = chem;
    this.tempC = t0C;
    this.alpha = THERMAL_CHEM[chem].stages.map(() => 0);
  }

  get runaway(): boolean {
    return this.onsetC !== null;
  }

  /** Force the runaway state now (module propagation: cell 1 starts in runaway). */
  igniteAt(onsetC: number): void {
    this.onsetC = onsetC;
    this.tempC = onsetC;
    this.events.runaway = this.timeS;
  }

  step(dt: number, ovenC: number, extraCPerS = 0): void {
    const p = THERMAL_CHEM[this.chem];
    const t0 = this.timeS;
    if (this.onsetC !== null) {
      const tOn = this.events.runaway!;
      // Oracle order: the curve is evaluated at the step's start time, then time advances.
      this.tempC = this.onsetC + (p.peakC - this.onsetC) * (1 - Math.exp(-(t0 - tOn) / p.tauRiseS));
      this.timeS += dt;
      return;
    }
    let sh = 0;
    p.stages.forEach((s, k) => {
      if (this.tempC > s.tK) {
        const da = s.r * Math.exp(Math.min(50, (this.tempC - s.tK) / THERMAL_THETA_C)) * (1 - this.alpha[k]!);
        this.alpha[k] = Math.min(1, this.alpha[k]! + da * dt);
        sh += s.dT * da;
      }
    });
    this.selfHeatingCPerS = sh;
    this.tempC += ((ovenC - this.tempC) / THERMAL_TAU_S + sh + extraCPerS) * dt;
    const marks: [ThermalEvent, number][] = [
      ['sei', p.stages[0]!.tK],
      ['separator', p.separatorC],
      ['vent', p.ventC],
      ['cathode', p.stages[1]!.tK],
    ];
    for (const [name, th] of marks)
      if (this.events[name] === undefined && this.tempC >= th) this.events[name] = t0;
    if (this.tempC >= p.stages[1]!.tK && sh * 60 > 10) {
      this.events.runaway = t0;
      this.onsetC = this.tempC;
    }
    this.timeS += dt;
  }
}
