/**
 * plant-coal M3 (step 8) flue-gas cleaning and M4 (step 9) CCS.
 *   flue gas = P_fuel·3600·0,35 Nm³/h (dry, 6 % O₂); SO₂ raw = coal kg/h·S·2; dust raw = coal kg/h·ash·0,8;
 *   NOx raw 600 mg/Nm³ (low-NOx burners); FGD ×0,03 SO₂ and ×0,5 dust; ESP ×0,001 dust; SCR ×0,15 NOx;
 *   gypsum = ΔSO₂·172,17/64,07; limestone = ΔSO₂·100,09/64,07·1,03; NH₃ = ΔNOx·Q·17/46 (≈ NO₂-equivalent stoichiometry)
 *   EU limits SO₂ 150, NOx 150, dust 10 mg/Nm³; annual t = kg/h·8760·CF/1000 (CF 0,6).
 * CCS: capture 90 %, energy penalty 25 % at the same fuel → g/kWh = CO₂·0,1/(0,75·P_net).
 */
import { COALS, fuelUse, type CoalType } from './fuel';

export const LIMITS_MG_NM3 = { so2: 150, nox: 150, dust: 10 } as const;
export const ANNUAL_CF = 0.6;

export interface CleaningParams {
  coal: CoalType;
  /** Sulphur [%] (step 8 switch 0,5 / 1 / 2,5); default = the coal's typical value. */
  sulphurPct?: number;
  netMW: number;
  eta: number;
  scr: boolean;
  esp: boolean;
  fgd: boolean;
}

export interface Pollutant {
  rawKgPerH: number;
  outKgPerH: number;
  outMgPerNm3: number;
  rawMgPerNm3: number;
  overLimit: boolean;
  annualT: number;
}

export interface CleaningResult {
  flueGasNm3PerH: number;
  so2: Pollutant;
  dust: Pollutant;
  nox: Pollutant;
  gypsumTph: number;
  limestoneTph: number;
  ammoniaKgPerH: number;
}

export function flueGasCleaning(p: CleaningParams): CleaningResult {
  const f = fuelUse(p.coal, p.netMW, p.eta);
  const q = f.fuelMW * 3600 * 0.35;
  const coalKgH = f.coalTph * 1000;
  const s = (p.sulphurPct ?? COALS[p.coal].sulphurPct) / 100;
  const ash = COALS[p.coal].ashPct / 100;
  const mk = (raw: number, out: number, limit: number): Pollutant => ({
    rawKgPerH: raw,
    outKgPerH: out,
    rawMgPerNm3: (raw * 1e6) / q,
    outMgPerNm3: (out * 1e6) / q,
    overLimit: (out * 1e6) / q > limit,
    annualT: (out * 8760 * ANNUAL_CF) / 1000,
  });
  const so2Raw = coalKgH * s * 2;
  const so2Out = so2Raw * (p.fgd ? 0.03 : 1);
  const dustRaw = coalKgH * ash * 0.8;
  const dustOut = dustRaw * (p.esp ? 0.001 : 1) * (p.fgd ? 0.5 : 1);
  const noxRawMg = 600;
  const noxOutMg = noxRawMg * (p.scr ? 0.15 : 1);
  const removedSo2 = so2Raw - so2Out;
  return {
    flueGasNm3PerH: q,
    so2: mk(so2Raw, so2Out, LIMITS_MG_NM3.so2),
    dust: mk(dustRaw, dustOut, LIMITS_MG_NM3.dust),
    nox: mk((noxRawMg * q) / 1e6, (noxOutMg * q) / 1e6, LIMITS_MG_NM3.nox),
    gypsumTph: (removedSo2 / 1000) * (172.17 / 64.07),
    limestoneTph: (removedSo2 / 1000) * (100.09 / 64.07) * 1.03,
    ammoniaKgPerH: p.scr ? (((noxRawMg - noxOutMg) * q) / 1e6) * (17 / 46) : 0,
  };
}

export const CCS = { capture: 0.9, penalty: 0.25 } as const;

export interface CcsResult {
  netMW: number;
  stackCo2Tph: number;
  stackGPerKWh: number;
  capturedTph: number;
}

/** Same coal burn; with CCS the net output drops by 25 % and 90 % of CO₂ is captured. */
export function ccs(coal: CoalType, netMW: number, eta: number, enabled: boolean): CcsResult {
  const f = fuelUse(coal, netMW, eta);
  const cap = enabled ? CCS.capture : 0;
  const net = netMW * (enabled ? 1 - CCS.penalty : 1);
  const stack = f.co2Tph * (1 - cap);
  return { netMW: net, stackCo2Tph: stack, stackGPerKWh: (stack * 1e6) / (net * 1000), capturedTph: f.co2Tph * cap };
}
