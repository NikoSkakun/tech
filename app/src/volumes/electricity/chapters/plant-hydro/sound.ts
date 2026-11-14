/**
 * Sound of the chapter (`@/audio`, all synthesised): the water loop follows what the valley shows — the
 * spillway roar and the rain swell it, the turbines' discharge keeps a low bed; a soft hum near the machines
 * (steps 4–6, 8); the night mood at the pumped-storage step. Loops are set every frame ("wanted this frame"),
 * so nothing keeps playing after a step or the chapter is left (the plugin fades loops on chapter change).
 */
import { audio } from '@/audio';
import type { Live } from './state';

const MACHINE_STEPS = new Set(['water-path', 'turbines', 'generator-governor', 'pumped-storage']);

export function setMood(night: boolean): void {
  audio.mood(night ? 'dioramaNight' : 'dioramaDay');
}

export function updateSound(stepId: string | undefined, live: Live): void {
  const machine = stepId !== undefined && MACHINE_STEPS.has(stepId);
  const water = 0.12 + 0.3 * live.spill + 0.25 * live.storm + (machine ? 0.08 : 0.06) * live.turbine;
  audio.loop('water').set({ gain: Math.min(0.6, water), pitch: 0.8 + 0.3 * live.spill });
  audio.loop('hum').set({ gain: machine ? 0.12 : 0, pitch: 1 });
  audio.loop('turbine').set({ gain: machine ? 0.1 + 0.08 * Math.abs(live.psh) : 0, pitch: 0.5 });
}
