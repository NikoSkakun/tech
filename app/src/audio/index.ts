/**
 * `@/audio` — procedural WebAudio (owner: F3-fx). No sample files; everything is synthesised.
 *
 * ```ts
 * import { audio } from '@/audio';
 * audio.play('click');                                  // one-shot
 * audio.play('tick', { pitch: 1 + value });             // … with options
 * audio.loop('turbine').set({ gain: 0.5, pitch: rpm / 3000 });   // parametric loop (set it in update / enterStep)
 * audio.mood('micro');                                  // ambient pad (the plugin does this per chapter)
 * ```
 *
 * The engine plugin unlocks audio on the first user gesture, follows `settings.audio` / `settings.volume`,
 * picks the ambient mood from each chapter's theme, plays the scale-transition whoosh, stops loops on chapter
 * change and pauses with the tab. With `?noaudio`, or before the first gesture, every call is a silent no-op.
 */
export { audio } from './audio';
export { plugin, type AudioDebug } from './plugin';
export { moodForTheme } from './moods';
export type { LoopHandle, LoopParams } from './engine';
export type { LoopName } from './loops';
export type { MoodName } from './moods';
export type { OneShotName, OneShotOptions } from './oneshots';
export type { RenderStats, SoundRef } from './offline';
