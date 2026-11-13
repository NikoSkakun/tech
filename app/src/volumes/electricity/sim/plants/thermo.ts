/**
 * plants M1 (step 4) Carnot limit with the empirical «real band» and M3 (step 6) ideal Brayton cycle.
 *   η_C = 1 − T_c/T_h (T in K; 0 if T_h ≤ T_c); real band 0,55…0,75·η_C (generalisation of real plants, «приблизно»)
 *   η_B(r) = 1 − r^(−(γ−1)/γ), γ = 1,4
 */
export const KELVIN = 273.15;

export function carnotEfficiency(hotC: number, coldC: number): number {
  const th = hotC + KELVIN;
  const tc = coldC + KELVIN;
  return th > tc ? 1 - tc / th : 0;
}

export function realBand(hotC: number, coldC: number): [number, number] {
  const e = carnotEfficiency(hotC, coldC);
  return [0.55 * e, 0.75 * e];
}

/** Real-plant markers of step 4 (t_h °C, η_real). */
export const PLANT_MARKERS = {
  nuclear: { hotC: 280, eta: 0.33 },
  coalSubcritical: { hotC: 540, eta: 0.37 },
  coalUsc: { hotC: 600, eta: 0.45 },
  pingshanII: { hotC: 610, eta: 0.4937 },
  ccgt: { hotC: 1600, eta: 0.62 },
  keadby2: { hotC: 1600, eta: 0.6418 },
} as const;

/** Ratio η_real/η_C of a marker (cold side 30 °C). */
export function markerRatio(m: { hotC: number; eta: number }, coldC = 30): number {
  return m.eta / carnotEfficiency(m.hotC, coldC);
}

export const GAMMA_AIR = 1.4;

export function braytonIdealEfficiency(pressureRatio: number, gamma = GAMMA_AIR): number {
  return pressureRatio > 1 ? 1 - pressureRatio ** (-(gamma - 1) / gamma) : 0;
}
