/**
 * Ambient pads per mood (STYLE_GUIDE §7: "low evolving ambient pad per mood"). A pad is a handful of detuned
 * sine / triangle partials on a chord, each breathing at its own slow rate, through a gentle low-pass, plus
 * an optional bed of air noise. Nothing here has a beat or a melody: it is a colour, not music.
 */
import { lfo, noiseLoop } from './synth';

export interface MoodSpec {
  /** Root frequency, Hz. */
  root: number;
  /** Chord as frequency ratios to the root. */
  ratios: readonly number[];
  /** Low-pass cutoff, Hz (lower = darker). */
  cutoff: number;
  /** Level of the air-noise bed, 0…1. */
  air: number;
  /** Band of the air noise, Hz. */
  airBand: number;
  /** Overall level. */
  level: number;
}

export const MOODS = {
  /** Inner space: airy, high, slightly glassy (A–E–B–C♯: an open add9 sound). */
  micro: { root: 110, ratios: [1, 1.5, 2.25, 2.52, 4], cutoff: 1800, air: 0.12, airBand: 2600, level: 1 },
  /** Studio / machines: neutral and warm (D–A–D–F♯). */
  studio: { root: 73.42, ratios: [1, 1.5, 2, 2.52, 3], cutoff: 1100, air: 0.06, airBand: 900, level: 0.9 },
  /** Diorama by day: brighter major sixth chord with a breeze. */
  dioramaDay: { root: 98, ratios: [1, 1.5, 2, 2.5, 3.34], cutoff: 1500, air: 0.2, airBand: 600, level: 0.9 },
  /** Diorama at night: lower and darker, minor colour, more still. */
  dioramaNight: { root: 82.41, ratios: [1, 1.5, 2, 2.4, 3], cutoff: 750, air: 0.1, airBand: 380, level: 0.85 },
} as const satisfies Record<string, MoodSpec>;

export type MoodName = keyof typeof MOODS;

export interface MoodVoice {
  /** Output gain node of the pad (the engine cross-fades it). */
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
}

/** Build a pad into `out`; it starts silent — fade `gain.gain` in. */
export function buildMood(ctx: BaseAudioContext, out: AudioNode, spec: MoodSpec, t0: number): MoodVoice {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.cutoff;
  filter.Q.value = 0.3;
  filter.connect(gain).connect(out);
  const sources: AudioScheduledSourceNode[] = [];
  spec.ratios.forEach((ratio, i) => {
    // two oscillators a few cents apart per chord tone: slow beating = the "evolving" shimmer
    for (const detune of [-6, 7]) {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'triangle' : 'sine';
      osc.frequency.value = spec.root * ratio;
      osc.detune.value = detune + i * 1.5;
      const g = ctx.createGain();
      // higher partials are quieter (≈ 1 / n roll-off)
      const base = (0.085 * spec.level) / (1 + i * 0.75);
      g.gain.value = base;
      osc.connect(g).connect(filter);
      osc.start(t0);
      // each partial breathes at its own period of 9…23 s, so the texture never repeats audibly
      sources.push(osc, lfo(ctx, g.gain, 1 / (9 + i * 3.7 + (detune > 0 ? 2.3 : 0)), base * 0.7, t0));
    }
  });
  sources.push(lfo(ctx, filter.frequency, 1 / 31, spec.cutoff * 0.25, t0));
  if (spec.air > 0) {
    const air = noiseLoop(ctx, 'bandpass', spec.airBand, 0.6);
    const g = ctx.createGain();
    g.gain.value = spec.air * 0.12 * spec.level;
    air.filter.connect(g).connect(gain);
    air.source.start(t0);
    sources.push(air.source, lfo(ctx, g.gain, 1 / 13, spec.air * 0.05 * spec.level, t0));
  }
  return { gain, sources };
}

/** Mood for a chapter theme (`manifest.theme`): the post mood and, for dioramas, the sky preset. */
export function moodForTheme(mood: string, sky: string): MoodName {
  if (mood === 'micro') return 'micro';
  if (mood === 'studio') return 'studio';
  return sky === 'night' || sky === 'dusk' ? 'dioramaNight' : 'dioramaDay';
}
