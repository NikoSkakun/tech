/**
 * home §Г (step 8) — the house: appliance currents I = P/(230·PF), group current = Σ (arithmetic, conservative),
 * main = Σ groups; each breaker is the MCB of §А (UI time ×10); fridge compressor cycles 16 min on / 24 min off
 * (mean 60 W) with an inrush ×5 / 0,3 s at every start. Bill: W_month = P_avg·h·30/1000 kWh, C = W·tariff.
 */
import {
  APPLIANCES,
  appliance,
  CIRCUITS,
  HOUSE_PHASE_V,
  MAIN_BREAKER,
  TARIFF_UAH_PER_KWH,
  type ApplianceId,
  type CircuitId,
} from '@electricity/sim/core/S2-sim/house';
import { createMcb, type Mcb } from '@electricity/sim/core/S2-sim/protection';

export const UI_TIME_SCALE = 10;
export const FRIDGE_CYCLE = { onS: 16 * 60, offS: 24 * 60 } as const;

export function applianceCurrentA(id: ApplianceId, powerW = appliance(id).powerW): number {
  return powerW / (HOUSE_PHASE_V * appliance(id).powerFactor);
}

/** Static group and main currents for a set of switched-on appliances (running powers). */
export function groupCurrents(on: readonly ApplianceId[]): { groupsA: Record<CircuitId, number>; mainA: number } {
  const groupsA = Object.fromEntries(CIRCUITS.map((c) => [c.id, 0])) as Record<CircuitId, number>;
  for (const id of on) groupsA[appliance(id).circuit] += applianceCurrentA(id);
  return { groupsA, mainA: Object.values(groupsA).reduce((a, b) => a + b, 0) };
}

export interface BillRow {
  id: ApplianceId;
  kWhPerMonth: number;
  uahPerMonth: number;
}

/** Monthly energy and cost; `hours` overrides the typical hours per day (slider 0…24). */
export function monthlyBill(hours: Partial<Record<ApplianceId, number>> = {}, tariff = TARIFF_UAH_PER_KWH): BillRow[] {
  return APPLIANCES.map((a) => {
    const h = hours[a.id] ?? a.hoursPerDay;
    // fridge and gas boiler: their 24 h use the mean power; others the running power
    const p = a.id === 'fridge' || a.id === 'gasBoilerPump' ? a.averageW : a.id === 'cooktop' ? 1500 : a.powerW;
    const kwh = (p * h * 30) / 1000;
    return { id: a.id, kWhPerMonth: kwh, uahPerMonth: kwh * tariff };
  });
}

/** Energy and cost of one use: P [W] for `minutes`. */
export function useCost(powerW: number, minutes: number, tariff = TARIFF_UAH_PER_KWH): { kWh: number; uah: number } {
  const kWh = (powerW * minutes) / 60 / 1000;
  return { kWh, uah: kWh * tariff };
}

/** Time-domain panel: one MCB per circuit + the main C40. `step(dt)` takes model seconds (scene: dt·UI_TIME_SCALE). */
export function createHousePanel() {
  const breakers = new Map<CircuitId, Mcb>(CIRCUITS.map((c) => [c.id, createMcb(c.ratedA, c.curve)]));
  const main = createMcb(MAIN_BREAKER.ratedA, MAIN_BREAKER.curve);
  const on = new Set<ApplianceId>();
  const startedAt = new Map<ApplianceId, number>();
  let t = 0;
  const currentOf = (id: ApplianceId): number => {
    const a = appliance(id);
    let p = a.powerW;
    const since = t - (startedAt.get(id) ?? t);
    if (id === 'fridge') {
      const phase = since % (FRIDGE_CYCLE.onS + FRIDGE_CYCLE.offS);
      if (phase >= FRIDGE_CYCLE.onS) return 0;
      if (phase < a.inrushS) p *= a.inrushMultiple;
    } else if (since < a.inrushS) p *= a.inrushMultiple;
    return p / (HOUSE_PHASE_V * a.powerFactor);
  };
  return {
    get timeS() {
      return t;
    },
    breaker: (id: CircuitId) => breakers.get(id)!.state,
    get main() {
      return main.state;
    },
    switchOn(id: ApplianceId) {
      on.add(id);
      startedAt.set(id, t);
    },
    switchOff(id: ApplianceId) {
      on.delete(id);
    },
    /** Present currents [A] per circuit (0 when its breaker or the main is open). */
    currents(): Record<CircuitId, number> {
      const out = Object.fromEntries(CIRCUITS.map((c) => [c.id, 0])) as Record<CircuitId, number>;
      if (!main.state.closed) return out;
      for (const id of on) {
        const c = appliance(id).circuit;
        if (breakers.get(c)!.state.closed) out[c] += currentOf(id);
      }
      return out;
    },
    step(dtS: number) {
      const cur = this.currents();
      main.step(dtS, Object.values(cur).reduce((a, b) => a + b, 0));
      for (const c of CIRCUITS) breakers.get(c.id)!.step(dtS, cur[c.id]);
      t += dtS;
    },
    /** «Звести автомат». */
    reclose(id: CircuitId | 'main') {
      (id === 'main' ? main : breakers.get(id)!).close();
    },
  };
}
