/**
 * Wind turbine power curve, rotor speed, pitch, Weibull annual energy and shear profile.
 * Source: `plant-wind` M1, M4, M6 (reviewed: shear reference 8.5 m/s at 200 m).
 */

export const RHO0 = 1.225; // kg/m³
export const R_SPECIFIC_AIR = 287.05; // J/(kg·K)
export const P0_PA = 101325;

/** Air density from temperature at sea-level pressure: ρ = p₀/(R_s·(T + 273.15)). */
export function airDensity(tC: number): number {
  return P0_PA / (R_SPECIFIC_AIR * (tC + 273.15));
}

/** Swept area A = π·D²/4, m². */
export function sweptArea(dM: number): number {
  return (Math.PI * dM * dM) / 4;
}

/** Power in the wind P = ½·ρ·A·v³, W. */
export function windPowerW(vMs: number, dM: number, rho = RHO0): number {
  return 0.5 * rho * sweptArea(dM) * vMs ** 3;
}

export interface TurbineSpec {
  ratedW: number;
  diameterM: number;
  vInMs: number;
  vOutMs: number;
  /** κ = C_p·η_drivetrain (0.47·0.93 = 0.437). */
  kappa: number;
  tipSpeedRatio: number;
  rpmMin: number;
  rpmMax: number;
}

/** Hero onshore turbine: 6 MW, D = 170 m. */
export const TURBINE_6MW: TurbineSpec = {
  ratedW: 6e6,
  diameterM: 170,
  vInMs: 3,
  vOutMs: 25,
  // κ = C_p·η_dt = 0.47·0.93, rounded to 0.437 as in the document (its control values use 0.437).
  kappa: 0.437,
  tipSpeedRatio: 8,
  rpmMin: 4,
  rpmMax: 10.1,
};
/** Offshore 15 MW, D = 236 m (step 10); rpm limit from the same 90 m/s tip speed. */
export const TURBINE_15MW: TurbineSpec = {
  ...TURBINE_6MW,
  ratedW: 15e6,
  diameterM: 236,
  rpmMax: (90 * 60) / (Math.PI * 236),
};

/** Rated wind speed v_r = (P_r/(½ρAκ))^(1/3). */
export function ratedSpeed(t: TurbineSpec, rho = RHO0): number {
  return (t.ratedW / (0.5 * rho * sweptArea(t.diameterM) * t.kappa)) ** (1 / 3);
}

/**
 * Electrical power P(v), W. Hard cut-out: 0 for v ≥ v_out. Storm control: P_r·(1 − (v − 25)/10) for v_out ≤ v < 35.
 */
export function turbinePowerW(t: TurbineSpec, vMs: number, stormControl = false, rho = RHO0): number {
  if (vMs < t.vInMs) return 0;
  if (vMs >= t.vOutMs) {
    if (!stormControl || vMs >= 35) return 0;
    return t.ratedW * (1 - (vMs - 25) / 10);
  }
  return Math.min(t.ratedW, 0.5 * rho * sweptArea(t.diameterM) * vMs ** 3 * t.kappa);
}

/** Rotor speed n = clamp(60·λ·v/(2π·R), n_min, n_max) while producing, else 0 (storm control: n_max while P > 0). */
export function rotorRpm(t: TurbineSpec, vMs: number, stormControl = false): number {
  if (vMs < t.vInMs) return 0;
  if (vMs >= t.vOutMs) return stormControl && vMs < 35 ? t.rpmMax : 0;
  const n = (60 * t.tipSpeedRatio * vMs) / (2 * Math.PI * (t.diameterM / 2));
  return Math.min(t.rpmMax, Math.max(t.rpmMin, n));
}

/** Pitch for visualisation: 0 below v_r, ≈ 1.7°·(v − v_r) above (max 25°), 90° feathered when stopped. */
export function pitchDeg(t: TurbineSpec, vMs: number, stormControl = false): number {
  const stopped = vMs >= t.vOutMs ? !stormControl || vMs >= 35 : false;
  if (stopped) return 90;
  return Math.min(25, Math.max(0, 1.7 * (vMs - ratedSpeed(t))));
}

/** Weibull pdf f(v) = (k/c)·(v/c)^(k−1)·exp(−(v/c)^k). */
export function weibullPdf(vMs: number, k: number, c: number): number {
  if (vMs < 0) return 0;
  return (k / c) * (vMs / c) ** (k - 1) * Math.exp(-((vMs / c) ** k));
}

/** Lanczos Γ(x) for the Weibull scale c = v̄/Γ(1 + 1/k). */
export function gamma(x: number): number {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const xx = x - 1;
  let a = p[0]!;
  const tt = xx + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += p[i]! / (xx + i);
  return Math.sqrt(2 * Math.PI) * tt ** (xx + 0.5) * Math.exp(-tt) * a;
}

export interface AnnualEnergy {
  /** Mean power without losses, W. */
  meanPowerW: number;
  /** AEP with η_loss, Wh. */
  aepWh: number;
  /** Capacity factor with losses. */
  capacityFactor: number;
  capacityFactorNoLoss: number;
  weibullC: number;
}

/** M6: P̄ = ∫₀^40 P(v)·f(v) dv (step 0.05 m/s, trapezoid), AEP = 8760·η_loss·P̄, CF = AEP/(8760·P_r). */
export function annualEnergy(
  t: TurbineSpec,
  meanVMs: number,
  k = 2,
  etaLoss = 0.85,
  dv = 0.05,
): AnnualEnergy {
  const c = meanVMs / gamma(1 + 1 / k);
  let s = 0;
  const n = Math.round(40 / dv);
  for (let i = 0; i <= n; i++) {
    const v = i * dv;
    const w = i === 0 || i === n ? 0.5 : 1;
    s += w * turbinePowerW(t, v) * weibullPdf(v, k, c);
  }
  const mean = s * dv;
  const cf0 = mean / t.ratedW;
  return {
    meanPowerW: mean,
    aepWh: 8760 * etaLoss * mean,
    capacityFactor: cf0 * etaLoss,
    capacityFactorNoLoss: cf0,
    weibullC: c,
  };
}

/** Shear profile v̄(h) = 8.5·(h/200)^α (reviewed M6), clamped to 4…11 m/s. */
export function shearMeanSpeed(hubHeightM: number, alpha: number, vRef = 8.5, hRef = 200): number {
  return Math.min(11, Math.max(4, vRef * (hubHeightM / hRef) ** alpha));
}

/** Terrain presets of step 9. */
export const TERRAIN_ALPHA = { sea: 0.1, steppe: 0.14, forest: 0.25 } as const;
