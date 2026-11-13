/**
 * Debug / QA API on `window.__app` (ARCHITECTURE §4). Always present, inert unless called.
 * The QA tools in `tools/qa/` drive the app exclusively through this object.
 */
import type { Engine, FrameStats, MeasureResult } from '../app';
import type { QualityTier } from '../quality';
import type { LocatedProbe } from '../qa-probes';
import { fontData } from '@/text/fonts';
import { measureTexts, type TextSize } from './text-sizes';

export interface CapturedMessage {
  level: 'error' | 'warn';
  message: string;
  /** Engine time when it was captured. */
  time: number;
}

export interface ChapterListing {
  /** Volume the chapter belongs to; `fullId` is `<volume>/<id>`. */
  volume: string;
  fullId: string;
  id: string;
  order: number;
  group: string;
  parent: string | null;
  title: string;
  dev: boolean;
  steps: { id: string; title: string }[];
}

export interface DebugApi {
  /** Resolves when the first chapter is on screen. Rejects if boot fails. */
  ready: Promise<void>;
  /** Navigate and wait until the target is settled (in freeze mode: until the hold time was simulated). */
  /**
   * `goto('atom', 'quarks')` — short chapter id: current volume, else the default volume, else any other;
   * `goto('electricity/atom', 'quarks')` — full chapter id; or one step address:
   * `goto('electricity/atom/quarks')`, `goto('atom/quarks')`.
   */
  goto(chapter: string, stepId?: string, opts?: { instant?: boolean }): Promise<boolean>;
  next(): Promise<boolean>;
  prev(): Promise<boolean>;
  /** Resolves when navigation is settled and a frame was presented. */
  settled(): Promise<void>;
  /** Stop real-time clock advancement. */
  pause(): void;
  resume(): void;
  /** Advance the paused clock by `frames` fixed steps of `dt` seconds (default 1/60). */
  step(dt?: number, frames?: number): Promise<void>;
  /** Fast-forward the clock to engine time `seconds` in fixed steps (never backwards), then pause. */
  setTime(seconds: number): Promise<void>;
  stats(): FrameStats;
  resetStats(): void;
  /** GPU-inclusive frame timing over `frames` frames. */
  measure(frames?: number): Promise<MeasureResult>;
  /** Registered volumes (dev volumes only with `?debug`). */
  listVolumes(): { id: string; title: string; status: string; listed: boolean; loaded: boolean }[];
  /** Chapters of the loaded volumes in library / journey order (with `?debug` every volume is loaded at boot). */
  listChapters(volumeId?: string): ChapterListing[];
  position(): { volumeId: string | null; chapterId: string | null; stepId: string | null };
  setQuality(tier: QualityTier | 'auto'): void;
  /** Console errors/warnings, uncaught errors and unhandled rejections captured since boot. */
  errors(): CapturedMessage[];
  clearErrors(): void;
  /** WebGL facts for QA assertions (unmasked renderer string, limits). */
  gpu(): { renderer: string; vendor: string; webgl2: boolean; maxTextureSize: number };
  /** Lose and (after `restoreAfterMs`) restore the WebGL context — exercises the recovery path. */
  simulateContextLoss(restoreAfterMs?: number): boolean;
  /** Project a world position of the active chapter to CSS pixels (for scripted pointer interactions). */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } | null;
  /**
   * Screen position (CSS px) of a probe the chapter registered with `ctx.qa.probe(name, target)` (M3), or null
   * when the chapter has no such probe. `visible`: inside the viewport and in front of the camera; `shown`:
   * the object and its ancestors are `visible`.
   */
  locate(name: string): LocatedProbe | null;
  /** Names of the probes (`locate`) and readers (`read`) registered by the chapter on screen. */
  probes(): string[];
  /** Observable state the chapter exposed with `ctx.qa.expose(name, fn)` (undefined when unknown). */
  read(name: string): unknown;
  /**
   * On-screen size (1 em, CSS px and px-equivalent) of every visible world `Text3D` of the chapter, measured
   * with the matrices of the last rendered frame (M3; `chapter-check` fails below 16 px-eq at 1280×720).
   * ui3d surfaces are not included (they batch their own glyphs).
   */
  textSizes(): TextSize[];
  /** The engine itself, for ad-hoc debugging in the console. */
  engine: Engine | null;
}

declare global {
  interface Window {
    __app: DebugApi;
  }
}

const captured: CapturedMessage[] = [];
let engineRef: Engine | null = null;

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 2000);
}

/**
 * Start capturing console errors/warnings and uncaught errors. Call first thing at boot so nothing is missed.
 */
export function installErrorCapture(): void {
  const push = (level: 'error' | 'warn', args: unknown[]): void => {
    captured.push({ level, message: format(args), time: engineRef?.clock.time ?? 0 });
    if (captured.length > 500) captured.shift();
  };
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    push('error', args);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push('warn', args);
    origWarn(...args);
  };
  window.addEventListener('error', (e) =>
    push('error', [`Uncaught ${e.message} (${e.filename}:${e.lineno})`]),
  );
  window.addEventListener('unhandledrejection', (e) => push('error', ['Unhandled rejection:', e.reason]));
}

/** Install `window.__app`. `ready` is the boot promise; the engine is attached once it exists. */
export function installDebugApi(ready: Promise<Engine>): void {
  const need = (): Engine => {
    if (!engineRef) throw new Error('__app: engine is not ready yet (await __app.ready)');
    return engineRef;
  };
  const api: DebugApi = {
    ready: ready.then(async (engine) => {
      engineRef = engine;
      api.engine = engine;
      await engine.settled();
    }),
    engine: null,
    async goto(chapter, stepId, opts) {
      const nav = need().nav;
      // one argument with a slash is a step address: `volume/chapter/step`, `chapter/step`, `volume/chapter`
      const ok =
        stepId === undefined && chapter.includes('/')
          ? await nav.open(chapter, opts)
          : await nav.goto(chapter, stepId, opts);
      await need().settled();
      return ok;
    },
    async next() {
      const ok = await need().nav.next();
      await need().settled();
      return ok;
    },
    async prev() {
      const ok = await need().nav.prev();
      await need().settled();
      return ok;
    },
    settled: () => need().settled(),
    pause() {
      need().clock.paused = true;
    },
    resume() {
      const e = need();
      e.clock.paused = false;
      e.clock.resetReal();
    },
    async step(dt = 1 / 60, frames = 1) {
      const e = need();
      e.clock.paused = true;
      e.advance(dt * frames);
      await e.nextFrame();
    },
    async setTime(seconds) {
      const e = need();
      e.clock.paused = true;
      if (seconds > e.clock.time) e.advance(seconds - e.clock.time);
      await e.nextFrame();
    },
    stats: () => need().stats(),
    resetStats: () => need().resetStats(),
    measure: (frames) => need().measure(frames),
    listVolumes: () =>
      need().library.volumes.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        listed: v.listed,
        loaded: need().library.registry(v.id) !== undefined,
      })),
    listChapters: (volumeId) =>
      need()
        .library.volumes.filter((v) => volumeId === undefined || v.id === volumeId)
        .flatMap((v) => need().library.registry(v.id)?.chapters ?? [])
        .map((m) => ({
          volume: m.volume,
          id: m.id,
          fullId: `${m.volume}/${m.id}`,
          order: m.order,
          group: m.group,
          parent: m.parent ?? null,
          title: m.title,
          dev: m.dev ?? false,
          steps: m.steps.map((s) => ({ id: s.id, title: s.title })),
        })),
    position() {
      const s = need().store.get();
      return { volumeId: s.volumeId, chapterId: s.chapterId, stepId: s.stepId };
    },
    setQuality: (tier) => need().setQuality(tier),
    errors: () => [...captured],
    clearErrors() {
      captured.length = 0;
    },
    gpu() {
      const gl = need().renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
        vendor: String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
        webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext,
        maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      };
    },
    simulateContextLoss(restoreAfterMs = 600) {
      const ext = need().renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      window.setTimeout(() => ext.restoreContext(), restoreAfterMs);
      return true;
    },
    locate(name) {
      const e = need();
      const probes = e.runtime.probes;
      const director = e.runtime.director;
      if (!probes || !director) return null;
      return probes.locate(name, director.camera, e.viewport.width, e.viewport.height);
    },
    probes() {
      const p = need().runtime.probes;
      return p ? [...p.names(), ...p.readerNames().map((n) => `read:${n}`)] : [];
    },
    read: (name) => need().runtime.probes?.read(name),
    textSizes() {
      const e = need();
      const scene = e.runtime.scene;
      const director = e.runtime.director;
      if (!scene || !director) return [];
      return measureTexts(
        scene,
        director.camera,
        e.viewport.width,
        e.viewport.height,
        e.renderer.getPixelRatio(),
        fontData().em,
      );
    },
    project(x, y, z) {
      const e = need();
      const director = e.runtime.director;
      if (!director) return null;
      const v = { x, y, z };
      const cam = director.camera;
      // world → clip → CSS px
      const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
      const cx = m[0]! * v.x + m[4]! * v.y + m[8]! * v.z + m[12]!;
      const cy = m[1]! * v.x + m[5]! * v.y + m[9]! * v.z + m[13]!;
      const cw = m[3]! * v.x + m[7]! * v.y + m[11]! * v.z + m[15]!;
      const vp = e.viewport;
      return {
        x: (cx / cw / 2 + 0.5) * vp.width,
        y: (0.5 - cy / cw / 2) * vp.height,
        visible: cw > 0 && Math.abs(cx / cw) <= 1 && Math.abs(cy / cw) <= 1,
      };
    },
  };
  // boot failures surface through `ready`; avoid an additional unhandled-rejection report
  api.ready.catch(() => undefined);
  window.__app = api;
}
