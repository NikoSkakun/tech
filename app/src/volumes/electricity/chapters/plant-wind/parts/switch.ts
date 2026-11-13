/**
 * A tweened on / off value for things a *control* shows and hides inside one step (the stage only knows
 * per-step visibility). `apply(v)` receives 0…1; call `set(false, true)` from the step's `leave` so the world
 * is back in its default state for every other step.
 */
import type { TweenScope } from '@/engine/api';

export interface Switch {
  readonly value: number;
  set(on: boolean, instant?: boolean): void;
}

export function createSwitch(tweens: TweenScope, apply: (v: number) => void, initial = false): Switch {
  const state = { v: initial ? 1 : 0 };
  let target = initial;
  apply(state.v);
  return {
    get value() {
      return state.v;
    },
    set(on, instant = false) {
      if (on === target && !instant) return;
      target = on;
      if (instant) {
        tweens.to(state, { v: on ? 1 : 0 }, { duration: 0 });
        state.v = on ? 1 : 0;
        apply(state.v);
      } else tweens.to(state, { v: on ? 1 : 0 }, { duration: 0.5, ease: 'power2.inOut', onUpdate: () => apply(state.v) });
    },
  };
}
