/**
 * `current` §6 (step `power`): appliances at 230 V (resistive / averaged, cos φ ignored), P_Σ = ΣP_i,
 * I_Σ = P_Σ/230 V, W = P_Σ·t (kWh, MJ, "car lifts to 367 m" n = W/1 kWh). Kettle: Q = 4186·1·80 = 334,9 kJ,
 * efficiency 0,8 → W = 418,6 kJ = 0,116 kWh, 209 s at 2 kW (scene ×20).
 * §8 (step `losses`): R_line = ρ_Cu·2L/A; R_load = U²/P_nom (P_nom = 2 kW at the chosen U); I = U/(R_line +
 * R_load); P_load = I²R_load; P_loss = I²R_line; U_load = I·R_load; η = R_load/(R_line + R_load). DC.
 */
import { clamp } from '../core/S1-sim/math';

export type ApplianceId = 'led' | 'charger' | 'laptop' | 'tv' | 'microwave' | 'kettle' | 'heater';
export const APPLIANCES_W: Readonly<Record<ApplianceId, number>> = { led: 10, charger: 20, laptop: 65, tv: 100, microwave: 1200, kettle: 2000, heater: 2000 };
export const MAINS_V = 230;
/** MCB rating mentioned on the chip (`home` chapter): above it «тут уже спрацював би автомат 16 A». */
export const BREAKER_HINT_A = 16;

export function appliancePower(on: readonly ApplianceId[], hours = 0): { totalW: number; currentA: number; energyKWh: number; energyMJ: number; carLifts: number; breakerWouldTrip: boolean } {
  const p = [...new Set(on)].reduce((s, id) => s + APPLIANCES_W[id], 0);
  const kwh = (p * clamp(hours, 0, 10)) / 1000;
  return { totalW: p, currentA: p / MAINS_V, energyKWh: kwh, energyMJ: kwh * 3.6, carLifts: kwh, breakerWouldTrip: p / MAINS_V > BREAKER_HINT_A };
}

export const KETTLE = { waterKg: 1, specificHeat: 4186, deltaT: 80, efficiency: 0.8, powerW: 2000, sceneSpeedup: 20, startC: 20, endC: 100 } as const;

export function kettleBoil(): { heatJ: number; electricJ: number; electricKWh: number; timeS: number } {
  const q = KETTLE.specificHeat * KETTLE.waterKg * KETTLE.deltaT;
  const w = q / KETTLE.efficiency;
  return { heatJ: q, electricJ: w, electricKWh: w / 3.6e6, timeS: w / KETTLE.powerW };
}

/** Kettle temperature after `modelTimeS` of heating (linear, losses folded into η), °C. */
export const kettleTemperatureC = (modelTimeS: number): number =>
  KETTLE.startC + (KETTLE.endC - KETTLE.startC) * clamp(modelTimeS / kettleBoil().timeS, 0, 1);

// ---------------------------------------------------------------- §8 line losses

export const LOSSES = {
  voltagesV: [12, 24, 48, 120, 230, 400, 1000] as const,
  crossSectionsMm2: [0.75, 1.5, 2.5, 4] as const,
  lengthRangeM: { min: 5, max: 100, step: 5, default: 50 },
  ratedW: 2000,
  copperOhmM: 1.68e-8,
} as const;

export interface LineLosses {
  lineOhm: number;
  loadOhm: number;
  currentA: number;
  loadW: number;
  lossW: number;
  loadV: number;
  efficiency: number;
  /** Heater brightness P_load/P_nom. */
  heaterBrightness: number;
  /** Wire heating per metre of conductor, W/m (colour). */
  lossPerMetreW: number;
}

export function lineLosses(voltageV: number, crossSectionMm2: number, lengthOneWayM: number): LineLosses {
  const rl = (LOSSES.copperOhmM * 2 * lengthOneWayM) / (crossSectionMm2 * 1e-6);
  const rLoad = (voltageV * voltageV) / LOSSES.ratedW;
  const i = voltageV / (rl + rLoad);
  const pLoad = i * i * rLoad;
  const pLoss = i * i * rl;
  return {
    lineOhm: rl,
    loadOhm: rLoad,
    currentA: i,
    loadW: pLoad,
    lossW: pLoss,
    loadV: i * rLoad,
    efficiency: rLoad / (rl + rLoad),
    heaterBrightness: pLoad / LOSSES.ratedW,
    lossPerMetreW: pLoss / (2 * lengthOneWayM),
  };
}
