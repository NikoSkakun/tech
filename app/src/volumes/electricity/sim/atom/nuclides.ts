/**
 * Nuclide data for the atom builder (`atom` «Модель симуляції» §4): stable mass numbers per Z and the listed
 * radioactive nuclides with half-lives. Half-life units: y (years), d (days), h, min, s.
 */
export type HalfLifeUnit = 'y' | 'd' | 'h' | 'min' | 's';

export interface HalfLife {
  value: number;
  unit: HalfLifeUnit;
  /** Shown with «≈». */
  approx?: boolean;
}

/** Stable mass numbers A for Z = 1…29 (Ca-48 included as "practically stable"; V-50 is radioactive). */
export const STABLE_A: Readonly<Record<number, readonly number[]>> = {
  1: [1, 2],
  2: [3, 4],
  3: [6, 7],
  4: [9],
  5: [10, 11],
  6: [12, 13],
  7: [14, 15],
  8: [16, 17, 18],
  9: [19],
  10: [20, 21, 22],
  11: [23],
  12: [24, 25, 26],
  13: [27],
  14: [28, 29, 30],
  15: [31],
  16: [32, 33, 34, 36],
  17: [35, 37],
  18: [36, 38, 40],
  19: [39, 41],
  20: [40, 42, 43, 44, 46, 48],
  21: [45],
  22: [46, 47, 48, 49, 50],
  23: [51],
  24: [50, 52, 53, 54],
  25: [55],
  26: [54, 56, 57, 58],
  27: [59],
  28: [58, 60, 61, 62, 64],
  29: [63, 65],
};

/** Ca-48 decays with T½ ≈ 6×10¹⁹ y — shown as «стабільний (практично)». */
export const PRACTICALLY_STABLE: readonly string[] = ['20-48'];

const y = (value: number, approx = false): HalfLife => ({ value, unit: 'y', approx });
const d = (value: number): HalfLife => ({ value, unit: 'd' });
const h = (value: number): HalfLife => ({ value, unit: 'h' });
const min = (value: number): HalfLife => ({ value, unit: 'min' });

/** Known radioactive nuclides, key `${Z}-${A}`. */
export const RADIOACTIVE: Readonly<Record<string, HalfLife>> = {
  '1-3': y(12.32),
  '4-7': d(53.2),
  '4-10': y(1.39e6),
  '6-11': min(20.4),
  '6-14': y(5700, true),
  '7-13': min(9.97),
  '8-15': min(2.04),
  '9-18': min(110),
  '11-22': y(2.6),
  '11-24': h(15.0),
  '13-26': y(0.72e6),
  '15-32': d(14.3),
  '16-35': d(87.4),
  '17-36': y(0.3e6),
  '18-39': y(269),
  '19-40': y(1.25e9),
  '20-41': y(0.1e6),
  '22-44': y(60, true),
  '23-50': y(2.7e17),
  '25-54': d(312),
  '26-55': y(2.74),
  '26-60': y(2.6e6),
  '27-60': y(5.27),
  '28-59': y(80e3, true),
  '28-63': y(101),
  '29-64': h(12.7),
  '29-67': h(61.8),
  '14-32': y(150, true),
  '15-33': d(25.3),
  '18-37': d(35.0),
  '18-42': y(32.9),
  '20-45': d(163),
  '20-47': d(4.54),
  '21-46': d(83.8),
  '21-47': d(3.35),
  '23-48': d(16.0),
  '23-49': d(330),
  '24-51': d(27.7),
  '25-52': d(5.59),
  '25-53': y(3.7e6),
  '26-59': d(44.5),
  '27-56': d(77.2),
  '27-57': d(272),
  '27-58': d(70.9),
  '28-56': d(6.08),
};

/** He-5, Li-5, Be-8 — «розпадається миттєво (≪ 1 s)». */
export const INSTANT_DECAY: readonly string[] = ['2-5', '3-5', '4-8'];

/** Elements whose anion X⁻ is not bound (He, Be, N, Ne, Mg, Ar, Mn). */
export const UNBOUND_ANION_Z: readonly number[] = [2, 4, 7, 10, 12, 18, 25];

/** Mean neutron number of the stable isotopes, N_ref(Z). */
export function referenceNeutronNumber(z: number): number {
  const list = STABLE_A[z];
  if (!list) return NaN;
  return list.reduce((s, a) => s + (a - z), 0) / list.length;
}
