/**
 * Engine — owns the renderer, the main loop and every engine service, and wires them together.
 * One instance per page (`main.ts` creates it); plugins (`@/hud`, `@/audio`, …) receive it in `mount()`.
 */
import { WebGLRenderer } from 'three';
import { kGlobals } from '@/style/materials/globals';
import { textViewport } from '@/text/text3d';
import type { Viewport } from './chapter';
import { Clock, FIXED_DT } from './clock';
import { Emitter, type Unsubscribe } from './events';
import { HudLayer } from './hud';
import { InputSystem } from './input';
import { Nav } from './nav';
import { RenderPipeline } from './pipeline/pipeline';
import { benchmarkGpu, isQualityTier, Quality, tierFromBenchmark, type QualityTier } from './quality';
import type { Library } from './library';
import { Router } from './router';
import { ChapterRuntime } from './runtime';
import { isReadingLevel, Store, type ReadingLevel, type StorageLike } from './store';
import { Tweens } from './tween';

export interface UrlFlags {
  /** `?q=low|medium|high|ultra` — session quality override. */
  quality: QualityTier | null;
  /** `?noaudio` — audio plugins must stay silent. */
  noaudio: boolean;
  /** `?debug` — dev chapters visible, debug overlay loaded. */
  debug: boolean;
  /** `?overlay=0` — with `?debug`: keep dev chapters but do not show the HTML overlay (QA screenshots). */
  overlay: boolean;
  /** `?freeze=<seconds>` — deterministic clock: after every navigation simulate exactly N seconds, then hold. */
  freeze: number | null;
  /** `?level=simple|detailed` — session override of the reading level (QA, links for a reader). */
  level: ReadingLevel | null;
}

export function parseFlags(search: string): UrlFlags {
  const q = new URLSearchParams(search);
  const tier = q.get('q');
  const freeze = q.get('freeze');
  const level = q.get('level');
  const freezeValue = freeze === null ? null : Number(freeze === '' ? 0 : freeze);
  return {
    quality: isQualityTier(tier) ? tier : null,
    noaudio: q.has('noaudio'),
    debug: q.has('debug'),
    overlay: q.get('overlay') !== '0',
    freeze:
      freezeValue !== null && Number.isFinite(freezeValue) && freezeValue >= 0
        ? Math.min(freezeValue, 120)
        : null,
    level: isReadingLevel(level) ? level : null,
  };
}

/** A unit that extends the engine without the engine importing it by name (HUD, audio, …). */
export interface EnginePlugin {
  readonly name: string;
  /** Called once after the engine is created, before the first chapter loads. May return a cleanup function. */
  mount(engine: Engine): void | (() => void);
}

export interface FrameStats {
  /** Average / 95th percentile / max CPU time of update + render submission per frame, ms (last ≤ 240 frames). */
  cpuAvg: number;
  cpuP95: number;
  cpuMax: number;
  /** Average interval between frames, ms (≈ 16.7 at 60 Hz when not throttled). */
  intervalAvg: number;
  intervalMax: number;
  fps: number;
  /** Draw calls and triangles of the last frame, all passes included. */
  drawCalls: number;
  triangles: number;
  /** Live GPU resource counts (leak checks compare these). */
  geometries: number;
  textures: number;
  programs: number;
  tweens: number;
  /** Internal render resolution. */
  width: number;
  height: number;
  dpr: number;
  quality: QualityTier;
  time: number;
  frame: number;
}

export interface MeasureResult {
  frames: number;
  /**
   * GPU time per frame from `EXT_disjoint_timer_query_webgl2` (all passes of the frame), ms.
   * Null when the extension is unavailable.
   */
  gpuAvg: number | null;
  gpuP95: number | null;
  gpuMax: number | null;
  /** CPU time per frame (update + draw-call submission), ms. */
  cpuAvg: number;
  cpuP95: number;
  /**
   * The number to hold against the frame budget: `cpuAvg + gpuAvg` (an upper bound — in a real browser the
   * two overlap). Falls back to `syncAvg` without timer queries.
   */
  frameAvg: number;
  /**
   * Wall time per frame with a blocking 1×1 `readPixels` after rendering, ms. Includes a fixed
   * synchronisation overhead of several ms in Chrome's multi-process GPU architecture; kept as a
   * conservative cross-check.
   */
  syncAvg: number;
  syncP95: number;
  syncMax: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

function safeStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.getItem('electricity:probe');
    return s;
  } catch {
    return null;
  }
}

export class Engine {
  readonly renderer: WebGLRenderer;
  readonly clock = new Clock();
  readonly tweens = new Tweens();
  readonly store: Store;
  readonly quality = new Quality();
  readonly pipeline: RenderPipeline;
  readonly hud = new HudLayer();
  readonly input: InputSystem;
  /** The volumes of this session and their chapter registries. */
  readonly library: Library;
  readonly router: Router;
  readonly nav: Nav;
  readonly runtime: ChapterRuntime;
  /** Dynamic-resolution scale currently applied (1 = full). */
  resolutionScale = 1;

  private readonly events = new Emitter<{
    update: number;
    resize: Viewport;
    contextLost: void;
    contextRestored: void;
  }>();
  private currentViewport: Viewport = { width: 1, height: 1, aspect: 1, dpr: 1 };
  private rafId = 0;
  private running = false;
  private contextLost = false;
  private frameWaiters: (() => void)[] = [];
  private readonly cpuTimes: number[] = [];
  private readonly intervals: number[] = [];
  private lastFrameAt = 0;
  private lastInfo = { calls: 0, triangles: 0 };
  /** Seconds still to simulate in freeze mode before the picture holds. */
  private freezePending = 0;
  private measuring: {
    left: number;
    sync: number[];
    cpu: number[];
    gpu: number[];
    pending: WebGLQuery[];
    timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
    drain: number;
    resolve: (r: MeasureResult) => void;
  } | null = null;
  private slowFrames = 0;
  private fastFrames = 0;
  private readonly reducedMotionQuery: MediaQueryList | null;
  private readonly syncPixel = new Uint8Array(4);

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly flags: UrlFlags,
    library: Library,
  ) {
    this.store = new Store(safeStorage(), library.defaultVolume.id);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false, // the pipeline renders into its own MSAA targets
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV || flags.debug;
    this.reducedMotionQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    // quality: URL flag > user setting > first-run benchmark
    const settings = this.store.get().settings;
    let benchTier = settings.benchmarkTier;
    if (flags.quality === null && settings.quality === 'auto' && benchTier === null) {
      benchTier = tierFromBenchmark(benchmarkGpu(this.renderer));
      this.store.updateSettings({ benchmarkTier: benchTier });
    }
    const tier = flags.quality ?? (settings.quality === 'auto' ? (benchTier ?? 'high') : settings.quality);
    this.quality.set(tier);
    this.store.set({ quality: tier });
    this.pipeline = new RenderPipeline(this.renderer, this.quality.profile);

    this.library = library;
    this.router = new Router(window, (id) => library.has(id));
    this.input = new InputSystem(canvas, {
      hudCamera: this.hud.camera,
      director: () => this.runtime.director,
    });
    this.runtime = new ChapterRuntime({
      renderer: this.renderer,
      pipeline: this.pipeline,
      clock: this.clock,
      tweens: this.tweens,
      store: this.store,
      library: this.library,
      quality: this.quality,
      hud: this.hud,
      input: this.input,
      nav: () => this.nav,
      viewport: () => this.currentViewport,
      reducedMotion: () => this.reducedMotion,
      nextFrame: () => this.nextFrame(),
      deterministic: () => this.flags.freeze !== null,
    });
    this.nav = new Nav(this.library, this.router, this.store, this.runtime);

    this.quality.onChange((profile) => {
      this.pipeline.setProfile(profile);
      this.store.set({ quality: profile.tier });
      this.resize();
    });
    this.store.subscribe(
      (s) => s.settings.textScale,
      (scale) => this.hud.setTextScale(scale),
      { immediate: true },
    );
    this.store.subscribe(
      (s) => s.settings.quality,
      (q) => {
        if (this.flags.quality !== null) return;
        this.quality.set(q === 'auto' ? (this.store.get().settings.benchmarkTier ?? 'high') : q);
      },
    );
    this.runtime.on('step', () => {
      if (this.flags.freeze !== null) this.freezePending = this.flags.freeze;
    });
    this.input.on('action', (action) => {
      const pos = this.nav.position;
      if (action === 'next') void this.nav.next();
      else if (action === 'prev') void this.nav.prev();
      else if (action === 'fullscreen') this.toggleFullscreen();
      else if (pos && (action === 'first' || action === 'last')) {
        const steps = this.library.registry(pos.volumeId)?.get(pos.chapterId)?.steps;
        const step = steps ? (action === 'first' ? steps[0] : steps[steps.length - 1]) : undefined;
        if (step) void this.nav.goto(`${pos.volumeId}/${pos.chapterId}`, step.id);
      }
    });

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // allows the browser to restore the context
      this.contextLost = true;
      this.events.emit('contextLost', undefined);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      // three.js re-initialises its state; GPU resources are re-created lazily from their CPU copies
      this.contextLost = false;
      this.clock.resetReal();
      this.resize();
      this.events.emit('contextRestored', undefined);
    });
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopLoop();
      else if (this.running) this.startLoop();
    });
    if (flags.freeze !== null) this.clock.paused = true;
    this.resize();
  }

  /** Current viewport (CSS px) and effective pixel ratio. */
  get viewport(): Viewport {
    return this.currentViewport;
  }

  /** Effective reduced-motion preference (setting, or the OS media query when the setting is `auto`). */
  get reducedMotion(): boolean {
    const s = this.store.get().settings.reducedMotion;
    return s === 'auto' ? (this.reducedMotionQuery?.matches ?? false) : s;
  }

  /** Subscribe to the per-frame update (engine-clock `dt` in seconds) — for plugins; chapters use `update()`. */
  onUpdate(fn: (dt: number) => void): Unsubscribe {
    return this.events.on('update', fn);
  }

  onResize(fn: (viewport: Viewport) => void): Unsubscribe {
    return this.events.on('resize', fn);
  }

  onContextLost(fn: () => void): Unsubscribe {
    return this.events.on('contextLost', fn);
  }

  onContextRestored(fn: () => void): Unsubscribe {
    return this.events.on('contextRestored', fn);
  }

  /** Resolves right after the next rendered frame. */
  nextFrame(): Promise<void> {
    return new Promise((resolve) => this.frameWaiters.push(resolve));
  }

  /** Start the render loop (pauses automatically while the tab is hidden). */
  start(): void {
    this.running = true;
    if (!document.hidden) this.startLoop();
  }

  stop(): void {
    this.running = false;
    this.stopLoop();
  }

  /**
   * Change quality: a tier, or `auto` for the benchmark result. Persisted. An explicit call also ends the
   * session pin of a `?q=` URL flag.
   */
  setQuality(tier: QualityTier | 'auto'): void {
    this.flags.quality = null;
    const previous = this.store.get().settings.quality;
    this.store.updateSettings({ quality: tier });
    // same setting as before (e.g. the flag pinned another tier): apply it anyway
    if (previous === tier)
      this.quality.set(tier === 'auto' ? (this.store.get().settings.benchmarkTier ?? 'high') : tier);
  }

  /** Reading level in effect: the `?level=` flag of this session, else the setting. */
  readingLevel(): ReadingLevel {
    return this.flags.level ?? this.store.get().settings.readingLevel;
  }

  /**
   * Change the reading level. Persisted; ends the session pin of a `?level=` flag. Subscribers of the store see
   * the change even when the setting already had this value (the flag pinned the other one).
   */
  setReadingLevel(level: ReadingLevel): void {
    this.flags.level = null;
    this.store.updateSettings({ readingLevel: level });
  }

  /**
   * Deterministically advance engine time by `seconds` in fixed 1/60 s steps without rendering
   * (debug/QA: `setTime`, `step`, `?freeze`).
   */
  advance(seconds: number): void {
    const steps = Math.round(seconds / FIXED_DT);
    for (let i = 0; i < steps; i++) {
      this.clock.advance(FIXED_DT);
      this.update(FIXED_DT);
    }
  }

  /** True when navigation has settled and (in freeze mode) the hold time has been simulated. */
  get idle(): boolean {
    return !this.runtime.busy && this.freezePending <= 0;
  }

  /** Resolves once `idle` and one more frame has been presented. */
  async settled(): Promise<void> {
    for (let guard = 0; guard < 100000; guard++) {
      await this.runtime.settled();
      await this.nextFrame();
      if (this.idle) {
        await this.nextFrame();
        if (this.idle) return;
      }
    }
  }

  stats(): FrameStats {
    const cpu = [...this.cpuTimes].sort((a, b) => a - b);
    const intervalAvg = this.intervals.length
      ? this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length
      : 0;
    const info = this.renderer.info;
    return {
      cpuAvg: cpu.length ? cpu.reduce((a, b) => a + b, 0) / cpu.length : 0,
      cpuP95: percentile(cpu, 0.95),
      cpuMax: cpu.length ? cpu[cpu.length - 1]! : 0,
      intervalAvg,
      intervalMax: this.intervals.length ? Math.max(...this.intervals) : 0,
      fps: intervalAvg > 0 ? 1000 / intervalAvg : 0,
      drawCalls: this.lastInfo.calls,
      triangles: this.lastInfo.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      tweens: this.tweens.liveCount,
      width: this.pipeline.width,
      height: this.pipeline.height,
      dpr: this.currentViewport.dpr,
      quality: this.quality.tier,
      time: this.clock.time,
      frame: this.clock.frame,
    };
  }

  /** Clear the rolling frame-time windows (call before a measurement interval). */
  resetStats(): void {
    this.cpuTimes.length = 0;
    this.intervals.length = 0;
  }

  /**
   * Measure true frame cost over the next `frames` frames: GPU time through timer queries, CPU time, and a
   * blocking-readPixels wall time as a cross-check. `frameAvg` is what the ≤ 8 ms budget of ARCHITECTURE §1
   * is held against.
   */
  measure(frames = 240): Promise<MeasureResult> {
    return new Promise((resolve) => {
      const timer = this.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2') as {
        TIME_ELAPSED_EXT: number;
        GPU_DISJOINT_EXT: number;
      } | null;
      this.measuring = { left: frames, sync: [], cpu: [], gpu: [], pending: [], timer, drain: 30, resolve };
    });
  }

  toggleFullscreen(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  }

  /* ---------------------------------------------------------------------------------------------- */

  private startLoop(): void {
    if (this.rafId !== 0) return;
    this.clock.resetReal();
    this.lastFrameAt = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private stopLoop(): void {
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private readonly frame = (now: number): void => {
    this.rafId = requestAnimationFrame(this.frame);
    if (this.contextLost) return;
    const t0 = performance.now();
    const m = this.measuring;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    let query: WebGLQuery | null = null;
    if (m?.timer && m.left > 0) {
      query = gl.createQuery();
      if (query) gl.beginQuery(m.timer.TIME_ELAPSED_EXT, query);
    }
    if (this.lastFrameAt > 0) this.pushSample(this.intervals, now - this.lastFrameAt);
    this.lastFrameAt = now;

    if (this.flags.freeze !== null) {
      // deterministic mode: time moves only through explicit fixed steps
      if (!this.runtime.busy && this.freezePending > 0) {
        const seconds = this.freezePending;
        this.freezePending = 0;
        this.advance(seconds);
      }
      this.clock.advance(0);
      this.update(0);
    } else {
      this.update(this.clock.tickReal(now));
    }
    const suspended = this.runtime.worldSuspended && !this.runtime.busy;
    this.pipeline.render(suspended ? null : this.runtime.worldView(), this.hud, this.clock.time);
    const info = this.renderer.info.render;
    this.lastInfo.calls = info.calls;
    this.lastInfo.triangles = info.triangles;

    const cpu = performance.now() - t0;
    this.pushSample(this.cpuTimes, cpu);
    if (m) {
      if (query && m.timer) {
        gl.endQuery(m.timer.TIME_ELAPSED_EXT);
        m.pending.push(query);
      }
      if (m.left > 0) {
        // Hard sync point: a 1×1 readPixels from the back buffer blocks until the GPU has finished the frame
        // (gl.finish() returns immediately in Chrome's command-buffer architecture).
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.syncPixel);
        this.renderer.resetState();
        m.sync.push(performance.now() - t0);
        m.cpu.push(cpu);
        m.left--;
      } else {
        m.drain--;
      }
      // collect finished timer queries (results arrive a few frames late)
      if (m.timer) {
        const disjoint = gl.getParameter(m.timer.GPU_DISJOINT_EXT) as boolean;
        m.pending = m.pending.filter((q) => {
          if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
          if (!disjoint) m.gpu.push((gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6);
          gl.deleteQuery(q);
          return false;
        });
      }
      if (m.left <= 0 && (m.pending.length === 0 || m.drain <= 0)) {
        this.measuring = null;
        for (const q of m.pending) gl.deleteQuery(q);
        const sort = (list: number[]): number[] => [...list].sort((a, b) => a - b);
        const mean = (list: number[]): number =>
          list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
        const sync = sort(m.sync);
        const cpuSorted = sort(m.cpu);
        const gpu = sort(m.gpu);
        const hasGpu = gpu.length > 0;
        m.resolve({
          frames: sync.length,
          gpuAvg: hasGpu ? mean(gpu) : null,
          gpuP95: hasGpu ? percentile(gpu, 0.95) : null,
          gpuMax: hasGpu ? gpu[gpu.length - 1]! : null,
          cpuAvg: mean(cpuSorted),
          cpuP95: percentile(cpuSorted, 0.95),
          frameAvg: hasGpu ? mean(cpuSorted) + mean(gpu) : mean(sync),
          syncAvg: mean(sync),
          syncP95: percentile(sync, 0.95),
          syncMax: sync.length ? sync[sync.length - 1]! : 0,
        });
      }
    } else {
      this.adaptResolution(now);
    }
    if (this.frameWaiters.length > 0) {
      const waiters = this.frameWaiters;
      this.frameWaiters = [];
      for (const w of waiters) w();
    }
  };

  private update(dt: number): void {
    // K-material time follows the clock also during fixed steps without rendering (`advance`: ?freeze,
    // __app.step), so effects that read `uKTime` (or fx one-shots) see the time of the step being simulated
    kGlobals.uKTime.value = this.clock.time;
    this.tweens.update(dt);
    this.events.emit('update', dt);
    this.runtime.update(dt, this.clock.time);
    this.input.update();
  }

  private pushSample(list: number[], value: number): void {
    list.push(value);
    if (list.length > 240) list.shift();
  }

  /** Dynamic resolution: drop the render scale when frames keep missing vsync, creep back up when stable. */
  private adaptResolution(now: number): void {
    if (!this.store.get().settings.dynamicResolution || this.flags.freeze !== null || this.runtime.busy)
      return;
    const interval = this.intervals[this.intervals.length - 1];
    if (interval === undefined || now < 4000) return;
    if (interval > 22) {
      this.fastFrames = 0;
      if (++this.slowFrames > 45 && this.resolutionScale > 0.6) {
        this.resolutionScale = Math.max(0.6, this.resolutionScale - 0.1);
        this.slowFrames = 0;
        this.resize();
      }
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (++this.fastFrames > 900 && this.resolutionScale < 1) {
        this.resolutionScale = Math.min(1, this.resolutionScale + 0.05);
        this.fastFrames = 0;
        this.resize();
      }
    }
  }

  private resize(): void {
    const width = Math.max(this.canvas.clientWidth, 1);
    const height = Math.max(this.canvas.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.profile.maxDpr) * this.resolutionScale;
    this.currentViewport = { width, height, aspect: width / height, dpr };
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.pipeline.setSize(Math.floor(width * dpr), Math.floor(height * dpr));
    this.hud.setViewport(width, height);
    textViewport.cssHeight = height;
    textViewport.pxPerUnit = this.hud.metrics.pxPerUnit;
    this.runtime.resize(this.currentViewport);
    this.events.emit('resize', this.currentViewport);
  }
}
