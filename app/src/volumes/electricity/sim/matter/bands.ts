/**
 * `matter` «Модель симуляції» §3 (step `bands`): tight-binding 1D chain, E_k = E₀ − 2t·cos(kπ/(N+1)),
 * k = 1…N; lower band E₀ = −6 eV, t = 1 eV (width 4 eV); the upper band is placed so that the N → ∞ gap equals
 * E_g of the chosen material (upper E₀' = −2 + E_g with the same t). Cu: one band, half filled (Fermi level at E₀).
 * Intrinsic carriers: n_i(T) = n_i(300)·(T/300)^1,5·exp(−E_g/(2k_BT) + E_g/(2k_B·300)), 0 below 50 K.
 * Hop rate in the tower f = log₁₀(n_i/1 cm⁻³)/14 s⁻¹, clamped 0…3.
 */
import { clamp } from '../core/S1-sim/math';

/** k_B as quoted in `matter` §1, eV/K. */
export const K_B_EV_PER_K = 8.617e-5;

export type BandMaterialId = 'Cu' | 'Ge' | 'Si' | 'GaAs' | 'diamond' | 'SiO2';

export const BAND_MATERIALS: Readonly<Record<BandMaterialId, { bandGapEv: number; ni300PerCm3: number | null; metal: boolean }>> = {
  Cu: { bandGapEv: 0, ni300PerCm3: null, metal: true },
  Ge: { bandGapEv: 0.66, ni300PerCm3: 2.0e13, metal: false },
  Si: { bandGapEv: 1.12, ni300PerCm3: 1.0e10, metal: false },
  GaAs: { bandGapEv: 1.42, ni300PerCm3: 2.1e6, metal: false },
  // «≈ 0 (менше 1 на кубокілометр)»: n_i is shown as negligible, not computed.
  diamond: { bandGapEv: 5.47, ni300PerCm3: null, metal: false },
  SiO2: { bandGapEv: 9, ni300PerCm3: null, metal: false },
};

/** Atom-count slider positions. */
export const ATOM_COUNTS: readonly number[] = [1, 2, 4, 16, 1e23];
export const BAND_LOWER_E0_EV = -6;
export const BAND_HOPPING_EV = 1;

/** Sub-levels E_k for a chain of N atoms (N ≥ 10³ is returned as continuous edges only). */
export function chainLevels(e0Ev: number, atomCount: number, hoppingEv = BAND_HOPPING_EV): { levels: number[]; bottomEv: number; topEv: number } {
  if (atomCount > 1000) return { levels: [], bottomEv: e0Ev - 2 * hoppingEv, topEv: e0Ev + 2 * hoppingEv };
  const levels: number[] = [];
  for (let k = 1; k <= atomCount; k++) levels.push(e0Ev - 2 * hoppingEv * Math.cos((k * Math.PI) / (atomCount + 1)));
  return { levels, bottomEv: Math.min(...levels), topEv: Math.max(...levels) };
}

export interface BandTower {
  lower: { levels: number[]; bottomEv: number; topEv: number };
  /** Absent for Cu (single half-filled band). */
  upper: { levels: number[]; bottomEv: number; topEv: number } | null;
  /** Gap between the bands for this N (→ E_g as N → ∞), eV; 0 for Cu. */
  gapEv: number;
  /** Fermi level (Cu: middle of the band; others: mid-gap), eV. */
  fermiEv: number;
}

export function bandTower(material: BandMaterialId, atomCount: number): BandTower {
  const m = BAND_MATERIALS[material];
  const lower = chainLevels(BAND_LOWER_E0_EV, atomCount);
  if (m.metal) return { lower, upper: null, gapEv: 0, fermiEv: BAND_LOWER_E0_EV };
  const upper = chainLevels(-2 + m.bandGapEv, atomCount);
  return { lower, upper, gapEv: upper.bottomEv - lower.topEv, fermiEv: (upper.bottomEv + lower.topEv) / 2 };
}

/** n_i(T), cm⁻³; 0 below 50 K and for materials shown as «≈ 0»; `negligible` flags the latter. */
export function intrinsicCarrierDensity(material: BandMaterialId, temperatureK: number): { perCm3: number; negligible: boolean } {
  const m = BAND_MATERIALS[material];
  if (m.metal || m.ni300PerCm3 === null) return { perCm3: 0, negligible: !m.metal };
  if (temperatureK < 50) return { perCm3: 0, negligible: true };
  const t = temperatureK;
  const eg = m.bandGapEv;
  const ni = m.ni300PerCm3 * Math.pow(t / 300, 1.5) * Math.exp(-eg / (2 * K_B_EV_PER_K * t) + eg / (2 * K_B_EV_PER_K * 300));
  return { perCm3: ni, negligible: false };
}

/** Visual hop rate across the gap, 1/s: log₁₀(n_i)/14, clamped 0…3. */
export function hopRatePerS(niPerCm3: number): number {
  return niPerCm3 > 1 ? clamp(Math.log10(niPerCm3) / 14, 0, 3) : 0;
}

/** Intrinsic conductivity relative to Si at 300 K (same mobilities → ratio of n_i); Cu → σ_Cu/σ_Si,i. */
export function conductivityRelativeToSi300(material: BandMaterialId, temperatureK: number): number {
  if (BAND_MATERIALS[material].metal) {
    // σ_Cu = 1/1,68×10⁻⁸ S/m vs intrinsic Si σ = e·n_i·(μ_n + μ_p) with 1400 + 450 cm²/(V·s) (§6)
    const sigmaSi = 1.602176634e-19 * 1e10 * 1e6 * (1400 + 450) * 1e-4;
    return 1 / 1.68e-8 / sigmaSi;
  }
  return intrinsicCarrierDensity(material, temperatureK).perCm3 / 1e10;
}
