/**
 * `lab-hybrid-home` step 5 «Блекаут: острів за мілісекунди» — live island scene.
 *
 * - Transfer time 0…3000 ms vs the illustrative hold-up of each appliance (PC 15 ms, LED ≈ 20 ms, boiler 50 ms,
 *   fridge indifferent).
 * - Island capacity = the §M5 limit: min(P_inv, min(PV·η_pv, P_inv) + P_bat,max) (+ generator). Above it the
 *   inverter switches the output off for 5 s and retries (in the 24 h simulator the same rule costs one 5-min step).
 */
import { batteryPowerKw } from '../core/S3-sim/home/params';

export type TransferVerdict = 'ok' | 'flicker' | 'reboot' | 'relight';

/** Illustrative hold-up times, ms (DECISIONS §5 chip). */
export const HOLDUP_MS = { pc: 15, led: 20, boiler: 50 } as const;

/** Verdicts for the transfer-time slider. */
export function transferVerdicts(
  transferMs: number,
): Record<'pc' | 'led' | 'boiler' | 'fridge', TransferVerdict> {
  return {
    pc: transferMs > HOLDUP_MS.pc ? 'reboot' : 'ok',
    led: transferMs > HOLDUP_MS.led ? 'flicker' : 'ok',
    boiler: transferMs > HOLDUP_MS.boiler ? 'relight' : 'ok',
    fridge: 'ok',
  };
}

export interface IslandLimits {
  invKw: number;
  /** Battery power limit; default min(P_inv, 0.5·W_bat). */
  pbatKw?: number;
  batKwh?: number;
  pvKw?: number;
  etaPv?: number;
  genKw?: number;
}

/** Maximum load the island can carry, kW (6 kW inverter, 5.12 kW battery, no PV → 5.12 kW). */
export function islandLimitKw(l: IslandLimits): number {
  const pbat = l.pbatKw ?? batteryPowerKw(l.invKw, l.batKwh ?? 10.24);
  const pvAc = Math.min((l.pvKw ?? 0) * (l.etaPv ?? 0.97), l.invKw);
  return Math.min(l.invKw, pvAc + pbat) + (l.genKw ?? 0);
}

export const OVERLOAD_OFF_S = 5;

export interface IslandSceneState {
  timeS: number;
  loadKw: number;
  limitKw: number;
  outputOn: boolean;
  /** Seconds until the retry while the output is off. */
  retryInS: number;
  overloadCount: number;
}

/** Live overload behaviour: load above the limit → output off for 5 s, then retry. */
export function createIslandScene(limits: IslandLimits) {
  let lim = limits;
  const state: IslandSceneState = {
    timeS: 0,
    loadKw: 0,
    limitKw: islandLimitKw(lim),
    outputOn: true,
    retryInS: 0,
    overloadCount: 0,
  };
  function check(): void {
    if (state.outputOn && state.loadKw > state.limitKw + 1e-9) {
      state.outputOn = false;
      state.retryInS = OVERLOAD_OFF_S;
      state.overloadCount++;
    }
  }
  return {
    state,
    /** Total demanded load on the backup output, kW. */
    setLoad(kw: number): void {
      state.loadKw = Math.max(0, kw);
      check();
    },
    setLimits(next: Partial<IslandLimits>): void {
      lim = { ...lim, ...next };
      state.limitKw = islandLimitKw(lim);
      check();
    },
    step(dt: number): void {
      if (!(dt > 0)) return;
      state.timeS += dt;
      if (!state.outputOn) {
        state.retryInS -= dt;
        if (state.retryInS <= 1e-9) {
          state.retryInS = 0;
          state.outputOn = true;
          check();
        }
      }
    },
    reset(): void {
      Object.assign(state, { timeS: 0, outputOn: true, retryInS: 0, overloadCount: 0 });
      check();
    },
  };
}

export type IslandScene = ReturnType<typeof createIslandScene>;
