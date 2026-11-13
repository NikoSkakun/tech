/**
 * Hybrid-home 24 h model — multi-day run and day totals (`lab-hybrid-home` §M3, §M5 «Підсумки», §M6).
 * Days 1…N−1 are preparation without outages (unless multiDay); day N is reported. Deterministic.
 */
import { inWindows } from './loads';
import { resolveHomeParams, type HomeParams, type HomeParamsResolved } from './params';
import { H, STEP_MIN, STEPS_PER_DAY, homeStep, type HomeBatteryState, type StepFlows } from './step';

export interface DayTotals {
  /** Energies, kWh. */
  pv: number;
  pvUsed: number;
  load: number;
  served: number;
  unserved: number;
  shed: number;
  imp: number;
  exp: number;
  curt: number;
  chg: number;
  dis: number;
  gen: number;
  /** Grid cost, UAH (4.32 day / 2.16 night). */
  cost: number;
  islandH: number;
  darkH: number;
  /** % (NaN without battery). */
  socMin: number;
  socEnd: number;
  /** SS = max(0, (served − imp)/(served + unserved)). */
  selfSufficiency: number;
  /** SC = (PV_used − exp)/PV; null when PV = 0 («—»). */
  selfConsumption: number | null;
  /** Generator fuel, L (0.5 L/kWh). */
  fuelL: number;
}

export function emptyTotals(socPct: number): DayTotals {
  return {
    pv: 0,
    pvUsed: 0,
    load: 0,
    served: 0,
    unserved: 0,
    shed: 0,
    imp: 0,
    exp: 0,
    curt: 0,
    chg: 0,
    dis: 0,
    gen: 0,
    cost: 0,
    islandH: 0,
    darkH: 0,
    socMin: socPct,
    socEnd: socPct,
    selfSufficiency: 0,
    selfConsumption: null,
    fuelL: 0,
  };
}

/** Add one step to the running totals (mirrors the oracle's accumulation). */
export function accumulate(t: DayTotals, f: StepFlows, p: HomeParamsResolved): void {
  t.pv += f.pvKw * H;
  t.pvUsed += (f.pvKw - f.curtKw) * H;
  t.load += (f.critKw + f.nonKw) * H;
  t.served += f.servedKw * H;
  t.unserved += f.unservedKw * H;
  t.shed += f.shedKw * H;
  t.imp += f.impKw * H;
  t.exp += f.expKw * H;
  t.curt += f.curtKw * H;
  t.chg += f.chgKw * H;
  t.dis += f.disKw * H;
  t.gen += f.genKw * H;
  t.cost += f.impKw * H * (f.night ? p.tariffNight : p.tariffDay);
  if (!f.grid) {
    t.islandH += H;
    if (f.unservedKw > 0) t.darkH += H;
  }
  t.socMin = Math.min(t.socMin, f.socPct);
  t.socEnd = f.socPct;
  t.selfSufficiency = Math.max(0, (t.served - t.imp) / Math.max(1e-9, t.served + t.unserved));
  t.selfConsumption = t.pv > 0 ? (t.pvUsed - t.exp) / t.pv : null;
  t.fuelL = 0.5 * t.gen;
}

export interface HomeDayResult {
  totals: DayTotals;
  /** 288 steps of the reported day (SOC after each step). */
  trace: StepFlows[];
  params: HomeParamsResolved;
}

/** Is the grid present at minute t of day `day` (0-based)? */
export function gridAt(p: HomeParamsResolved, day: number, tMin: number): boolean {
  const scheduled = day === p.days - 1 || p.multiDay;
  return !(scheduled && inWindows(tMin / 60, p.outageWindows));
}

/** Run the configured number of days and report the last one. */
export function simulateHome(params: Partial<HomeParams> = {}): HomeDayResult {
  const p = resolveHomeParams(params);
  const hasBat = p.batKwh > 0;
  const st: HomeBatteryState = { socPct: hasBat ? p.soc0Pct : 0, genOn: false };
  let totals = emptyTotals(st.socPct);
  let trace: StepFlows[] = [];
  for (let day = 0; day < p.days; day++) {
    totals = emptyTotals(hasBat ? st.socPct : NaN);
    trace = [];
    for (let k = 0; k < STEPS_PER_DAY; k++) {
      const t = k * STEP_MIN;
      const f = homeStep(p, st, t, gridAt(p, day, t));
      accumulate(totals, f, p);
      trace.push(f);
    }
  }
  if (!hasBat) {
    totals.socMin = NaN;
    totals.socEnd = NaN;
  }
  return { totals, trace, params: p };
}
