/**
 * AudioEngine — master bus with limiter, three sub-buses (sfx, loops, ambient), unlock handling, ducking.
 * Until `unlock()` (first user gesture) and whenever audio is disabled (`?noaudio`), every call is a silent
 * no-op that only records intent (requested mood, loop parameters), so callers never need to check.
 */
import { LOOPS, type LoopName, type LoopVoice } from './loops';
import { buildMood, MOODS, type MoodName, type MoodVoice } from './moods';
import { DUCKING, ONE_SHOTS, type OneShotName, type OneShotOptions } from './oneshots';

/** Headroom of the master bus: the sum of ambient + loops + sfx stays well below full scale. */
const MASTER_LEVEL = 0.55;
/** Bus balance: the ambient bed sits well under the effects ("sound is seasoning"). */
export const SFX_LEVEL = 1.8;
export const LOOP_LEVEL = 0.7;
export const AMBIENT_LEVEL = 0.4;
const MOOD_FADE = 2.5; // s — cross-fade between ambient pads (STYLE_GUIDE §5 `MOTION.mood` ≈ 2 s)

export interface LoopParams {
  /** 0…1 loudness of the loop (0 = silent; the voice is released after a while). */
  gain?: number;
  /** Pitch multiplier (rpm, flow speed, 50 → 60 Hz…). */
  pitch?: number;
}

/** Handle of a parametric loop: `audio.loop('turbine').set({ gain: 0.6, pitch: 1.2 })`. */
export class LoopHandle {
  private gain = 0;
  private pitchValue = 1;
  private voice: { out: GainNode; voice: LoopVoice } | null = null;

  constructor(
    readonly name: LoopName,
    private readonly engine: AudioEngine,
  ) {}

  set(params: LoopParams): this {
    if (params.gain !== undefined) this.gain = Math.max(0, Math.min(1, params.gain));
    if (params.pitch !== undefined) this.pitchValue = Math.max(0.01, params.pitch);
    this.apply();
    return this;
  }

  /** Fade out and release the voice. */
  stop(fade = 0.4): void {
    this.gain = 0;
    const v = this.voice;
    const ctx = this.engine.context;
    if (!v || !ctx) return;
    this.voice = null;
    const t = ctx.currentTime;
    v.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const s of v.voice.sources) s.stop(t + fade * 1.5);
  }

  /** @internal Called by the engine after unlock and by `set`. */
  apply(): void {
    const ctx = this.engine.context;
    const bus = this.engine.loopBus;
    if (!ctx || !bus) return;
    if (!this.voice) {
      if (this.gain <= 0) return;
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(bus);
      this.voice = { out, voice: LOOPS[this.name](ctx, out, ctx.currentTime) };
    }
    const t = ctx.currentTime;
    this.voice.out.gain.setTargetAtTime(this.gain, t, 0.08);
    this.voice.voice.pitch(this.pitchValue, t);
  }
}

export class AudioEngine {
  /** The live context (null while locked or disabled). */
  context: AudioContext | null = null;
  loopBus: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private disabled = false;
  private volume = 0.8;
  private enabled = true;
  private moodName: MoodName | null = null;
  private moodVoice: MoodVoice | null = null;
  private readonly loops = new Map<LoopName, LoopHandle>();

  /** Permanently silence the engine (`?noaudio`). */
  disable(): void {
    this.disabled = true;
  }

  get unlocked(): boolean {
    return this.context !== null;
  }

  /** Create the context and the bus graph. Call from (or after) a user gesture. Safe to call twice. */
  unlock(): void {
    if (this.disabled || this.context) return;
    let ctx: AudioContext;
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      this.disabled = true; // no audio device / blocked: stay silent for the session
      return;
    }
    this.context = ctx;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.master = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(limiter).connect(this.analyser).connect(ctx.destination);
    const bus = (level: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master!);
      return g;
    };
    this.sfxBus = bus(SFX_LEVEL);
    this.loopBus = bus(LOOP_LEVEL);
    this.ambientBus = bus(AMBIENT_LEVEL);
    this.applyVolume(0);
    void ctx.resume();
    for (const loop of this.loops.values()) loop.apply();
    if (this.moodName) this.startMood(this.moodName);
  }

  /** Master volume 0…1 and the mute switch (persisted settings drive these). */
  setVolume(volume: number, enabled: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.enabled = enabled;
    this.applyVolume(0.05);
  }

  private applyVolume(tau: number): void {
    if (!this.context || !this.master) return;
    const v = this.enabled ? this.volume * this.volume * MASTER_LEVEL : 0; // squared: perceptually even slider
    if (tau > 0) this.master.gain.setTargetAtTime(v, this.context.currentTime, tau);
    else this.master.gain.value = v;
  }

  /** Play a one-shot. */
  play(name: OneShotName, opts: OneShotOptions = {}): void {
    const ctx = this.context;
    if (!ctx || !this.sfxBus || !this.enabled) return;
    const t = ctx.currentTime + 0.005;
    ONE_SHOTS[name](ctx, this.sfxBus, t, opts.gain ?? 1, opts.pitch ?? 1);
    if (DUCKING.has(name) && this.ambientBus) {
      // sidechain-style dip of the ambient bed
      this.ambientBus.gain.setTargetAtTime(AMBIENT_LEVEL * 0.5, t, 0.03);
      this.ambientBus.gain.setTargetAtTime(AMBIENT_LEVEL, t + 0.35, 0.3);
    }
  }

  /** The loop with this name (one shared voice per name). */
  loop(name: LoopName): LoopHandle {
    let handle = this.loops.get(name);
    if (!handle) this.loops.set(name, (handle = new LoopHandle(name, this)));
    return handle;
  }

  /** Fade out every loop (chapter change). */
  stopLoops(fade = 0.6): void {
    for (const loop of this.loops.values()) loop.stop(fade);
  }

  /** Cross-fade to an ambient mood (`null` = silence). */
  mood(name: MoodName | null): void {
    if (name === this.moodName) return;
    this.moodName = name;
    if (this.context) this.startMood(name);
  }

  get currentMood(): MoodName | null {
    return this.moodName;
  }

  private startMood(name: MoodName | null): void {
    const ctx = this.context;
    if (!ctx || !this.ambientBus) return;
    const t = ctx.currentTime;
    const old = this.moodVoice;
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, MOOD_FADE / 3);
      for (const s of old.sources) s.stop(t + MOOD_FADE * 2);
    }
    this.moodVoice = null;
    if (!name) return;
    this.moodVoice = buildMood(ctx, this.ambientBus, MOODS[name], t);
    this.moodVoice.gain.gain.setTargetAtTime(1, t, MOOD_FADE / 3);
  }

  /** Pause / resume output with the page (tab hidden). */
  setSuspended(suspended: boolean): void {
    if (!this.context) return;
    if (suspended) void this.context.suspend();
    else void this.context.resume();
  }
}
