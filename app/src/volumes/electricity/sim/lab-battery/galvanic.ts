/**
 * `lab-battery` §M1 / step 1: galvanic pair from standard electrode potentials (idealised: 1 mol/L, 25 °C).
 * ℰ = E°_cathode − E°_anode, the cathode being the metal with the larger E°.
 */

/** Standard electrode potentials E°, V. */
export const STANDARD_POTENTIALS_V = {
  Li: -3.04,
  K: -2.93,
  Na: -2.71,
  Mg: -2.37,
  Al: -1.66,
  Zn: -0.76,
  Fe: -0.44,
  Pb: -0.13,
  H: 0.0,
  Cu: 0.34,
  Ag: 0.8,
  Au: 1.5,
} as const;
export type Electrode = keyof typeof STANDARD_POTENTIALS_V;

/** Metals that react with water (red chip «Реагує з водою! Потрібен неводний електроліт»). */
export const REACTS_WITH_WATER: readonly Electrode[] = ['Li', 'K', 'Na'];

export interface GalvanicPair {
  /** Cell EMF, V (≥ 0). */
  emfV: number;
  /** Positive electrode (larger E°). */
  cathode: Electrode;
  /** Negative electrode — electrons leave it through the wire. */
  anode: Electrode;
  reactsWithWater: boolean;
}

/** Zn–Cu 1.10 V; Li–Cu 3.38 V; Mg–Ag 3.17 V. */
export function galvanicPair(a: Electrode, b: Electrode): GalvanicPair {
  const ea = STANDARD_POTENTIALS_V[a];
  const eb = STANDARD_POTENTIALS_V[b];
  const [cathode, anode] = ea >= eb ? [a, b] : [b, a];
  return {
    emfV: Math.abs(ea - eb),
    cathode,
    anode,
    reactsWithWater: REACTS_WITH_WATER.includes(a) || REACTS_WITH_WATER.includes(b),
  };
}
