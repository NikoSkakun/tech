/**
 * `plant-future` M5 (D–T power balance), M5b (NIF illustrative curve), M6 (Voyager RTG), step 8 magnetic pressure,
 * step 10 piezo tile.
 */

const SIGMA_V_T_KEV = [1, 2, 5, 10, 20, 50, 100, 200];
const SIGMA_V_M3S = [5.5e-27, 2.6e-25, 1.3e-23, 1.1e-22, 4.2e-22, 8.7e-22, 8.5e-22, 6.3e-22];
export const E_FUS_J = 2.82e-12;
const KEV_J = 1.602e-16;

/** ⟨σv⟩ for D–T by log-log interpolation of the NRL table (clamped to 1…200 keV), m³/s. */
export function sigmaV(tKeV: number): number {
  const t = Math.min(200, Math.max(1, tKeV));
  let i = 0;
  while (i < SIGMA_V_T_KEV.length - 2 && t > SIGMA_V_T_KEV[i + 1]!) i++;
  const x0 = Math.log(SIGMA_V_T_KEV[i]!);
  const x1 = Math.log(SIGMA_V_T_KEV[i + 1]!);
  const y0 = Math.log(SIGMA_V_M3S[i]!);
  const y1 = Math.log(SIGMA_V_M3S[i + 1]!);
  return Math.exp(y0 + ((Math.log(t) - x0) / (x1 - x0)) * (y1 - y0));
}

export interface FusionBalance {
  /** Fusion power density, W/m³. */
  pFusWm3: number;
  pLossWm3: number;
  pAlphaWm3: number;
  pHeatWm3: number;
  /** Q = p_fus/p_heat; Infinity = ignition. */
  q: number;
  ignition: boolean;
  /** Triple product n·T·τ_E, keV·s/m³. */
  tripleProduct: number;
}

/** p_fus = ¼n²⟨σv⟩E; p_loss = 3nTe/τ_E + 5.35e−37·n²·√T; p_α = p_fus/5; p_heat = p_loss − p_α. */
export function fusionBalance(nM3: number, tKeV: number, tauES: number): FusionBalance {
  const pf = 0.25 * nM3 * nM3 * sigmaV(tKeV) * E_FUS_J;
  const loss = (3 * nM3 * tKeV * KEV_J) / tauES + 5.35e-37 * nM3 * nM3 * Math.sqrt(tKeV);
  const pa = pf / 5;
  const heat = loss - pa;
  const ignition = heat <= 0;
  return {
    pFusWm3: pf,
    pLossWm3: loss,
    pAlphaWm3: pa,
    pHeatWm3: heat,
    q: ignition ? Infinity : pf / heat,
    ignition,
    tripleProduct: nM3 * tKeV * tauES,
  };
}

/** M5b NIF illustrative yield: 0.05·W_L below 1.8 MJ, then 0.09·exp(14.2·(W_L − 1.8)), capped at 12 MJ. */
export function nifYieldMj(laserMj: number): number {
  if (laserMj < 1.8) return 0.05 * laserMj;
  return Math.min(12, 0.09 * Math.exp(14.2 * (laserMj - 1.8)));
}
/** Real shots drawn as separate markers (MJ on target, MJ yield). */
export const NIF_SHOTS = [
  { laserMj: 2.05, yieldMj: 3.15 },
  { laserMj: 2.08, yieldMj: 8.6 },
] as const;

/** Q_eng = W_fus·η_conv/(W_L/η_laser), η_conv = 0.4. */
export function engineeringGain(
  yieldMj: number,
  laserMj: number,
  laserEfficiency: number,
  etaConv = 0.4,
): number {
  return (yieldMj * etaConv) / (laserMj / laserEfficiency);
}

/** M6 Voyager RTG: P(t) = 470·2^(−t/87.7)·(1 − 0.006·t), t in years since 1977. */
export function voyagerRtgW(year: number): number {
  const t = Math.max(0, year - 1977);
  return 470 * 2 ** (-t / 87.7) * (1 - 0.006 * t);
}

/** Step 8: magnetic pressure B²/(2μ₀), MPa. */
export function magneticPressureMpa(bT: number): number {
  return (bT * bT) / (2 * 4e-7 * Math.PI) / 1e6;
}

/** Step 10 piezo tile: steps per day × J per step → Wh (≈ 2…5 J per step). */
export function piezoWh(stepsPerDay: number, joulePerStep = 3.5): number {
  return (stepsPerDay * joulePerStep) / 3600;
}
