/**
 * Session around `createHBridge` (§M1) for step 3: runs the model in slowed time and turns its flags into
 * events. No three.js.
 *
 * Time: the model lives in real seconds (50 Hz, an RL time constant of ≈ 2 ms); the scene shows it slowed
 * ×`SLOWDOWN`. The dead time (μs) would be invisible on a 10 ms half period, so the session feeds it to the
 * model stretched ×`DEAD_STRETCH` (the step carries the chip «не в масштабі»).
 */
import {
  createHBridge,
  type BridgeLoad,
  type Conductor,
  type HBridgeState,
} from '@electricity/sim/lab-inverter';

export const SLOWDOWN = 200;
export const DEAD_STRETCH = 1000;
export const BRIDGE_UDC_V = 325;

export interface BridgeEvents {
  /** A shoot-through just happened in this leg (protection off). */
  fault?(leg: 'A' | 'B'): void;
  /** Protection refused a key: `index` (0…3) was reverted. */
  blocked?(index: number): void;
  /** The burnt keys were replaced: all four are off again. */
  repaired?(): void;
}

export interface BridgeSession {
  readonly state: HBridgeState;
  /** Keys as the learner set them (manual mode). */
  readonly keys: readonly boolean[];
  readonly auto: boolean;
  /** Signature of the conducting devices («S1+S4», «D2+D3», «» when no current flows). */
  readonly loop: string;
  readonly conducting: readonly Conductor[];
  /** Flip a key by hand; returns the state the key ended in. */
  setKey(index: number, on: boolean): boolean;
  setProtection(on: boolean): void;
  setLoad(load: BridgeLoad): void;
  setAuto(on: boolean): void;
  setDeadTimeUs(us: number): void;
  /** Advance by `dt` seconds of screen time. */
  tick(dt: number): void;
  reset(): void;
}

export function createBridgeSession(events: BridgeEvents = {}): BridgeSession {
  const sim = createHBridge({ udcV: BRIDGE_UDC_V });
  const keys: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  let auto = false;
  let wasFault = false;
  const self: BridgeSession = {
    state: sim.state,
    keys,
    get auto() {
      return auto;
    },
    get conducting() {
      return sim.state.conducting;
    },
    get loop() {
      return sim.state.conducting.join('+');
    },
    setKey(index, on) {
      if (auto || sim.state.burntRemainingS > 0) return keys[index] ?? false;
      keys[index] = on;
      sim.set({ keys: [...keys] });
      if (sim.state.blocked) {
        // protection kept the previous gates: take the offending key back
        keys[index] = false;
        sim.set({ keys: [...keys] });
        events.blocked?.(index);
        return false;
      }
      if (sim.state.fault && !wasFault) {
        wasFault = true;
        events.fault?.(index < 2 ? 'A' : 'B');
      }
      return on;
    },
    setProtection: (on) => sim.set({ protection: on }),
    setLoad: (load) => sim.set({ load }),
    setAuto(on) {
      if (on === auto) return;
      auto = on;
      keys.fill(false);
      sim.set({ mode: on ? 'auto50' : 'manual', keys: [...keys] });
      sim.reset();
    },
    setDeadTimeUs: (us) => sim.set({ deadTimeS: us * 1e-6 * DEAD_STRETCH }),
    tick(dt) {
      // the burn-out pause (1.5 s) is screen time; everything else runs slowed
      sim.step(sim.state.burntRemainingS > 0 ? dt : dt / SLOWDOWN);
      if (wasFault && !sim.state.fault) {
        wasFault = false;
        keys.fill(false);
        events.repaired?.();
      }
    },
    reset() {
      auto = false;
      wasFault = false;
      keys.fill(false);
      sim.set({ mode: 'manual', keys: [...keys], protection: true, load: 'lamp', deadTimeS: 0 });
      sim.reset();
    },
  };
  return self;
}
