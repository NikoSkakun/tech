/**
 * Audio of the chapter: loops follow the "wanted this frame" state the step on screen writes into
 * `bench.live`. Loops are set every frame (FX_API §10) and the state is reset afterwards, so a step that stops
 * updating falls silent by itself. Sound is seasoning only — nothing here carries meaning.
 */
import { audio } from '@/audio';
import { damp } from '@/engine/api';
import type { LiveState } from './chapter';

export function createSound(live: LiveState): { update(dt: number): void } {
  const shown: LiveState = { hum: 0, buzz: 0, water: 0, steam: 0 };
  const keys = Object.keys(shown) as (keyof LiveState)[];
  return {
    update(dt) {
      for (const k of keys) {
        shown[k] = damp(shown[k], Math.min(Math.max(live[k], 0), 1), 6, dt);
        live[k] = 0;
      }
      audio.loop('hum').set({ gain: 0.1 * shown.hum });
      audio.loop('buzz').set({ gain: 0.07 * shown.buzz, pitch: 0.8 + 0.4 * shown.buzz });
      audio.loop('water').set({ gain: 0.12 * shown.water });
      audio.loop('steam').set({ gain: 0.1 * shown.steam });
    },
  };
}
