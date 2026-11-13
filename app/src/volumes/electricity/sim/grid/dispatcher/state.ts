/**
 * grid §Б.3 initial state at 00:00 (winter, imbalance ≈ 0): nuclear 7000, CHP 900, wind 631 (windy), coal 4 × 180 MW
 * (2 units stopped), hydro 800, import 950 MW for 00–01 then 0, PSH stopped (4000 MWh), BESS 0 MW at 50 %, no gas,
 * no queues. Summer (not specified by the document): CHP 300, no import, hydro balances the 00:00 load.
 */
import { gridLoadMW, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { clamp } from '@electricity/sim/core/S2-sim/math';
import { FLEET, type DispatcherScenario } from './fleet';
import type { DispatcherControls, FleetState } from './units';

const RUNNING_COAL_AT_START = 4;

export function initialHydroAndImport(sc: DispatcherScenario): { hydroMW: number; importMW: number } {
  if (sc.season === 'winter') return { hydroMW: 800, importMW: 950 };
  const rest =
    gridLoadMW(sc.season, 0) -
    FLEET.nuclear.units * FLEET.nuclear.unitMW -
    FLEET.chp.mustRunMW.summer -
    windOutputMW(sc.windInstalledMW, sc.wind, 0) -
    RUNNING_COAL_AT_START * FLEET.coal.minMW;
  return { hydroMW: clamp(rest, 0, FLEET.hydro.maxMW), importMW: 0 };
}

export function initialFleet(sc: DispatcherScenario): FleetState {
  const { hydroMW } = initialHydroAndImport(sc);
  return {
    nuclearUnits: FLEET.nuclear.units,
    chpMW: FLEET.chp.mustRunMW[sc.season],
    coal: Array.from({ length: FLEET.coal.units }, (_, i) =>
      i < RUNNING_COAL_AT_START
        ? { status: 'running' as const, outputMW: FLEET.coal.minMW, timerMin: 0 }
        : { status: 'stopped' as const, outputMW: 0, timerMin: 0 },
    ),
    gas: Array.from({ length: FLEET.gas.units }, () => ({ status: 'stopped' as const, outputMW: 0, timerMin: 0 })),
    hydroMW,
    waterUsedMWh: 0,
    pshMode: 'stop',
    pshActiveMode: 'stop',
    pshChangeTimerMin: 0,
    pshGenMW: 0,
    pshPumpMW: 0,
    pshReservoirMWh: FLEET.psh.startMWh,
    bessMW: 0,
    bessEnergyMWh: FLEET.bess.startSoc * FLEET.bess.capacityMWh,
    drMW: 0,
    drUsedH: 0,
  };
}

export function initialControls(sc: DispatcherScenario): DispatcherControls {
  const { hydroMW, importMW } = initialHydroAndImport(sc);
  return {
    chpSetpointMW: FLEET.chp.mustRunMW[sc.season],
    coalRun: Array.from({ length: FLEET.coal.units }, (_, i) => i < RUNNING_COAL_AT_START),
    coalSetpointMW: Array.from({ length: FLEET.coal.units }, () => FLEET.coal.minMW),
    hydroSetpointMW: hydroMW,
    pshMode: 'stop',
    pshSetpointMW: 0,
    gasUnits: 0,
    gasSetpointMW: FLEET.gas.maxMW,
    bessSetpointMW: 0,
    importScheduleMW: Array.from({ length: 24 }, (_, h) => (h === 0 ? importMW : 0)),
    demandResponse: false,
    queues: 0,
  };
}
