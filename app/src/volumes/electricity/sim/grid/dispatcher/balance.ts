/**
 * grid §Б.4–Б.5 — one 5-min step: unit updates, balance, quasi-steady frequency (core §Б.4 solver), PV curtailment
 * above 50,2 Hz, UFLS, and accounting (cost, CO₂, ENS, frequency quality).
 *   ΔP_bal = ΣP_gen − (P_L·(1 − 0,05·n_queues) − P_DR + P_pump + P_BESS,charge)
 */
import { DEFAULT_QUASI_STEADY, solveQuasiSteady, type QuasiSteadyParams } from '@electricity/sim/core/S2-sim/quasiSteadyFrequency';
import { bisect, clamp } from '@electricity/sim/core/S2-sim/math';
import { environmentAt } from './environment';
import { FLEET, STEP_H, STEP_MIN, importPrice, type DayEvent, type DispatcherScenario } from './fleet';
import {
  ramp,
  updateBess,
  updateCoal,
  updateDr,
  updateGas,
  updateHydro,
  updatePsh,
  type DispatcherControls,
  type FleetState,
} from './units';

export interface StepRecord {
  timeMin: number;
  loadMW: number;
  pvMW: number;
  pvCurtailedMW: number;
  windMW: number;
  nuclearMW: number;
  chpMW: number;
  coalMW: number;
  gasMW: number;
  hydroMW: number;
  pshGenMW: number;
  pshPumpMW: number;
  bessMW: number;
  importMW: number;
  drMW: number;
  queueMW: number;
  uflsMW: number;
  imbalanceMW: number;
  poolMW: number;
  fHz: number;
  unscheduledMW: number;
  costEur: number;
  co2t: number;
}

export interface Totals {
  ensQueueMWh: number;
  ensUflsMWh: number;
  costEur: number;
  co2t: number;
  steps: number;
  qualitySteps: number;
  uflsEvents: number;
  curtailedMWh: number;
  unscheduledMWh: number;
  loadMWhSum: number;
}

export const ZERO_TOTALS: Totals = {
  ensQueueMWh: 0,
  ensUflsMWh: 0,
  costEur: 0,
  co2t: 0,
  steps: 0,
  qualitySteps: 0,
  uflsEvents: 0,
  curtailedMWh: 0,
  unscheduledMWh: 0,
  loadMWhSum: 0,
};

export function quasiSteadyParamsFor(sc: DispatcherScenario, loadMW: number, importMW: number): QuasiSteadyParams {
  const cap = FLEET.import.maxMW[sc.mode];
  return {
    ...DEFAULT_QUASI_STEADY,
    loadMW,
    extGainMWPerHz: sc.connected ? 15000 : 0,
    // interconnector headroom: capacity minus the scheduled import (deficit), full capacity (surplus)
    extLimitDeficitMW: sc.connected ? Math.max(0, cap - importMW) : 0,
    extLimitSurplusMW: sc.connected ? cap : 0,
  };
}

/** Update every unit for one step from the controls (ramps, delays, energy limits). */
export function advanceFleet(
  f: FleetState,
  c: DispatcherControls,
  sc: DispatcherScenario,
  events: readonly DayEvent[],
  min: number,
): FleetState {
  const env = environmentAt(sc, events, min);
  let coal = f.coal.map((u, i) => updateCoal(u, c.coalRun[i] ?? false, c.coalSetpointMW[i] ?? FLEET.coal.minMW));
  if (env.coalTripDue) {
    // the first loaded unit trips (forced outage for the rest of the day)
    const i = coal.findIndex((u) => u.status === 'running');
    if (i >= 0) coal = coal.map((u, j) => (j === i ? { status: 'tripped', outputMW: 0, timerMin: 0 } : u));
  }
  const nGas = Math.max(0, Math.min(FLEET.gas.units, Math.round(c.gasUnits)));
  const gas = f.gas.map((u, i) => updateGas(u, i < nGas, c.gasSetpointMW));
  const water = FLEET.hydro.waterMWh[sc.mode];
  return {
    ...f,
    nuclearUnits: FLEET.nuclear.units - env.nuclearTrips,
    chpMW: ramp(f.chpMW, clamp(c.chpSetpointMW, FLEET.chp.mustRunMW[sc.season], FLEET.chp.maxMW), FLEET.chp.rampMWPerMin),
    coal,
    gas,
    ...updateHydro(f, c.hydroSetpointMW, water),
    ...updatePsh(f, c.pshMode, c.pshSetpointMW),
    ...updateBess(f, c.bessSetpointMW),
    ...updateDr(f, c.demandResponse),
  };
}

export interface Settlement {
  record: StepRecord;
  totals: Totals;
  blackout: boolean;
}

/** Balance, frequency, curtailment, UFLS and accounting for the (already advanced) fleet at minute `min`. */
export function settleStep(
  f: FleetState,
  c: DispatcherControls,
  sc: DispatcherScenario,
  events: readonly DayEvent[],
  min: number,
  noise: number,
  t: Totals,
): Settlement {
  const env = environmentAt(sc, events, min, noise);
  const hour = Math.floor(min / 60);
  const importMW = Math.max(0, Math.min(FLEET.import.maxMW[sc.mode], c.importScheduleMW[hour] ?? 0));
  const nuclearMW = f.nuclearUnits * FLEET.nuclear.unitMW;
  const coalMW = f.coal.reduce((s, u) => s + u.outputMW, 0);
  const gasMW = f.gas.reduce((s, u) => s + u.outputMW, 0);
  const nQ = Math.max(0, Math.min(FLEET.queues.max, Math.round(c.queues)));
  const queueMW = nQ * FLEET.queues.share * env.loadMW;
  const consumption = env.loadMW - queueMW - f.drMW + f.pshPumpMW + Math.max(0, -f.bessMW);
  const genNoPv =
    nuclearMW + f.chpMW + coalMW + gasMW + f.hydroMW + f.pshGenMW + Math.max(0, f.bessMW) + importMW + env.windMW;
  const qp = quasiSteadyParamsFor(sc, env.loadMW, importMW);
  const solve = (curtail: number) => solveQuasiSteady(genNoPv + env.pvAvailableMW - curtail - consumption, qp);
  let curtail = 0;
  let q = solve(0);
  if (q.fHz > 50.2 && env.pvAvailableMW > 0) {
    // automatic PV curtailment down to the level that gives f ≤ 50,2 Hz
    curtail = bisect((x) => -solve(x).fHz, -50.2, 0, env.pvAvailableMW, 50);
    q = solve(curtail);
  }
  const uflsMW = q.uflsShedMW;
  const groups: [number, number][] = [
    [nuclearMW, FLEET.nuclear.price],
    [f.chpMW, FLEET.chp.price],
    [coalMW, FLEET.coal.price],
    [gasMW, FLEET.gas.price],
    [f.hydroMW, FLEET.hydro.price],
    [importMW, importPrice(hour)],
    [f.drMW, FLEET.dr.price],
  ];
  const energyCost = groups.reduce((s, [p, price]) => s + p * price, 0);
  const maxRunningPrice = Math.max(0, ...groups.filter(([p]) => p > 0).map(([, price]) => price));
  // aFRR (the automatic pool) is paid ×1,5 of the most expensive running group (up-regulation only)
  const afrrCost = Math.max(0, q.poolOutputMW) * 1.5 * maxRunningPrice;
  const vollCost = (queueMW + uflsMW) * FLEET.queues.voll;
  const costEur = (energyCost + afrrCost + vollCost) * STEP_H;
  const co2t = (f.chpMW * FLEET.chp.co2 + coalMW * FLEET.coal.co2 + gasMW * FLEET.gas.co2) * STEP_H;
  const record: StepRecord = {
    timeMin: min,
    loadMW: env.loadMW,
    pvMW: env.pvAvailableMW - curtail,
    pvCurtailedMW: curtail,
    windMW: env.windMW,
    nuclearMW,
    chpMW: f.chpMW,
    coalMW,
    gasMW,
    hydroMW: f.hydroMW,
    pshGenMW: f.pshGenMW,
    pshPumpMW: f.pshPumpMW,
    bessMW: f.bessMW,
    importMW,
    drMW: f.drMW,
    queueMW,
    uflsMW,
    imbalanceMW: q.imbalanceMW,
    poolMW: q.poolOutputMW,
    fHz: q.fHz,
    unscheduledMW: q.unscheduledMW,
    costEur,
    co2t,
  };
  const totals: Totals = {
    ensQueueMWh: t.ensQueueMWh + queueMW * STEP_H,
    ensUflsMWh: t.ensUflsMWh + uflsMW * STEP_H,
    costEur: t.costEur + costEur,
    co2t: t.co2t + co2t,
    steps: t.steps + 1,
    qualitySteps: t.qualitySteps + (Math.abs(q.deltaFHz) <= 0.05 + 1e-9 ? 1 : 0),
    uflsEvents: t.uflsEvents + (q.uflsStages > 0 ? 1 : 0),
    curtailedMWh: t.curtailedMWh + curtail * STEP_H,
    unscheduledMWh: t.unscheduledMWh + Math.abs(q.unscheduledMW) * STEP_H,
    loadMWhSum: t.loadMWhSum + env.loadMW * STEP_H,
  };
  return { record, totals, blackout: q.blackout };
}

/** Minute of day of step k. */
export const stepMinute = (k: number): number => k * STEP_MIN;
