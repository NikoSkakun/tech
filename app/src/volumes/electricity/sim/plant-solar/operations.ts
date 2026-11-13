/**
 * `plant-solar` step calculators: string voltage (3), clipping share (4), park controller (5), 100 MWp field and
 * tracker gain (6), city yield (7).
 */
import { CLIMATE_FACTOR } from './irradiance';
import { dayEnergy, ETA_BOS, type DayOptions } from './power';

/* ---------------------------------------------- step 3 ---------------------------------------------------- */

/** Utility module: V_mp 44 V, cold V_oc 53 V; DC limit 1500 V (N ≥ 29 exceeds it in frost). */
export function utilityString(n: number) {
  const vmp = 44 * n;
  const vocCold = 53 * n;
  return { operatingV: vmp, vocColdV: vocCold, exceeds1500: vocCold > 1500 };
}

/* ---------------------------------------------- step 4 ---------------------------------------------------- */

/** Clipped share of the day and relative inverter cost (∝ 1/(DC/AC)). */
export function clippingShare(o: Omit<DayOptions, 'dcAc'>, dcAc: number) {
  const e = dayEnergy({ ...o, dcAc });
  const total = e.acKwhPerKwp + e.clippedKwhPerKwp;
  return {
    clippedFraction: total > 0 ? e.clippedKwhPerKwp / total : 0,
    relativeInverterCost: 1 / dcAc,
    day: e,
  };
}

/* ---------------------------------------------- step 5 ---------------------------------------------------- */

/**
 * Park power controller (qualitative): TSO set-point reached with a ramp of 10 % P_n/min; voltage at the PCC
 * u = 1 + x·q (p.u., x = 0.1, q = Q/P_n ∈ ±0.33); «провал напруги» — u = 0.2 for 0.15 s, inverters ride through.
 */
export const PPC = { rampPerMin: 0.1, xPu: 0.1, dipDepthPu: 0.2, dipS: 0.15 } as const;

export function createParkController(available = 1) {
  const state = { timeS: 0, setPointPu: 1, pPu: available, qPu: 0, uPu: 1, dipRemainingS: 0, frtOk: true };
  return {
    state,
    /** «Команда TSO: обмежити до 60 %» → setPoint(0.6). */
    setPoint(pu: number): void {
      state.setPointPu = Math.min(1, Math.max(0, pu));
    },
    setQ(qPu: number): void {
      state.qPu = Math.min(0.33, Math.max(-0.33, qPu));
    },
    voltageDip(): void {
      state.dipRemainingS = PPC.dipS;
    },
    step(dt: number): void {
      state.timeS += dt;
      const target = Math.min(available, state.setPointPu);
      const maxStep = (PPC.rampPerMin / 60) * dt;
      state.pPu += Math.max(-maxStep, Math.min(maxStep, target - state.pPu));
      state.dipRemainingS = Math.max(0, state.dipRemainingS - dt);
      state.uPu = state.dipRemainingS > 0 ? PPC.dipDepthPu : 1 + PPC.xPu * state.qPu;
    },
  };
}

/* ---------------------------------------------- step 6 ---------------------------------------------------- */

/** Field of 100 MWp: power (MW) from the per-kWp AC power, and the tracker gain of a day, %. */
export const FIELD_MWP = 100;
export function trackerGainPct(dayOfYear: number, ambientC: number, opts: Partial<DayOptions> = {}): number {
  const fixed = dayEnergy({ ...opts, mount: 'fixed', dayOfYear, ambientC }).acKwhPerKwp;
  const tracker = dayEnergy({ ...opts, mount: 'tracker', dayOfYear, ambientC }).acKwhPerKwp;
  return fixed > 0 ? (tracker / fixed - 1) * 100 : 0;
}

/* ---------------------------------------------- step 7 ---------------------------------------------------- */

export const CITIES = {
  Lviv: { latDeg: 49.8, k: CLIMATE_FACTOR.Lviv },
  Kyiv: { latDeg: 50.45, k: CLIMATE_FACTOR.Kyiv },
  Odesa: { latDeg: 46.5, k: CLIMATE_FACTOR.Odesa },
  Cairo: { latDeg: 30, k: CLIMATE_FACTOR.Cairo },
  Atacama: { latDeg: 23.5, k: CLIMATE_FACTOR.Atacama },
} as const;
export type City = keyof typeof CITIES;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Annual yield of a fixed 35° plant (kWh/kWp) as clear-sky × climate factor; summer ambient slider 15…45 °C sets
 * the seasonal curve T(n) = (T_summer − 12) − 12·cos(2π(n − 15)/365) (22 °C → the M4 sinusoid 10 ± 12 °C).
 * «Помити модулі»: dust 4 % → 1 % inside η_bos.
 */
export function cityYield(city: City, summerC = 22, washed = false) {
  const c = CITIES[city];
  const dust = washed ? (1 - 0.01) / (1 - 0.04) : 1;
  const monthly: number[] = [];
  let n = 0;
  for (const days of MONTH_DAYS) {
    let m = 0;
    for (let d = 0; d < days; d++) {
      n++;
      const t = summerC - 12 - 12 * Math.cos((2 * Math.PI * (n - 15)) / 365);
      m += dayEnergy({
        mount: 'fixed',
        latDeg: c.latDeg,
        dayOfYear: n,
        ambientC: t,
        stepH: 0.25,
      }).acKwhPerKwp;
    }
    monthly.push(m * c.k * dust);
  }
  const y = monthly.reduce((a, b) => a + b, 0);
  return { monthlyKwhPerKwp: monthly, yieldKwhPerKwp: y, capacityFactor: y / 8760, etaBos: ETA_BOS * dust };
}
