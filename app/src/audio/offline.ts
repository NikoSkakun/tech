/**
 * Offline rendering of any sound through the same master chain as the live engine — used by QA to prove
 * that every one-shot, loop and mood is audible and never clips, without needing a sound card.
 */
import { AMBIENT_LEVEL, LOOP_LEVEL, SFX_LEVEL } from './engine';
import { LOOPS, type LoopName } from './loops';
import { buildMood, MOODS, type MoodName } from './moods';
import { ONE_SHOTS, type OneShotName } from './oneshots';

export interface RenderStats {
  /** Root mean square of the rendered signal (0…1). */
  rms: number;
  /** Largest absolute sample value. */
  peak: number;
  seconds: number;
}

export type SoundRef =
  | { kind: 'oneshot'; name: OneShotName }
  | { kind: 'loop'; name: LoopName; pitch?: number }
  | { kind: 'mood'; name: MoodName };

/** Render `sound` for `seconds` at master volume 0.8 and measure it. */
export async function renderOffline(sound: SoundRef, seconds = 1.5): Promise<RenderStats> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
  // same chain as AudioEngine.unlock(): bus → master (0.8² · 0.55) → limiter
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.8 * 0.8 * 0.55;
  master.connect(limiter).connect(ctx.destination);
  const bus = ctx.createGain();
  bus.connect(master);
  if (sound.kind === 'oneshot') {
    bus.gain.value = SFX_LEVEL;
    ONE_SHOTS[sound.name](ctx, bus, 0.02, 1, 1);
  } else if (sound.kind === 'loop') {
    bus.gain.value = LOOP_LEVEL;
    const voice = LOOPS[sound.name](ctx, bus, 0);
    voice.pitch(sound.pitch ?? 1, 0);
  } else {
    bus.gain.value = AMBIENT_LEVEL;
    const voice = buildMood(ctx, bus, MOODS[sound.name], 0);
    voice.gain.gain.setTargetAtTime(1, 0, 0.15); // faster fade-in than live so a short render is meaningful
  }
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    sum += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  return { rms: Math.sqrt(sum / data.length), peak, seconds };
}
