/**
 * Planning helpers of the auto-dispatcher: forecast of the net load to the end of the day (only events that already
 * happened are known) and peak shaving («water filling») of energy-limited resources.
 */
import { gridLoadMW, pvOutputMW, PV_WEATHER, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { bisect } from '@electricity/sim/core/S2-sim/math';
import { loadFactor, pvFactor } from './environment';
import { FLEET, STEP_H, STEP_MIN, STEPS_PER_DAY, type DayEvent, type DispatcherScenario } from './fleet';
import type { FleetState } from './units';

/** Events that already happened at `min` (the dispatcher does not know the future). */
export function knownEvents(events: readonly DayEvent[], min: number): DayEvent[] {
  return events.filter((e) => (e.kind === 'clouds' || e.kind === 'coldSnap' ? e.fromMin <= min : e.atMin <= min));
}

export interface Forecast {
  /** Minute of day of each forecast step (now … end of day). */
  minutes: number[];
  loadMW: number[];
  /** Net load N = load − PV − wind − nuclear − CHP must-run [MW]. */
  netMW: number[];
}

export function forecast(sc: DispatcherScenario, events: readonly DayEvent[], nowMin: number, f: FleetState): Forecast {
  const known = knownEvents(events, nowMin);
  const minutes: number[] = [];
  const loadMW: number[] = [];
  const netMW: number[] = [];
  for (let m = nowMin; m < STEPS_PER_DAY * STEP_MIN; m += STEP_MIN) {
    const h = m / 60;
    const load = gridLoadMW(sc.season, h) * loadFactor(known, m);
    const pv = pvOutputMW(sc.pvInstalledMW, sc.season, h, PV_WEATHER[sc.weather] * pvFactor(known, m));
    const wind = windOutputMW(sc.windInstalledMW, sc.wind, h);
    minutes.push(m);
    loadMW.push(load);
    netMW.push(load - pv - wind - f.nuclearUnits * FLEET.nuclear.unitMW - FLEET.chp.mustRunMW[sc.season]);
  }
  return { minutes, loadMW, netMW };
}

/**
 * Peak shaving: output(τ) = clamp(R(τ) − L, 0, cap) with the level L chosen so that Σ output·Δt = energy (or L = 0
 * if even shaving everything above zero needs less energy). Returns the output series.
 */
export function shavePeaks(residualMW: readonly number[], capMW: number, energyMWh: number): number[] {
  const out = (L: number) => residualMW.map((r) => Math.min(capMW, Math.max(0, r - L)));
  const used = (L: number) => out(L).reduce((s, p) => s + p * STEP_H, 0);
  if (capMW <= 0 || energyMWh <= 0) return residualMW.map(() => 0);
  if (used(0) <= energyMWh) return out(0);
  const hi = Math.max(0, ...residualMW);
  // used(L) decreases with L: solve −used(L) = −energy
  const L = bisect((x) => -used(x), -energyMWh, 0, hi, 50);
  return out(L);
}

export interface StoragePlan {
  hydroMW: number[];
  pshMW: number[];
  bessMW: number[];
  drMW: number[];
  /** Residual for the energy-unlimited units after the storages [MW]. */
  afterMW: number[];
}

/**
 * Sequential peak shaving of the energy-limited resources (hydro → PSH → BESS → DR) against the residual that the
 * energy-unlimited units (CHP flex, coal, import, gas) cannot cover; any water left also shaves the remaining peak.
 */
export function planStorages(net: readonly number[], unlimitedCapMW: readonly number[], f: FleetState, sc: DispatcherScenario): StoragePlan {
  const water = Math.max(0, FLEET.hydro.waterMWh[sc.mode] - f.waterUsedMWh);
  // hydro is the cheapest: it shaves the net load itself (displacing the most expensive units first)
  const hydroMW = shavePeaks(net, FLEET.hydro.maxMW, water);
  let rest = net.map((n, i) => n - hydroMW[i]! - unlimitedCapMW[i]!);
  const pshMW = shavePeaks(rest, FLEET.psh.genMW, f.pshReservoirMWh);
  rest = rest.map((r, i) => r - pshMW[i]!);
  const bessMW = shavePeaks(rest, FLEET.bess.maxMW, f.bessEnergyMWh * FLEET.bess.etaDischarge);
  rest = rest.map((r, i) => r - bessMW[i]!);
  const drMW = shavePeaks(rest, FLEET.dr.maxMW, Math.max(0, FLEET.dr.maxHours - f.drUsedH) * FLEET.dr.maxMW);
  const afterMW = net.map((n, i) => n - hydroMW[i]! - pshMW[i]! - bessMW[i]! - drMW[i]!);
  return { hydroMW, pshMW, bessMW, drMW, afterMW };
}
