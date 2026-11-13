/**
 * Hybrid-home live stepper for the scenes of steps 3–7: the §M5 algorithm advanced in 5-min model steps, with
 * a manual grid switch («Вимкнути мережу» at any moment) and a manual generator start. The caller converts
 * screen time to model minutes (e.g. «18:00 → 07:00 за 10 s» = 78 model min per screen second).
 */
import { accumulate, emptyTotals, gridAt, type DayTotals } from './day';
import { resolveHomeParams, type HomeParams, type HomeParamsResolved } from './params';
import { STEP_MIN, STEPS_PER_DAY, homeStep, type HomeBatteryState, type StepFlows } from './step';

export interface HomeLiveState {
  /** Clock minutes since 00:00 of the current day (0…1440). */
  clockMin: number;
  day: number;
  /** Flows of the last executed 5-min step (null before the first). */
  flows: StepFlows | null;
  /** Totals of the current day so far. */
  totals: DayTotals;
  socPct: number;
  genOn: boolean;
  gridOn: boolean;
}

export interface HomeLiveOptions {
  /** Start clock, minutes (default 0). */
  startMin?: number;
  /** Initial SOC, % (default: params.soc0Pct). */
  socPct?: number;
}

export function createHomeLive(params: Partial<HomeParams> = {}, opts: HomeLiveOptions = {}) {
  let p: HomeParamsResolved = resolveHomeParams({ ...params, days: 1 });
  let gridOverride: boolean | null = null;
  let acc = 0;
  const bat: HomeBatteryState = { socPct: opts.socPct ?? p.soc0Pct, genOn: false };
  const startStep = Math.floor((opts.startMin ?? 0) / STEP_MIN);
  let k = startStep;
  const state: HomeLiveState = {
    clockMin: k * STEP_MIN,
    day: 0,
    flows: null,
    totals: emptyTotals(bat.socPct),
    socPct: bat.socPct,
    genOn: false,
    gridOn: true,
  };

  function gridNow(): boolean {
    // Live scenes apply the outage schedule every day (they show «today»); the override wins.
    return gridOverride ?? gridAt({ ...p, multiDay: true }, 0, k * STEP_MIN);
  }

  function execute(): void {
    const f = homeStep(p, bat, k * STEP_MIN, gridNow());
    accumulate(state.totals, f, p);
    state.flows = f;
    k++;
    if (k >= STEPS_PER_DAY) {
      k = 0;
      state.day++;
      state.totals = emptyTotals(bat.socPct);
    }
  }

  function sync(): void {
    state.clockMin = k * STEP_MIN + acc;
    state.socPct = bat.socPct;
    state.genOn = bat.genOn;
    state.gridOn = gridNow();
  }

  sync();
  return {
    state,
    /** Advance by `dtMin` model minutes (whole 5-min steps are executed as the clock crosses them). */
    step(dtMin: number): void {
      if (!(dtMin > 0)) return;
      acc += dtMin;
      while (acc >= STEP_MIN - 1e-9) {
        acc -= STEP_MIN;
        execute();
      }
      sync();
    },
    /** Manual grid: false = «Вимкнути мережу», true = «Увімкнути», null = follow the outage schedule. */
    setGrid(on: boolean | null): void {
      gridOverride = on;
      sync();
    },
    /** «Запустити вручну» (the stop threshold still applies; ignored while the grid is present). */
    startGenerator(): void {
      if (p.genKw > 0) bat.genOn = true;
      sync();
    },
    set(next: Partial<HomeParams>): void {
      p = resolveHomeParams({ ...params, ...next, days: 1 });
      params = { ...params, ...next };
      sync();
    },
    params(): HomeParamsResolved {
      return p;
    },
    reset(): void {
      k = startStep;
      acc = 0;
      bat.socPct = opts.socPct ?? p.soc0Pct;
      bat.genOn = false;
      state.day = 0;
      state.flows = null;
      state.totals = emptyTotals(bat.socPct);
      sync();
    },
  };
}

export type HomeLive = ReturnType<typeof createHomeLive>;

/** Index of the 5-min step that contains clock hour `h` (0…24) — for hour sliders over a `simulateHome` trace. */
export function stepIndexAtHour(h: number): number {
  return Math.min(STEPS_PER_DAY - 1, Math.max(0, Math.floor((h * 60) / STEP_MIN)));
}
