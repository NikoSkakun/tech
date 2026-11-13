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

/**
 * After an out-of-sync closing the surge trips the protection: the relay is thrown open this many model
 * seconds later (a real breaker needs milliseconds; the slowed scene shows the hit first, then the trip).
 */
export const BREAKER_S = 0.04;
/** Observation of a returned grid before the inverter reconnects (typical EU value, document step 8), s. */
export const RECONNECT_S = 60;
/** The 60 s of observation run this much faster on screen (an honesty chip says so). */
export const RECONNECT_SPED = 10;

export interface GridEvents {
  /** The relay opened by the anti-islanding protection, `tripS` model seconds after the grid was lost. */
  tripped?(tripS: number): void;
  /** The surge of an out-of-sync closing tripped the relay open again. */
  breaker?(): void;
  /** The returned grid was watched for `RECONNECT_S` and the inverter closed its relay again, in sync. */
  reconnected?(): void;
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
  /** Seconds of grid observation left before the automatic reconnection (0 = not waiting). */
  readonly waitS: number;
  /** The last closing was out of sync and the protection threw the relay open. */
  readonly breakerTripped: boolean;
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
  let breakerIn = -1;
  let breakerTripped = false;
  let waitS = 0;
  let resync = false;
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
    get waitS() {
      return waitS;
    },
    get breakerTripped() {
      return breakerTripped;
    },
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
      const r = sim.closeRelay();
      breakerTripped = false;
      breakerIn = r.soft ? -1 : BREAKER_S;
      return r;
    },
    grid(on) {
      // a grid that comes back after a trip is watched for a minute before the inverter reconnects
      const tripped = s.tripTimeS !== null && !s.relayClosed;
      sim.setGrid(on);
      waitS = on && tripped ? RECONNECT_S : 0;
      resync = false;
      tripSeen = false;
      drift.t.length = 0;
      drift.f.length = 0;
    },
    restart() {
      sim.reset();
      breakerIn = -1;
      breakerTripped = false;
      waitS = 0;
      resync = false;
      sim.set({ uInvV: 230 });
      tripSeen = false;
      drift.t.length = 0;
      drift.f.length = 0;
    },
    tick(dt) {
      spin = (spin + dt * SPIN_HZ * Math.PI * 2) % (Math.PI * 2);
      sim.step(dt / EVENT_SLOW);
      // the protection after an out-of-sync closing (the model has no breaker: the session throws the relay open)
      if (breakerIn >= 0 && s.relayClosed) {
        breakerIn -= dt / EVENT_SLOW;
        if (breakerIn < 0) {
          s.relayClosed = false;
          breakerTripped = true;
          events.breaker?.();
        }
      }
      // reconnection: watch the grid, then lock the PLL and close softly once in synchronism
      if (waitS > 0 && s.gridPresent) {
        waitS = Math.max(0, waitS - dt * RECONNECT_SPED);
        if (waitS === 0) {
          sim.enablePll(true);
          resync = true;
        }
      }
      if (resync && s.sync.inSync && !s.relayClosed) {
        resync = false;
        sim.set({ uInvV: 230 });
        sim.closeRelay();
        events.reconnected?.();
      }
      if (!s.gridPresent && s.islandTimeS >= 0 && s.tripTimeS === null && s.relayClosed) {
        drift.t.push(s.islandTimeS);
        drift.f.push(s.fInvHz);
      }
      // (the model keeps `tripTimeS` after the grid returns: announce a trip only while the grid is away)
      if (s.tripTimeS !== null && !tripSeen && !s.gridPresent) {
        tripSeen = true;
        drift.t.push(s.tripTimeS);
        drift.f.push(GRID_F_HZ + ISLANDING.driftHzPerS * s.tripTimeS);
        events.tripped?.(s.tripTimeS);
      }
    },
  };
}
