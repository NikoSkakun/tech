/**
 * `lab-pv` steps 1, 2, 8: sunlight through the atmosphere (§M5), photon energy, sun arcs over the lab house.
 */
import { DEG } from '../core/S3-sim/num';
import {
  KYIV,
  clearSkyBeam,
  incidenceCos,
  noonElevationDeg,
  declinationDeg,
  sunPosition,
} from '../core/S3-sim/sun';

export { clearSkyBeam, airMassKastenYoung, meinelDniWm2, sunPosition } from '../core/S3-sim/sun';

/** h·c/q in eV·nm: E[eV] = 1239.84/λ[nm]. */
export const HC_EV_NM = 1239.841984;
/** Silicon band gap, eV (step 2). */
export const SI_BANDGAP_EV = 1.12;

export interface PhotonResult {
  energyEv: number;
  /** True when E_ph ≥ E_g — an electron–hole pair is created. */
  absorbed: boolean;
  /** Useful fraction η_ph = E_g/E_ph (0 when not absorbed). */
  usefulFraction: number;
  /** Thermalised excess E_ph − E_g (eV), shown as an orange flash. */
  heatEv: number;
}

/** Step 2 «Довжина хвилі λ» (300…1300 nm): 550 nm → 2.25 eV → 50 %; cut-off λ > 1107 nm. */
export function photon(wavelengthNm: number, bandGapEv = SI_BANDGAP_EV): PhotonResult {
  const e = HC_EV_NM / Math.max(1, wavelengthNm);
  const absorbed = e >= bandGapEv;
  return {
    energyEv: e,
    absorbed,
    usefulFraction: absorbed ? bandGapEv / e : 0,
    heatEv: absorbed ? e - bandGapEv : 0,
  };
}

/** Cut-off wavelength λ = hc/E_g (≈ 1107 nm for Si). */
export function cutoffWavelengthNm(bandGapEv = SI_BANDGAP_EV): number {
  return HC_EV_NM / bandGapEv;
}

export interface AtmosphereReadout {
  elevationDeg: number;
  zenithDeg: number;
  airMass: number;
  /** Clear-sky direct normal irradiance (beam only), W/m². */
  dniWm2: number;
  /** Beam on a horizontal square G_h = G_n·sin h, W/m². */
  beamHorizontalWm2: number;
  /** Relative path length through the atmosphere slab (= AM), for the 3D slab thickness. */
  pathLength: number;
}

/** Step 1 slider «Висота Сонця» h: 5…90° (default 41.8° ⇒ AM 1.5). */
export function atmosphere(elevationDeg: number): AtmosphereReadout {
  const h = Math.min(90, Math.max(5, elevationDeg));
  const b = clearSkyBeam(h);
  return {
    elevationDeg: h,
    zenithDeg: 90 - h,
    airMass: b.airMass,
    dniWm2: b.dniWm2,
    beamHorizontalWm2: b.beamHorizontalWm2,
    pathLength: b.airMass,
  };
}

/** Step 8 date tabs: day of year for 21 June, 20 March, 21 December, and the histogram month (0-based). */
export const SEASON_DAYS = {
  june21: { dayOfYear: 172, month: 5 },
  march20: { dayOfYear: 79, month: 2 },
  december21: { dayOfYear: 355, month: 11 },
} as const;
export type SeasonDay = keyof typeof SEASON_DAYS;

export interface ArcSample {
  solarHour: number;
  elevationDeg: number;
  /** Azimuth from south, + west. */
  azimuthDeg: number;
  /** Angle of incidence on the module, degrees (> 90° = sun behind the module). */
  incidenceDeg: number;
  /** Beam-only clear-sky irradiance on the module plane G_beam,POA = DNI·max(0, cos θ), W/m². */
  beamPoaWm2: number;
}

/**
 * Sun arc for one of the three dates over Kyiv and the incidence angle on a module with tilt β and azimuth γ
 * (from south, + west): cos θ = cos z·cos β + sin z·sin β·cos(A_s − γ) (§M5). Only above-horizon samples.
 */
export function sunArc(day: SeasonDay, tiltDeg: number, azimuthDeg: number, samples = 97): ArcSample[] {
  const n = SEASON_DAYS[day].dayOfYear;
  const out: ArcSample[] = [];
  for (let k = 0; k < samples; k++) {
    const t = (24 * k) / (samples - 1);
    const s = sunPosition(KYIV.latDeg, n, t);
    if (!s.up) continue;
    const c = incidenceCos(s.zenithDeg, s.azimuthDeg, tiltDeg, azimuthDeg);
    out.push({
      solarHour: t,
      elevationDeg: s.elevationDeg,
      azimuthDeg: s.azimuthDeg,
      incidenceDeg: Math.acos(Math.max(-1, Math.min(1, c))) / DEG,
      beamPoaWm2: clearSkyBeam(s.elevationDeg).dniWm2 * Math.max(0, c),
    });
  }
  return out;
}

/** Noon elevation over Kyiv for a date tab (63° in June, ≈16° in December, ≈39.5° at the equinox). */
export function kyivNoonElevationDeg(day: SeasonDay): number {
  return noonElevationDeg(KYIV.latDeg, declinationDeg(SEASON_DAYS[day].dayOfYear));
}
