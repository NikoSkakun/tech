/**
 * Audio of the chapter: loops follow the "wanted this frame" state the step on screen writes into
 * `bench.live`. Loops are set every frame (FX_API §10) and the state is reset afterwards, so a step that stops
 * updating falls silent by itself. Sound is seasoning only — nothing here carries meaning.
 */
import { audio } from '@/audio';
import { damp } from '@/engine/api';
import type { LiveState } from './chapter';

export const silent = (): LiveState => ({ buzz: 0, whir: 0, whirPitch: 1, hum: 0, humPitch: 1 });

export function createSound(live: LiveState): { update(dt: number): void } {
  const shown = silent();
  return {
    update(dt) {
      shown.buzz = damp(shown.buzz, clamp01(live.buzz), 6, dt);
      shown.whir = damp(shown.whir, clamp01(live.whir), 5, dt);
      shown.hum = damp(shown.hum, clamp01(live.hum), 6, dt);
      shown.whirPitch = damp(shown.whirPitch, live.whirPitch, 4, dt);
      shown.humPitch = damp(shown.humPitch, live.humPitch, 4, dt);
      Object.assign(live, silent());
      audio.loop('buzz').set({ gain: 0.06 * shown.buzz, pitch: 0.8 + 0.4 * shown.buzz });
      audio.loop('turbine').set({ gain: 0.12 * shown.whir, pitch: shown.whirPitch });
      audio.loop('hum').set({ gain: 0.08 * shown.hum, pitch: shown.humPitch });
    },
  };
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);
