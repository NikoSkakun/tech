/**
 * The one house (docs/volumes/electricity/chapters/_shared-house.md §2–§3, DECISIONS §13, §48) — numeric data only; on-screen names come
 * from the content export. PF and bill hours are added by `home` §Г.1.
 */
import type { McbCurve } from './protection';

export const HOUSE_PHASE_V = 230;
export const TARIFF_UAH_PER_KWH = 4.32;
export const TARIFF_NIGHT_UAH_PER_KWH = 2.16;
/** Main breaker C40, single phase (≈ 9,2 kW). */
export const MAIN_BREAKER = { ratedA: 40, curve: 'C' as McbCurve };

export type CircuitId = 'lights' | 'rooms' | 'fridge' | 'boiler' | 'kitchen' | 'bath' | 'stove' | 'aircon' | 'ev';

export interface Circuit {
  id: CircuitId;
  ratedA: number;
  curve: McbCurve;
  /** RCBO 30 mA (bath) / RCD for the EV charger. */
  residualMA: number | null;
  cableMm2: number;
  critical: boolean;
}

export const CIRCUITS: readonly Circuit[] = [
  { id: 'lights', ratedA: 10, curve: 'B', residualMA: null, cableMm2: 1.5, critical: true },
  { id: 'rooms', ratedA: 16, curve: 'C', residualMA: null, cableMm2: 2.5, critical: true },
  { id: 'fridge', ratedA: 16, curve: 'C', residualMA: null, cableMm2: 2.5, critical: true },
  { id: 'boiler', ratedA: 16, curve: 'C', residualMA: null, cableMm2: 2.5, critical: true },
  { id: 'kitchen', ratedA: 16, curve: 'C', residualMA: null, cableMm2: 2.5, critical: false },
  { id: 'bath', ratedA: 16, curve: 'C', residualMA: 30, cableMm2: 2.5, critical: false },
  { id: 'stove', ratedA: 32, curve: 'C', residualMA: null, cableMm2: 6, critical: false },
  { id: 'aircon', ratedA: 16, curve: 'C', residualMA: null, cableMm2: 2.5, critical: false },
  { id: 'ev', ratedA: 20, curve: 'C', residualMA: 30, cableMm2: 4, critical: false },
];

export type ApplianceId =
  | 'kettle'
  | 'microwave'
  | 'fridge'
  | 'iron'
  | 'washer'
  | 'waterHeater'
  | 'cooktop'
  | 'vacuum'
  | 'heater'
  | 'tv'
  | 'laptop'
  | 'aircon'
  | 'router'
  | 'gasBoilerPump'
  | 'lighting'
  | 'ev';

export interface Appliance {
  id: ApplianceId;
  /** Nameplate (running) power [W]. */
  powerW: number;
  /** Average power for energy/autonomy [W] (fridge 60, gas boiler 80 in winter). */
  averageW: number;
  powerFactor: number;
  /** Inrush multiple and duration (1 / 0 = none). */
  inrushMultiple: number;
  inrushS: number;
  circuit: CircuitId;
  /** Typical hours per day for the bill (home §Г.1). */
  hoursPerDay: number;
}

export const APPLIANCES: readonly Appliance[] = [
  { id: 'kettle', powerW: 2000, averageW: 2000, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'kitchen', hoursPerDay: 0.25 },
  { id: 'microwave', powerW: 1200, averageW: 1200, powerFactor: 0.95, inrushMultiple: 3, inrushS: 0.05, circuit: 'kitchen', hoursPerDay: 0.2 },
  { id: 'fridge', powerW: 150, averageW: 60, powerFactor: 0.8, inrushMultiple: 5, inrushS: 0.3, circuit: 'fridge', hoursPerDay: 24 },
  { id: 'iron', powerW: 2200, averageW: 2200, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'kitchen', hoursPerDay: 0.2 },
  { id: 'washer', powerW: 2000, averageW: 2000, powerFactor: 1, inrushMultiple: 3, inrushS: 0.2, circuit: 'bath', hoursPerDay: 0.6 },
  { id: 'waterHeater', powerW: 2000, averageW: 2000, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'bath', hoursPerDay: 2 },
  { id: 'cooktop', powerW: 6000, averageW: 1500, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'stove', hoursPerDay: 1 },
  { id: 'vacuum', powerW: 1400, averageW: 1400, powerFactor: 0.95, inrushMultiple: 4, inrushS: 0.2, circuit: 'rooms', hoursPerDay: 0.2 },
  { id: 'heater', powerW: 2000, averageW: 2000, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'rooms', hoursPerDay: 0 },
  { id: 'tv', powerW: 100, averageW: 100, powerFactor: 0.9, inrushMultiple: 1, inrushS: 0, circuit: 'rooms', hoursPerDay: 5 },
  { id: 'laptop', powerW: 65, averageW: 65, powerFactor: 0.55, inrushMultiple: 1, inrushS: 0, circuit: 'rooms', hoursPerDay: 8 },
  { id: 'aircon', powerW: 900, averageW: 900, powerFactor: 0.95, inrushMultiple: 1, inrushS: 0, circuit: 'aircon', hoursPerDay: 0 },
  { id: 'router', powerW: 20, averageW: 20, powerFactor: 0.6, inrushMultiple: 1, inrushS: 0, circuit: 'rooms', hoursPerDay: 24 },
  { id: 'gasBoilerPump', powerW: 100, averageW: 80, powerFactor: 0.9, inrushMultiple: 2, inrushS: 0.2, circuit: 'boiler', hoursPerDay: 24 },
  { id: 'lighting', powerW: 150, averageW: 150, powerFactor: 0.9, inrushMultiple: 1, inrushS: 0, circuit: 'lights', hoursPerDay: 8 },
  { id: 'ev', powerW: 3700, averageW: 3700, powerFactor: 1, inrushMultiple: 1, inrushS: 0, circuit: 'ev', hoursPerDay: 0 },
];

export function appliance(id: ApplianceId): Appliance {
  return APPLIANCES.find((a) => a.id === id)!;
}

export function circuit(id: CircuitId): Circuit {
  return CIRCUITS.find((c) => c.id === id)!;
}
