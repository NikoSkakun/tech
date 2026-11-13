/**
 * Audio of the chapter: loops driven by "wanted this frame" levels. `begin()` clears them, the step on screen
 * raises what it needs in its `update`, `apply()` hands the result to the audio engine (FX_API §10: loops are
 * set continuously, never once in the factory). Machines hum at twice the mains frequency (100 Hz): the hum
 * loop at pitch 2 (its base is 50 Hz). Sound is seasoning — nothing depends on it.
 */
import { audio } from '@/audio';

export interface Sound {
  /** Machine hum 0…1 (100 Hz and harmonics). */
  hum: number;
  /** Pitch of the hum: 2 = 100 Hz (the hum of a 50 Hz machine). */
  humPitch: number;
  /** Rotating machinery (whoosh of a rotor) 0…1 and its pitch (1 = 3000 rpm). */
  turbine: number;
  turbinePitch: number;
  /** Harsh buzz 0…1: an overheated motor, an out-of-step generator. */
  buzz: number;
  begin(): void;
  apply(): void;
  click(pitch?: number): void;
  relay(): void;
  breaker(): void;
  zap(): void;
  ok(): void;
  error(): void;
}

export function createSound(): Sound {
  const s: Sound = {
    hum: 0,
    humPitch: 2,
    turbine: 0,
    turbinePitch: 1,
    buzz: 0,
    begin() {
      s.hum = 0.05; // the machine hall always hums a little
      s.humPitch = 2;
      s.turbine = 0;
      s.turbinePitch = 1;
      s.buzz = 0;
    },
    apply() {
      audio.loop('hum').set({ gain: Math.min(1, s.hum) * 0.45, pitch: s.humPitch });
      audio.loop('turbine').set({ gain: Math.min(1, s.turbine) * 0.4, pitch: Math.max(0.2, s.turbinePitch) });
      audio.loop('buzz').set({ gain: Math.min(1, s.buzz) * 0.3, pitch: 1 });
    },
    click: (pitch = 1) => audio.play('tick', { pitch, gain: 0.6 }),
    relay: () => audio.play('relay'),
    breaker: () => audio.play('breaker', { gain: 0.8 }),
    zap: () => audio.play('zap'),
    ok: () => audio.play('success', { gain: 0.6 }),
    error: () => audio.play('error', { gain: 0.6 }),
  };
  return s;
}
