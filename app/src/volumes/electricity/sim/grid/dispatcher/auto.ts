/**
 * grid §Б.6 auto-dispatcher — greedy merit order with ramp limits, re-planned every 5 min with what is known now.
 *  N = P_L,forecast − P_PV − P_wind − nuclear − CHP_min.
 *  Energy-limited units are spread by peak shaving over the rest of the day (plan.ts): hydro shaves N itself; PSH,
 *  BESS and DR only shave what CHP flex + coal + import + gas cannot cover. Energy-unlimited units follow in the order
 *  CHP flex → coal (setpoints for t + 30 min; a stopped unit is started when the +3 h forecast exceeds CHP + coal +
 *  import capacity) → import (hourly) → gas (10-min start; at most one unit stopped per step) → outage queues.
 *  Surplus (N below the minimum loads): PSH pumping and BESS charging.
 * Deviation from the document (logged in docs/audits/sim-S2-sim.md): the document spreads hydro ∝ N over 07–22 and
 * leaves CHP at must-run; with those rules the «hard day» cannot reach its own sanity range (ENS 1–4k MWh).
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';
import { FLEET, STEP_MIN, type DayEvent, type DispatcherScenario } from './fleet';
import { forecast, planStorages } from './plan';
import { ramp, type DispatcherControls, type FleetState } from './units';

export { knownEvents } from './plan';

export const AUTO_TUNING = {
  /** Forecast horizon for slow decisions [min] (coal must be able to follow). */
  forecastMin: 30,
  /** Coal start look-ahead [min] (= start-up time) and the shortfall duration that justifies a start [min]. */
  coalStartLookaheadMin: 180,
  coalStartMinShortfallMin: 60,
  /** Part of the automatic pool (±600 MW) the dispatcher keeps free before ordering outage queues [MW]. */
  queueToleranceMW: 300,
} as const;

const idx = (minutesAhead: number) => Math.round(minutesAhead / STEP_MIN);
const at = (a: readonly number[], i: number) => a[Math.min(Math.max(0, i), a.length - 1)] ?? 0;

export function autoControls(
  sc: DispatcherScenario,
  events: readonly DayEvent[],
  min: number,
  f: FleetState,
  prev: DispatcherControls,
): DispatcherControls {
  const T = AUTO_TUNING;
  const cap = FLEET.import.maxMW[sc.mode];
  const chpFlex = FLEET.chp.maxMW - FLEET.chp.mustRunMW[sc.season];
  const fc = forecast(sc, events, min, f);
  const online = f.coal.filter((u) => u.status === 'running').length;
  const committed = f.coal.filter((u) => u.status === 'running' || u.status === 'starting').length;
  const unlimited = fc.netMW.map(() => chpFlex + committed * FLEET.coal.maxMW + cap + FLEET.gas.units * FLEET.gas.maxMW);
  const plan = planStorages(fc.netMW, unlimited, f, sc);
  const after = plan.afterMW;

  // coal commitment: shortfall of CHP + committed coal + import beyond the start-up time
  const coalRun = f.coal.map((u) => u.status === 'running' || u.status === 'starting');
  const cheapCap = chpFlex + committed * FLEET.coal.maxMW + cap;
  // compare with N − hydro (not with the storage plan, which would otherwise «replace» the coal start)
  const beforeStorage = fc.netMW.map((n, i) => n - plan.hydroMW[i]!);
  const shortSteps = beforeStorage.slice(idx(T.coalStartLookaheadMin)).filter((r) => r > cheapCap).length;
  const stopped = f.coal.findIndex((u) => u.status === 'stopped');
  if (stopped >= 0 && shortSteps * STEP_MIN >= T.coalStartMinShortfallMin) coalRun[stopped] = true;

  // CHP flex and coal follow the 30-min forecast
  const a30 = at(after, idx(T.forecastMin));
  const chpSetpointMW = FLEET.chp.mustRunMW[sc.season] + clamp(a30, 0, chpFlex);
  const hour = Math.floor(min / 60);
  const importScheduleMW = [...prev.importScheduleMW];
  if (min % 60 === 0) {
    let worst = 0;
    for (let i = 0; i < idx(60); i++) worst = Math.max(worst, at(after, i) - chpFlex - online * FLEET.coal.maxMW);
    importScheduleMW[hour] = clamp(worst, 0, cap);
  }
  const imp = importScheduleMW[hour] ?? 0;
  const imp30 = importScheduleMW[Math.floor((min + T.forecastMin) / 60)] ?? imp;
  const coalTotal = clamp(a30 - clamp(a30, 0, chpFlex) - (min % 60 >= 30 ? imp30 : imp), online * FLEET.coal.minMW, online * FLEET.coal.maxMW);
  const coalSet = online > 0 ? coalTotal / online : FLEET.coal.minMW;
  const coalSetpointMW = f.coal.map(() => coalSet);
  const coalNext = f.coal.reduce((s, u) => s + (u.status === 'running' ? ramp(u.outputMW, coalSet, FLEET.coal.rampMWPerMin) : 0), 0);
  const chpNext = ramp(f.chpMW, chpSetpointMW, FLEET.chp.rampMWPerMin) - FLEET.chp.mustRunMW[sc.season];

  // storages: follow the plan; PSH needs 10 min to change mode
  const pshSoon = Math.max(...plan.pshMW.slice(0, idx(FLEET.psh.modeChangeMin) + 1));
  const pshDelivered = f.pshActiveMode === 'generate' ? Math.min(at(plan.pshMW, 0), f.pshReservoirMWh * 12) : 0;
  let rem = at(after, 0) - chpNext - coalNext - imp + (at(plan.pshMW, 0) - pshDelivered);
  let pshMode: DispatcherControls['pshMode'] = pshSoon > 0 ? 'generate' : 'stop';
  let pshSetpointMW = pshSoon > 0 ? Math.max(at(plan.pshMW, 0), 0) : 0;
  let bessSetpointMW = at(plan.bessMW, 0);
  if (rem < 0 && pshSoon <= 0) {
    // surplus: pump and charge (the PSH plan does not need the unit in the next 10 min)
    const surplus = -rem;
    const room = FLEET.psh.reservoirMWh - f.pshReservoirMWh;
    pshSetpointMW = room > 1 ? clamp(surplus, 0, FLEET.psh.pumpMW) : 0;
    pshMode = pshSetpointMW > 0 ? 'pump' : 'stop';
    bessSetpointMW = -clamp(surplus - pshSetpointMW, 0, FLEET.bess.maxMW);
    rem = 0;
  }

  // gas: started 10 min ahead; at most one unit stopped per step (no start/stop chattering)
  const ahead = at(after, idx(FLEET.gas.startMin)) - chpFlex - online * FLEET.coal.maxMW - imp;
  const target = Math.ceil(Math.max(0, rem, ahead) / FLEET.gas.maxMW - 1e-9);
  const running = f.gas.filter((u) => u.status !== 'stopped').length;
  const gasUnits = clamp(target >= running ? target : running - 1, 0, FLEET.gas.units);
  const gasNow = f.gas.reduce((s, u, i) => s + (i < gasUnits && u.status === 'running' ? FLEET.gas.maxMW : 0), 0);
  rem -= Math.min(gasNow, Math.max(0, rem));
  // hydro bridges what the slow units cannot follow yet (start-ups, ramps, unforeseen events), if water is left
  const waterLeft = Math.max(0, FLEET.hydro.waterMWh[sc.mode] - f.waterUsedMWh);
  const hydroSetpointMW = at(plan.hydroMW, 0) + clamp(rem, 0, Math.min(FLEET.hydro.maxMW - at(plan.hydroMW, 0), waterLeft * 12));
  rem -= hydroSetpointMW - at(plan.hydroMW, 0);
  if (rem > 0 && bessSetpointMW >= 0) {
    // BESS (instant) bridges the rest, within its energy
    const extra = clamp(rem, 0, Math.min(FLEET.bess.maxMW - bessSetpointMW, f.bessEnergyMWh * FLEET.bess.etaDischarge * 12));
    bessSetpointMW += extra;
    rem -= extra;
  }

  // outage queues only for what is still missing beyond the tolerated part of the automatic pool
  const loadNow = at(fc.loadMW, 0);
  const qMW = FLEET.queues.share * loadNow;
  const queues = rem > T.queueToleranceMW ? clamp(Math.ceil((rem - T.queueToleranceMW) / qMW), 0, FLEET.queues.max) : 0;

  return {
    chpSetpointMW,
    coalRun,
    coalSetpointMW,
    hydroSetpointMW,
    pshMode,
    pshSetpointMW,
    gasUnits,
    gasSetpointMW: FLEET.gas.maxMW,
    bessSetpointMW,
    importScheduleMW,
    demandResponse: at(plan.drMW, 0) > 0,
    queues,
  };
}
