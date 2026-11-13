/**
 * Engine plugin of `@/audio`, in its own module so that `main.ts` loads only this at boot (M1 plugin loading):
 * unlock on the first gesture, volume / mute, per-chapter mood, transition whoosh, tab pause, `window.__audio`.
 */
import type { EnginePlugin } from '@/engine/api';
import { audio, engine } from './audio';
import type { LoopParams } from './engine';
import type { LoopName } from './loops';
import { moodForTheme } from './moods';
import { renderOffline, type RenderStats, type SoundRef } from './offline';

/** QA hooks exposed as `window.__audio` (inert unless called). */
export interface AudioDebug {
  unlocked(): boolean;
  /** RMS and peak of the live master output over the analyser window. */
  level(): { rms: number; peak: number };
  renderOffline(sound: SoundRef, seconds?: number): Promise<RenderStats>;
  names: typeof audio.names;
  play: typeof audio.play;
  loop(name: LoopName, params: LoopParams): void;
  mood: typeof audio.mood;
  stopLoops(): void;
  state(): string;
}

declare global {
  interface Window {
    __audio?: AudioDebug;
  }
}

export const plugin: EnginePlugin = {
  name: 'audio',
  mount(app) {
    if (app.flags.noaudio) engine.disable();
    void app.input.gesture.then(() => engine.unlock());
    const sync = (): void => {
      const s = app.store.get().settings;
      engine.setVolume(s.volume, s.audio);
    };
    const offVolume = app.store.subscribe((s) => s.settings.volume, sync, { immediate: true });
    const offMute = app.store.subscribe((s) => s.settings.audio, sync);
    const offChapter = app.runtime.on('chapter', ({ volumeId, chapterId }) => {
      engine.stopLoops();
      const theme = app.library.registry(volumeId)?.get(chapterId)?.theme;
      if (theme) engine.mood(moodForTheme(theme.mood, theme.sky));
    });
    // direction +1 = zooming in (down in scale) → falling whoosh; −1 = zooming out → rising
    const offTransition = app.runtime.on('transitionStart', ({ from, direction }) => {
      if (from !== null) engine.play(direction > 0 ? 'whooshDown' : 'whooshUp', { gain: 0.8 });
    });
    const onVisibility = (): void => engine.setSuspended(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const data = new Float32Array(2048);
    window.__audio = {
      unlocked: () => engine.unlocked,
      level() {
        if (!engine.analyser) return { rms: 0, peak: 0 };
        engine.analyser.getFloatTimeDomainData(data);
        let sum = 0;
        let peak = 0;
        for (const v of data) {
          sum += v * v;
          peak = Math.max(peak, Math.abs(v));
        }
        return { rms: Math.sqrt(sum / data.length), peak };
      },
      renderOffline,
      names: audio.names,
      play: audio.play,
      loop: (name, params) => void engine.loop(name).set(params),
      mood: audio.mood,
      stopLoops: () => engine.stopLoops(),
      state: () => engine.context?.state ?? 'locked',
    };
    return () => {
      offVolume();
      offMute();
      offChapter();
      offTransition();
      document.removeEventListener('visibilitychange', onVisibility);
      delete window.__audio;
    };
  },
};
