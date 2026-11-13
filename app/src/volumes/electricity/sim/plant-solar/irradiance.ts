/**
 * `plant-solar` M1–M3: sun position, clear-sky Meinel (G_sc 1353) with cloud multipliers, POA on a fixed south
 * plane and on a N–S single-axis tracker (±60°, optional backtracking), bifacial gain. Local solar time.
 */
import { DEG } from '../core/S3-sim/num';
import { airMassKastenYoung, meinelDniWm2, sunPosition } from '../core/S3-sim/sun';

export const PLANT_SOLAR_GSC = 1353;
export type Sky = 'clear' | 'partly' | 'overcast';
/** Cloud multipliers (DNI, DHI). */
export const CLOUD_FACTORS: Record<Sky, { dni: number; dhi: number }> = {
  clear: { dni: 1, dhi: 1 },
  partly: { dni: 0.5, dhi: 1.6 },
  overcast: { dni: 0, dhi: 2.0 },
};
/** Climate factor on clear-sky daily energy (simplified annual estimate). */
export const CLIMATE_FACTOR = { Kyiv: 0.62, Odesa: 0.7, Lviv: 0.6, Cairo: 0.85, Atacama: 0.92 } as const;

export interface SkyIrradiance {
  elevationDeg: number;
  zenithDeg: number;
  azimuthFromNorthDeg: number;
  declinationDeg: number;
  hourAngleDeg: number;
  dniWm2: number;
  dhiWm2: number;
  ghiWm2: number;
}

/** M1 + M2: DNI = 1353·0.7^(AM^0.678), DHI = 0.1·DNI (× cloud factors); zero for α ≤ 0.5°. */
export function skyIrradiance(
  latDeg: number,
  dayOfYear: number,
  solarHour: number,
  sky: Sky = 'clear',
): SkyIrradiance {
  const s = sunPosition(latDeg, dayOfYear, solarHour);
  let dni = 0;
  let dhi = 0;
  if (s.elevationDeg > 0.5) {
    const clearDni = meinelDniWm2(airMassKastenYoung(s.zenithDeg), PLANT_SOLAR_GSC);
    dni = clearDni * CLOUD_FACTORS[sky].dni;
    dhi = 0.1 * clearDni * CLOUD_FACTORS[sky].dhi;
  }
  return {
    elevationDeg: s.elevationDeg,
    zenithDeg: s.zenithDeg,
    azimuthFromNorthDeg: s.azimuthFromNorthDeg,
    declinationDeg: s.declinationDeg,
    hourAngleDeg: s.hourAngleDeg,
    dniWm2: dni,
    dhiWm2: dhi,
    ghiWm2: dni * Math.cos(s.zenithDeg * DEG) + dhi,
  };
}

export type Mount = 'fixed' | 'tracker' | 'horizontal';

export interface PoaOptions {
  mount: Mount;
  /** Fixed tilt, degrees (default 35). */
  tiltDeg?: number;
  /** Tracker rotation limit, degrees (default 60). */
  limitDeg?: number;
  /**
   * Row interaction of the tracker (qualitative, GCR ≈ 0.35): 'ideal' (default, used by the M4 control values) —
   * no rows; 'shading' — below α = 25° the beam is shaded by s = 1 − α/25°; 'backtracking' — R = R_ideal·α/25°.
   */
  rows?: 'ideal' | 'shading' | 'backtracking';
  /** Ground albedo ρ_g (0.2 grass, 0.8 snow). */
  albedo?: number;
  bifacial?: boolean;
}

export interface PoaResult {
  /** Plane-of-array irradiance (front), W/m². */
  poaWm2: number;
  /** With bifacial rear gain φ_bif·ρ_g·GHI·0.35 (φ_bif = 0.7), W/m². */
  effectiveWm2: number;
  cosIncidence: number;
  /** Tracker rotation R (+ = towards west), degrees; tilt for fixed/horizontal. */
  rotationDeg: number;
  /** Row-to-row shading fraction of the beam (tracker without backtracking, α < 25°). */
  shading: number;
}

/** M3: POA for the given sky state at latitude φ. */
export function planeOfArray(sky: SkyIrradiance, latDeg: number, o: PoaOptions): PoaResult {
  const rho = o.albedo ?? 0.2;
  const d = sky.declinationDeg * DEG;
  const h = sky.hourAngleDeg * DEG;
  const cz = Math.cos(sky.zenithDeg * DEG);
  let cosT: number;
  let beta: number;
  let rotation: number;
  let shading = 0;
  if (o.mount === 'tracker') {
    const sE = Math.cos(d) * Math.sin(h);
    const sZ = cz;
    const lim = (o.limitDeg ?? 60) * DEG;
    let R = Math.atan2(sE, sZ);
    if (sky.elevationDeg < 25 && (o.rows ?? 'ideal') !== 'ideal') {
      if (o.rows === 'backtracking') R = R * (Math.max(0, sky.elevationDeg) / 25);
      else shading = 1 - Math.max(0, sky.elevationDeg) / 25;
    }
    const rLim = Math.max(-lim, Math.min(lim, R));
    cosT = sE * Math.sin(rLim) + sZ * Math.cos(rLim);
    beta = Math.abs(rLim);
    rotation = rLim / DEG;
  } else {
    beta = o.mount === 'horizontal' ? 0 : (o.tiltDeg ?? 35) * DEG;
    const phi = latDeg * DEG;
    cosT = Math.sin(d) * Math.sin(phi - beta) + Math.cos(d) * Math.cos(phi - beta) * Math.cos(h);
    rotation = beta / DEG;
  }
  const poa =
    sky.dniWm2 * Math.max(0, cosT) * (1 - shading) +
    (sky.dhiWm2 * (1 + Math.cos(beta))) / 2 +
    (rho * sky.ghiWm2 * (1 - Math.cos(beta))) / 2;
  const eff = poa + (o.bifacial ? 0.7 * rho * sky.ghiWm2 * 0.35 : 0);
  return { poaWm2: poa, effectiveWm2: eff, cosIncidence: cosT, rotationDeg: rotation, shading };
}
