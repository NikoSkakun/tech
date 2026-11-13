/**
 * Synthesis building blocks (no sample files): enveloped oscillators, filtered noise, shared noise buffers.
 * Everything takes a `BaseAudioContext`, so the same graphs render live and in an `OfflineAudioContext`
 * (QA proves "non-silent, non-clipping" offline).
 */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, generated once per context from a fixed seed (reproducible renders). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const hit = noiseCache.get(ctx);
  if (hit) return hit;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let s = 0x2f6e2b1;
  for (let i = 0; i < data.length; i++) {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    data[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

export interface ToneSpec {
  type?: OscillatorType;
  /** Start / end frequency, Hz (exponential glide). */
  f0: number;
  f1?: number;
  /** Start time (context seconds) and duration. */
  t0: number;
  dur: number;
  /** Peak gain. */
  gain: number;
  /** Attack time, s. Default 0.004. */
  attack?: number;
  /** Detune in cents. */
  detune?: number;
}

/** One enveloped oscillator: fast attack, exponential decay to silence at `t0 + dur`. */
export function tone(ctx: BaseAudioContext, out: AudioNode, s: ToneSpec): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = s.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(s.f0, 1), s.t0);
  if (s.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(s.f1, 1), s.t0 + s.dur);
  if (s.detune) osc.detune.value = s.detune;
  const attack = s.attack ?? 0.004;
  amp.gain.setValueAtTime(0.0001, s.t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(s.gain, 0.0002), s.t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, s.t0 + s.dur);
  osc.connect(amp).connect(out);
  osc.start(s.t0);
  osc.stop(s.t0 + s.dur + 0.02);
}

export interface NoiseSpec {
  t0: number;
  dur: number;
  gain: number;
  attack?: number;
  filter?: BiquadFilterType;
  /** Filter frequency start / end, Hz. */
  f0?: number;
  f1?: number;
  q?: number;
}

/** A burst of filtered noise with the same envelope shape as `tone`. */
export function noise(ctx: BaseAudioContext, out: AudioNode, s: NoiseSpec): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = s.filter ?? 'bandpass';
  filter.frequency.setValueAtTime(s.f0 ?? 1000, s.t0);
  if (s.f1 !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(s.f1, 10), s.t0 + s.dur);
  filter.Q.value = s.q ?? 1;
  const amp = ctx.createGain();
  const attack = s.attack ?? 0.004;
  amp.gain.setValueAtTime(0.0001, s.t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(s.gain, 0.0002), s.t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, s.t0 + s.dur);
  src.connect(filter).connect(amp).connect(out);
  // a different slice of the buffer for every burst, derived from the start time (no Math.random)
  src.start(s.t0, (s.t0 * 7.31) % 1.5);
  src.stop(s.t0 + s.dur + 0.02);
}

/** Continuous looping noise source through a filter; returns the nodes so callers can modulate them. */
export function noiseLoop(
  ctx: BaseAudioContext,
  type: BiquadFilterType,
  frequency: number,
  q = 0.7,
): { source: AudioBufferSourceNode; filter: BiquadFilterNode } {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  source.connect(filter);
  return { source, filter };
}

/** Slow sine LFO connected to an AudioParam (adds ±depth around the param's own value). */
export function lfo(ctx: BaseAudioContext, target: AudioParam, rate: number, depth: number, t0 = 0): OscillatorNode {
  const osc = ctx.createOscillator();
  const amount = ctx.createGain();
  osc.frequency.value = rate;
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  osc.start(t0);
  return osc;
}
