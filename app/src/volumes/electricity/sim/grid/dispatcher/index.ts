/**
 * grid §Б «Диспетчер на добу» (step 6): 288 × 5-min steps. Each step: (1) controls — user or auto-dispatcher (§Б.6),
 * (2) units advance (ramps, delays, energy limits), (3) balance, quasi-steady f, curtailment, UFLS, accounting.
 */
import { gaussian, seededRandom } from '@electricity/sim/core/S2-sim/math';
import { autoControls } from './auto';
import { advanceFleet, settleStep, stepMinute, ZERO_TOTALS, type StepRecord, type Totals } from './balance';
import { DEFAULT_SCENARIO, dayEvents, STEPS_PER_DAY, type DayEvent, type DispatcherScenario } from './fleet';
import { initialControls, initialFleet } from './state';
import type { DispatcherControls, FleetState } from './units';

export * from './fleet';
export type { DispatcherControls, FleetState } from './units';
export type { StepRecord, Totals } from './balance';
export { autoControls, AUTO_TUNING } from './auto';

export interface DayReport {
  ensMWh: number;
  ensQueueMWh: number;
  ensUflsMWh: number;
  /** «≈ X годин без світла для 5 % споживачів» = ENS/(0,05·P_L,avg). */
  hoursWithoutPowerFor5Pct: number;
  costMEur: number;
  co2kt: number;
  /** Share of steps with |Δf| ≤ 50 mHz. */
  frequencyQuality: number;
  uflsEvents: number;
  blackout: boolean;
  /** §Б.7: 3 — ENS = 0, UFLS = 0, quality ≥ 95 %; 2 — UFLS = 0, only planned ENS; 1 — survived; 0 — blackout. */
  stars: 0 | 1 | 2 | 3;
}

export function dayReport(t: Totals, blackout: boolean): DayReport {
  const ens = t.ensQueueMWh + t.ensUflsMWh;
  const avgLoad = t.steps > 0 ? t.loadMWhSum / (t.steps * (5 / 60)) : 0;
  const quality = t.steps > 0 ? t.qualitySteps / t.steps : 1;
  const stars: DayReport['stars'] = blackout
    ? 0
    : ens === 0 && t.uflsEvents === 0 && quality >= 0.95
      ? 3
      : t.uflsEvents === 0
        ? 2
        : 1;
  return {
    ensMWh: ens,
    ensQueueMWh: t.ensQueueMWh,
    ensUflsMWh: t.ensUflsMWh,
    hoursWithoutPowerFor5Pct: avgLoad > 0 ? ens / (0.05 * avgLoad) : 0,
    costMEur: t.costEur / 1e6,
    co2kt: t.co2t / 1000,
    frequencyQuality: quality,
    uflsEvents: t.uflsEvents,
    blackout,
    stars,
  };
}

export interface DispatcherState {
  step: number;
  fleet: FleetState;
  controls: DispatcherControls;
  totals: Totals;
  history: StepRecord[];
  blackout: boolean;
  finished: boolean;
  /** AR(1) forecast error ε. */
  noise: number;
}

export interface Dispatcher {
  readonly state: Readonly<DispatcherState>;
  readonly scenario: Readonly<DispatcherScenario>;
  readonly events: readonly DayEvent[];
  /** Auto-dispatcher on: decisions are taken by §Б.6 (the scene shows them as `cyan` hints). */
  auto: boolean;
  /** User decisions (merged into the persistent controls). */
  setControls(c: Partial<DispatcherControls>): void;
  /** Suggested decisions for the next step (hints), regardless of `auto`. */
  suggestion(): DispatcherControls;
  /** One 5-min step; returns its record (null when the day is over or after a blackout). */
  stepOnce(): StepRecord | null;
  runToEnd(): DayReport;
  report(): DayReport;
  reset(): void;
}

export function createDispatcher(scenario: Partial<DispatcherScenario> = {}, auto = false): Dispatcher {
  const sc: DispatcherScenario = { ...DEFAULT_SCENARIO, ...scenario };
  const events = dayEvents(sc.mode);
  const rand = sc.noiseSeed === null ? null : seededRandom(sc.noiseSeed);
  const fresh = (): DispatcherState => ({
    step: 0,
    fleet: initialFleet(sc),
    controls: initialControls(sc),
    totals: { ...ZERO_TOTALS },
    history: [],
    blackout: false,
    finished: false,
    noise: 0,
  });
  let st = fresh();
  const d: Dispatcher = {
    auto,
    get state() {
      return st;
    },
    scenario: sc,
    events,
    setControls(c) {
      st = { ...st, controls: { ...st.controls, ...c } };
    },
    suggestion() {
      return autoControls(sc, events, stepMinute(st.step), st.fleet, st.controls);
    },
    stepOnce() {
      if (st.finished) return null;
      const min = stepMinute(st.step);
      const controls = d.auto && st.step > 0 ? d.suggestion() : st.controls;
      const fleet = st.step === 0 ? st.fleet : advanceFleet(st.fleet, controls, sc, events, min);
      // AR(1) forecast error: ε_k = 0,9·ε_{k−1} + N(0; 0,4 %)
      const noise = rand ? 0.9 * st.noise + 0.004 * gaussian(rand) : 0;
      const s = settleStep(fleet, controls, sc, events, min, noise, st.totals);
      const step = st.step + 1;
      st = {
        step,
        fleet,
        controls,
        totals: s.totals,
        history: [...st.history, s.record],
        blackout: s.blackout,
        finished: s.blackout || step >= STEPS_PER_DAY,
        noise,
      };
      return s.record;
    },
    runToEnd() {
      while (!st.finished) d.stepOnce();
      return d.report();
    },
    report() {
      return dayReport(st.totals, st.blackout);
    },
    reset() {
      st = fresh();
    },
  };
  return d;
}
