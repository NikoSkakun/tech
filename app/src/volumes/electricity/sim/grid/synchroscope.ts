/**
 * grid step 12, mini-game part 2 «Синхронізуй»: synchroscope and the breaker-closing check.
 * Δφ(t) = Δφ₀ + 360°·Δf·t, wrapped to (−180°, 180°]; the pointer turns once per 1/|Δf| s; «12 o'clock» = Δφ = 0.
 * Closing succeeds if |Δf| ≤ 0,1 Hz, |Δφ| ≤ 10°, |ΔU| ≤ 0,05 p.u. (grid.md step 12).
 */

export const SYNC_LIMITS = { maxDeltaFHz: 0.1, maxDeltaPhiDeg: 10, maxDeltaUPu: 0.05 } as const;
export const SYNC_INITIAL = { islandFHz: 49.8, islandUPu: 0.96, phi0Deg: 120 } as const;
export const GRID_F_HZ = 50;
export const GRID_U_PU = 1;

/** Wrap an angle in degrees to (−180, 180]. */
export function wrapDeg(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

/** Phase difference island − grid [deg] at time t [s] for a constant slip Δf = f_island − 50 Hz. */
export function phaseDifferenceDeg(phi0Deg: number, deltaFHz: number, timeS: number): number {
  return wrapDeg(phi0Deg + 360 * deltaFHz * timeS);
}

/** Pointer period [s] (Infinity at zero slip — the pointer stands still). */
export function synchroscopePeriodS(deltaFHz: number): number {
  return deltaFHz === 0 ? Infinity : 1 / Math.abs(deltaFHz);
}

export type SyncFailure = 'frequency' | 'phase' | 'voltage';

export interface SyncCheck {
  ok: boolean;
  /** What did not match (empty on success). */
  failures: SyncFailure[];
  deltaFHz: number;
  deltaPhiDeg: number;
  deltaUPu: number;
}

export function checkSynchronisation(islandFHz: number, islandUPu: number, deltaPhiDeg: number): SyncCheck {
  const deltaFHz = islandFHz - GRID_F_HZ;
  const deltaUPu = islandUPu - GRID_U_PU;
  const dphi = wrapDeg(deltaPhiDeg);
  const failures: SyncFailure[] = [];
  if (Math.abs(deltaFHz) > SYNC_LIMITS.maxDeltaFHz + 1e-9) failures.push('frequency');
  if (Math.abs(dphi) > SYNC_LIMITS.maxDeltaPhiDeg + 1e-9) failures.push('phase');
  if (Math.abs(deltaUPu) > SYNC_LIMITS.maxDeltaUPu + 1e-9) failures.push('voltage');
  return { ok: failures.length === 0, failures, deltaFHz, deltaPhiDeg: dphi, deltaUPu };
}

/**
 * Stateful synchroscope for the scene: integrates the phase with the current slip (so slider moves do not make the
 * pointer jump) — dΔφ/dt = 360°·Δf.
 */
export interface Synchroscope {
  readonly state: { islandFHz: number; islandUPu: number; deltaPhiDeg: number; timeS: number; closed: boolean };
  set(p: { islandFHz?: number; islandUPu?: number }): void;
  step(dt: number): void;
  /** Try to close the breaker; on success the island is locked to the grid (Δφ = 0, f = 50). */
  close(): SyncCheck;
  reset(): void;
}

export function createSynchroscope(): Synchroscope {
  type St = { islandFHz: number; islandUPu: number; deltaPhiDeg: number; timeS: number; closed: boolean };
  const init = (): St => ({
    islandFHz: SYNC_INITIAL.islandFHz,
    islandUPu: SYNC_INITIAL.islandUPu,
    deltaPhiDeg: SYNC_INITIAL.phi0Deg,
    timeS: 0,
    closed: false,
  });
  let st = init();
  return {
    get state() {
      return st;
    },
    set(p) {
      if (st.closed) return;
      if (p.islandFHz !== undefined) st.islandFHz = Math.min(50.5, Math.max(49.5, p.islandFHz));
      if (p.islandUPu !== undefined) st.islandUPu = Math.min(1.1, Math.max(0.9, p.islandUPu));
    },
    step(dt) {
      if (!(dt > 0)) return;
      st.timeS += dt;
      if (!st.closed) st.deltaPhiDeg = wrapDeg(st.deltaPhiDeg + 360 * (st.islandFHz - GRID_F_HZ) * dt);
    },
    close() {
      const c = checkSynchronisation(st.islandFHz, st.islandUPu, st.deltaPhiDeg);
      if (c.ok) st = { ...st, closed: true, deltaPhiDeg: 0, islandFHz: GRID_F_HZ, islandUPu: GRID_U_PU };
      return c;
    },
    reset() {
      st = init();
    },
  };
}
