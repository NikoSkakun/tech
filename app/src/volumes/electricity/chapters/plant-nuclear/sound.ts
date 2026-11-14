/**
 * Sound of the chapter (FX_API §10): loops follow the live state every frame — wind and water over the
 * island, the deep hum of the machinery inside the containment and the turbine hall, mains hum by the line;
 * the micro-world and the inner halls get their own ambient mood. One-shots are played by the steps.
 */
import { audio } from '@/audio';
import type { Live } from './state';
import type { StepId } from './steps/types';

const ISLAND: readonly StepId[] = ['overview', 'role-ukraine'];
const MACHINES: Partial<Record<StepId, number>> = { reactor: 0.35, 'primary-loop': 0.45, 'reactor-sim': 0.2 };
const MICRO: readonly StepId[] = ['fission', 'chain-reaction', 'control'];

export function updateSound(step: StepId | undefined, live: Live): void {
  if (!step) return;
  const outside = ISLAND.includes(step);
  audio.loop('wind').set({ gain: outside ? 0.22 : 0, pitch: 0.85 });
  audio.loop('water').set({ gain: outside ? 0.12 * live.cooling : 0 });
  audio.loop('hum').set({ gain: (MACHINES[step] ?? (outside ? 0.06 : 0)) * (0.3 + 0.7 * live.power) });
}

/** Ambient bed per step (the plugin cross-fades between moods). */
export function setMood(step: string): void {
  const micro = MICRO.includes(step as StepId);
  audio.mood(micro ? 'micro' : ISLAND.includes(step as StepId) ? 'dioramaDay' : 'studio');
}
