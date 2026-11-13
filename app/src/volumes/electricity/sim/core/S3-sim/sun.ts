/**
 * Sun position, clear-sky beam irradiance and plane-of-array (POA) irradiance.
 *
 * Used by `lab-pv` (§M5, step 1 and 8), `plant-solar` (M1–M4, M7) and `lab-hybrid-home` (§M1).
 * Time is local *solar* time (no time zones, no equation of time), as all three documents specify.
 * Angles in the public API are degrees; azimuths are measured **from south, positive to the west**
 * unless the name says otherwise (`…FromNorthDeg`).
 */
import { DEG, clamp } from './num';

/** Solar constant used by `lab-pv` §M5 (W/m², without orbital eccentricity). */
export const SOLAR_CONSTANT_WM2 = 1361;

/** Kyiv, the course's reference site (`_shared-house.md` §1). */
export const KYIV = { latDeg: 50.45, lonDeg: 30.52 } as const;

/** Cooper's declination: δ = 23.45°·sin(2π·(284 + n)/365), n = day of year 1…365. */
export function declinationDeg(dayOfYear: number): number {
  return 23.45 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
}

/** Hour angle ω = 15°·(t_solar − 12), negative in the morning. */
export function hourAngleDeg(solarHour: number): number {
  return 15 * (solarHour - 12);
}

/** Solar noon elevation h_max = 90° − φ + δ (northern mid-latitudes). */
export function noonElevationDeg(latDeg: number, declDeg: number): number {
  return 90 - latDeg + declDeg;
}

export interface SunPosition {
  declinationDeg: number;
  hourAngleDeg: number;
  /** cos z = sin φ·sin δ + cos φ·cos δ·cos ω (can be negative at night). */
  cosZenith: number;
  zenithDeg: number;
  /** Elevation (altitude) α = 90° − z; negative below the horizon. */
  elevationDeg: number;
  /** Azimuth from south, + towards west (morning negative). */
  azimuthDeg: number;
  /** Azimuth from north, clockwise (east = 90°, south = 180°, west = 270°). */
  azimuthFromNorthDeg: number;
  /** True when the Sun is above the horizon. */
  up: boolean;
}

/** Sun position for latitude φ, day of year n and local solar time t (hours, 0…24). */
export function sunPosition(latDeg: number, dayOfYear: number, solarHour: number): SunPosition {
  const decl = declinationDeg(dayOfYear);
  const ha = hourAngleDeg(solarHour);
  const phi = latDeg * DEG;
  const d = decl * DEG;
  const w = ha * DEG;
  const cz = clamp(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(w), -1, 1);
  const z = Math.acos(cz);
  const sz = Math.max(1e-9, Math.sin(z));
  const sa = (Math.cos(d) * Math.sin(w)) / sz;
  const ca = (Math.sin(phi) * cz - Math.sin(d)) / Math.max(1e-9, Math.cos(phi) * sz);
  const az = Math.atan2(sa, ca) / DEG;
  return {
    declinationDeg: decl,
    hourAngleDeg: ha,
    cosZenith: cz,
    zenithDeg: z / DEG,
    elevationDeg: 90 - z / DEG,
    azimuthDeg: az,
    azimuthFromNorthDeg: (az + 180 + 360) % 360,
    up: cz > 0,
  };
}

/**
 * Relative optical air mass, Kasten–Young (1989): AM = 1 / (cos z + 0.50572·(96.07995 − z)^−1.6364).
 * The formula is defined up to z ≈ 96°; beyond that a large finite value is returned.
 */
export function airMassKastenYoung(zenithDeg: number): number {
  if (zenithDeg >= 96) return 1e3;
  const v = Math.cos(zenithDeg * DEG) + 0.50572 * (96.07995 - zenithDeg) ** -1.6364;
  return v > 1e-3 ? 1 / v : 1e3;
}

/**
 * Clear-sky direct normal irradiance after Meinel & Meinel (1976): G_n = G_sc·0.7^(AM^0.678) [W/m²].
 * `lab-pv` uses G_sc = 1361, `plant-solar` M2 uses 1353 (both documented).
 */
export function meinelDniWm2(airMass: number, solarConstantWm2 = SOLAR_CONSTANT_WM2): number {
  return solarConstantWm2 * 0.7 ** (airMass ** 0.678);
}

export interface ClearSkyBeam {
  airMass: number;
  /** Direct normal irradiance, W/m². */
  dniWm2: number;
  /** Direct irradiance on a horizontal surface G_h = G_n·sin h, W/m². */
  beamHorizontalWm2: number;
}

/** `lab-pv` §M5: beam-only clear-sky irradiance for a Sun elevation h (degrees). */
export function clearSkyBeam(elevationDeg: number, solarConstantWm2 = SOLAR_CONSTANT_WM2): ClearSkyBeam {
  if (elevationDeg <= 0)
    return { airMass: airMassKastenYoung(90 - elevationDeg), dniWm2: 0, beamHorizontalWm2: 0 };
  const am = airMassKastenYoung(90 - elevationDeg);
  const dni = meinelDniWm2(am, solarConstantWm2);
  return { airMass: am, dniWm2: dni, beamHorizontalWm2: dni * Math.sin(elevationDeg * DEG) };
}

/**
 * Cosine of the angle of incidence on a tilted plane:
 * cos θ = cos z·cos β + sin z·sin β·cos(A_s − γ), azimuths from south (+west). Not clamped.
 */
export function incidenceCos(
  zenithDeg: number,
  sunAzimuthDeg: number,
  tiltDeg: number,
  surfaceAzimuthDeg: number,
): number {
  const z = zenithDeg * DEG;
  const b = tiltDeg * DEG;
  return (
    Math.cos(z) * Math.cos(b) +
    Math.sin(z) * Math.sin(b) * Math.cos((sunAzimuthDeg - surfaceAzimuthDeg) * DEG)
  );
}

export interface PoaInput {
  dniWm2: number;
  dhiWm2: number;
  ghiWm2: number;
  /** Cosine of incidence on the plane (may be negative — clamped to 0). */
  cosIncidence: number;
  tiltDeg: number;
  /** Ground albedo ρ_g. */
  albedo: number;
}

/**
 * Isotropic-sky plane-of-array irradiance (Liu–Jordan):
 * G_POA = DNI·max(0, cos θ) + DHI·(1 + cos β)/2 + ρ_g·GHI·(1 − cos β)/2.
 */
export function poaIsotropicWm2(p: PoaInput): number {
  const cb = Math.cos(p.tiltDeg * DEG);
  return (
    p.dniWm2 * Math.max(0, p.cosIncidence) + (p.dhiWm2 * (1 + cb)) / 2 + (p.albedo * p.ghiWm2 * (1 - cb)) / 2
  );
}
