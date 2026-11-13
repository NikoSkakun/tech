/**
 * Physical constants (SI). Exact values are SI-2019 definitions; the rest are CODATA 2022 as quoted in the
 * chapter documents (`charge-field` «Модель симуляції» §1, `atom` §1, `matter` §1).
 */

/** Elementary charge e, C (exact, SI 2019). */
export const ELEMENTARY_CHARGE_C = 1.602176634e-19;
/** Coulomb constant k = 1/(4π·ε₀), N·m²/C². */
export const COULOMB_K = 8.9875517862e9;
/** Vacuum permittivity ε₀, F/m. */
export const EPSILON_0_F_PER_M = 8.8541878188e-12;
/**
 * Vacuum permeability μ₀, H/m. The documents (`current` §10, `magnetism` constants) use the classical
 * 4π×10⁻⁷ H/m; the CODATA value differs by 5×10⁻¹⁰ (relative), far below any display precision.
 */
export const MU_0_H_PER_M = 4 * Math.PI * 1e-7;
/** Electron mass m_e, kg. */
export const ELECTRON_MASS_KG = 9.1093837139e-31;
/** Proton mass m_p, kg. */
export const PROTON_MASS_KG = 1.67262192595e-27;
/** Bohr radius a₀, m. */
export const BOHR_RADIUS_M = 5.29177210544e-11;
/** Newtonian constant of gravitation G, N·m²/kg². */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11;
/** Speed of light in vacuum c, m/s (exact). */
export const SPEED_OF_LIGHT_M_PER_S = 299792458;
/** Boltzmann constant k_B in eV/K. */
export const BOLTZMANN_EV_PER_K = 8.617333262e-5;
/** Boltzmann constant k_B in J/K (exact). */
export const BOLTZMANN_J_PER_K = 1.380649e-23;
/** h·c in eV·nm: photon wavelength λ[nm] = 1239,84 / E[eV] (`atom` §3, `matter` §9). */
export const HC_EV_NM = 1239.84;
/** Standard gravity used by the documents (`magnetism` constants), m/s². */
export const GRAVITY_M_PER_S2 = 9.81;
/** Absolute zero offset: T[K] = T[°C] + 273,15. */
export const KELVIN_OFFSET = 273.15;
/** Grid frequency of Ukraine / continental Europe, Hz. */
export const GRID_FREQUENCY_HZ = 50;
