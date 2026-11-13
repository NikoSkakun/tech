/**
 * `atom` «Модель симуляції» §5 (step `quarks`) — illustrative "string breaking": E(d) = σ·d, σ = 0,9 GeV/fm,
 * d = distance of the dragged quark from the proton centre minus 0,4 fm; the string breaks at d = 1,2 fm
 * (≈ 1,1 GeV) creating a q q̄ pair; a π⁰ (135 MeV/c²) flies off with the rest as kinetic energy (qualitative).
 * Also: hadron charges (Proton | Neutron toggle) and the mass budget of the proton (step `quarks` misconception).
 */

export const STRING_TENSION_GEV_PER_FM = 0.9;
export const STRING_OFFSET_FM = 0.4;
export const STRING_BREAK_FM = 1.2;
export const PION0_MASS_GEV = 0.135;

export interface QuarkPull {
  /** Stretch d = max(r − 0,4 fm, 0), fm. */
  stretchFm: number;
  /** E = σ·d, GeV. */
  energyGeV: number;
  broken: boolean;
  /** Kinetic energy left for the pion after breaking, GeV (≥ 0; qualitative only). */
  pionKineticGeV: number;
}

export function quarkPull(distanceFromCentreFm: number): QuarkPull {
  const d = Math.max(distanceFromCentreFm - STRING_OFFSET_FM, 0);
  const broken = d >= STRING_BREAK_FM;
  const e = STRING_TENSION_GEV_PER_FM * Math.min(d, STRING_BREAK_FM);
  return { stretchFm: d, energyGeV: e, broken, pionKineticGeV: broken ? Math.max(e - PION0_MASS_GEV, 0) : 0 };
}

export type QuarkFlavour = 'u' | 'd';
/** Quark charges in units of e. */
export const QUARK_CHARGE_E: Readonly<Record<QuarkFlavour, number>> = { u: 2 / 3, d: -1 / 3 };
export const PROTON_QUARKS: readonly QuarkFlavour[] = ['u', 'u', 'd'];
export const NEUTRON_QUARKS: readonly QuarkFlavour[] = ['u', 'd', 'd'];

/** Sum of quark charges (count-up target): uud → +1, udd → 0. Rounded to remove 1/3 float noise. */
export function hadronCharge(quarks: readonly QuarkFlavour[]): number {
  return Math.round(quarks.reduce((s, q) => s + QUARK_CHARGE_E[q], 0) * 3) / 3;
}

/** Proton mass budget: quark rest masses (2·2,2 + 4,7 MeV) vs m_p = 938,272 MeV → ≈ 1 % / ≈ 99 %. */
export function protonMassBudget(): { quarkMassMeV: number; protonMassMeV: number; quarkShare: number; fieldShare: number } {
  const quark = 2 * 2.2 + 4.7;
  const proton = 938.272;
  return { quarkMassMeV: quark, protonMassMeV: proton, quarkShare: quark / proton, fieldShare: 1 - quark / proton };
}
