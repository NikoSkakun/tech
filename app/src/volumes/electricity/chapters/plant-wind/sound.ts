/**
 * Sound of the chapter (FX_API §10): loops follow the live state every frame — wind with the wind speed, the
 * turbine with the hero's rotor (louder when the camera is at the nacelle), mains hum where 50 Hz is the
 * topic, water over the sea block. One-shots are played by the steps on their events.
 */
import { audio } from '@/audio';
import type { Live } from './state';
import type { StepId } from './steps/types';

/** How close the listener is to the hero's machinery, per step (0…1). */
const NEAR: Partial<Record<StepId, number>> = { nacelle: 1, drivetrain: 1, 'power-curve': 0.55, blade: 0.4, 'wind-power': 0.35, betz: 0.3 };
const HUM: Partial<Record<StepId, number>> = { drivetrain: 0.2, 'wind-farm': 0.16, role: 0.1 };

export function updateSound(step: StepId | undefined, live: Live): void {
  if (!step) return;
  const v = Math.min(1, live.wind / 25);
  audio.loop('wind').set({ gain: 0.1 + 0.55 * v, pitch: 0.8 + 0.6 * v });
  const rpm = Math.min(1, live.heroRpm / 10.1);
  audio.loop('turbine').set({ gain: 0.5 * (NEAR[step] ?? 0.12) * rpm, pitch: 0.55 + 0.6 * rpm });
  audio.loop('hum').set({ gain: (HUM[step] ?? 0) * Math.min(1, live.heroPower * 2 + 0.4) });
  audio.loop('water').set({ gain: step === 'offshore' ? 0.28 : 0 });
}

/** Ambient bed for the time of day (the plugin picks the day mood from the manifest). */
export function setMood(night: boolean): void {
  audio.mood(night ? 'dioramaNight' : 'dioramaDay');
}
