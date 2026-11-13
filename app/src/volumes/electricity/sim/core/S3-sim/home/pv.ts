/**
 * Hybrid-home 24 h model — §M1 «Сонце й PV» of `lab-hybrid-home` (oracle `home_model.py`, `poa_clear`, `pv_kw`).
 * Clear-sky POA on a south-facing 35° plane in Kyiv with orbital eccentricity; weather multiplier w.
 */

export type Season = 'winter' | 'spring' | 'summer';
export type Weather = 'clear' | 'partly' | 'overcast';

/** Day of year and clock offset (clock = solar time + offset, h; summer time in summer). */
export const SEASONS: Record<Season, { doy: number; offsetH: number }> = {
  winter: { doy: 355, offsetH: 0 },
  spring: { doy: 80, offsetH: 0 },
  summer: { doy: 172, offsetH: 1 },
};

/** Weather multiplier: clear 1.0, partly cloudy 0.6, overcast 0.2. */
export const WEATHER_FACTOR: Record<Weather, number> = { clear: 1.0, partly: 0.6, overcast: 0.2 };

export const HOME_LAT_DEG = 50.45;
export const HOME_TILT_DEG = 35;
export const HOME_PR = 0.8;

const RAD = Math.PI / 180;

/**
 * Clear-sky plane-of-array irradiance, W/m² (§M1):
 * I0 = 1361·(1 + 0.033·cos(2π·doy/365)); DNI = I0·0.7^(AM^0.678); DHI = 0.1·DNI; GHI = DNI·cos z + DHI;
 * cos θ = max(0, sin(φ−β)·sin δ + cos(φ−β)·cos δ·cos ω); POA = DNI·cos θ + DHI·(1 + cos β)/2 + 0.2·GHI·(1 − cos β)/2.
 */
export function poaClearWm2(
  doy: number,
  solarHour: number,
  tiltDeg = HOME_TILT_DEG,
  latDeg = HOME_LAT_DEG,
): number {
  const decl = 23.45 * RAD * Math.sin((2 * Math.PI * (284 + doy)) / 365);
  const ha = 15 * (solarHour - 12) * RAD;
  const phi = latDeg * RAD;
  const cz = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  if (cz <= 0) return 0;
  const zdeg = Math.acos(cz) / RAD;
  const am = 1 / (cz + 0.50572 * (96.07995 - zdeg) ** -1.6364);
  const i0 = 1361 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365));
  const dni = i0 * 0.7 ** (am ** 0.678);
  const dhi = 0.1 * dni;
  const ghi = dni * cz + dhi;
  const b = tiltDeg * RAD;
  const phi2 = (latDeg - tiltDeg) * RAD;
  const cosI = Math.max(0, Math.sin(phi2) * Math.sin(decl) + Math.cos(phi2) * Math.cos(decl) * Math.cos(ha));
  return dni * cosI + (dhi * (1 + Math.cos(b))) / 2 + (0.2 * ghi * (1 - Math.cos(b))) / 2;
}

/** PV DC power (inverter input), kW: P = kWp·PR·POA/1000·w at clock time t (minutes from 00:00). */
export function homePvKw(tMin: number, kwp: number, season: Season, weather: Weather): number {
  const s = SEASONS[season];
  const solarH = tMin / 60 - s.offsetH;
  return ((kwp * HOME_PR * poaClearWm2(s.doy, solarH)) / 1000) * WEATHER_FACTOR[weather];
}
