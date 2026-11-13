/**
 * `plant-ocean` M1 (sea level, spring–neap), M3 (tidal-stream turbine), M4 (wave power, wavelength),
 * M5 (point absorber resonance), M6 (OTEC), step 7 (storm survival, fouling), step 8 (PRO membrane).
 */
import { RHO_SEA, G, SPRING_NEAP_S, T_M2_S } from './barrage';

/* ------------------------------------------------ M1 ------------------------------------------------------ */

/** ζ(t) = (H(t)/2)·cos(2πt/T_M2), H(t) = H̄·(1 + 0.4·cos(2πt/14.77 d)) with spring–neap, else H̄. */
export function seaLevelM(tS: number, meanRangeM: number, springNeap = false): number {
  const h = springNeap ? meanRangeM * (1 + 0.4 * Math.cos((2 * Math.PI * tS) / SPRING_NEAP_S)) : meanRangeM;
  return (h / 2) * Math.cos((2 * Math.PI * tS) / T_M2_S);
}

/** Range relative to spring tide for a Moon–Sun angle ψ: √(1 + 0.46² + 2·0.46·cos 2ψ)/1.46 (0° → 1, 90° → 0.37). */
export function relativeRange(moonSunAngleDeg: number): number {
  const c = Math.cos((2 * moonSunAngleDeg * Math.PI) / 180);
  return Math.sqrt(1 + 0.46 ** 2 + 2 * 0.46 * c) / 1.46;
}

/** Step 2 location scale: our bay 8 m, open ocean 0.8 m, Black Sea 8 cm. */
export const TIDE_SCALE = { bay: 1, openOcean: 0.1, blackSea: 0.01 } as const;

/* ------------------------------------------------ M3 ------------------------------------------------------ */

export const STREAM_TURBINE = { diameterM: 18, cp: 0.42, ratedW: 1.5e6, cutInMs: 1.0 } as const;

/** P = min(P_r, ½·ρ·A·|v|³·C_p) above the 1 m/s cut-in. */
export function streamPowerW(vMs: number): number {
  const v = Math.abs(vMs);
  if (v < STREAM_TURBINE.cutInMs) return 0;
  const a = (Math.PI * STREAM_TURBINE.diameterM ** 2) / 4;
  return Math.min(STREAM_TURBINE.ratedW, 0.5 * RHO_SEA * a * v ** 3 * STREAM_TURBINE.cp);
}

/** v(t) = v_max(t)·sin(2πt/T_M2), v_max(t) = v̄_max·(1 + 0.35·cos(2πt/14.77 d)). */
export function streamSpeed(tS: number, meanVmax = 3): number {
  return (
    meanVmax *
    (1 + 0.35 * Math.cos((2 * Math.PI * tS) / SPRING_NEAP_S)) *
    Math.sin((2 * Math.PI * tS) / T_M2_S)
  );
}

/** Capacity factor and energy per day over `days` (default 29.54, step 60 s). */
export function streamCapacityFactor(meanVmax = 3, days = 29.54, stepS = 60) {
  let e = 0;
  const n = Math.round((days * 86400) / stepS);
  for (let k = 0; k < n; k++) e += streamPowerW(streamSpeed(k * stepS, meanVmax)) * stepS;
  const cf = e / (STREAM_TURBINE.ratedW * n * stepS);
  return { capacityFactor: cf, mwhPerDay: e / 3.6e9 / days };
}

/** Rotor diameter for a power P in a medium of density ρ at speed v (C_p 0.42): water 3 m/s → 18.1 m, air 12 m/s → 65.5 m. */
export function diameterForPower(pW: number, vMs: number, rho: number, cp = 0.42): number {
  return Math.sqrt((4 * pW) / (0.5 * rho * vMs ** 3 * cp) / Math.PI);
}

/** Equivalent wind speed giving the same power per area as water at v (ρ ratio). */
export function equivalentWindMs(vWaterMs: number, rhoAir = 1.225): number {
  return vWaterMs * Math.cbrt(RHO_SEA / rhoAir);
}

/* ------------------------------------------------ M4 ------------------------------------------------------ */

/** Wave power per metre of crest P = ρ·g²·H_s²·T_e/(64π), W/m; deep-water wavelength λ = g·T²/(2π). */
export function wavePowerWPerM(hsM: number, teS: number): number {
  return (RHO_SEA * G * G * hsM * hsM * teS) / (64 * Math.PI);
}
export function wavelengthM(tS: number): number {
  return (G * tS * tS) / (2 * Math.PI);
}

/** Visual Gerstner components: periods T_e·{0.8, 1, 1.25}, amplitudes summing to H_s/2. */
export function gerstnerComponents(hsM: number, teS: number) {
  const w = [0.25, 0.5, 0.25];
  return [0.8, 1, 1.25].map((f, i) => ({
    periodS: teS * f,
    amplitudeM: (hsM / 2) * w[i]!,
    wavelengthM: wavelengthM(teS * f),
  }));
}

/** Step 5 sea presets (typical H_s, T_e). */
export const SEA_PRESETS = {
  blackSea: { hs: 1, te: 6 },
  northSea: { hs: 2, te: 8 },
  atlanticIreland: { hs: 3, te: 10 },
} as const;

/* ------------------------------------------------ M5 ------------------------------------------------------ */

/** Point absorber with ζ_d = 0.2: P_norm(r) = (2ζr)²/((1 − r²)² + (2ζr)²), A(r) = 1/√(…) (screen ≤ 2), r = T_n/T_e. */
export function pointAbsorber(naturalPeriodS: number, teS: number, zeta = 0.2) {
  const r = naturalPeriodS / teS;
  const den = (1 - r * r) ** 2 + (2 * zeta * r) ** 2;
  const amp = 1 / Math.sqrt(den);
  return {
    r,
    pNorm: (2 * zeta * r) ** 2 / den,
    amplification: amp,
    screenAmplification: Math.min(2, amp),
    inResonance: Math.abs(r - 1) < 0.05,
  };
}

/* ------------------------------------------------ M6 ------------------------------------------------------ */

/** OTEC: η_C = 1 − T_d/T_s (K); η_gross = 0.35·η_C; η_net = η_gross·(1 − 0.4); «не окупиться» for ΔT < 18 °C. */
export function otec(surfaceC: number, deepC: number) {
  const etaC = 1 - (deepC + 273.15) / (surfaceC + 273.15);
  const gross = 0.35 * etaC;
  return {
    etaCarnot: etaC,
    etaGross: gross,
    etaNet: gross * 0.6,
    pumpShare: 0.4,
    uneconomic: surfaceC - deepC < 18,
  };
}

/** Pressure-retarded osmosis membrane power density, W/m² (commercial threshold ≈ 5 W/m²). */
export const PRO_MEMBRANE_W_M2 = { old: 1, modern: 5 } as const;

/* ------------------------------------------------ step 7 -------------------------------------------------- */

/** Fouling: efficiency −5 %/year without cleaning (illustrative). */
export function foulingFactor(years: number): number {
  return Math.max(0, 1 - 0.05 * years);
}
