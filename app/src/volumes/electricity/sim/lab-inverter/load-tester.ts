/**
 * `lab-inverter` §M7 / step 12 «примірювальна»: appliances on the «ЛІ-6» output with start-up surges.
 *
 * P(t) = Σ P_run,i + Σ_{starting now} (k_start,i − 1)·P_run,i.
 * Rules: P > P_peak (12 kW) → instant trip («Перевантаження/КЗ»); P_rated (6 kW) < P ≤ P_peak for longer than 10 s →
 * trip; otherwise OK. After a trip: automatic restart after 5 s if the load has been reduced to ≤ P_rated.
 * Numbers: `_shared-house.md` §3 (nameplate P and start-up multiples).
 */

export interface ApplianceSpec {
  id: string;
  name: string;
  /** Running power, W. */
  pRunW: number;
  /** Start-up multiple k_start (1 = no surge). */
  kStart: number;
  /** Surge duration, s. */
  tStartS: number;
  motor: boolean;
  /** Behaviour on a «modified sine» inverter: ok, warning (hums, heats) or fault (boiler flame error). */
  modifiedSine: 'ok' | 'warn' | 'fault';
}

export const TESTER_APPLIANCES: readonly ApplianceSpec[] = [
  {
    id: 'fridge',
    name: 'Холодильник',
    pRunW: 150,
    kStart: 5,
    tStartS: 0.3,
    motor: true,
    modifiedSine: 'warn',
  },
  {
    id: 'well_pump',
    name: 'Насос свердловини',
    pRunW: 1000,
    kStart: 5,
    tStartS: 0.5,
    motor: true,
    modifiedSine: 'warn',
  },
  { id: 'drill', name: 'Перфоратор', pRunW: 800, kStart: 3, tStartS: 0.2, motor: true, modifiedSine: 'warn' },
  { id: 'kettle', name: 'Чайник', pRunW: 2000, kStart: 1, tStartS: 0, motor: false, modifiedSine: 'ok' },
  {
    id: 'microwave',
    name: 'Мікрохвильовка',
    pRunW: 1200,
    kStart: 1,
    tStartS: 0,
    motor: false,
    modifiedSine: 'ok',
  },
  { id: 'laptop', name: 'Ноутбук', pRunW: 65, kStart: 1, tStartS: 0, motor: false, modifiedSine: 'ok' },
  { id: 'tv', name: 'ТБ', pRunW: 100, kStart: 1, tStartS: 0, motor: false, modifiedSine: 'ok' },
  { id: 'router', name: 'Роутер і оптичний модем', pRunW: 20, kStart: 1, tStartS: 0, motor: false, modifiedSine: 'ok' },
  {
    id: 'lights',
    name: 'Світлодіодне освітлення (20 × 7,5 W)',
    pRunW: 150,
    kStart: 1,
    tStartS: 0,
    motor: false,
    modifiedSine: 'ok',
  },
  {
    id: 'boiler',
    name: 'Газовий котел (електроніка + насос)',
    pRunW: 100,
    kStart: 2,
    tStartS: 0.2,
    motor: true,
    modifiedSine: 'fault',
  },
];

export const LI6_OUTPUT = { ratedW: 6000, peakW: 12000, peakTimeS: 10, restartDelayS: 5, idleW: 50 } as const;

/** Inverter self-consumption over a day: 50 W × 24 h = 1.2 kWh. */
export const IDLE_KWH_PER_DAY = (LI6_OUTPUT.idleW * 24) / 1000;

export interface LoadTesterState {
  timeS: number;
  /** Instantaneous load, W. */
  pW: number;
  /** Running (steady) load, W. */
  pRunW: number;
  status: 'ok' | 'overload-timer' | 'tripped';
  /** Reason of the last trip. */
  tripReason: 'peak' | 'overload-10s' | null;
  /** Seconds spent above the rated power in the current overload episode. */
  overloadS: number;
  /** Seconds since the trip (restart countdown). */
  trippedS: number;
  /** Per-instance surge remaining, s. */
  starting: Record<number, number>;
}

interface Instance {
  key: number;
  spec: ApplianceSpec;
}

export function createLoadTester() {
  let nextKey = 1;
  const items: Instance[] = [];
  const state: LoadTesterState = {
    timeS: 0,
    pW: 0,
    pRunW: 0,
    status: 'ok',
    tripReason: null,
    overloadS: 0,
    trippedS: 0,
    starting: {},
  };

  function compute(): void {
    let run = 0;
    let surge = 0;
    for (const it of items) {
      run += it.spec.pRunW;
      if ((state.starting[it.key] ?? 0) > 0) surge += (it.spec.kStart - 1) * it.spec.pRunW;
    }
    state.pRunW = run;
    state.pW = state.status === 'tripped' ? 0 : run + surge;
  }

  function evaluate(): void {
    if (state.status === 'tripped') return;
    if (state.pW > LI6_OUTPUT.peakW) {
      state.status = 'tripped';
      state.tripReason = 'peak';
      state.trippedS = 0;
    }
  }

  return {
    state,
    /** Put an appliance on the platform; motors start with a surge. Returns its instance key. */
    add(id: string, start = true): number {
      const spec = TESTER_APPLIANCES.find((a) => a.id === id);
      if (!spec) throw new Error(`unknown appliance ${id}`);
      const key = nextKey++;
      items.push({ key, spec });
      if (start && spec.kStart > 1) state.starting[key] = spec.tStartS;
      compute();
      evaluate();
      compute();
      return key;
    },
    remove(key: number): void {
      const i = items.findIndex((x) => x.key === key);
      if (i >= 0) items.splice(i, 1);
      delete state.starting[key];
      compute();
    },
    /** «Пуск» on a motor appliance. */
    start(key: number): void {
      const it = items.find((x) => x.key === key);
      if (it && it.spec.kStart > 1) state.starting[key] = it.spec.tStartS;
      compute();
      evaluate();
      compute();
    },
    list(): readonly { key: number; spec: ApplianceSpec }[] {
      return items;
    },
    /** Advance time (sub-stepped at 10 ms so surges and the 10 s timer resolve correctly). */
    step(dt: number): void {
      let rem = dt;
      while (rem > 1e-12) {
        const h = Math.min(0.01, rem);
        rem -= h;
        state.timeS += h;
        for (const k of Object.keys(state.starting)) {
          const key = Number(k);
          state.starting[key] = Math.max(0, (state.starting[key] ?? 0) - h);
          if (state.starting[key] === 0) delete state.starting[key];
        }
        compute();
        if (state.status === 'tripped') {
          state.trippedS += h;
          if (state.trippedS >= LI6_OUTPUT.restartDelayS - 1e-9 && state.pRunW <= LI6_OUTPUT.ratedW) {
            state.status = 'ok';
            state.tripReason = null;
            state.overloadS = 0;
            compute();
          }
          continue;
        }
        // evaluate() may switch the status to 'tripped' (TS cannot see the mutation through the call).
        evaluate();
        if ((state.status as LoadTesterState['status']) === 'tripped') {
          compute();
          continue;
        }
        if (state.pW > LI6_OUTPUT.ratedW) {
          state.overloadS += h;
          state.status = 'overload-timer';
          if (state.overloadS >= LI6_OUTPUT.peakTimeS - 1e-9) {
            state.status = 'tripped';
            state.tripReason = 'overload-10s';
            state.trippedS = 0;
            compute();
          }
        } else {
          state.overloadS = 0;
          state.status = 'ok';
        }
      }
    },
    /** Modified-sine verdict per appliance on the platform. */
    modifiedSineVerdicts(): { key: number; verdict: ApplianceSpec['modifiedSine'] }[] {
      return items.map((x) => ({ key: x.key, verdict: x.spec.modifiedSine }));
    },
    reset(): void {
      items.length = 0;
      Object.assign(state, {
        timeS: 0,
        pW: 0,
        pRunW: 0,
        status: 'ok',
        tripReason: null,
        overloadS: 0,
        trippedS: 0,
        starting: {},
      });
    },
  };
}

export type LoadTester = ReturnType<typeof createLoadTester>;
