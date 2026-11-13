/**
 * `plant-solar` M4: plant power per kWp and clear-sky daily / annual energy.
 * T_cell = T_amb + 25 °C·G/800; P_DC = P_STC·(G/1000)·(1 + γ·(T_cell − 25))·η_bos (γ = −0.003, η_bos = 0.90);
 * P_AC = min(0.985·P_DC, P_STC/(DC/AC)).
 */
import { KYIV } from '../core/S3-sim/sun';
import { planeOfArray, skyIrradiance, type Mount, type PoaOptions, type Sky } from './irradiance';

export const PLANT_GAMMA = -0.003;
export const ETA_BOS = 0.9;
export const ETA_INVERTER = 0.985;

export interface PlantPower {
  cellTempC: number;
  /** Per kWp, kW. */
  pDcKw: number;
  pAcKw: number;
  /** DC power lost to inverter clipping (AC equivalent), kW per kWp. */
  clippedKw: number;
}

/** Power of 1 kWp at POA irradiance G (W/m²) and ambient T, with DC/AC ratio. */
export function plantPowerPerKwp(gWm2: number, ambientC: number, dcAc = 1.3): PlantPower {
  const tc = ambientC + (25 * gWm2) / 800;
  const pdc = (gWm2 / 1000) * (1 + PLANT_GAMMA * (tc - 25)) * ETA_BOS;
  const uncapped = ETA_INVERTER * pdc;
  const cap = 1 / dcAc;
  return {
    cellTempC: tc,
    pDcKw: pdc,
    pAcKw: Math.min(uncapped, cap),
    clippedKw: Math.max(0, uncapped - cap),
  };
}

export interface DayEnergy {
  /** kWh/kWp (AC). */
  acKwhPerKwp: number;
  /** Energy clipped by the inverter, kWh/kWp. */
  clippedKwhPerKwp: number;
  /** Profile for charts: [solar hour, POA W/m², P_AC kW/kWp]. */
  profile: { hour: number; poaWm2: number; pAcKw: number }[];
}

export interface DayOptions extends Partial<Omit<PoaOptions, 'mount'>> {
  mount: Mount;
  latDeg?: number;
  dayOfYear: number;
  ambientC: number;
  dcAc?: number;
  sky?: Sky;
  /** Integration step, h (default 1/60). */
  stepH?: number;
}

/** Clear-sky daily energy by midpoint integration over the day. */
export function dayEnergy(o: DayOptions): DayEnergy {
  const lat = o.latDeg ?? KYIV.latDeg;
  const dt = o.stepH ?? 1 / 60;
  let ac = 0;
  let clip = 0;
  const profile: DayEnergy['profile'] = [];
  const n = Math.round(24 / dt);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) * dt;
    const sky = skyIrradiance(lat, o.dayOfYear, t, o.sky ?? 'clear');
    const poa = sky.elevationDeg > 0.5 ? planeOfArray(sky, lat, { ...o, mount: o.mount }).effectiveWm2 : 0;
    const p = plantPowerPerKwp(poa, o.ambientC, o.dcAc ?? 1.3);
    ac += p.pAcKw * dt;
    clip += p.clippedKw * dt;
    if (k % Math.max(1, Math.round(0.25 / dt)) === 0) profile.push({ hour: t, poaWm2: poa, pAcKw: p.pAcKw });
  }
  return { acKwhPerKwp: ac, clippedKwhPerKwp: clip, profile };
}

/** Seasonal ambient temperature for annual sums: 10 ± 12 °C, minimum mid-January, maximum mid-July. */
export function seasonalAmbientC(dayOfYear: number): number {
  return 10 - 12 * Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365);
}

/** Annual clear-sky sum, kWh/kWp (×k_clim for a realistic estimate). */
export function annualClearSky(mount: Mount, latDeg = KYIV.latDeg, stepH = 0.25): number {
  let s = 0;
  for (let n = 1; n <= 365; n++)
    s += dayEnergy({ mount, latDeg, dayOfYear: n, ambientC: seasonalAmbientC(n), stepH }).acKwhPerKwp;
  return s;
}
