/**
 * `matter` «Модель симуляції» §2 (step `electron-sea`) — visual Drude gas: N = 600 electrons in a periodic box
 * L = 7,2 nm (20 Cu cells), all with speed v_F = 1,57×10⁶ m/s in random isotropic directions; Poisson
 * scattering with mean τ(T) = τ₂₀·ρ₂₀/ρ(T), τ₂₀ = 2,5×10⁻¹⁴ s → new random direction.
 * Scene time: 1 s scene = 2×10⁻¹⁵ s real. True drift v_d = e·τ·E/m_e; visual drift v_vis = v_d × 10⁸ (chip
 * «дрейф збільшено ×10⁸»), electrons drift against E (along −x for E along +x).
 */
import { ELEMENTARY_CHARGE_C } from '../core/S1-sim/constants';
import { clamp, subStepCount } from '../core/S1-sim/math';
import { exponentialSample, randomUnitVector, toRandomSource, type RandomSource } from '../core/S1-sim/rng';
import { METALS, resistivityOhmM } from './materials';

/** The document's §1 m_e = 9,109×10⁻³¹ kg. */
const ELECTRON_MASS_DOC_KG = 9.109e-31;

export const ELECTRON_GAS = {
  count: 600,
  boxNm: 7.2,
  fermiSpeedMPerS: 1.57e6,
  tau20S: 2.5e-14,
  realSecondsPerSceneSecond: 2e-15,
  driftExaggeration: 1e8,
  fieldRange: { min: 0, max: 1, step: 0.05, default: 0.2 },
  temperatureRange: { min: 20, max: 300 },
} as const;

/** τ(T) = τ₂₀·ρ₂₀/ρ(T) for copper, s. */
export function scatteringTimeS(temperatureC: number): number {
  return (ELECTRON_GAS.tau20S * METALS.Cu.resistivity20OhmM) / resistivityOhmM('Cu', temperatureC);
}

/** v_d = e·τ·E/m_e, m/s, and v_d/v_F. */
export function driftVelocity(fieldVPerM: number, temperatureC = 20): { driftMPerS: number; ratioToFermi: number; oneIn: number } {
  const vd = (ELEMENTARY_CHARGE_C * scatteringTimeS(temperatureC) * fieldVPerM) / ELECTRON_MASS_DOC_KG;
  const ratio = vd / ELECTRON_GAS.fermiSpeedMPerS;
  return { driftMPerS: vd, ratioToFermi: ratio, oneIn: ratio > 0 ? 1 / ratio : Infinity };
}

export interface ElectronGasParams {
  fieldVPerM: number;
  temperatureC: number;
}

export interface ElectronGas {
  /** Positions in nm inside [0, L)³, flat xyz. */
  readonly positions: Float32Array;
  /** Unit velocity directions, flat xyz. */
  readonly directions: Float32Array;
  /** Number of scattering events in the last step (for sparkles / audio). */
  scatteredLastStep: number;
  step(dtScene: number): void;
  set(params: Partial<ElectronGasParams>): void;
  /** Accumulated visual drift along x since creation, nm (negative: electrons move against E). */
  readonly driftOffsetNm: () => number;
}

export function createElectronGas(params: Partial<ElectronGasParams> = {}, rng: RandomSource | number = 3): ElectronGas {
  const r = toRandomSource(rng);
  const p: ElectronGasParams = { fieldVPerM: 0, temperatureC: 20, ...params };
  const n = ELECTRON_GAS.count;
  const L = ELECTRON_GAS.boxNm;
  const positions = new Float32Array(n * 3);
  const directions = new Float32Array(n * 3);
  const nextScatter = new Float64Array(n);
  const meanScene = (): number => scatteringTimeS(p.temperatureC) / ELECTRON_GAS.realSecondsPerSceneSecond;
  for (let i = 0; i < n; i++) {
    positions[3 * i] = r.next() * L;
    positions[3 * i + 1] = r.next() * L;
    positions[3 * i + 2] = r.next() * L;
    directions.set(randomUnitVector(r), 3 * i);
    nextScatter[i] = exponentialSample(r, meanScene());
  }
  let drift = 0;
  const gas: ElectronGas = {
    positions,
    directions,
    scatteredLastStep: 0,
    driftOffsetNm: () => drift,
    step(dtScene: number): void {
      const steps = subStepCount(dtScene, 0.05, 20);
      const h = dtScene / Math.max(steps, 1);
      // nm per scene second: v[m/s] × 2×10⁻¹⁵ s × 10⁹ nm/m
      const k = ELECTRON_GAS.realSecondsPerSceneSecond * 1e9;
      const speed = ELECTRON_GAS.fermiSpeedMPerS * k;
      const vVis = -driftVelocity(p.fieldVPerM, p.temperatureC).driftMPerS * ELECTRON_GAS.driftExaggeration * k;
      let scattered = 0;
      for (let s = 0; s < steps; s++) {
        drift += vVis * h;
        for (let i = 0; i < n; i++) {
          nextScatter[i] -= h;
          if (nextScatter[i] <= 0) {
            directions.set(randomUnitVector(r), 3 * i);
            nextScatter[i] += exponentialSample(r, meanScene());
            scattered++;
          }
          for (let c = 0; c < 3; c++) {
            let x = positions[3 * i + c] + (speed * directions[3 * i + c] + (c === 0 ? vVis : 0)) * h;
            x -= Math.floor(x / L) * L;
            positions[3 * i + c] = x;
          }
        }
      }
      gas.scatteredLastStep = scattered;
    },
    set(next: Partial<ElectronGasParams>): void {
      Object.assign(p, next);
      p.fieldVPerM = clamp(p.fieldVPerM, ELECTRON_GAS.fieldRange.min, ELECTRON_GAS.fieldRange.max);
      p.temperatureC = clamp(p.temperatureC, -100, 300);
    },
  };
  return gas;
}
