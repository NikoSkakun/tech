/**
 * Audio of the chapter (FX_API §10): loops are set every frame from the live state the steps publish here, so
 * they follow the simulation and fade by themselves when the chapter is left. Sound is seasoning only.
 */
import { audio } from '@/audio';
import type { StepId } from './content';

/** What the step on screen wants to be heard this frame (reset after every frame). */
export const sound = {
  /** Electrical power flowing through the bench / array, 0…1 of the nominal value → mains-like hum. */
  power: 0,
  /** A hot spot is burning, 0…1 → buzz. */
  hot: 0,
  /** Wind over the roof, 0…1. */
  wind: 0,
};

export function updateSound(step: StepId | undefined): void {
  const on = step !== undefined;
  audio.loop('hum').set({ gain: on ? 0.05 + 0.16 * Math.min(1, sound.power) : 0, pitch: 1 });
  audio.loop('buzz').set({ gain: on ? 0.22 * Math.min(1, sound.hot) : 0, pitch: 0.8 + 0.3 * sound.hot });
  audio.loop('wind').set({ gain: on ? 0.25 * Math.min(1, sound.wind) : 0, pitch: 1 });
  sound.power = 0;
  sound.hot = 0;
  sound.wind = 0;
}

/** One-shot for a discrete event of a step (MPPT step, diode switching, a preset). */
export function blip(name: 'tick' | 'relay' | 'zap' | 'success' | 'whooshUp', gain = 0.5, pitch = 1): void {
  audio.play(name, { gain, pitch });
}
