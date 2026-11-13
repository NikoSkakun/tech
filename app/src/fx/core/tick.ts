/**
 * Self-ticking: effects animate on the engine clock without the chapter calling `update()`.
 *
 * `kGlobals.uKTime` is written by the render pipeline right before it renders a scene; three.js then calls
 * `updateMatrixWorld()` on the whole graph. `onTick` hooks that call, so an effect ticks exactly once per
 * engine-time value, before culling and buffer uploads of the same frame, and only while it is visible
 * (itself and all ancestors). Under `?freeze` time stands still between navigations, so nothing moves.
 */
import type { Object3D } from 'three';
import { kGlobals } from '@/style';

export type TickFn = (t: number, dt: number) => void;

/** True when the object and all its ancestors are visible. */
export function shown(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/**
 * Call `fn(t, dt)` once per engine-time step while `object` is in a rendered scene graph and visible.
 * `dt` is the engine time since the previous tick of this object (0 on the first tick; it includes the time
 * the object spent hidden — clamp it where a jump would be wrong).
 */
export function onTick(object: Object3D, fn: TickFn): void {
  let last = -1;
  const base = object.updateMatrixWorld;
  object.updateMatrixWorld = function (this: Object3D, force?: boolean): void {
    const t = kGlobals.uKTime.value;
    if (t !== last && shown(object)) {
      const dt = last < 0 ? 0 : Math.max(t - last, 0);
      last = t;
      fn(t, dt);
    }
    base.call(this, force);
  };
}

let clockSource: { readonly time: number } | null = null;
const steppers = new Set<(dt: number) => void>();

/**
 * Call `fn(dt)` on every engine update — including the fixed steps of `?freeze` / `__app.step`, where no
 * frame is rendered. For effects with history (trails) that must see every step. Returns the unsubscribe
 * function. Without the fx plugin (unit tests) nothing is called: check `fxStepping()` and fall back.
 */
export function onStep(fn: (dt: number) => void): () => void {
  steppers.add(fn);
  return () => void steppers.delete(fn);
}

/** True when the fx plugin is mounted and `onStep` callbacks are being driven. */
export function fxStepping(): boolean {
  return clockSource !== null;
}

/** @internal Driven by the fx plugin from `engine.onUpdate`. */
export function runFxSteps(dt: number): void {
  for (const fn of steppers) fn(dt);
}

/** @internal The fx plugin hands over the engine clock at mount. */
export function bindFxClock(clock: { readonly time: number } | null): void {
  clockSource = clock;
}

/**
 * Current engine time in seconds. During `update()` this is the engine clock (also inside the fixed steps of
 * `?freeze` / `__app.step`, where no frame is rendered); without the plugin it falls back to the time of the
 * last rendered frame.
 */
export function fxTime(): number {
  return clockSource ? clockSource.time : kGlobals.uKTime.value;
}

/** Anything a chapter must advance itself (controllers that move other objects). */
export interface Updatable {
  update(dt: number, t: number): void;
}

/**
 * Collects `Updatable` controllers so a chapter forwards its `update(dt, t)` once:
 * `const fx = new FxSet(); const spin = fx.add(createSpin(…)); return { update: (dt, t) => fx.update(dt, t) }`.
 */
export class FxSet implements Updatable {
  private readonly items: Updatable[] = [];

  add<T extends Updatable>(item: T): T {
    this.items.push(item);
    return item;
  }

  remove(item: Updatable): void {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  update(dt: number, t: number): void {
    for (const item of this.items) item.update(dt, t);
  }
}
