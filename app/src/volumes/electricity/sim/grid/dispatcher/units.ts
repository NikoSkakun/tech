/**
 * grid §Б.3 — per-unit state and the 5-min update rules (ramp P_k = P_{k−1} + clamp(P_set − P_{k−1}, ±ramp·5 min),
 * start-up delays, energy limits of hydro water, PSH reservoir, BESS SOC and the demand-response budget).
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';
import { FLEET, STEP_H, STEP_MIN } from './fleet';

export type CoalStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'tripped';
export type GasStatus = 'stopped' | 'starting' | 'running';
export type PshMode = 'pump' | 'stop' | 'generate';

export interface CoalUnit {
  status: CoalStatus;
  outputMW: number;
  /** Minutes left until synchronisation while starting. */
  timerMin: number;
}

export interface GasUnit {
  status: GasStatus;
  outputMW: number;
  timerMin: number;
}

export interface FleetState {
  nuclearUnits: number;
  chpMW: number;
  coal: CoalUnit[];
  gas: GasUnit[];
  hydroMW: number;
  waterUsedMWh: number;
  pshMode: PshMode;
  /** Mode actually running (lags `pshMode` by the 10-min change-over). */
  pshActiveMode: PshMode;
  pshChangeTimerMin: number;
  pshGenMW: number;
  pshPumpMW: number;
  /** Upper reservoir in generator MWh (0…9000). */
  pshReservoirMWh: number;
  /** + discharge, − charge [MW]. */
  bessMW: number;
  bessEnergyMWh: number;
  drMW: number;
  drUsedH: number;
}

/** User (or auto-dispatcher) decisions; they persist between steps. */
export interface DispatcherControls {
  /** CHP above its must-run level (must-run…1500 MW, 15 MW/min). */
  chpSetpointMW: number;
  coalRun: boolean[];
  coalSetpointMW: number[];
  hydroSetpointMW: number;
  pshMode: PshMode;
  pshSetpointMW: number;
  gasUnits: number;
  gasSetpointMW: number;
  bessSetpointMW: number;
  /** 24 hourly import values [MW]; a change acts from the start of the hour. */
  importScheduleMW: number[];
  demandResponse: boolean;
  queues: number;
}

export function ramp(prev: number, setpoint: number, rampMWPerMin: number): number {
  const d = rampMWPerMin * STEP_MIN;
  return prev + clamp(setpoint - prev, -d, d);
}

export function updateCoal(u: CoalUnit, run: boolean, setpointMW: number): CoalUnit {
  const c = FLEET.coal;
  if (u.status === 'tripped') return { ...u, outputMW: 0 };
  if (!run) {
    if (u.status === 'starting' || u.status === 'stopped') return { status: 'stopped', outputMW: 0, timerMin: 0 };
    const p = ramp(u.outputMW, c.minMW, c.rampMWPerMin);
    return p <= c.minMW + 1e-9 ? { status: 'stopped', outputMW: 0, timerMin: 0 } : { status: 'stopping', outputMW: p, timerMin: 0 };
  }
  if (u.status === 'stopped') return { status: 'starting', outputMW: 0, timerMin: c.startMin - STEP_MIN };
  if (u.status === 'starting') {
    // synchronised at minimum load when the start-up time has elapsed
    return u.timerMin <= 0 ? { status: 'running', outputMW: c.minMW, timerMin: 0 } : { ...u, timerMin: u.timerMin - STEP_MIN };
  }
  const sp = clamp(setpointMW, c.minMW, c.maxMW);
  return { status: 'running', outputMW: ramp(u.outputMW, sp, c.rampMWPerMin), timerMin: 0 };
}

export function updateGas(u: GasUnit, run: boolean, setpointMW: number): GasUnit {
  const g = FLEET.gas;
  if (!run) return { status: 'stopped', outputMW: 0, timerMin: 0 };
  if (u.status === 'stopped') return { status: 'starting', outputMW: 0, timerMin: g.startMin - STEP_MIN };
  if (u.status === 'starting' && u.timerMin > 0) return { ...u, timerMin: u.timerMin - STEP_MIN };
  const sp = clamp(setpointMW, g.minMW, g.maxMW);
  return { status: 'running', outputMW: ramp(u.outputMW, sp, g.rampMWPerMin), timerMin: 0 };
}

/** Hydro: ramp 300 MW/min, limited by the remaining water budget of the day. */
export function updateHydro(s: FleetState, setpointMW: number, waterBudgetMWh: number): Pick<FleetState, 'hydroMW' | 'waterUsedMWh'> {
  const h = FLEET.hydro;
  const left = Math.max(0, waterBudgetMWh - s.waterUsedMWh);
  const p = Math.min(ramp(s.hydroMW, clamp(setpointMW, 0, h.maxMW), h.rampMWPerMin), left / STEP_H);
  const out = Math.max(0, p);
  return { hydroMW: out, waterUsedMWh: s.waterUsedMWh + out * STEP_H };
}

type PshPart = Pick<
  FleetState,
  'pshMode' | 'pshActiveMode' | 'pshChangeTimerMin' | 'pshGenMW' | 'pshPumpMW' | 'pshReservoirMWh'
>;

/**
 * PSH: a mode change takes 10 min with zero output; generation W_up −= P_gen·Δt, pumping W_up += P_pump·Δt·0,75;
 * the reservoir (0…9000 generator-MWh) limits both directions.
 */
export function updatePsh(s: FleetState, mode: PshMode, setpointMW: number): PshPart {
  const c = FLEET.psh;
  let active = s.pshActiveMode;
  let timer = s.pshChangeTimerMin;
  let gen = s.pshGenMW;
  let pump = s.pshPumpMW;
  if (mode !== s.pshMode) timer = mode === 'stop' ? 0 : c.modeChangeMin;
  if (mode === 'stop') active = 'stop';
  else if (active !== mode) {
    if (timer > 0) {
      timer -= STEP_MIN;
      active = 'stop';
    } else active = mode;
  }
  if (active === 'generate') {
    gen = Math.min(ramp(gen, clamp(setpointMW, 0, c.genMW), c.rampMWPerMin), s.pshReservoirMWh / STEP_H);
    pump = 0;
  } else if (active === 'pump') {
    const room = (c.reservoirMWh - s.pshReservoirMWh) / (STEP_H * c.pumpEff);
    pump = Math.min(ramp(pump, clamp(setpointMW, 0, c.pumpMW), c.rampMWPerMin), room);
    gen = 0;
  } else {
    gen = 0;
    pump = 0;
  }
  gen = Math.max(0, gen);
  pump = Math.max(0, pump);
  const reservoir = clamp(s.pshReservoirMWh - gen * STEP_H + pump * STEP_H * c.pumpEff, 0, c.reservoirMWh);
  return { pshMode: mode, pshActiveMode: active, pshChangeTimerMin: timer, pshGenMW: gen, pshPumpMW: pump, pshReservoirMWh: reservoir };
}

/** BESS: instantaneous, ±500 MW; η_charge = η_discharge = 0,94; energy 0…1000 MWh. */
export function updateBess(s: FleetState, setpointMW: number): Pick<FleetState, 'bessMW' | 'bessEnergyMWh'> {
  const b = FLEET.bess;
  let p = clamp(setpointMW, -b.maxMW, b.maxMW);
  if (p > 0) p = Math.min(p, (s.bessEnergyMWh * b.etaDischarge) / STEP_H);
  else p = Math.max(p, -(b.capacityMWh - s.bessEnergyMWh) / (b.etaCharge * STEP_H));
  const e = p > 0 ? s.bessEnergyMWh - (p * STEP_H) / b.etaDischarge : s.bessEnergyMWh - p * STEP_H * b.etaCharge;
  return { bessMW: p, bessEnergyMWh: clamp(e, 0, b.capacityMWh) };
}

/** Demand response: 500 MW reached in 10 min, at most 4 h of activity per day. */
export function updateDr(s: FleetState, on: boolean): Pick<FleetState, 'drMW' | 'drUsedH'> {
  const d = FLEET.dr;
  const allowed = on && s.drUsedH < d.maxHours - 1e-9;
  const p = Math.max(0, ramp(s.drMW, allowed ? d.maxMW : 0, d.rampMWPerMin));
  return { drMW: p, drUsedH: s.drUsedH + (p > 0 ? STEP_H : 0) };
}
