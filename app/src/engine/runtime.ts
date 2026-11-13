/**
 * Chapter runtime: lazy loading with progress, lifecycle, step changes and the universal chapter
 * transition (ARCHITECTURE §3).
 *
 * Navigation requests are "latest target wins":
 *   - same chapter → the step state is retargeted immediately (continuous camera move + tweens);
 *   - other chapter → its chunk is imported and its scene built while the current chapter keeps running;
 *     when it is ready the outgoing frame is frozen to a texture, the scenes are swapped and the engine plays
 *     the scale-zoom. A newer request during loading simply replaces the pending target; one arriving during
 *     the zoom makes the zoom finish faster and then proceeds — input is never blocked and there is never a
 *     blank frame (either a live scene or the frozen frame is on screen).
 */
import { Group, Scene, type Material, type Mesh, type WebGLRenderer } from 'three';
import { MOTION, REDUCED_MOTION } from '@/style/motion';
import { col } from '@/style/palette';
import { Environment } from '@/style/env/environment';
import { CameraDirector } from './camera/director';
import {
  fullChapterId,
  type ChapterContext,
  type ChapterManifest,
  type PostControl,
  type SceneHooks,
  type StepInfo,
  type Viewport,
} from './chapter';
import type { Clock } from './clock';
import { Disposables, disposeObject3D } from './disposables';
import { Emitter, type Unsubscribe } from './events';
import type { HudLayer } from './hud';
import type { InputSystem } from './input';
import type { Nav } from './nav';
import type { RenderPipeline, WorldView } from './pipeline/pipeline';
import { postForMood, type PostOverrides, type PostParams } from './pipeline/post-params';
import type { Quality } from './quality';
import { QaProbes } from './qa-probes';
import { Rng } from './random';
import type { Library } from './library';
import { Stage } from './stage';
import { samePosition, type Position, type Store } from './store';
import { EASE, type Tween, type Tweens, type TweenScope } from './tween';

export interface RuntimeEvents {
  /** A chapter chunk is loading / its scene is initialising. */
  loading: { volumeId: string; chapterId: string; progress: number };
  /**
   * The scale-zoom between two chapters started. HUD: animate panels out/in here.
   * `from` / `to` are full chapter ids (`<volume>/<chapter>`), as in the store's `transition`.
   */
  transitionStart: { from: string | null; to: string; direction: 1 | -1; duration: number };
  transitionEnd: { from: string | null; to: string };
  /** A step became current (after its state was applied). `from` is the previous step id. */
  step: { volumeId: string; chapterId: string; stepId: string; from: string | null; instant: boolean };
  /** A chapter became the active one (fires before its first `step`). `from` is a full chapter id. */
  chapter: { volumeId: string; chapterId: string; from: string | null };
  /** Loading or initialising a chapter failed; the previous chapter stays active. */
  error: { volumeId: string; chapterId: string; error: unknown };
}

export interface RuntimeDeps {
  renderer: WebGLRenderer;
  pipeline: RenderPipeline;
  clock: Clock;
  tweens: Tweens;
  store: Store;
  library: Library;
  quality: Quality;
  hud: HudLayer;
  input: InputSystem;
  /** Late-bound: `Nav` is constructed after the runtime. */
  nav: () => Nav;
  viewport: () => Viewport;
  reducedMotion: () => boolean;
  /** Resolves on the next rendered frame (used to sequence the freeze/swap). */
  nextFrame: () => Promise<void>;
  /** True in deterministic (frozen clock) mode: never wait on real time. */
  deterministic: () => boolean;
}

/** Post params the engine animates itself; chapters cannot override them. */
const ENGINE_OWNED: (keyof PostParams)[] = ['dofFocus', 'chroma'];

class ChapterPost implements PostControl {
  private chapterBase: PostOverrides = {};
  private last: PostOverrides = {};
  private tween: Tween | null = null;
  /** False until this chapter becomes the active one (its values must not leak into the outgoing chapter). */
  live = false;

  constructor(
    private readonly manifest: ChapterManifest,
    private readonly pipeline: RenderPipeline,
    private readonly scope: TweenScope,
  ) {}

  get params(): Readonly<PostParams> {
    return this.pipeline.params;
  }

  base(overrides: PostOverrides): void {
    this.chapterBase = { ...this.chapterBase, ...overrides };
    if (this.live) this.apply(this.last, { duration: 0.4 });
  }

  apply(overrides: PostOverrides = {}, opts: { duration?: number; instant?: boolean } = {}): void {
    this.last = overrides;
    if (!this.live) return;
    const target = postForMood(this.manifest.theme.mood, {
      ...this.chapterBase,
      ...overrides,
    }) as unknown as Record<string, number>;
    for (const key of ENGINE_OWNED) delete target[key];
    this.tween?.kill();
    this.tween = null;
    if (opts.instant) Object.assign(this.pipeline.params, target);
    else
      this.tween = this.scope.to(this.pipeline.params, target, {
        duration: opts.duration ?? MOTION.state.duration,
        ease: 'power2.inOut',
      });
  }

  /** Become the pipeline's driver (at chapter swap). */
  activate(duration: number): void {
    this.live = true;
    this.apply(this.last, duration > 0 ? { duration } : { instant: true });
  }
}

interface Instance {
  manifest: ChapterManifest;
  scene: Scene;
  root: Group;
  director: CameraDirector;
  env: Environment;
  stage: Stage;
  post: ChapterPost;
  hooks: SceneHooks;
  disposables: Disposables;
  tweens: TweenScope;
  input: ReturnType<InputSystem['scoped']>;
  stepId: string | null;
  disposed: boolean;
  resizeListeners: Set<(v: Viewport) => void>;
  probes: QaProbes;
}

export class ChapterRuntime {
  private readonly events = new Emitter<RuntimeEvents>();
  private active: Instance | null = null;
  private wanted: Position | null = null;
  private wantedInstant = false;
  private loadToken = 0;
  private loadingChapter: string | null = null;
  private animating = false;
  private suspended = false;
  /** Running scale-zoom (advanced in `update`, so a newer request can speed it up mid-flight). */
  private zoom: {
    elapsed: number;
    duration: number;
    reduced: boolean;
    from: string | null;
    to: string;
    direction: 1 | -1;
    /** Frames still to render before the animation starts (see `update`). */
    warmup: number;
  } | null = null;
  private transitionSpeed = 1;
  private settleWaiters: (() => void)[] = [];
  private readonly view: WorldView = {
    scene: null as unknown as Scene,
    camera: null as unknown as WorldView['camera'],
    rig: null,
  };

  constructor(private readonly deps: RuntimeDeps) {
    deps.quality.onChange((profile) => {
      const a = this.active;
      if (!a) return;
      a.env.setQuality(profile);
      // shadow / tier defines are baked into programs: recompile this chapter's materials
      a.scene.traverse((o) => {
        const m = (o as Mesh).material as Material | Material[] | undefined;
        if (Array.isArray(m)) for (const x of m) x.needsUpdate = true;
        else if (m) m.needsUpdate = true;
      });
    });
    deps.hud.onInsets((insets) => this.active?.director.setInsets(insets));
  }

  on<K extends keyof RuntimeEvents>(type: K, fn: (payload: RuntimeEvents[K]) => void): Unsubscribe {
    return this.events.on(type, fn);
  }

  /** Manifest of the chapter on screen. */
  get chapter(): ChapterManifest | null {
    return this.active?.manifest ?? null;
  }

  /** World scene of the chapter on screen (QA measurements). */
  get scene(): Scene | null {
    return this.active?.scene ?? null;
  }

  /** QA probes of the chapter on screen (`ctx.qa.probe` → `__app.locate`). */
  get probes(): QaProbes | null {
    return this.active?.probes ?? null;
  }

  /** Camera director of the chapter on screen (input and debug tools use it). */
  get director(): CameraDirector | null {
    return this.active?.director ?? null;
  }

  /**
   * Stop (true) or resume (false) rendering the world while a full-screen view (Journey Map, home screen)
   * covers it: the frame then renders only the HUD over the void colour, saving the whole chapter frame time.
   * The chapter keeps updating (its state and the engine clock stay consistent); during a chapter load or
   * transition the world renders regardless, so transition captures are never empty. Idempotent.
   */
  suspendWorld(suspended = true): void {
    this.suspended = suspended;
  }

  /** True while `suspendWorld(true)` is in effect. */
  get worldSuspended(): boolean {
    return this.suspended;
  }

  /** What the render pipeline should draw as the world this frame. */
  worldView(): WorldView | null {
    const a = this.active;
    if (!a) return null;
    this.view.scene = a.scene;
    this.view.camera = a.director.camera;
    this.view.rig = a.env.rig;
    this.view.mood = a.env.mood;
    return this.view;
  }

  /** True while a chapter is loading or the transition animation runs. */
  get busy(): boolean {
    return this.loadingChapter !== null || this.animating;
  }

  /** Resolves when no load or transition is in flight. */
  settled(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    return new Promise((resolve) => this.settleWaiters.push(resolve));
  }

  /** Navigate to a position (called by `Nav`). Resolves when it is on screen or was superseded. */
  async request(position: Position, opts: { instant: boolean }): Promise<void> {
    this.wanted = position;
    this.wantedInstant = opts.instant;
    this.pump();
    await this.settled();
  }

  /** @internal Per-frame update of the active chapter. */
  update(dt: number, t: number): void {
    const a = this.active;
    if (!a) return;
    a.hooks.update?.(dt, t);
    a.director.update(dt);
    const vp = this.deps.viewport();
    a.env.update(dt, a.director.camera, a.director.target, vp.height * vp.dpr);
    const pipeline = this.deps.pipeline;
    pipeline.params.dofFocus = a.director.focusDistance;
    pipeline.dofReference =
      pipeline.params.dofReference > 0 ? pipeline.params.dofReference : a.env.subjectScale * 2.2;
    pipeline.lookScale = a.env.lookScale;
    const zoom = this.zoom;
    if (zoom && zoom.warmup > 0 && zoom.duration > 0) {
      // Warm-up (3 frames: the heavy one, the one whose interval contains it, one clean): the first frame of
      // the incoming scene uploads buffers and builds its shadow map behind the
      // frozen picture. The zoom (and `transitionStart`) begins only afterwards, so that long frame is part
      // of loading and costs no animation time.
      if (--zoom.warmup === 0) {
        this.deps.store.set((st) => ({ transition: { ...st.transition, phase: 'animating', progress: 0 } }));
        this.events.emit('transitionStart', {
          from: zoom.from,
          to: zoom.to,
          direction: zoom.direction,
          duration: zoom.duration,
        });
      }
    } else if (zoom) {
      zoom.elapsed += dt * this.transitionSpeed;
      const p = zoom.duration <= 0 ? 1 : Math.min(zoom.elapsed / zoom.duration, 1);
      pipeline.transition.progress = EASE['sine.inOut'](p);
      // chromatic aberration only during transitions (STYLE_GUIDE §4)
      pipeline.params.chroma = zoom.reduced ? 0 : Math.sin(p * Math.PI) * 0.014;
      a.director.camera.freeCenter(pipeline.transition.center);
      if (p >= 1) {
        this.zoom = null;
        this.animating = false;
        pipeline.endTransition();
        pipeline.params.chroma = 0;
        this.setTransition('idle');
        this.events.emit('transitionEnd', { from: zoom.from, to: zoom.to });
        this.pump(); // a newer target may have arrived meanwhile
        this.checkSettled();
      }
    }
  }

  /** @internal Viewport changed. */
  resize(viewport: Viewport): void {
    const a = this.active;
    if (!a) return;
    a.director.setViewport(viewport.width, viewport.height);
    for (const fn of a.resizeListeners) fn(viewport);
  }

  /** Dispose the active chapter (context loss recovery / shutdown). */
  disposeActive(): void {
    if (this.active) this.disposeInstance(this.active);
    this.active = null;
  }

  /* ---------------------------------------------------------------------------------------------- */

  /** Drive the state machine toward `wanted`. Safe to call at any time. */
  private pump(): void {
    const want = this.wanted;
    if (!want) return;
    const a = this.active;
    if (a && a.manifest.volume === want.volumeId && a.manifest.id === want.chapterId) {
      // target is the chapter on screen: cancel any pending load of another chapter and retarget the step
      if (this.loadingChapter !== null) {
        this.loadToken++;
        this.loadingChapter = null;
        this.setTransition('idle');
      }
      if (a.stepId !== want.stepId) this.enterStep(a, want.stepId, this.wantedInstant);
      this.checkSettled();
      return;
    }
    if (this.animating) {
      this.transitionSpeed = 2.6; // hurry the running zoom; pump() runs again when it ends
      return;
    }
    const key = `${want.volumeId}/${want.chapterId}`;
    if (this.loadingChapter === key) return; // already on its way; the step is read when it arrives
    void this.load(want);
  }

  private async load(target: Position): Promise<void> {
    const { library, store, pipeline } = this.deps;
    const { volumeId, chapterId } = target;
    // navigation only hands over positions of loaded volumes (`Library.resolve`)
    const registry = library.registry(volumeId);
    const manifest = registry?.get(chapterId);
    if (!registry || !manifest) return;
    const key = fullChapterId(manifest);
    const token = ++this.loadToken;
    this.loadingChapter = key;
    const active = this.active?.manifest;
    const from = active ? fullChapterId(active) : null;
    const direction = library.zoomDirection(
      active ? { volumeId: active.volume, chapterId: active.id } : null,
      target,
    );
    store.set({ transition: { phase: 'loading', from, to: key, direction, progress: 0 } });
    this.events.emit('loading', { volumeId, chapterId, progress: 0 });
    let instance: Instance | null = null;
    try {
      const mod = await manifest.load();
      if (token !== this.loadToken) return;
      if (!mod.default?.isSceneModule)
        throw new Error(`chapter '${key}': scene.ts must \`export default defineScene(...)\``);
      instance = this.createInstance(manifest);
      const ctx = this.createContext(instance, token);
      const hooks = await mod.default.create(ctx);
      if (hooks) instance.hooks = hooks;
      if (token !== this.loadToken) {
        this.disposeInstance(instance);
        return;
      }
      instance.stage.validate(
        manifest.steps.map((s) => s.id),
        manifest.id,
      );
      // apply the target step instantly behind the scenes, then compile programs without blocking a frame
      const want =
        this.wanted?.volumeId === volumeId && this.wanted.chapterId === chapterId
          ? this.wanted
          : { chapterId, stepId: manifest.steps[0]!.id };
      this.enterStep(instance, registry.resolve(chapterId, want.stepId)!.stepId, true, false);
      instance.director.update(0);
      instance.env.update(0, instance.director.camera, instance.director.target, 1080);
      const renderer = this.deps.renderer;
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        await renderer.compileAsync(instance.scene, instance.director.camera);
      } else {
        // no parallel compilation on this driver (e.g. ANGLE/Vulkan): compile now, behind the live scene
        renderer.compile(instance.scene, instance.director.camera);
      }
      if (token !== this.loadToken) {
        this.disposeInstance(instance);
        return;
      }
      this.events.emit('loading', { volumeId, chapterId, progress: 1 });
      // freeze the outgoing frame (one more frame of the old scene), then swap
      pipeline.requestFreeze();
      await this.deps.nextFrame();
      if (token !== this.loadToken) {
        pipeline.endTransition();
        this.disposeInstance(instance);
        return;
      }
      this.swap(instance, from, direction);
    } catch (error) {
      if (instance) this.disposeInstance(instance);
      if (token !== this.loadToken) return;
      this.loadingChapter = null;
      this.setTransition('idle');
      console.error(`[runtime] failed to load chapter '${key}':`, error);
      this.events.emit('error', { volumeId, chapterId, error });
      // stay where we are: point navigation back at the chapter on screen
      const a = this.active;
      this.wanted =
        a && a.stepId ? { volumeId: a.manifest.volume, chapterId: a.manifest.id, stepId: a.stepId } : null;
      this.checkSettled();
    }
  }

  private swap(next: Instance, from: string | null, direction: 1 | -1): void {
    const { pipeline, store, clock } = this.deps;
    const previous = this.active;
    this.active = next;
    this.loadingChapter = null;
    if (previous) this.disposeInstance(previous);
    const reduced = this.deps.reducedMotion();
    // deterministic (frozen clock) mode skips the animation: time only moves through explicit fixed steps
    const duration = this.deps.deterministic()
      ? 0
      : MOTION.transition.duration * (reduced ? REDUCED_MOTION.transition : 1);
    next.post.activate(Math.min(0.35, duration));
    const vp = this.deps.viewport();
    next.director.setViewport(vp.width, vp.height);
    next.director.setInsets(this.deps.hud.insetFractions(), true);
    // the incoming world really moves in depth: start farther (zoom in) or closer (zoom out) and settle
    next.director.arrive(direction > 0 ? 1.9 : 0.55, duration * 1.15);
    next.director.update(0);
    const tr = pipeline.transition;
    tr.active = true;
    tr.progress = 0;
    tr.direction = direction;
    tr.simple = reduced;
    col(next.manifest.theme.accent, tr.accent);
    next.director.camera.freeCenter(tr.center);
    this.animating = true;
    this.transitionSpeed = 1;
    const to = fullChapterId(next.manifest);
    const here: Position = {
      volumeId: next.manifest.volume,
      chapterId: next.manifest.id,
      stepId: next.stepId!,
    };
    store.set({
      volumeId: here.volumeId,
      chapterId: here.chapterId,
      stepId: next.stepId,
      transition: {
        phase: duration > 0 ? 'loading' : 'animating',
        from,
        to,
        direction,
        progress: 1,
      },
    });
    this.events.emit('chapter', { volumeId: here.volumeId, chapterId: here.chapterId, from });
    this.events.emit('step', {
      volumeId: here.volumeId,
      chapterId: here.chapterId,
      stepId: here.stepId,
      from: null,
      instant: true,
    });
    if (duration <= 0) this.events.emit('transitionStart', { from, to, direction, duration });
    clock.resetReal();
    this.zoom = { elapsed: 0, duration, reduced, from, to, direction, warmup: 3 };
    store.settle(here);
    store.markVisited(here);
    // a step change requested while loading
    const want = this.wanted;
    if (want && samePosition(want, { ...here, stepId: want.stepId }) && want.stepId !== next.stepId)
      this.enterStep(next, want.stepId, true);
  }

  private enterStep(instance: Instance, stepId: string, instant: boolean, announce = true): void {
    const manifest = instance.manifest;
    const index = manifest.steps.findIndex((s) => s.id === stepId);
    if (index < 0) return;
    const from = instance.stepId;
    const fromIndex = from === null ? -1 : manifest.steps.findIndex((s) => s.id === from);
    const direction: StepInfo['direction'] =
      fromIndex < 0 ? 0 : index > fromIndex ? 1 : index < fromIndex ? -1 : 0;
    instance.stepId = stepId;
    let info: StepInfo;
    try {
      info = instance.stage.apply(stepId, { from, instant, direction, index });
      instance.hooks.enterStep?.(stepId, info);
    } catch (error) {
      console.error(`[runtime] ${manifest.id}/${stepId}: enterStep failed:`, error);
    }
    if (!announce) return;
    const { store } = this.deps;
    const here: Position = { volumeId: manifest.volume, chapterId: manifest.id, stepId };
    store.set({ volumeId: here.volumeId, chapterId: here.chapterId, stepId });
    store.settle(here);
    store.markVisited(here);
    this.events.emit('step', { ...here, from, instant });
  }

  private createInstance(manifest: ChapterManifest): Instance {
    const { tweens, input, quality, pipeline } = this.deps;
    const scene = new Scene();
    scene.name = `chapter:${manifest.id}`;
    const root = new Group();
    root.name = 'chapter-root';
    scene.add(root);
    const director = new CameraDirector();
    const vp = this.deps.viewport();
    director.setViewport(vp.width, vp.height);
    director.setInsets(this.deps.hud.insetFractions(), true);
    director.reducedMotion = this.deps.reducedMotion();
    const env = new Environment(
      scene,
      { preset: manifest.theme.sky, accent: manifest.theme.accent },
      quality.profile,
    );
    const scope = tweens.root.scope();
    const post = new ChapterPost(manifest, pipeline, scope);
    const stage = new Stage({ tweens: scope, camera: director, env, post, defaultEnv: manifest.theme.sky });
    return {
      manifest,
      scene,
      root,
      director,
      env,
      stage,
      post,
      hooks: {},
      disposables: new Disposables(),
      tweens: scope,
      input: input.scoped(),
      stepId: null,
      disposed: false,
      resizeListeners: new Set(),
      probes: new QaProbes(),
    };
  }

  private createContext(instance: Instance, token: number): ChapterContext {
    const deps = this.deps;
    const report = (fraction: number): void => {
      if (token !== this.loadToken) return;
      const progress = Math.min(Math.max(fraction, 0), 1);
      deps.store.set((s) => ({ transition: { ...s.transition, progress } }));
      this.events.emit('loading', {
        volumeId: instance.manifest.volume,
        chapterId: instance.manifest.id,
        progress,
      });
    };
    let sliceStart = performance.now();
    return {
      manifest: instance.manifest,
      scene: instance.scene,
      root: instance.root,
      camera: instance.director,
      env: instance.env,
      post: instance.post,
      stage: instance.stage,
      input: instance.input,
      tweens: instance.tweens,
      clock: deps.clock,
      quality: deps.quality,
      store: deps.store,
      get nav() {
        return deps.nav();
      },
      hud: deps.hud,
      random: new Rng(`chapter:${instance.manifest.id}`),
      get viewport() {
        return deps.viewport();
      },
      renderer: deps.renderer,
      get reducedMotion() {
        return deps.reducedMotion();
      },
      gesture: deps.input.gesture,
      get disposed() {
        return instance.disposed;
      },
      track: (resource) => instance.disposables.track(resource),
      onDispose: (fn) => instance.disposables.onDispose(fn),
      onResize: (fn) => {
        instance.resizeListeners.add(fn);
        return () => instance.resizeListeners.delete(fn);
      },
      qa: instance.probes,
      progress: report,
      breathe: async () => {
        // Yield only when this slice of init work has used a good part of a frame — and never in
        // deterministic mode, where real time must not influence anything.
        if (deps.deterministic() || performance.now() - sliceStart < 7) return;
        await deps.nextFrame();
        sliceStart = performance.now();
      },
    };
  }

  private disposeInstance(instance: Instance): void {
    if (instance.disposed) return;
    instance.disposed = true;
    instance.probes.clear();
    const errors: unknown[] = [];
    try {
      instance.hooks.dispose?.();
    } catch (e) {
      errors.push(e);
    }
    instance.stage.dispose();
    instance.tweens.dispose();
    instance.input.dispose();
    errors.push(...instance.disposables.dispose());
    instance.resizeListeners.clear();
    disposeObject3D(instance.root);
    instance.env.dispose();
    instance.scene.clear();
    for (const e of errors) console.error(`[runtime] ${instance.manifest.id}: error during dispose:`, e);
  }

  private setTransition(phase: 'idle'): void {
    const t = this.deps.store.get().transition;
    if (t.phase !== phase) this.deps.store.set({ transition: { ...t, phase, progress: 0 } });
  }

  private checkSettled(): void {
    if (this.busy) return;
    const waiters = this.settleWaiters;
    this.settleWaiters = [];
    for (const w of waiters) w();
  }
}
