/**
 * Audio of the chapter: loops driven by "wanted this frame" levels. `begin()` clears them, the step on screen
 * raises what it needs in its `update`, `apply()` hands the result to the audio engine (FX_API §10: loops are
 * set continuously, never once in the factory). The turbine hall hums softly at 100 Hz (a 50 Hz machine:
 * `hum` at pitch 2); steam, water, fire and wind loops follow the rig on screen. Sound is seasoning.
 */
import { audio } from '@/audio';

export interface Sound {
  hum: number;
  /** Rotating machinery 0…1 and its pitch (1 = 3000 rpm). */
  turbine: number;
  turbinePitch: number;
  steam: number;
  water: number;
  fire: number;
  wind: number;
  begin(): void;
  apply(): void;
  click(pitch?: number): void;
  relay(): void;
  whoosh(): void;
  ok(): void;
  alarm(): void;
}

export function createSound(): Sound {
  const s: Sound = {
    hum: 0,
    turbine: 0,
    turbinePitch: 1,
    steam: 0,
    water: 0,
    fire: 0,
    wind: 0,
    begin() {
      s.hum = 0.04; // the hub always hums a little
      s.turbine = 0;
      s.turbinePitch = 1;
      s.steam = 0;
      s.water = 0;
      s.fire = 0;
      s.wind = 0;
    },
    apply() {
      audio.loop('hum').set({ gain: Math.min(1, s.hum) * 0.4, pitch: 2 });
      audio.loop('turbine').set({ gain: Math.min(1, s.turbine) * 0.35, pitch: Math.max(0.2, s.turbinePitch) });
      audio.loop('steam').set({ gain: Math.min(1, s.steam) * 0.3, pitch: 1 });
      audio.loop('water').set({ gain: Math.min(1, s.water) * 0.35, pitch: 1 });
      audio.loop('fire').set({ gain: Math.min(1, s.fire) * 0.3, pitch: 1 });
      audio.loop('wind').set({ gain: Math.min(1, s.wind) * 0.3, pitch: 1 });
    },
    click: (pitch = 1) => audio.play('tick', { pitch, gain: 0.6 }),
    relay: () => audio.play('relay'),
    whoosh: () => audio.play('whooshUp', { gain: 0.5 }),
    ok: () => audio.play('success', { gain: 0.6 }),
    alarm: () => audio.play('error', { gain: 0.5 }),
  };
  return s;
}
