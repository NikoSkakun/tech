/**
 * Engine clock. Every animation in the app (tweens, camera, shaders, simulations) is driven by this clock so
 * that the debug/QA API can pause, single-step, scale or fast-forward time deterministically.
 */
export interface ClockView {
  /** Seconds of engine time since boot (affected by pause / timeScale). */
  readonly time: number;
  /** Seconds advanced by the current update (0 while paused). */
  readonly dt: number;
  /** Number of updates so far. */
  readonly frame: number;
}

/** Longest step a single real frame may advance the clock: tab switches and hitches must not teleport state. */
export const MAX_FRAME_DT = 1 / 15;
/** Fixed step used by deterministic fast-forward (`advanceFixed`). */
export const FIXED_DT = 1 / 60;

export class Clock implements ClockView {
  time = 0;
  dt = 0;
  frame = 0;
  timeScale = 1;
  paused = false;
  private lastReal: number | null = null;

  /** Advance from a real timestamp in milliseconds (rAF). Returns the dt applied. */
  tickReal(nowMs: number): number {
    const last = this.lastReal;
    this.lastReal = nowMs;
    if (last === null || this.paused) return this.advance(0);
    const real = Math.min(Math.max((nowMs - last) / 1000, 0), MAX_FRAME_DT);
    return this.advance(real * this.timeScale);
  }

  /** Advance by an explicit dt in seconds (ignores `paused`; used by `step` and fixed fast-forward). */
  advance(dt: number): number {
    this.dt = dt;
    this.time += dt;
    this.frame++;
    return dt;
  }

  /** Forget the last real timestamp so the next `tickReal` does not include the time spent hidden/paused. */
  resetReal(): void {
    this.lastReal = null;
  }
}
