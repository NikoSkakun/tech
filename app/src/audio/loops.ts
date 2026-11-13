/**
 * Parametric loops: continuous sounds whose loudness and pitch follow the simulation (`set({ gain, pitch })`).
 * A builder wires its sources into `out` and returns how to change pitch and what to stop.
 */
import { lfo, noiseBuffer, noiseLoop } from './synth';

export interface LoopVoice {
  /** Apply a pitch multiplier (1 = as designed) smoothly from time `at`. */
  pitch(p: number, at: number): void;
  /** Everything that must be stopped when the loop ends. */
  sources: AudioScheduledSourceNode[];
}

type Builder = (ctx: BaseAudioContext, out: AudioNode, t0: number) => LoopVoice;

const GLIDE = 0.12; // s — time constant of pitch changes (no zipper noise, no lag you can hear)

function osc(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, gain: number, t0: number): OscillatorNode {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.value = gain;
  o.connect(g).connect(out);
  o.start(t0);
  return o;
}

export const LOOPS = {
  /** Mains hum: 50 Hz with its 2nd, 3rd and 5th harmonics, very subtle; pitch 1.2 = 60 Hz. */
  hum: (ctx, out, t0) => {
    const parts = [
      [50, 0.5], [100, 0.32], [150, 0.12], [250, 0.05],
    ].map(([f, g]) => ({ f: f!, o: osc(ctx, out, 'sine', f!, g! * 0.22, t0) }));
    return {
      pitch: (p, at) => parts.forEach((x) => x.o.frequency.setTargetAtTime(x.f * p, at, GLIDE)),
      sources: parts.map((x) => x.o),
    };
  },
  /** Turbine / rotor whirr: a breathy band of noise plus a soft tone; pitch follows rpm. */
  turbine: (ctx, out, t0) => {
    const n = noiseLoop(ctx, 'bandpass', 520, 2.2);
    const ng = ctx.createGain();
    ng.gain.value = 0.3;
    n.filter.connect(ng).connect(out);
    n.source.start(t0);
    const a = osc(ctx, out, 'triangle', 130, 0.07, t0);
    const b = osc(ctx, out, 'sine', 261, 0.035, t0);
    const wob = lfo(ctx, ng.gain, 5.5, 0.05, t0);
    return {
      pitch: (p, at) => {
        n.filter.frequency.setTargetAtTime(520 * p, at, GLIDE);
        a.frequency.setTargetAtTime(130 * p, at, GLIDE);
        b.frequency.setTargetAtTime(261 * p, at, GLIDE);
        wob.frequency.setTargetAtTime(5.5 * p, at, GLIDE);
      },
      sources: [n.source, a, b, wob],
    };
  },
  /** Water flow: low rushing noise that swells slowly; pitch = how lively the stream is. */
  water: (ctx, out, t0) => {
    const n = noiseLoop(ctx, 'lowpass', 900, 0.4);
    const g = ctx.createGain();
    g.gain.value = 0.34;
    n.filter.connect(g).connect(out);
    n.source.start(t0);
    const swell = lfo(ctx, g.gain, 0.23, 0.09, t0);
    const drift = lfo(ctx, n.filter.frequency, 0.31, 260, t0);
    return {
      pitch: (p, at) => n.filter.frequency.setTargetAtTime(900 * p, at, GLIDE),
      sources: [n.source, swell, drift],
    };
  },
  /** Steam hiss: airy high-passed noise. */
  steam: (ctx, out, t0) => {
    const n = noiseLoop(ctx, 'highpass', 3200, 0.5);
    const g = ctx.createGain();
    g.gain.value = 0.16;
    n.filter.connect(g).connect(out);
    n.source.start(t0);
    const flutter = lfo(ctx, g.gain, 7, 0.025, t0);
    return {
      pitch: (p, at) => n.filter.frequency.setTargetAtTime(3200 * p, at, GLIDE),
      sources: [n.source, flutter],
    };
  },
  /** Wind: a wandering band of noise (gusts come from two slow LFOs beating). */
  wind: (ctx, out, t0) => {
    const n = noiseLoop(ctx, 'bandpass', 420, 0.9);
    const g = ctx.createGain();
    g.gain.value = 0.3;
    n.filter.connect(g).connect(out);
    n.source.start(t0);
    const a = lfo(ctx, n.filter.frequency, 0.13, 170, t0);
    const b = lfo(ctx, g.gain, 0.19, 0.12, t0);
    return {
      pitch: (p, at) => n.filter.frequency.setTargetAtTime(420 * p, at, GLIDE),
      sources: [n.source, a, b],
    };
  },
  /** Fire: a warm low roar with crackle (noise gated by slower noise). */
  fire: (ctx, out, t0) => {
    const roar = noiseLoop(ctx, 'lowpass', 380, 0.3);
    const rg = ctx.createGain();
    rg.gain.value = 0.34;
    roar.filter.connect(rg).connect(out);
    roar.source.start(t0);
    // crackle: bright noise whose gain is driven by a second, very slow noise read (audio-rate modulation)
    const crack = noiseLoop(ctx, 'highpass', 2600, 0.6);
    const cg = ctx.createGain();
    cg.gain.value = 0;
    const gate = ctx.createBufferSource();
    gate.buffer = noiseBuffer(ctx);
    gate.loop = true;
    gate.playbackRate.value = 0.004; // ≈ 170 control values per second: sparse random pops
    const depth = ctx.createGain();
    depth.gain.value = 0.16;
    gate.connect(depth).connect(cg.gain);
    crack.filter.connect(cg).connect(out);
    crack.source.start(t0);
    gate.start(t0);
    return {
      pitch: (p, at) => roar.filter.frequency.setTargetAtTime(380 * p, at, GLIDE),
      sources: [roar.source, crack.source, gate],
    };
  },
  /** Geiger-like ticks: random soft clicks; pitch = count rate. */
  geiger: (ctx, out, t0) => {
    // four seconds of pre-rendered sparse clicks, looped; playbackRate is the count rate
    const length = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let s = 0x51f15e;
    const rnd = (): number => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
    for (let k = 0; k < 22; k++) {
      const at = Math.floor(rnd() * (length - 400));
      const amp = 0.4 + rnd() * 0.5;
      for (let i = 0; i < 260; i++) data[at + i]! += amp * Math.sin(i * 0.55) * Math.exp(-i / 38);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g).connect(out);
    src.start(t0);
    return { pitch: (p, at) => src.playbackRate.setTargetAtTime(Math.max(p, 0.05), at, GLIDE), sources: [src] };
  },
  /** Electric buzz: 100 Hz rasp (transformer under load, arc, neon). */
  buzz: (ctx, out, t0) => {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    filter.connect(g).connect(out);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 100;
    saw.connect(filter);
    saw.start(t0);
    const rasp = lfo(ctx, g.gain, 50, 0.07, t0);
    return {
      pitch: (p, at) => {
        saw.frequency.setTargetAtTime(100 * p, at, GLIDE);
        rasp.frequency.setTargetAtTime(50 * p, at, GLIDE);
      },
      sources: [saw, rasp],
    };
  },
} as const satisfies Record<string, Builder>;

export type LoopName = keyof typeof LOOPS;
