/**
 * plant-nuclear M1 (step 2) fission «slingshot», M2 (step 3) k_eff sandbox, step 4 prompt-only illustration.
 * M1: fission probability per hit (illustrative): thermal 0,85, 1 keV 0,35, 2 MeV 0,08; else elastic scattering.
 *     Energy split [MeV]: fragments 169, prompt neutrons 5, prompt γ 7, β 6,5, decay γ 6,3, antineutrinos 8,8 (lost).
 * M2: k∞,mod(e) = 1 + 0,30·(1 − exp(−(e − 0,9)/1,2)); k∞,fast(e) = 2,3·e/(e + 15);
 *     k = k∞·(1 − 0,3·A)·P_NL, P_NL = 0,70 / 0,88 / 0,97 (small / medium / large); N_{g+1} = k·N_g;
 *     single neutrons: each causes a fission with probability min(1, k/ν), ν ∈ {2, 3} (mean 2,43), seeded PRNG.
 * Step 4: without delayed neutrons n(t) = exp(ρ·t/Λ), Λ = 10⁻⁴ s (chart cut at 10³).
 */
import { clamp, seededRandom } from '@electricity/sim/core/S2-sim/math';

export type NeutronEnergy = 'thermal' | 'kev' | 'fast';
export const FISSION_PROBABILITY: Readonly<Record<NeutronEnergy, number>> = { thermal: 0.85, kev: 0.35, fast: 0.08 };
export const FISSION_ENERGY_MEV = { fragments: 169, promptNeutrons: 5, promptGamma: 7, beta: 6.5, decayGamma: 6.3, antineutrinos: 8.8 } as const;
export const FISSION_TOTAL_MEV = Object.values(FISSION_ENERGY_MEV).reduce((a, b) => a + b, 0);
/** Chemical comparison: C + O₂ → CO₂ ≈ 4 eV. */
export const COMBUSTION_EV = 4;

/** Outcome of one shot (seeded). */
export function shoot(energy: NeutronEnergy, rand: () => number): 'fission' | 'scatter' {
  return rand() < FISSION_PROBABILITY[energy] ? 'fission' : 'scatter';
}

export type CoreSize = 'small' | 'medium' | 'large';
export const NON_LEAKAGE: Readonly<Record<CoreSize, number>> = { small: 0.7, medium: 0.88, large: 0.97 };

export function kInfModerated(enrichmentPct: number): number {
  return 1 + 0.3 * (1 - Math.exp(-(enrichmentPct - 0.9) / 1.2));
}

export function kInfFast(enrichmentPct: number): number {
  return (2.3 * enrichmentPct) / (enrichmentPct + 15);
}

export function kEff(enrichmentPct: number, moderator: boolean, rodsInserted: number, size: CoreSize): number {
  const kinf = moderator ? kInfModerated(enrichmentPct) : kInfFast(enrichmentPct);
  return kinf * (1 - 0.3 * clamp(rodsInserted, 0, 1)) * NON_LEAKAGE[size];
}

/** Deterministic generations N_g = k^g (for the chart). */
export function generations(k: number, count: number, n0 = 1): number[] {
  return Array.from({ length: count + 1 }, (_, g) => n0 * k ** g);
}

/** Stochastic neutron population for the visual: returns counts per generation (capped). */
export function neutronGenerations(k: number, count: number, seed: number, cap = 600): number[] {
  const rand = seededRandom(seed);
  const p = Math.min(1, k / 2.43);
  const out = [1];
  let n = 1;
  for (let g = 0; g < count; g++) {
    let next = 0;
    for (let i = 0; i < n; i++) if (rand() < p) next += rand() < 0.57 ? 2 : 3; // mean ν = 0,57·2 + 0,43·3 = 2,43
    n = Math.min(next, cap);
    out.push(next);
  }
  return out;
}

export const PROMPT_GENERATION_S = 1e-4;

/** Step 4 «уявний світ»: n(t) = exp(ρ·t/Λ), capped at 10³ for the chart. */
export function promptOnlyPower(reactivityPcm: number, timeS: number, cap = 1e3): number {
  return Math.min(cap, Math.exp(((reactivityPcm * 1e-5) * timeS) / PROMPT_GENERATION_S));
}

/** «у скільки разів за 1 s» without the cap. */
export function promptGrowthPerSecond(reactivityPcm: number): number {
  return Math.exp((reactivityPcm * 1e-5) / PROMPT_GENERATION_S);
}
