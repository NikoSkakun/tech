/** The `audio` facade and the shared engine instance (see `@/audio`). */
import { AudioEngine, type LoopHandle } from './engine';
import { LOOPS, type LoopName } from './loops';
import { MOODS, type MoodName } from './moods';
import { ONE_SHOTS, type OneShotName, type OneShotOptions } from './oneshots';

/** The one audio engine of the app (shared by the facade and the plugin). */
export const engine = new AudioEngine();

export const audio = {
  /** Play a one-shot: `hover`, `click`, `toggle`, `tick`, `panelOpen`, `panelClose`, `success`, `error`,
   *  `zap`, `spark`, `breaker`, `relay`, `whooshUp`, `whooshDown`. */
  play: (name: OneShotName, opts?: OneShotOptions): void => engine.play(name, opts),
  /** A parametric loop: `hum`, `turbine`, `water`, `steam`, `wind`, `fire`, `geiger`, `buzz`. */
  loop: (name: LoopName): LoopHandle => engine.loop(name),
  /** Cross-fade to an ambient mood: `micro`, `studio`, `dioramaDay`, `dioramaNight` (null = none). */
  mood: (name: MoodName | null): void => engine.mood(name),
  /** Fade out all loops. */
  stopLoops: (fade?: number): void => engine.stopLoops(fade),
  /** True once the first user gesture has unlocked audio (always false with `?noaudio`). */
  get unlocked(): boolean {
    return engine.unlocked;
  },
  /** Names of everything that can be played (for menus, tests, sound checks). */
  names: {
    oneShots: Object.keys(ONE_SHOTS) as OneShotName[],
    loops: Object.keys(LOOPS) as LoopName[],
    moods: Object.keys(MOODS) as MoodName[],
  },
} as const;
