/**
 * plants M2 (step 5) — illustrative Rankine efficiencies, NOT solved in real time.
 * Live steam 16 MPa, condenser 30 °C (4,247 kPa), turbine η 0,88, pump η 0,80, reheat at 3,5 MPa to 540 °C, no
 * regeneration, before boiler losses and auxiliaries. Values recomputed with IAPWS-IF97 by `tools/rankine_iapws.py`
 * (the document's hand-computed table: 0,35 / 0,39 / 0,42, ideal 0,40 / 0,44 / 0,47, turbine 880 / 1290 / 1590 kJ/kg;
 * differences in docs/audits/sim-S2-sim.md P1). «No condenser»: exhaust at 1 bar, make-up water at 15 °C.
 */

export type RankineConfig = 'saturated' | 'superheat' | 'reheat';

export interface RankinePoint {
  /** Cycle efficiency with the real turbine and pump. */
  eta: number;
  /** Moisture of the steam at the turbine exhaust (fraction). */
  moisture: number;
  turbineKJkg: number;
  pumpKJkg: number;
  /** Same cycle with an ideal turbine and pump. */
  etaIdeal: number;
  /** «Прибрати конденсатор»: efficiency and factor relative to the cycle with condenser. */
  noCondenserEta: number;
  noCondenserFactor: number;
}

/** IAPWS-IF97 output of tools/rankine_iapws.py (copied verbatim). */
export const RANKINE_IAPWS: Readonly<Record<RankineConfig, RankinePoint>> = {
  saturated: { eta: 0.3521, moisture: 0.3507, turbineKJkg: 877.4, pumpKJkg: 20.08, etaIdeal: 0.4022, noCondenserEta: 0.2363, noCondenserFactor: 0.671 },
  superheat: { eta: 0.3882, moisture: 0.1776, turbineKJkg: 1288.0, pumpKJkg: 20.08, etaIdeal: 0.4427, noCondenserEta: 0.2785, noCondenserFactor: 0.717 },
  reheat: { eta: 0.4087, moisture: 0.0807, turbineKJkg: 1563.9, pumpKJkg: 20.08, etaIdeal: 0.4594, noCondenserEta: 0.3001, noCondenserFactor: 0.734 },
};

export const RANKINE_SATURATION_TEMP_C = 347.36;
export const RANKINE_CONDENSER_KPA = 4.247;
/** Moisture above which the counter turns amber (real turbines allow ≈ 12–14 %). */
export const MOISTURE_LIMIT = 0.13;

/** Toggles «Перегрів» / «Проміжний перегрів» (reheat implies superheat). */
export function rankineConfig(superheat: boolean, reheat: boolean): RankineConfig {
  return reheat ? 'reheat' : superheat ? 'superheat' : 'saturated';
}

export function rankine(superheat: boolean, reheat: boolean, condenser = true): RankinePoint & { config: RankineConfig; shownEta: number; moistureWarning: boolean } {
  const config = rankineConfig(superheat, reheat);
  const p = RANKINE_IAPWS[config];
  return { ...p, config, shownEta: condenser ? p.eta : p.noCondenserEta, moistureWarning: condenser && p.moisture > MOISTURE_LIMIT };
}

/** Pump work estimate of the text: w_p ≈ v·Δp = 0,001 m³/kg × 16 MPa = 16 kJ/kg (ideal). */
export const PUMP_WORK_ESTIMATE_KJKG = 0.001 * 16e6 / 1000;
