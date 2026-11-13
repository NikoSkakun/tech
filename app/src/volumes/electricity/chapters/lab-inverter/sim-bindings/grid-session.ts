/**
 * Session around `createGridTie` (§M6) for step 8: synchronisation, relay, P/Q dispatch, loss of mains.
 * No three.js.
 *
 * Two time scales (both on the step's honesty chip): the phasors would spin 50 times a second, so the picture
 * turns at `SPIN_HZ`; the *events* (phase slip at Δf, PLL pull-in in ≈ 0,12 s, the 0,6 s islanding trip) run
 * slowed ×`EVENT_SLOW`, so they take a second or a few.
 */
import {
  GRID_F_HZ,
  ISLANDING,
  createGridTie,
  dispatchPQ,
  type GridTieState,
  type PhasorResult,
} from '@electricity/sim/lab-inverter';

export const EVENT_SLOW = 10;
export const SPIN_HZ = 0.25;
export const SPIN_SLOW = GRID_F_HZ / SPIN_HZ;

export interface GridEvents {
  /** The relay opened by the anti-islanding protection, `tripS` model seconds after the grid was lost. */
  tripped?(tripS: number): void;
}

export interface GridSession {
  readonly state: GridTieState;
  /** Dispatch for the present P / Q sliders (δ, U_inv, I; Q clipped at 6 kVA). */
  readonly pq: PhasorResult & { qLimited: boolean };
  readonly forming: boolean;
  /** The house has voltage: from the grid, from a closed relay, or from a grid-forming island. */
  readonly housePowered: boolean;
  /** The street line is dead and nothing back-feeds it: the lineman is safe. */
  readonly lineSafe: boolean;
  /** The inverter still energises a line without mains (the dangerous island, until the trip). */
  readonly islanding: boolean;
  /** Angle of the grid phasor on screen, rad. */
  readonly spin: number;
  /** Frequency samples (model s since the grid was lost → Hz) for the board chart. */
  readonly drift: { t: number[]; f: number[] };
  setManualFreq(hz: number): void;
  setPhaseErrorDeg(deg: number): void;
  setPQ(pW: number, qVar: number): void;
  setForming(on: boolean): void;
  pll(on: boolean): void;
  close(): { soft: boolean; inrushA: number };
  grid(on: boolean): void;
  restart(): void;
  tick(dt: number): void;
}

export function createGridSession(events: GridEvents = {}): GridSession {
  const sim = createGridTie();
  let pq = dispatchPQ(3000, 0);
  let forming = false;
  let spin = 0;
  let tripSeen = false;
  const drift = { t: [] as number[], f: [] as number[] };
  const s = sim.state;
  return {
    state: s,
    get pq() {
      return pq;
    },
    get forming() {
      return forming;
    },
    get housePowered() {
      if (s.gridPresent || s.relayClosed) return true;
      return forming && s.tripTimeS !== null && s.outputOn;
    },
    get lineSafe() {
      return !s.gridPresent && !s.relayClosed;
    },
    get islanding() {
      return !s.gridPresent && s.relayClosed;
    },
    get spin() {
      return spin;
    },
    drift,
    setManualFreq: (hz) => sim.set({ manualFreqHz: hz }),
    setPhaseErrorDeg: (deg) => sim.setPhaseErrorDeg(deg),
    setPQ(pW, qVar) {
      pq = dispatchPQ(pW, qVar);
      sim.set({ uInvV: s.relayClosed ? pq.uInvV : 230 });
    },
    setForming(on) {
      forming = on;
      sim.set({ control: on ? 'grid-forming' : 'grid-following' });
    },
    pll: (on) => sim.enablePll(on),
    close() {
      sim.set({ uInvV: 230 });
      return sim.closeRelay();
    },
    grid(on) {
      sim.setGrid(on);
      tripSeen = false;
      drift.t.length = 0;
      drift.f.length = 0;
    },
    restart() {
      sim.reset();
      sim.set({ uInvV: 230 });
      tripSeen = false;
      drift.t.length = 0;
      drift.f.length = 0;
    },
    tick(dt) {
      spin = (spin + dt * SPIN_HZ * Math.PI * 2) % (Math.PI * 2);
      sim.step(dt / EVENT_SLOW);
      if (!s.gridPresent && s.islandTimeS >= 0 && s.tripTimeS === null && s.relayClosed) {
        drift.t.push(s.islandTimeS);
        drift.f.push(s.fInvHz);
      }
      if (s.tripTimeS !== null && !tripSeen) {
        tripSeen = true;
        drift.t.push(s.tripTimeS);
        drift.f.push(GRID_F_HZ + ISLANDING.driftHzPerS * s.tripTimeS);
        events.tripped?.(s.tripTimeS);
      }
    },
  };
}
