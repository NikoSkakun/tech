/**
 * distribution Р7 (step 6) — allowed power of the service entrance. Single phase: I = ΣP/230 V (C40); three phases:
 * I_p = ΣP_p/230 V per phase (3 × 25 A); the cooktop (6 kW) and the 11 kW EV charger are three-phase (⅓ per phase).
 * The main breaker «clicks» as soon as I > I_n (simplified; the real thermal release takes minutes — `home/mcb`).
 * Appliance powers are the shared house values rounded to 0,1 kW (+ a «what if» heat pump 3 kW).
 */

export const PHASE_V = 230;
export type EntranceKind = 'single' | 'three';
export const ENTRANCE_RATED_A: Readonly<Record<EntranceKind, number>> = { single: 40, three: 25 };

export type EntranceApplianceId = 'kettle' | 'waterHeater' | 'cooktop' | 'aircon' | 'washer' | 'lighting' | 'ev' | 'heatPump';

/** Power [W]; EV: 3,7 kW single-phase, 11 kW three-phase. */
export function entranceApplianceW(id: EntranceApplianceId, kind: EntranceKind): number {
  const table: Record<EntranceApplianceId, number> = {
    kettle: 2000,
    waterHeater: 2000,
    cooktop: 6000,
    aircon: 900,
    washer: 2000,
    lighting: 150,
    ev: kind === 'three' ? 11000 : 3700,
    heatPump: 3000,
  };
  return table[id];
}

export const THREE_PHASE_APPLIANCES: readonly EntranceApplianceId[] = ['cooktop', 'ev'];

export interface PlacedAppliance {
  id: EntranceApplianceId;
  /** Phase 0…2 for single-phase appliances on a three-phase entrance (ignored otherwise). */
  phase?: 0 | 1 | 2;
}

export interface EntranceResult {
  phaseCurrentsA: number[];
  maxCurrentA: number;
  ratedA: number;
  totalW: number;
  /** Share of the allowed power (max phase current / rated). */
  utilisation: number;
  level: 'green' | 'amber' | 'red';
  tripped: boolean;
}

export function solveEntrance(kind: EntranceKind, items: readonly PlacedAppliance[]): EntranceResult {
  const phases = kind === 'single' ? [0] : [0, 0, 0];
  let total = 0;
  for (const it of items) {
    const w = entranceApplianceW(it.id, kind);
    total += w;
    if (kind === 'single') phases[0]! += w;
    else if (THREE_PHASE_APPLIANCES.includes(it.id)) for (let p = 0; p < 3; p++) phases[p]! += w / 3;
    else phases[it.phase ?? 0]! += w;
  }
  const currents = phases.map((w) => w / PHASE_V);
  const maxI = Math.max(...currents);
  const rated = ENTRANCE_RATED_A[kind];
  const u = maxI / rated;
  return {
    phaseCurrentsA: currents,
    maxCurrentA: maxI,
    ratedA: rated,
    totalW: total,
    utilisation: u,
    level: u > 1 ? 'red' : u >= 0.8 ? 'amber' : 'green',
    tripped: maxI > rated,
  };
}

/** Allowed power [W]: 230·40 ≈ 9,2 kW (single) or 3·230·25 ≈ 17,3 kW. */
export function allowedPowerW(kind: EntranceKind): number {
  return PHASE_V * ENTRANCE_RATED_A[kind] * (kind === 'single' ? 1 : 3);
}

/** Meter LED (1000 imp/kWh): flashes per second = P[kW]/3,6. */
export function meterFlashHz(powerW: number): number {
  return powerW / 1000 / 3.6;
}
