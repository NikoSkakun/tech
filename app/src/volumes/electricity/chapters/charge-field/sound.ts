/**
 * Audio loops driven by the state of the step on screen (FX_API §10: set loops continuously, never once in the
 * factory). Steps publish what they want through `sound.*`; `updateSound` runs every frame after the step.
 */
import { audio } from '@/audio';
import type { StepId } from './content';

/** "Wanted this frame" levels, 0…1; steps write them in `update`, they decay to silence by themselves. */
export const sound = { hum: 0, buzz: 0, wind: 0 };

export function updateSound(step: StepId | null): void {
  if (step === null) sound.hum = sound.buzz = sound.wind = 0;
  audio.loop('hum').set({ gain: 0.22 * sound.hum, pitch: 1 });
  audio.loop('buzz').set({ gain: 0.3 * sound.buzz, pitch: 1.2 });
  audio.loop('wind').set({ gain: 0.35 * sound.wind, pitch: 0.8 });
  // steps must ask again every frame
  sound.hum = sound.buzz = sound.wind = 0;
}
