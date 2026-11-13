/**
 * Hybrid-home 24 h model — §M5 step algorithm (priority order), one 5-min step (oracle `home_model.py`).
 * Energy kWh, power kW, SOC %. Pure: the caller owns `HomeBatteryState`.
 */
import type { HomeParamsResolved } from './params';
import { homeLoadsKw } from './loads';
import { homePvKw } from './pv';

export const STEP_MIN = 5;
export const STEPS_PER_DAY = (24 * 60) / STEP_MIN;
/** Hours per step. */
export const H = STEP_MIN / 60;

export interface HomeBatteryState {
  socPct: number;
  genOn: boolean;
}

/** Everything the scene and the 24 h chart need for one step (powers in kW, SOC after the step). */
export interface StepFlows {
  tMin: number;
  grid: boolean;
  night: boolean;
  pvKw: number;
  /** Critical load incl. inverter idle. */
  critKw: number;
  nonKw: number;
  /** Load the system tries to serve (all on grid; crit (+ non if whole-home) in island). */
  loadKw: number;
  servedKw: number;
  unservedKw: number;
  shedKw: number;
  impKw: number;
  expKw: number;
  curtKw: number;
  /** Battery charge (PV + grid/generator), kW at the battery input. */
  chgKw: number;
  disKw: number;
  genKw: number;
  genOn: boolean;
  /** SOC after the step, % (NaN without battery). */
  socPct: number;
  /** True when the island output is off for this step (dark house). */
  dark: boolean;
}

export function homeStep(
  p: HomeParamsResolved,
  st: HomeBatteryState,
  tMin: number,
  grid: boolean,
): StepFlows {
  const h = tMin / 60;
  const night = h >= 23 || h < 7;
  const pv = homePvKw(tMin + STEP_MIN / 2, p.kwp, p.season, p.weather); // mid-step sample
  const l = homeLoadsKw(tMin, p.season, p.enabled);
  const crit = l.crit + p.idleKw;
  const non = l.non;
  const hasBat = p.batKwh > 0;
  const eBat = (p.batKwh * st.socPct) / 100;
  const room = (p.batKwh * (100 - st.socPct)) / 100;
  const pchgLim = Math.min(p.pbatKw, room / p.etaCh / H);
  const base = { tMin, grid, night, pvKw: pv, critKw: crit, nonKw: non };

  if (!hasBat && !grid) {
    // No battery: the hybrid inverter cannot form an island — output off, PV curtailed, no generator.
    const load = crit + (p.wholeHomeBackup ? non : 0);
    st.genOn = false;
    return {
      ...base,
      loadKw: load,
      servedKw: 0,
      unservedKw: load,
      shedKw: p.wholeHomeBackup ? 0 : non,
      impKw: 0,
      expKw: 0,
      curtKw: pv,
      chgKw: 0,
      disKw: 0,
      genKw: 0,
      genOn: false,
      socPct: NaN,
      dark: true,
    };
  }

  if (grid) {
    const load = crit + non;
    const floor = p.mode !== 'backup' ? p.reservePct : 100;
    const avail = (Math.max(0, eBat - (p.batKwh * Math.max(floor, p.socMinPct)) / 100) * p.etaDis) / H;
    const pvAc = Math.min(pv * p.etaPv, p.invKw);
    const pvToLoad = Math.min(pvAc, load);
    let rest = load - pvToLoad;
    let surplus = pv - pvToLoad / p.etaPv;
    const chg = Math.min(surplus, pchgLim);
    surplus -= chg;
    const exp = p.exportAllowed
      ? Math.max(0, Math.min(surplus * p.etaPv, p.exportKw, p.invKw - pvToLoad))
      : 0;
    const curt = Math.max(0, surplus - exp / p.etaPv);
    let dis = 0;
    if ((p.mode === 'self_use' || p.mode === 'tou') && !(p.mode === 'tou' && night)) {
      dis = Math.min(rest, Math.max(0, Math.min(p.pbatKw, avail, p.invKw - pvToLoad)));
    }
    rest -= dis;
    let gchg = 0;
    if ((p.mode === 'backup' || (p.mode === 'tou' && night)) && st.socPct < 100) {
      gchg = Math.max(0, Math.min(p.gridChargeKw, pchgLim - chg));
    } else if ((p.mode === 'self_use' || p.mode === 'tou') && st.socPct < p.reservePct) {
      gchg = Math.max(0, Math.min(p.gridChargeKw, pchgLim - chg));
    }
    if (hasBat) st.socPct += ((((chg + gchg) * p.etaCh - dis / p.etaDis) * H) / p.batKwh) * 100;
    st.socPct = Math.min(100, Math.max(0, st.socPct));
    st.genOn = false;
    return {
      ...base,
      loadKw: load,
      servedKw: load,
      unservedKw: 0,
      shedKw: 0,
      impKw: rest + gchg,
      expKw: exp,
      curtKw: curt,
      chgKw: chg + gchg,
      disKw: dis,
      genKw: 0,
      genOn: false,
      socPct: hasBat ? st.socPct : NaN,
      dark: false,
    };
  }

  // Island (battery present).
  const load = crit + (p.wholeHomeBackup ? non : 0);
  const avail = (Math.max(0, eBat - (p.batKwh * p.socMinPct) / 100) * p.etaDis) / H;
  const pdisLim = Math.min(p.pbatKw, avail);
  if (p.genKw > 0 && st.socPct <= p.genStartPct) st.genOn = true;
  if (st.genOn && st.socPct >= p.genStopPct) st.genOn = false;
  const genCap = st.genOn ? p.genKw : 0;
  let pvToLoad = Math.min(Math.min(pv * p.etaPv, p.invKw), load);
  let need = load - pvToLoad;
  let genToLoad = Math.min(genCap, need);
  need -= genToLoad;
  let dis = Math.min(need, pdisLim, Math.max(0, p.invKw - pvToLoad));
  need -= dis;
  const dark = need > 1e-9;
  if (dark) pvToLoad = genToLoad = dis = 0; // output off for this step
  const surplus = pv - pvToLoad / p.etaPv;
  const chg = Math.min(surplus, pchgLim);
  const curt = surplus - chg;
  const gchg = st.genOn ? Math.min(genCap - genToLoad, Math.max(0, pchgLim - chg)) : 0;
  st.socPct += ((((chg + gchg) * p.etaCh - dis / p.etaDis) * H) / p.batKwh) * 100;
  st.socPct = Math.min(100, Math.max(0, st.socPct));
  return {
    ...base,
    loadKw: load,
    servedKw: dark ? 0 : load,
    unservedKw: dark ? load : 0,
    shedKw: p.wholeHomeBackup ? 0 : non,
    impKw: 0,
    expKw: 0,
    curtKw: curt,
    chgKw: chg + gchg,
    disKw: dis,
    genKw: genToLoad + gchg,
    genOn: st.genOn,
    socPct: st.socPct,
    dark,
  };
}
