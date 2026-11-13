/**
 * `plant-solar` M6 (concentrator optimum temperature, qualitative) and M7 (tower CSP with molten-salt storage).
 */
import { skyIrradiance } from './irradiance';

export const SIGMA_SB = 5.67e-8;

/* ------------------------------------------------ M6 ------------------------------------------------------ */

/** η_rec = α − ε·σ·T⁴/(C·G); η = η_rec·(1 − 300/T)·0.6 (α 0.95, G 900 W/m²). */
export function concentratorEfficiency(
  tK: number,
  concentration: number,
  emissivity: number,
  gWm2 = 900,
): number {
  const rec = 0.95 - (emissivity * SIGMA_SB * tK ** 4) / (concentration * gWm2);
  return rec * (1 - 300 / tK) * 0.6;
}

/** Receiver emissivity: evacuated tube with selective coating (trough, Fresnel) or open receiver (tower, dish). */
export const RECEIVER_EMISSIVITY = { selective: 0.1, open: 0.85 } as const;
/** Material limits for the η(T) chart, °C. */
export const HEAT_TRANSFER_LIMITS_C = { syntheticOil: 400, solarSalt: 600 } as const;

/** Optimum T ∈ [350, 1500] K (1 K grid + parabolic refinement); returns °C and η. */
export function concentratorOptimum(
  concentration: number,
  emissivity: number,
): { tOptC: number; eta: number } {
  let bestT = 350;
  let best = -Infinity;
  for (let t = 350; t <= 1500; t += 1) {
    const e = concentratorEfficiency(t, concentration, emissivity);
    if (e > best) {
      best = e;
      bestT = t;
    }
  }
  const a = concentratorEfficiency(bestT - 1, concentration, emissivity);
  const c = concentratorEfficiency(bestT + 1, concentration, emissivity);
  const den = a - 2 * best + c;
  const shift = bestT > 350 && bestT < 1500 && den < 0 ? (0.5 * (a - c)) / den : 0;
  const t = bestT + shift;
  return { tOptC: t - 273.15, eta: concentratorEfficiency(t, concentration, emissivity) };
}

/* ------------------------------------------------ M7 ------------------------------------------------------ */

export interface CspParams {
  /** Storage hours h_storage (0…15). */
  storageH: number;
  /** Turbine set-point, MW (default 100). */
  pSetMw?: number;
  /** «Хмари пополудні»: DNI × 0.5 (M2 «мінлива») from 13:00 to 17:00 (window chosen by S3-sim, see audit). */
  afternoonClouds?: boolean;
}

export const CSP = {
  pMaxMw: 100,
  etaCycle: 0.42,
  solarMultiple: 2.5,
  etaField: 0.95,
  latDeg: 25,
  dayOfYear: 172,
  dtH: 0.25,
  cpKjPerKgK: 1.5,
  dTK: 275,
} as const;

export interface CspResult {
  /** Electricity on the reported (third) day, MWh. */
  dailyMwh: number;
  /** Hours with zero output. */
  zeroHours: number;
  wThMaxMwh: number;
  /** Salt mass, t. */
  saltT: number;
  /** Per 15-min interval of day 3: start hour, P_el MW, receiver heat MW_th, storage level 0…1 (end of interval). */
  series: { hour: number; pElMw: number; qRecMw: number; level: number; dumpedMw: number }[];
  /** Daily DNI sum, kWh/m². */
  dniKwhM2: number;
}

/** Receiver heat Q_rec = SM·(P_max/η_cycle)·DNI/900·η_field, MW_th, at solar hour t (midpoint sampling). */
export function receiverHeatMw(solarHour: number, afternoonClouds = false): { qMw: number; dni: number } {
  const clouded = afternoonClouds && solarHour >= 13 && solarHour < 17;
  const dni = skyIrradiance(CSP.latDeg, CSP.dayOfYear, solarHour, clouded ? 'partly' : 'clear').dniWm2;
  return { qMw: ((CSP.solarMultiple * CSP.pMaxMw) / CSP.etaCycle) * (dni / 900) * CSP.etaField, dni };
}

/** Three identical days from W_th = 0.3·W_th,max at 00:00; the third is reported (periodic regime). */
export function simulateCsp(p: CspParams): CspResult {
  const pSet = p.pSetMw ?? CSP.pMaxMw;
  const wMax = (Math.max(0, p.storageH) * CSP.pMaxMw) / CSP.etaCycle;
  const dt = CSP.dtH;
  const n = Math.round(24 / dt);
  let w = 0.3 * wMax;
  const series: CspResult['series'] = [];
  let mwh = 0;
  let zero = 0;
  let dniSum = 0;
  for (let day = 0; day < 3; day++) {
    for (let k = 0; k < n; k++) {
      const { qMw: q, dni } = receiverHeatMw((k + 0.5) * dt, p.afternoonClouds);
      const qTurb = Math.min(pSet / CSP.etaCycle, q + w / dt);
      let next = w + (q - qTurb) * dt;
      let dumped = 0;
      if (next > wMax) {
        dumped = (next - wMax) / dt;
        next = wMax;
      }
      w = Math.max(0, next);
      if (day === 2) {
        const pel = qTurb * CSP.etaCycle;
        mwh += pel * dt;
        if (pel < 1e-6) zero += dt;
        dniSum += (dni * dt) / 1000;
        series.push({
          hour: k * dt,
          pElMw: pel,
          qRecMw: q,
          level: wMax > 0 ? w / wMax : 0,
          dumpedMw: dumped,
        });
      }
    }
  }
  return {
    dailyMwh: mwh,
    zeroHours: zero,
    wThMaxMwh: wMax,
    saltT: (wMax * 3.6e6) / (CSP.cpKjPerKgK * CSP.dTK) / 1000,
    series,
    dniKwhM2: dniSum,
  };
}
