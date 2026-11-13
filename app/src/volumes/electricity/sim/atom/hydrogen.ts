/**
 * `atom` «Модель симуляції» §3 (step `ions-photons`) — hydrogen "photon gun".
 * Levels E_n = −13,598 eV/n², n = 1…6. A photon of energy E: ionises if E ≥ −E_{n_cur} (E_k = E + E_{n_cur});
 * else is absorbed to the level m > n_cur with |E − (E_m − E_{n_cur})| ≤ 0,05 eV (closest wins); else passes.
 * Decay: every τ = 1,2 s (scene time, «сповільнено ≈ у мільярд разів») the atom drops from n to a uniformly
 * random lower level k ∈ [1, n−1], emitting E = E_n − E_k, λ = 1239,84/E nm (vacuum). After ionisation a new
 * electron is captured 2 s later; the capture level and its recombination photon are not specified by the
 * document — we capture into a seeded random level 1…6 emitting E = −E_n (electron at rest), then cascade
 * (see docs/audits/sim-S1-sim.md).
 */
import { toRandomSource, randomInt, type RandomSource } from '../core/S1-sim/rng';
import { photonBand, photonWavelengthNm, type PhotonBand } from '../core/S1-sim/spectrum';

export const RYDBERG_EV = 13.598;
export const MAX_LEVEL = 6;
export const ABSORPTION_TOLERANCE_EV = 0.05;
export const DECAY_TIME_S = 1.2;
export const RECAPTURE_DELAY_S = 2;
/** Photon energy slider: 0,5…16 eV, step 0,01, default 10,20. */
export const PHOTON_ENERGY_RANGE_EV = { min: 0.5, max: 16, step: 0.01, default: 10.2 } as const;

export const levelEnergyEv = (n: number): number => -RYDBERG_EV / (n * n);
export const transitionEnergyEv = (upper: number, lower: number): number => levelEnergyEv(upper) - levelEnergyEv(lower);

/** Slider tick marks: resonances from n = 1 (10,20; 12,09; 12,75; 13,05; 13,22) and the 13,6 eV edge. */
export const GROUND_RESONANCES_EV: readonly number[] = [2, 3, 4, 5, 6].map((m) => transitionEnergyEv(m, 1));
export const IONIZATION_EDGE_EV = RYDBERG_EV;

/** Reference wavelengths (air for visible lines) from the document table, nm, keyed "upper→lower". */
export const REFERENCE_LINES_NM: Readonly<Record<string, number>> = {
  '2→1': 121.6,
  '3→1': 102.6,
  '4→1': 97.3,
  '5→1': 95.0,
  '6→1': 93.8,
  '3→2': 656.3,
  '4→2': 486.1,
  '5→2': 434.0,
  '6→2': 410.2,
  '4→3': 1875,
  '5→3': 1282,
  '6→3': 1094,
  '5→4': 4051,
  '6→4': 2625,
  '6→5': 7460,
};

export interface EmittedPhoton {
  from: number;
  /** Lower level. Recombination (capture) photons have `from` = Infinity (free electron). */
  to: number;
  energyEv: number;
  /** Vacuum wavelength 1239,84/E, nm. */
  wavelengthNm: number;
  band: PhotonBand;
}

export type FireResult =
  | { kind: 'absorbed'; from: number; to: number; detuningEv: number }
  | { kind: 'ionized'; from: number; kineticEnergyEv: number }
  | { kind: 'passed' };

/** Pure absorption rule for a photon of energy E hitting an atom at level n (or already ionised). */
export function photonOutcome(level: number | 'ionized', energyEv: number): FireResult {
  if (level === 'ionized') return { kind: 'passed' };
  const bind = -levelEnergyEv(level);
  if (energyEv >= bind) return { kind: 'ionized', from: level, kineticEnergyEv: energyEv - bind };
  let best: { to: number; d: number } | null = null;
  for (let m = level + 1; m <= MAX_LEVEL; m++) {
    const d = Math.abs(energyEv - transitionEnergyEv(m, level));
    if (d <= ABSORPTION_TOLERANCE_EV + 1e-9 && (!best || d < best.d)) best = { to: m, d };
  }
  return best ? { kind: 'absorbed', from: level, to: best.to, detuningEv: best.d } : { kind: 'passed' };
}

const photon = (from: number, to: number, energyEv: number): EmittedPhoton => {
  const wl = photonWavelengthNm(energyEv);
  return { from, to, energyEv, wavelengthNm: wl, band: photonBand(wl) };
};

export interface HydrogenState {
  level: number | 'ionized';
  /** Scene seconds until the next decay (or recapture when ionised); Infinity at n = 1. */
  timerS: number;
  /** Kinetic energy of the last ejected electron, eV (null if none). */
  lastKineticEnergyEv: number | null;
}

export interface HydrogenAtom {
  readonly state: HydrogenState;
  /** «Вогонь!»: applies the absorption rule immediately. */
  fire(energyEv: number): FireResult;
  /** Advances scene time; returns photons emitted during this step (in order). */
  step(dt: number): EmittedPhoton[];
  reset(): void;
}

export function createHydrogenAtom(options: { rng?: RandomSource | number } = {}): HydrogenAtom {
  const seed = options.rng;
  let rng = toRandomSource(seed, 1);
  const state: HydrogenState = { level: 1, timerS: Infinity, lastKineticEnergyEv: null };
  const armDecay = (): void => {
    state.timerS = state.level === 'ionized' ? RECAPTURE_DELAY_S : state.level > 1 ? DECAY_TIME_S : Infinity;
  };
  return {
    state,
    fire(energyEv: number): FireResult {
      const r = photonOutcome(state.level, energyEv);
      if (r.kind === 'absorbed') {
        state.level = r.to;
        armDecay();
      } else if (r.kind === 'ionized') {
        state.level = 'ionized';
        state.lastKineticEnergyEv = r.kineticEnergyEv;
        armDecay();
      }
      return r;
    },
    step(dt: number): EmittedPhoton[] {
      const out: EmittedPhoton[] = [];
      let remaining = Math.max(dt, 0);
      while (remaining >= state.timerS) {
        remaining -= state.timerS;
        if (state.level === 'ionized') {
          const n = randomInt(rng, 1, MAX_LEVEL);
          out.push(photon(Infinity, n, -levelEnergyEv(n)));
          state.level = n;
        } else {
          const n = state.level;
          const k = randomInt(rng, 1, n - 1);
          out.push(photon(n, k, transitionEnergyEv(n, k)));
          state.level = k;
        }
        armDecay();
      }
      if (state.timerS !== Infinity) state.timerS -= remaining;
      return out;
    },
    reset(): void {
      rng = toRandomSource(seed, 1);
      state.level = 1;
      state.lastKineticEnergyEv = null;
      armDecay();
    },
  };
}
