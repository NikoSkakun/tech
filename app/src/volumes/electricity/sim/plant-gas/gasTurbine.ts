/**
 * plant-gas M1 (steps 3, 4, 6) — gas turbine, Brayton cycle with losses (cold-air standard, constant c_p):
 *   τ = r^((γ−1)/γ); w_c = c_p·T1·(τ − 1)/η_c; T2 = T1 + w_c/c_p; w_t = c_p·T3·η_t·(1 − 1/τ); T4 = T3 − w_t/c_p;
 *   w_net = w_t − w_c; q_in = c_p·(T3 − T2); η = w_net/q_in; compressor share = w_c/w_t; ṁ = P/w_net.
 * c_p 1,005 kJ/(kg·K), γ 1,4, T1 288,15 K, η_c 0,86, η_t 0,88 (calibrated so H/J class gives ≈ 44 %).
 * M2 (step 5, illustrative «оцінка»): T_metal = 950 + 120·!TBC + 200·!film + 350·!internal + 0,6·(TIT − 1600) °C;
 * > 1100 creep, > 1300 melting.
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export const GT = { cp: 1.005, gamma: 1.4, t1K: 288.15, etaC: 0.86, etaT: 0.88 } as const;
export const R_RANGE = [4, 40] as const;
export const TIT_RANGE_C = [900, 1700] as const;

export interface GasTurbineResult {
  eta: number;
  t2C: number;
  t4C: number;
  wNetKJkg: number;
  wCompKJkg: number;
  wTurbKJkg: number;
  compressorShare: number;
  /** w_net ≤ 0 → «машина не тягне сама себе»; < 100 kJ/kg → red warning. */
  selfSustaining: boolean;
  lowWorkWarning: boolean;
  /** TIT > 1650 °C → «за межами сучасних матеріалів». */
  beyondMaterials: boolean;
}

export function gasTurbine(pressureRatio: number, titC: number): GasTurbineResult {
  const r = clamp(pressureRatio, R_RANGE[0], R_RANGE[1]);
  const tit = clamp(titC, TIT_RANGE_C[0], TIT_RANGE_C[1]);
  const t3 = tit + 273.15;
  const tau = r ** ((GT.gamma - 1) / GT.gamma);
  const wc = (GT.cp * GT.t1K * (tau - 1)) / GT.etaC;
  const t2 = GT.t1K + wc / GT.cp;
  const wt = GT.cp * t3 * GT.etaT * (1 - 1 / tau);
  const t4 = t3 - wt / GT.cp;
  const wnet = wt - wc;
  const qin = GT.cp * (t3 - t2);
  return {
    eta: wnet > 0 ? wnet / qin : 0,
    t2C: t2 - 273.15,
    t4C: t4 - 273.15,
    wNetKJkg: wnet,
    wCompKJkg: wc,
    wTurbKJkg: wt,
    compressorShare: wc / wt,
    selfSustaining: wnet > 0,
    lowWorkWarning: wnet < 100,
    beyondMaterials: tit > 1650,
  };
}

/** Air mass flow [kg/s] for a power [MW]: ṁ = P/w_net. */
export function airFlowKgS(powerMW: number, r: GasTurbineResult): number {
  return r.wNetKJkg > 0 ? (powerMW * 1000) / r.wNetKJkg : Infinity;
}

/** Step 4 presets (r, TIT °C). */
export const GT_PRESETS = {
  classE: { r: 12, titC: 1100 },
  classF: { r: 17, titC: 1350 },
  classHJ: { r: 23, titC: 1600 },
  aeroderivative: { r: 30, titC: 1300 },
} as const;

export function bladeMetalTempC(tbc: boolean, film: boolean, internal: boolean, titC: number): number {
  return 950 + (tbc ? 0 : 120) + (film ? 0 : 200) + (internal ? 0 : 350) + 0.6 * (titC - 1600);
}

export function bladeState(metalC: number): 'ok' | 'creep' | 'melting' {
  return metalC > 1300 ? 'melting' : metalC > 1100 ? 'creep' : 'ok';
}
