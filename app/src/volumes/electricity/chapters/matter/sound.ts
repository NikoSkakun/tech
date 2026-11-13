/**
 * Audio loops driven by the state of the step on screen (FX_API §10: set loops continuously, never once in the
 * factory). Steps publish what they want through `lab.live`; `update` runs every frame after the steps, glides
 * the loops toward it and resets the request — a step that is left goes silent by itself.
 */
import { audio } from '@/audio';
import type { LiveState } from './chapter';

export function createSound(live: LiveState): { update(dt: number): void } {
  const level = { buzz: 0, hum: 0, crackle: 0 };
  return {
    update(dt) {
      const k = Math.min(dt * 6, 1);
      level.buzz += (live.buzz - level.buzz) * k;
      level.hum += (live.hum - level.hum) * k;
      level.crackle += (live.crackle - level.crackle) * k;
      audio.loop('buzz').set({ gain: 0.22 * level.buzz, pitch: 1.1 });
      audio.loop('hum').set({ gain: 0.18 * level.hum, pitch: 1 });
      // scattering / thermal noise as a soft geiger rustle: pitch = click rate
      audio.loop('geiger').set({ gain: 0.12 * level.crackle, pitch: 0.4 + 1.6 * live.crackleRate });
      live.buzz = live.hum = live.crackle = live.crackleRate = 0;
    },
  };
}
