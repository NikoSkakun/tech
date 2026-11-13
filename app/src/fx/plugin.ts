/**
 * Engine plugin of `@/fx`, in its own module so that `main.ts` loads only this at boot (M1 plugin loading) and the
 * effect library itself arrives with the first chapter that imports it.
 */
import type { EnginePlugin } from '@/engine/api';
import { bindFxClock, runFxSteps } from './core/tick';

/** Engine hook: gives one-shot effects (`emit`, `fire`, `strike`) the engine clock as their time base. */
export const plugin: EnginePlugin = {
  name: 'fx',
  mount(engine) {
    bindFxClock(engine.clock);
    const off = engine.onUpdate(runFxSteps);
    return () => {
      off();
      bindFxClock(null);
    };
  },
};
