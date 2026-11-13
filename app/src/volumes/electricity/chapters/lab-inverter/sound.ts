/**
 * Audio of the lab: two loops driven by "wanted this frame" levels. `begin()` clears them, the step on screen
 * raises what it needs in its `update`, `apply()` hands the result to the audio engine (FX_API §10: loops are
 * set continuously, never once in the factory). Sound is seasoning — nothing depends on it.
 */
import { audio } from '@/audio';

export interface Sound {
  /** Mains / transformer hum 0…1 (50 Hz and harmonics; very quiet by default). */
  hum: number;
  /** Pitch of the hum: 1 = 50 Hz (a drive at 25 Hz → 0.5). */
  humPitch: number;
  /** Harsh buzz 0…1: a choke singing at a low carrier, an overloaded inverter, a modified sine on a motor. */
  buzz: number;
  buzzPitch: number;
  begin(): void;
  apply(): void;
  /** One-shots (thin wrappers so steps do not import the audio engine for a click). */
  click(pitch?: number): void;
  relay(): void;
  zap(): void;
  ok(): void;
  error(): void;
}

export function createSound(): Sound {
  const s: Sound = {
    hum: 0,
    humPitch: 1,
    buzz: 0,
    buzzPitch: 1,
    begin() {
      s.hum = 0.08; // the lab always hums a little: something here is alive
      s.humPitch = 1;
      s.buzz = 0;
      s.buzzPitch = 1;
    },
    apply() {
      audio.loop('hum').set({ gain: Math.min(1, s.hum) * 0.5, pitch: s.humPitch });
      audio.loop('buzz').set({ gain: Math.min(1, s.buzz) * 0.35, pitch: s.buzzPitch });
    },
    click: (pitch = 1) => audio.play('tick', { pitch, gain: 0.6 }),
    relay: () => audio.play('relay'),
    zap: () => audio.play('zap'),
    ok: () => audio.play('success', { gain: 0.6 }),
    error: () => audio.play('error', { gain: 0.6 }),
  };
  return s;
}
