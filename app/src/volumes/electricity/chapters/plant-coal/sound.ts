/**
 * Sound of the chapter (FX_API §10): loops follow the live state every frame — the roar of the furnace where the
 * fire is the subject, the turbine whine and 50 Hz hum in the machine hall, steam hiss at the boiler and the
 * pipe capsule, water in the condenser. Levels are per step (how close the listener is to the source); the
 * plugin fades every loop out when the chapter is left. One-shots are played by the steps on their events.
 */
import { audio } from '@/audio';
import type { Live } from './state';
import type { StepId } from './steps/types';

const FIRE: Partial<Record<StepId, number>> = { boiler: 0.45, 'coal-to-dust': 0.2, overview: 0.06, 'role-ukraine': 0.05 };
const TURBINE: Partial<Record<StepId, number>> = { turbine: 0.4, feedwater: 0.18, 'chp-flex': 0.08 };
const HUM: Partial<Record<StepId, number>> = { turbine: 0.16, overview: 0.05 };
const STEAM: Partial<Record<StepId, number>> = { boiler: 0.16, 'steam-params': 0.22, turbine: 0.12, 'chp-flex': 0.1 };
const WATER: Partial<Record<StepId, number>> = { feedwater: 0.26, 'ash-co2': 0.08 };

export function updateSound(step: StepId | undefined, live: Live): void {
  if (!step) return;
  const load = Math.max(0.2, live.load);
  audio.loop('fire').set({ gain: (FIRE[step] ?? 0) * load, pitch: 0.8 + 0.3 * load });
  audio.loop('turbine').set({ gain: (TURBINE[step] ?? 0) * load, pitch: 0.95 });
  audio.loop('hum').set({ gain: (HUM[step] ?? 0) * load });
  audio.loop('steam').set({ gain: (STEAM[step] ?? 0) * load, pitch: 1 });
  audio.loop('water').set({ gain: WATER[step] ?? 0 });
  audio.loop('wind').set({ gain: step === 'overview' || step === 'role-ukraine' || step === 'ash-co2' ? 0.12 : 0.04, pitch: 0.8 });
}
