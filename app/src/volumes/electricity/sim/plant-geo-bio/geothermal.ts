/**
 * `plant-geo-bio` M1 (gradient, plant type, power, flash steam fraction), M2 (field pressure, thermal
 * breakthrough), M3 (EGS stimulation: fractures, induced micro-events, traffic light; injected RNG).
 */
import { interp1 } from '../core/S3-sim/num';

/* ------------------------------------------------ M1 ------------------------------------------------------ */

export const GEO_T0_C = 12;
/** Gradient presets of step 2, °C/km. */
export const REGIONS = { Kyiv: 25, Transcarpathia: 50, Iceland: 100 } as const;
export type Region = keyof typeof REGIONS;

/** T(z) = T₀ + G·z (z in km). */
export function reservoirTemperatureC(gradientCPerKm: number, depthKm: number): number {
  return GEO_T0_C + gradientCPerKm * depthKm;
}

export type GeoPlantType = 'heat-only' | 'binary' | 'flash' | 'dry-steam';

/** < 100 °C heat only; 100–180 binary; ≥ 180 flash; dry steam only in «Iceland» at ≥ 235 °C. */
export function plantTypeFor(tC: number, region?: Region): GeoPlantType {
  if (region === 'Iceland' && tC >= 235) return 'dry-steam';
  if (tC < 100) return 'heat-only';
  if (tC < 180) return 'binary';
  return 'flash';
}

const HF_T = [160, 180, 200, 250, 300];
const HF_KJKG = [675.5, 763.1, 852.3, 1085.7, 1344.8];

/** Flash steam fraction at a 160 °C separator: x = (h_f(T) − 675.5)/2082.0; 0 below 165 °C (warning). */
export function flashFraction(tResC: number): { x: number; warning: boolean } {
  if (tResC < 165) return { x: 0, warning: true };
  return { x: (interp1(HF_T, HF_KJKG, tResC) - 675.5) / 2082.0, warning: false };
}

export interface GeoPower {
  qThMw: number;
  eta: number;
  pElMw: number;
  injectionC: number;
  /** Steam fraction (flash). */
  steamFraction: number;
  /** The chosen type does not suit the temperature («пари замало»). */
  mismatch: boolean;
}

/** Q = ṁ·c_w·(T_res − T_inj) (T_inj 70 °C binary, 100 °C flash/dry steam); η = 0.40·(1 − 313.15/T_res[K]). */
export function geothermalPower(
  tResC: number,
  massFlowKgS: number,
  type: Exclude<GeoPlantType, 'heat-only'>,
): GeoPower {
  const tInj = type === 'binary' ? 70 : 100;
  const q = (massFlowKgS * 4.19 * Math.max(0, tResC - tInj)) / 1000;
  const eta = Math.max(0, 0.4 * (1 - 313.15 / (tResC + 273.15)));
  const flash = type === 'flash' ? flashFraction(tResC) : { x: 0, warning: false };
  const mismatch =
    (type === 'flash' && flash.warning) || (type === 'dry-steam' && tResC < 235) || tResC < 100;
  return { qThMw: q, eta, pElMw: q * eta, injectionC: tInj, steamFraction: flash.x, mismatch };
}

/* ------------------------------------------------ M2 ------------------------------------------------------ */

/**
 * Relative reservoir pressure: dp/dt = (−Q + r·Q + k_r·(1 − p))/C, C = 30 years, k_r = 0.3, Q = 1; exact solution
 * p(t) = p_eq + (1 − p_eq)·e^(−k_r·t/C), clamped at 0.3 («станція втрачає потужність»). Station power ∝ p.
 */
export function fieldPressure(years: number, reinjection: number): { p: number; collapsed: boolean } {
  const kr = 0.3;
  const peq = 1 - (1 - reinjection) / kr;
  const p = peq + (1 - peq) * Math.exp((-kr * Math.max(0, years)) / 30);
  return { p: Math.max(0.3, p), collapsed: p <= 0.3 };
}

/** Thermal breakthrough t_b = 8 years·(L/1 km)²; afterwards production temperature −1 %/year. */
export function breakthrough(distanceKm: number, years: number): { tbYears: number; tempFactor: number } {
  const tb = 8 * distanceKm * distanceKm;
  return { tbYears: tb, tempFactor: Math.max(0, 1 - 0.01 * Math.max(0, years - tb)) };
}

/* ------------------------------------------------ M3 ------------------------------------------------------ */

export type TrafficLight = 'green' | 'yellow' | 'red';
export function trafficLight(magnitude: number): TrafficLight {
  return magnitude >= 2 ? 'red' : magnitude >= 1 ? 'yellow' : 'green';
}

export interface EgsEvent {
  timeS: number;
  magnitude: number;
  light: TrafficLight;
}

/**
 * EGS stimulation (animation time): ℓ += k·max(0, p − 0.25)·dt (k = 0.05 /s, fraction of the target length);
 * micro-events Poisson with λ = 5·max(0, p − 0.2) /s, M = −1 + 4·u²·p; a red event cuts p to 0.7·p.
 */
export function createEgs(rng: () => number, initialPressure = 0.4) {
  const state = {
    timeS: 0,
    pressure: initialPressure,
    fractureLength: 0,
    events: [] as EgsEvent[],
    light: 'green' as TrafficLight,
  };
  let nextEventIn = -1;
  const draw = (): number => {
    const lam = 5 * Math.max(0, state.pressure - 0.2);
    return lam > 0 ? -Math.log(Math.max(1e-12, rng())) / lam : Infinity;
  };
  return {
    state,
    setPressure(p: number): void {
      state.pressure = Math.min(1, Math.max(0, p));
      nextEventIn = draw();
    },
    step(dt: number): EgsEvent[] {
      const fired: EgsEvent[] = [];
      if (nextEventIn < 0) nextEventIn = draw();
      let rem = dt;
      while (rem > 0) {
        const h = Math.min(rem, nextEventIn);
        state.fractureLength = Math.min(
          1,
          state.fractureLength + 0.05 * Math.max(0, state.pressure - 0.25) * h,
        );
        state.timeS += h;
        rem -= h;
        nextEventIn -= h;
        if (nextEventIn <= 1e-12 && Number.isFinite(nextEventIn)) {
          const u = rng();
          const m = -1 + 4 * u * u * state.pressure;
          const ev = { timeS: state.timeS, magnitude: m, light: trafficLight(m) };
          fired.push(ev);
          state.events.push(ev);
          state.light = ev.light;
          if (ev.light === 'red') state.pressure *= 0.7;
          nextEventIn = draw();
        }
      }
      if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
      return fired;
    },
  };
}
