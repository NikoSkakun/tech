/**
 * Sound of the chapter (FX_API §10): loops follow the live state every frame — the jet-like roar of the gas
 * turbine (louder in the hall, pitch with load), the low thump of the engines, a whisper of wind outside,
 * mains hum where the generators are the topic. One-shots are played by the steps on their events.
 */
import { audio } from '@/audio';
import type { Live } from './state';
import type { StepId } from './steps/types';

/** How close the listener is to the gas turbine, per step (0…1). */
const NEAR_GT: Partial<Record<StepId, number>> = { 'gas-turbine': 1, 'brayton-sim': 0.9, 'hot-section': 0.7, 'combined-cycle': 0.35, 'natural-gas': 0.15 };
const NEAR_ENGINES: Partial<Record<StepId, number>> = { 'gas-engines': 1, flexibility: 0.4 };
const OUTSIDE: Partial<Record<StepId, number>> = { overview: 1, 'natural-gas': 0.8, flexibility: 0.7, 'emissions-hydrogen': 1, role: 1, 'combined-cycle': 0.5 };

export function updateSound(step: StepId | undefined, live: Live): void {
  if (!step) return;
  const gt = Math.min(1, live.gt) * Math.min(1, live.spin / 2.2);
  audio.loop('turbine').set({ gain: (0.08 + 0.42 * (NEAR_GT[step] ?? 0.1)) * gt, pitch: 0.9 + 0.5 * gt });
  audio.loop('fire').set({ gain: 0.18 * (NEAR_GT[step] ?? 0) * gt });
  const engines = Math.min(1, live.engines / 8);
  audio.loop('buzz').set({ gain: 0.14 * (NEAR_ENGINES[step] ?? 0) * engines, pitch: 0.5 });
  audio.loop('wind').set({ gain: 0.12 * (OUTSIDE[step] ?? 0), pitch: 0.8 });
  audio.loop('hum').set({ gain: step === 'gas-turbine' ? 0.06 : 0 });
}

/** Ambient bed for the time of day. */
export function setMood(night: boolean): void {
  audio.mood(night ? 'dioramaNight' : 'dioramaDay');
}
