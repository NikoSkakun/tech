/**
 * The model's temperature ↔ degrees Celsius, and the heat a real gram of water needs.
 *
 * The solver (`md.ts`) knows only its own temperature unit (one bond energy per k_B). A sample of a few hundred
 * molecules in one layer does not melt at a point: it loses its order gradually between T_ICE and T_LIQUID.
 * A real glass (10²⁵ molecules) melts exactly at 0 °C. So the whole melting range of the model stands for 0 °C:
 *   below T_ICE       absolute scale: kelvins in proportion to the model's temperature (no motion = −273.15 °C);
 *   T_ICE … T_LIQUID  0 °C (the sample is part ice, part liquid);
 *   above T_LIQUID    linear, 100 °C at T_BOIL (where the model's liquid leaves a hot plate quickly).
 * A stated simplification: the model's boiling point is set by this map, not predicted.
 */
export const T_ICE = 0.092;
export const T_LIQUID = 0.115;
export const T_BOIL = 0.168;
/** 0 °C in kelvins. */
export const KELVIN_0C = 273.15;

/** Degrees Celsius shown for a model temperature. */
export function toCelsius(t: number): number {
  if (t < T_ICE) return (KELVIN_0C * t) / T_ICE - KELVIN_0C;
  if (t <= T_LIQUID) return 0;
  return (100 * (t - T_LIQUID)) / (T_BOIL - T_LIQUID);
}

/**
 * Model temperature for degrees Celsius. 0 °C is a range: `melted` (0 … 1) says how far through it the sample is
 * (0: still all ice, 1: all liquid); it is ignored away from 0 °C.
 */
export function fromCelsius(celsius: number, melted = 0): number {
  if (celsius < 0) return (T_ICE * (celsius + KELVIN_0C)) / KELVIN_0C;
  if (celsius === 0) return T_ICE + (T_LIQUID - T_ICE) * Math.min(1, Math.max(0, melted));
  return T_LIQUID + ((T_BOIL - T_LIQUID) * celsius) / 100;
}

/**
 * Heat for one gram of water at normal pressure, joules (CODATA / IAPWS values, rounded as in school tables):
 * ice 2.1 J/(g·K), melting 334 J/g, water 4.19 J/(g·K), boiling 2 260 J/g, steam 2.0 J/(g·K).
 */
export const HEAT = { ice: 2.1, melting: 334, water: 4.19, boiling: 2260, steam: 2.0 } as const;

export interface ThermalState {
  celsius: number;
  /** Share of the gram that is ice, liquid, steam (sum 1). */
  ice: number;
  liquid: number;
  steam: number;
}

/**
 * The state of one gram that started as ice at `from` °C (≤ 0) and has received `heat` joules — the lumped model
 * behind the thermometer: the temperature rises, stands at 0 °C until the ice is gone, rises, stands at 100 °C
 * until the water is gone, rises.
 */
export function heated(heat: number, from = -20): ThermalState {
  let q = Math.max(0, heat);
  const warmIce = -from * HEAT.ice;
  if (q <= warmIce) return { celsius: from + q / HEAT.ice, ice: 1, liquid: 0, steam: 0 };
  q -= warmIce;
  if (q <= HEAT.melting) return { celsius: 0, ice: 1 - q / HEAT.melting, liquid: q / HEAT.melting, steam: 0 };
  q -= HEAT.melting;
  const warmWater = 100 * HEAT.water;
  if (q <= warmWater) return { celsius: q / HEAT.water, ice: 0, liquid: 1, steam: 0 };
  q -= warmWater;
  if (q <= HEAT.boiling) return { celsius: 100, ice: 0, liquid: 1 - q / HEAT.boiling, steam: q / HEAT.boiling };
  q -= HEAT.boiling;
  return { celsius: 100 + q / HEAT.steam, ice: 0, liquid: 0, steam: 1 };
}

/** Heat (J per gram) that brings ice at `from` °C to the state `celsius` with the given melted / boiled share. */
export function heatTo(celsius: number, share = 0, from = -20): number {
  const warmIce = -from * HEAT.ice;
  if (celsius < 0) return (celsius - from) * HEAT.ice;
  if (celsius === 0) return warmIce + share * HEAT.melting;
  if (celsius < 100) return warmIce + HEAT.melting + celsius * HEAT.water;
  if (celsius === 100) return warmIce + HEAT.melting + 100 * HEAT.water + share * HEAT.boiling;
  return warmIce + HEAT.melting + 100 * HEAT.water + HEAT.boiling + (celsius - 100) * HEAT.steam;
}
