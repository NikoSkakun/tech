/**
 * One-shot sounds. Each builder schedules its nodes on `out` starting at `t0` and returns its length in
 * seconds. Everything is short, soft and pitched in one family (pentatonic around A) — STYLE_GUIDE §7:
 * "soft UI ticks/pops … nothing harsh".
 */
import { noise, tone } from './synth';

export interface OneShotOptions {
  /** Gain multiplier. Default 1. */
  gain?: number;
  /** Pitch multiplier (1 = as designed; e.g. slider ticks rising with the value). Default 1. */
  pitch?: number;
}

type Builder = (ctx: BaseAudioContext, out: AudioNode, t0: number, g: number, p: number) => number;

const A4 = 440;

export const ONE_SHOTS = {
  /** Pointer enters an interactive element: a tiny airy blip. */
  hover: (ctx, out, t0, g, p) => {
    tone(ctx, out, { f0: A4 * 2 * p, f1: A4 * 2.2 * p, t0, dur: 0.06, gain: 0.05 * g });
    return 0.08;
  },
  /** Button press: soft wooden pop. */
  click: (ctx, out, t0, g, p) => {
    tone(ctx, out, { type: 'triangle', f0: 620 * p, f1: 300 * p, t0, dur: 0.09, gain: 0.16 * g });
    noise(ctx, out, { t0, dur: 0.03, gain: 0.05 * g, f0: 2600, q: 0.8 });
    return 0.11;
  },
  /** Toggle switch: two-step tick (pitch up = on; pass pitch < 1 for off). */
  toggle: (ctx, out, t0, g, p) => {
    tone(ctx, out, { type: 'triangle', f0: 520 * p, t0, dur: 0.05, gain: 0.12 * g });
    tone(ctx, out, { type: 'triangle', f0: 780 * p, t0: t0 + 0.055, dur: 0.07, gain: 0.12 * g });
    return 0.14;
  },
  /** Slider detent. */
  tick: (ctx, out, t0, g, p) => {
    tone(ctx, out, { f0: 1500 * p, f1: 1100 * p, t0, dur: 0.03, gain: 0.1 * g, attack: 0.002 });
    return 0.04;
  },
  /** Panel opens: short rising breath with a chime on top. */
  panelOpen: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 0.26, gain: 0.07 * g, f0: 500, f1: 3200, q: 0.9, attack: 0.08 });
    tone(ctx, out, { f0: A4 * 1.5 * p, t0: t0 + 0.08, dur: 0.3, gain: 0.07 * g, attack: 0.02 });
    return 0.4;
  },
  /** Panel closes: the same breath falling. */
  panelClose: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 0.2, gain: 0.06 * g, f0: 2800, f1: 420, q: 0.9, attack: 0.03 });
    tone(ctx, out, { f0: A4 * p, f1: A4 * 0.75 * p, t0, dur: 0.18, gain: 0.05 * g, attack: 0.01 });
    return 0.24;
  },
  /** Success: rising major triad arpeggio with a soft sparkle. */
  success: (ctx, out, t0, g, p) => {
    [1, 1.25, 1.5, 2].forEach((r, i) =>
      tone(ctx, out, { f0: A4 * r * p, t0: t0 + i * 0.075, dur: 0.42, gain: 0.11 * g, attack: 0.008 }),
    );
    tone(ctx, out, { f0: A4 * 4 * p, t0: t0 + 0.26, dur: 0.5, gain: 0.035 * g, attack: 0.02 });
    return 0.8;
  },
  /** Error: two low, rounded steps down — clear but never alarming. */
  error: (ctx, out, t0, g, p) => {
    tone(ctx, out, { type: 'triangle', f0: 233 * p, t0, dur: 0.16, gain: 0.16 * g, attack: 0.01 });
    tone(ctx, out, { type: 'triangle', f0: 185 * p, t0: t0 + 0.15, dur: 0.26, gain: 0.16 * g, attack: 0.01 });
    return 0.45;
  },
  /** Zap: a quick electric discharge — falling buzz plus a crackle. */
  zap: (ctx, out, t0, g, p) => {
    tone(ctx, out, { type: 'sawtooth', f0: 1400 * p, f1: 90 * p, t0, dur: 0.22, gain: 0.07 * g, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.18, gain: 0.12 * g, filter: 'highpass', f0: 1800, f1: 600, attack: 0.002 });
    return 0.26;
  },
  /** Spark: tiny bright crackle with a pitched "sparkle" tail (electrons / energy). */
  spark: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 0.05, gain: 0.1 * g, filter: 'highpass', f0: 3500, attack: 0.001 });
    tone(ctx, out, { f0: 2637 * p, t0: t0 + 0.01, dur: 0.22, gain: 0.04 * g, attack: 0.003 });
    tone(ctx, out, { f0: 3520 * p, t0: t0 + 0.04, dur: 0.18, gain: 0.025 * g, attack: 0.003 });
    return 0.26;
  },
  /** Circuit breaker: heavy mechanical clack (thump + snap). */
  breaker: (ctx, out, t0, g, p) => {
    tone(ctx, out, { f0: 150 * p, f1: 55 * p, t0, dur: 0.14, gain: 0.3 * g, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, gain: 0.2 * g, f0: 1900, q: 1.4, attack: 0.001 });
    noise(ctx, out, { t0: t0 + 0.035, dur: 0.06, gain: 0.08 * g, f0: 900, q: 2, attack: 0.001 });
    return 0.18;
  },
  /** Relay: light double click. */
  relay: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 0.02, gain: 0.5 * g, f0: 2400 * p, q: 3, attack: 0.001 });
    noise(ctx, out, { t0: t0 + 0.03, dur: 0.026, gain: 0.32 * g, f0: 1700 * p, q: 3, attack: 0.001 });
    return 0.07;
  },
  /** Whoosh up: scale transition toward the bigger world (zoom out). */
  whooshUp: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 1.1, gain: 0.13 * g, f0: 240 * p, f1: 2600 * p, q: 1.1, attack: 0.45 });
    tone(ctx, out, { f0: 110 * p, f1: 330 * p, t0, dur: 1.0, gain: 0.05 * g, attack: 0.4 });
    return 1.2;
  },
  /** Whoosh down: scale transition toward the smaller world (zoom in). */
  whooshDown: (ctx, out, t0, g, p) => {
    noise(ctx, out, { t0, dur: 1.1, gain: 0.13 * g, f0: 2600 * p, f1: 220 * p, q: 1.1, attack: 0.3 });
    tone(ctx, out, { f0: 330 * p, f1: 98 * p, t0, dur: 1.0, gain: 0.05 * g, attack: 0.3 });
    return 1.2;
  },
} as const satisfies Record<string, Builder>;

export type OneShotName = keyof typeof ONE_SHOTS;

/** One-shots that briefly duck the ambient bed so they read clearly at low volume. */
export const DUCKING: ReadonlySet<OneShotName> = new Set(['zap', 'breaker', 'success', 'error', 'whooshUp', 'whooshDown']);
