/**
 * `plant-future` M3 (step 4): portable/standby generators — Willans line, efficiency, tank hours, start-up dip.
 */
import { appliance, type ApplianceId } from '@electricity/sim/core/S2-sim/house';

export interface GensetSpec {
  ratedKw: number;
  /** Willans line F = a·P_r + b·P, l/h. */
  a: number;
  b: number;
  /** Fuel LHV, kWh/l. */
  lhvKwhPerL: number;
  tankL: number;
  inverter: boolean;
}

export const GENSETS = {
  diesel10: { ratedKw: 10, a: 0.08, b: 0.25, lhvKwhPerL: 9.9, tankL: 40, inverter: false },
  petrol3: { ratedKw: 3, a: 0.12, b: 0.4, lhvKwhPerL: 8.9, tankL: 15, inverter: false },
  inverter2: { ratedKw: 2, a: 0.05, b: 0.45, lhvKwhPerL: 8.9, tankL: 4, inverter: true },
} as const satisfies Record<string, GensetSpec>;
export type GensetId = keyof typeof GENSETS;

/** Fuel flow, specific consumption, efficiency and hours on a full tank at load P (kW). */
export function gensetOperatingPoint(g: GensetSpec, pKw: number) {
  const p = Math.max(0, pKw);
  const flow = g.a * g.ratedKw + g.b * p;
  return {
    fuelLPerH: flow,
    litresPerKwh: p > 0 ? flow / p : Infinity,
    efficiency: p > 0 ? p / (flow * g.lhvKwhPerL) : 0,
    tankHours: g.tankL / flow,
    overload: p > g.ratedKw,
  };
}

/** Step 4 appliances: nameplates and inrush of the one house (`_shared-house.md` §3, DECISIONS §48). */
function fromHouse(id: ApplianceId) {
  const a = appliance(id);
  return { kw: a.powerW / 1000, kStart: a.inrushMultiple, tStartS: a.inrushS };
}

export const GENSET_APPLIANCES = {
  fridge: fromHouse('fridge'),
  boiler: fromHouse('gasBoilerPump'),
  kettle: fromHouse('kettle'),
  waterHeater: fromHouse('waterHeater'),
  router: fromHouse('router'),
  laptop: fromHouse('laptop'),
  /** Well pump (plot option, separate line in `_shared-house.md` §3; not part of the core house list). */
  pump: { kw: 1.0, kStart: 5, tStartS: 0.5 },
} as const;
export type GensetAppliance = keyof typeof GENSET_APPLIANCES;

/**
 * Starting an appliance: peak = P_running + (k − 1)·P_app; protection trips above 1.3·P_r (M3 «P_sum·k_start»
 * read as running load plus the surge of the starting appliance, see audit).
 */
export function startCheck(g: GensetSpec, runningKw: number, app: GensetAppliance) {
  const a = GENSET_APPLIANCES[app];
  const peak = runningKw + a.kStart * a.kw;
  return { peakKw: peak, trips: peak > 1.3 * g.ratedKw };
}

/**
 * Load-step transient (oscilloscope, qualitative): for ΔP > 30 % P_r a conventional set dips U by 20 %·ΔP/P_r
 * (AVR recovery τ = 0.3 s) and f by 5 %·ΔP/P_r (governor τ = 1.0 s); an inverter set dips U by 3 % only.
 * Returns per-unit U and f at time t after the step.
 */
export function loadStepResponse(g: GensetSpec, deltaKw: number, tS: number): { uPu: number; fPu: number } {
  const rel = deltaKw / g.ratedKw;
  if (tS < 0 || rel <= 0.3) return { uPu: 1, fPu: 1 };
  if (g.inverter) return { uPu: 1 - 0.03 * Math.exp(-tS / 0.3), fPu: 1 };
  return { uPu: 1 - 0.2 * rel * Math.exp(-tS / 0.3), fPu: 1 - 0.05 * rel * Math.exp(-tS / 1.0) };
}

/** ATS transfer from grid to generator: engine start 5…15 s (UPS / hybrid inverter < 20 ms). */
export const ATS_TRANSFER_S = { min: 5, max: 15 } as const;
