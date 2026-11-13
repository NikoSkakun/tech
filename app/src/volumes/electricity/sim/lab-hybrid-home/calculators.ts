/**
 * `lab-hybrid-home` §M7 calculators (steps 5, 6, 9) and the step 12 illustrative microgrid peak.
 */

/** Autonomy t = W_bat·(SOC − SOC_min)/100·η_dis/P, h (10.24 kWh, 100 → 10 %, 0.33 kW → 26.5 h). */
export function autonomyHours(
  batKwh: number,
  socPct: number,
  loadKw: number,
  socMinPct = 10,
  etaDis = 0.95,
): number {
  if (loadKw <= 0) return Infinity;
  return (((batKwh * Math.max(0, socPct - socMinPct)) / 100) * etaDis) / loadKw;
}

/** Recharge t = W_bat·(SOC_target − SOC)/100/(P_ch·η_ch), h (40 → 100 %, 2 kW → 3.23 h; 5 kW → 1.29 h). */
export function rechargeHours(
  batKwh: number,
  socPct: number,
  targetPct: number,
  pChKw: number,
  etaCh = 0.95,
): number {
  if (pChKw <= 0) return Infinity;
  return (batKwh * Math.max(0, targetPct - socPct)) / 100 / (pChKw * etaCh);
}

/** Battery module step, kWh (16S1P LFP-100). */
export const BATTERY_MODULE_KWH = 5.12;

/**
 * W_bat = P_avg·t/(DoD·η_dis)·(1 + margin), rounded up to a multiple of 5.12 kWh.
 * Control: 0.325 kW, 16 h, DoD 0.9, η 0.95 → 6.08 → 10.24; margin 0.2 → 7.30 → 10.24; 4 h → 1.52 → 5.12.
 */
export function batterySize(pAvgKw: number, hours: number, dod = 0.9, etaDis = 0.95, margin = 0) {
  const required = ((pAvgKw * hours) / (dod * etaDis)) * (1 + margin);
  const modules = Math.max(1, Math.ceil(required / BATTERY_MODULE_KWH - 1e-9));
  return { requiredKwh: required, recommendedKwh: modules * BATTERY_MODULE_KWH, modules };
}

export const STANDARD_INVERTERS_KW = [3, 5, 6, 8, 10, 12] as const;

export interface SizingAppliance {
  /** Running power, kW. */
  pRunKw: number;
  /** Start-up multiple k (1 = none). */
  kStart?: number;
}

/**
 * Smallest standard inverter with P ≥ 1.25·ΣP_run and 2·P ≥ ΣP_run + max((k − 1)·P_run).
 * Control: ΣP_run 1.57 kW, peak 5.57 → 3 kW; with a 2 kW kettle: 3.57, peak 7.57 → 5 kW.
 */
export function inverterSize(items: readonly SizingAppliance[]) {
  const sumRun = items.reduce((s, a) => s + a.pRunKw, 0);
  const maxSurge = items.reduce((m, a) => Math.max(m, ((a.kStart ?? 1) - 1) * a.pRunKw), 0);
  const peak = sumRun + maxSurge;
  const needContinuous = 1.25 * sumRun;
  const needPeak = peak / 2;
  const pick = STANDARD_INVERTERS_KW.find((p) => p >= needContinuous - 1e-9 && p >= needPeak - 1e-9) ?? null;
  return {
    sumRunKw: sumRun,
    peakKw: peak,
    needContinuousKw: needContinuous,
    needPeakKw: needPeak,
    recommendedKw: pick,
  };
}

/** Kyiv daily specific yield at 37°, kWh/kWp·day, January…December (PVGIS). */
export const KYIV_DAILY_YIELD = [
  1.19, 2.01, 3.07, 3.95, 4.39, 4.65, 4.53, 4.38, 3.73, 2.59, 1.19, 0.88,
] as const;
export const MODULE_KWP = 0.44;
/** Roof capacity: 12 modules on the south slope (+12 on east/west at ≈ 77–79 % yield). */
export const ROOF_SOUTH_MODULES = 12;

/** kWp = W_day·share/Y_day(month); modules = ceil(kWp/0.44). 9.79 kWh: June → 2.11 kWp (5), December → 11.13 (26). */
export function pvSize(dailyKwh: number, share: number, monthIndex: number) {
  const y = KYIV_DAILY_YIELD[Math.min(11, Math.max(0, Math.round(monthIndex)))]!;
  const kwp = (dailyKwh * share) / y;
  const modules = Math.ceil(kwp / MODULE_KWP - 1e-9);
  return {
    kwp,
    modules,
    fitsSouthRoof: modules <= ROOF_SOUTH_MODULES,
    fitsWholeRoof: modules <= 2 * ROOF_SOUTH_MODULES,
  };
}

/** Step 9 table summary: daily critical energy, peak simultaneous power, largest start surge. */
export function loadTableSummary(
  rows: readonly { kw: number; hoursPerDay: number; kStart?: number; critical: boolean }[],
) {
  return {
    criticalKwhPerDay: rows.filter((r) => r.critical).reduce((s, r) => s + r.kw * r.hoursPerDay, 0),
    peakKw: rows.reduce((s, r) => s + r.kw, 0),
    largestStartKw: rows.reduce((m, r) => Math.max(m, (r.kStart ?? 1) * r.kw), 0),
  };
}

/**
 * Step 12 illustration (not a calculation): transformer peak after the grid returns, in units of P_base.
 * «розумний» (smart): 1.5 − 0.5·share; «усі одразу» (all at once): 1.5 + 1.0·share.
 */
export function microgridPeak(share: number, smart: boolean): number {
  const s = Math.min(1, Math.max(0, share));
  return smart ? 1.5 - 0.5 * s : 1.5 + 1.0 * s;
}
