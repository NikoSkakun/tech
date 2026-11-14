/**
 * Audio of the chapter: two loops driven by "wanted this frame" levels. `begin()` clears them, the step on screen
 * raises what it needs in its `update`, `apply()` hands the result to the audio engine (FX_API §10: loops are set
 * continuously, never once in the factory) — so nothing keeps playing after the step is left. Sound is seasoning.
 */
import { audio } from '@/audio';

export interface Sound {
  /**
   * Transformer hum 0…1. The engine's `hum` loop is mains 50 Hz + harmonics; a transformer's fundamental is
   * 100 Hz (magnetostriction), so the steps that speak of the hum play it at pitch 2.
   */
  hum: number;
  humPitch: number;
  /** Fans / oil pumps / an arc: the `buzz` loop 0…1. */
  buzz: number;
  buzzPitch: number;
  begin(): void;
  apply(): void;
  click(pitch?: number): void;
  relay(): void;
  breaker(): void;
  zap(): void;
  spark(): void;
  ok(): void;
  error(): void;
}

export function createSound(): Sound {
  const s: Sound = {
    hum: 0,
    humPitch: 2,
    buzz: 0,
    buzzPitch: 1,
    begin() {
      s.hum = 0.05; // every transformer hums a little: something here is alive
      s.humPitch = 2;
      s.buzz = 0;
      s.buzzPitch = 1;
    },
    apply() {
      // mix measured offline (qa/sound-offline.mjs): the steps' hum sits 10–20 dB under the mood pad, «Послухати»
      // reaches the pad's level; never clips
      audio.loop('hum').set({ gain: Math.min(1, s.hum), pitch: s.humPitch });
      audio.loop('buzz').set({ gain: Math.min(1, s.buzz) * 0.6, pitch: s.buzzPitch });
    },
    click: (pitch = 1) => audio.play('tick', { pitch, gain: 0.6 }),
    relay: () => audio.play('relay'),
    breaker: () => audio.play('breaker', { gain: 0.7 }),
    zap: () => audio.play('zap'),
    spark: () => audio.play('spark', { gain: 0.7 }),
    ok: () => audio.play('success', { gain: 0.6 }),
    error: () => audio.play('error', { gain: 0.6 }),
  };
  return s;
}
