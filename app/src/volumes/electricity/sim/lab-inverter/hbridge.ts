/**
 * `lab-inverter` §M1 / step 3: H-bridge with four switches, dead time, freewheeling diodes and an R or RL load.
 *
 * Leg A = S1 (top) / S2 (bottom), leg B = S3 (top) / S4 (bottom); u_load = v_A − v_B, load current i flows
 * A → B through the load. With a switch on, the leg node is at U_dc (top) or 0 (bottom). With both switches
 * of a leg off (dead time or manual), the node is set by the freewheeling diode that the load current forces
 * on: leg A — i > 0 → bottom diode (0 V), i < 0 → top diode (U_dc); leg B is mirrored (i > 0 enters node B →
 * top diode, U_dc). When i = 0 the leg floats and no current can start through it.
 * Load: L·di/dt = u − R·i, integrated with the exact exponential solution over every interval of constant u,
 * with event detection at switching instants and at current zero crossings in diode conduction.
 */

export type BridgeLoad = 'lamp' | 'motor';

/** Load parameters (§M1): R = 26.45 Ω; L = 50 mH for the «motor», 0 for the «lamp». */
export const BRIDGE_LOADS: Record<BridgeLoad, { rOhm: number; lH: number }> = {
  lamp: { rOhm: 26.45, lH: 0 },
  motor: { rOhm: 26.45, lH: 0.05 },
};

export interface HBridgeParams {
  /** DC-link voltage, V (default 325). */
  udcV: number;
  load: BridgeLoad;
  /** 'manual' — the four keys; 'auto50' — (S1,S4) ↔ (S3,S2) every 10 ms with dead time. */
  mode: 'manual' | 'auto50';
  /** Manual key states [S1, S2, S3, S4]. */
  keys: [boolean, boolean, boolean, boolean];
  /** «Захист увімк.»: forbid S1+S2 / S3+S4 combinations. */
  protection: boolean;
  /** Dead time t_d, s (0…5 μs). */
  deadTimeS: number;
}

export const HBRIDGE_DEFAULTS: Readonly<HBridgeParams> = Object.freeze({
  udcV: 325,
  load: 'lamp',
  mode: 'manual',
  keys: [false, false, false, false] as [boolean, boolean, boolean, boolean],
  protection: true,
  deadTimeS: 0,
});

/** Seconds the switches stay «burnt» after a shoot-through before the automatic «repair» (step 3). */
export const BURN_TIME_S = 1.5;

export type Conductor = 'S1' | 'S2' | 'S3' | 'S4' | 'D1' | 'D2' | 'D3' | 'D4';

export interface HBridgeState {
  timeS: number;
  /** Gate states actually applied [S1…S4] (after protection / dead time / burn-out). */
  gates: [boolean, boolean, boolean, boolean];
  /** Load voltage u_load, V. */
  uLoadV: number;
  /** Load current, A (A → B positive). */
  iLoadA: number;
  pLoadW: number;
  /** Devices carrying the load current (diodes highlighted amber in the scene). */
  conducting: Conductor[];
  /** Polarity readout. */
  polarity: '+U' | '-U' | '0' | 'open';
  /** A shoot-through happened (protection off); cleared after BURN_TIME_S. */
  fault: boolean;
  burntRemainingS: number;
  /** The last manual combination was blocked by protection (amber hint). */
  blocked: boolean;
  /** Inside a dead-time interval (auto mode). */
  inDeadTime: boolean;
}

type Leg = 'top' | 'bottom' | 'off';

export function createHBridge(initial: Partial<HBridgeParams> = {}) {
  let params: HBridgeParams = {
    ...HBRIDGE_DEFAULTS,
    ...initial,
    keys: [...(initial.keys ?? HBRIDGE_DEFAULTS.keys)],
  };
  const state: HBridgeState = {
    timeS: 0,
    gates: [false, false, false, false],
    uLoadV: 0,
    iLoadA: 0,
    pLoadW: 0,
    conducting: [],
    polarity: 'open',
    fault: false,
    burntRemainingS: 0,
    blocked: false,
    inDeadTime: false,
  };

  function applyManualKeys(): void {
    const [s1, s2, s3, s4] = params.keys;
    const shoot = (s1 && s2) || (s3 && s4);
    if (shoot && params.protection) {
      state.blocked = true;
      return; // keep previous gates
    }
    state.blocked = false;
    if (shoot) {
      state.fault = true;
      state.burntRemainingS = BURN_TIME_S;
      state.gates = [false, false, false, false];
      return;
    }
    state.gates = [s1, s2, s3, s4];
  }

  /** Gates for the automatic 50 Hz square: half-period 10 ms, positive pair first, dead time at each edge. */
  function autoGates(t: number): { gates: [boolean, boolean, boolean, boolean]; dead: boolean } {
    const half = 0.01;
    const k = Math.floor(t / half);
    const tin = t - k * half;
    const positive = k % 2 === 0;
    if (tin < params.deadTimeS && t >= half) return { gates: [false, false, false, false], dead: true };
    return { gates: positive ? [true, false, false, true] : [false, true, true, false], dead: false };
  }

  /** Next time an auto-mode gate pattern changes after t. */
  function nextAutoEvent(t: number): number {
    const half = 0.01;
    const k = Math.floor(t / half + 1e-12);
    const edge = k * half;
    const deadEnd = edge + params.deadTimeS;
    if (params.deadTimeS > 0 && t < deadEnd - 1e-15 && k > 0) return deadEnd;
    return (k + 1) * half;
  }

  function legOf(top: boolean, bottom: boolean): Leg {
    return top ? 'top' : bottom ? 'bottom' : 'off';
  }

  /**
   * Load voltage for given legs and a current direction. Returns null if a floating leg blocks the current
   * (then i = 0 and u = 0).
   */
  function loadVoltage(a: Leg, b: Leg, iDir: number): number | null {
    const udc = params.udcV;
    let va: number;
    let vb: number;
    if (a === 'off') {
      if (iDir === 0) return null;
      va = iDir > 0 ? 0 : udc;
    } else va = a === 'top' ? udc : 0;
    if (b === 'off') {
      if (iDir === 0) return null;
      vb = iDir > 0 ? udc : 0;
    } else vb = b === 'top' ? udc : 0;
    return va - vb;
  }

  function conductors(a: Leg, b: Leg, i: number): Conductor[] {
    if (i === 0) return [];
    const out: Conductor[] = [];
    // leg A: i > 0 leaves node A → through S1 (top on) or D2 (bottom diode)… i < 0 → S2 or D1.
    if (a === 'top') out.push(i > 0 ? 'S1' : 'D1');
    else if (a === 'bottom') out.push(i > 0 ? 'D2' : 'S2');
    else out.push(i > 0 ? 'D2' : 'D1');
    if (b === 'top') out.push(i > 0 ? 'D3' : 'S3');
    else if (b === 'bottom') out.push(i > 0 ? 'S4' : 'D4');
    else out.push(i > 0 ? 'D3' : 'D4');
    return out;
  }

  /** Integrate the load over h seconds with constant gates. */
  function integrate(h: number): void {
    const { rOhm, lH } = BRIDGE_LOADS[params.load];
    const [s1, s2, s3, s4] = state.gates;
    const a = legOf(s1, s2);
    const b = legOf(s3, s4);
    if (lH <= 0) {
      // Pure resistance: current is algebraic. A floating leg means no current.
      const u = loadVoltage(a, b, 0);
      state.uLoadV = u ?? 0;
      state.iLoadA = (u ?? 0) / rOhm;
      state.timeS += h;
      return;
    }
    let remaining = h;
    let guard = 0;
    while (remaining > 0 && guard++ < 8) {
      const i0 = state.iLoadA;
      const dir = Math.sign(i0);
      const u = loadVoltage(a, b, dir);
      if (u === null) {
        // Floating with zero current: will current start? Only if the driven path pushes it, which requires
        // both legs driven — so it stays at zero.
        state.iLoadA = 0;
        state.uLoadV = 0;
        state.timeS += remaining;
        return;
      }
      const tau = lH / rOhm;
      const iInf = u / rOhm;
      const diodePath = a === 'off' || b === 'off';
      // Exact solution i(t) = iInf + (i0 − iInf)·e^(−t/τ); in diode conduction stop at the zero crossing.
      if (diodePath && dir !== 0 && Math.sign(iInf) !== dir) {
        const tz = tau * Math.log((i0 - iInf) / (0 - iInf));
        if (tz <= remaining) {
          state.iLoadA = 0;
          state.uLoadV = 0;
          state.timeS += tz;
          remaining -= tz;
          continue;
        }
      }
      state.iLoadA = iInf + (i0 - iInf) * Math.exp(-remaining / tau);
      state.uLoadV = u;
      state.timeS += remaining;
      remaining = 0;
    }
  }

  function updateReadouts(): void {
    const [s1, s2, s3, s4] = state.gates;
    const a = legOf(s1, s2);
    const b = legOf(s3, s4);
    const u = loadVoltage(a, b, Math.sign(state.iLoadA));
    if (u === null) state.uLoadV = 0;
    else state.uLoadV = u;
    state.pLoadW = state.uLoadV * state.iLoadA;
    state.conducting = conductors(a, b, state.iLoadA);
    if (a === 'off' && b === 'off' && state.iLoadA === 0) state.polarity = 'open';
    else state.polarity = state.uLoadV > 1e-9 ? '+U' : state.uLoadV < -1e-9 ? '-U' : '0';
  }

  if (params.mode === 'manual') applyManualKeys();
  updateReadouts();

  return {
    state,
    step(dt: number): void {
      if (!(dt > 0)) return;
      const tEnd = state.timeS + dt;
      let guard = 0;
      while (state.timeS < tEnd - 1e-15 && guard++ < 100000) {
        if (state.burntRemainingS > 0) {
          const h = Math.min(state.burntRemainingS, tEnd - state.timeS);
          state.gates = [false, false, false, false];
          integrate(h);
          state.burntRemainingS -= h;
          if (state.burntRemainingS <= 1e-12) {
            state.burntRemainingS = 0;
            state.fault = false;
            if (params.mode === 'manual') {
              params.keys = [false, false, false, false];
              applyManualKeys();
            }
          }
          continue;
        }
        if (params.mode === 'auto50') {
          const g = autoGates(state.timeS + 1e-13);
          state.gates = g.gates;
          state.inDeadTime = g.dead;
          const tNext = Math.min(nextAutoEvent(state.timeS + 1e-13), tEnd);
          integrate(Math.max(tNext - state.timeS, 1e-15));
        } else {
          state.inDeadTime = false;
          integrate(tEnd - state.timeS);
        }
      }
      updateReadouts();
    },
    set(p: Partial<HBridgeParams>): void {
      params = { ...params, ...p, keys: [...(p.keys ?? params.keys)] };
      if (params.mode === 'manual' && state.burntRemainingS <= 0) applyManualKeys();
      updateReadouts();
    },
    params(): Readonly<HBridgeParams> {
      return params;
    },
    reset(): void {
      Object.assign(state, {
        timeS: 0,
        gates: [false, false, false, false],
        uLoadV: 0,
        iLoadA: 0,
        pLoadW: 0,
        conducting: [],
        polarity: 'open',
        fault: false,
        burntRemainingS: 0,
        blocked: false,
        inDeadTime: false,
      });
      if (params.mode === 'manual') applyManualKeys();
      updateReadouts();
    },
  };
}

export type HBridge = ReturnType<typeof createHBridge>;
