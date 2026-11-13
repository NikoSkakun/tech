/**
 * The chapter contract (ARCHITECTURE §3): manifest, scene module and the context a scene receives.
 * Chapter authors import these through `@/engine/api`.
 */
import type { Group, Object3D, Scene, WebGLRenderer } from 'three';
import type { AccentName } from '@/style/palette';
import type { Environment } from '@/style/env/environment';
import type { EnvPresetName } from '@/style/env/presets';
import type { CameraDirector } from './camera/director';
import type { ClockView } from './clock';
import type { Disposable, DisposeFn } from './disposables';
import type { Unsubscribe } from './events';
import type { HudLayer } from './hud';
import type { ScopedInput } from './input';
import type { Nav } from './nav';
import type { Mood, PostOverrides, PostParams } from './pipeline/post-params';
import type { QualityView } from './quality';
import type { QaApi } from './qa-probes';
import type { Rng } from './random';
import type { Stage } from './stage';
import type { Store } from './store';
import type { TweenScope } from './tween';

/** Id of a group (part) of the chapter's volume — one of `volume.json` → `groups` (checked at registration). */
export type ChapterGroup = string;

export interface StepManifest {
  /** URL-safe id, unique within the chapter (`[A-Za-z0-9_-]`). */
  readonly id: string;
  /** Short title for menus and the journey map (Ukrainian). */
  readonly title: string;
  /** One-sentence teaser (Ukrainian). The full step text lives in the chapter's `content.ts`. */
  readonly blurb: string;
}

export interface ChapterTheme {
  /** Dominant accent of the chapter (UI highlights, rim tint, transition iris). */
  readonly accent: AccentName;
  /** Environment preset: backdrop + light rig. Its kind (space / studio / sky) is fixed for the chapter. */
  readonly sky: EnvPresetName;
  /** Post-processing mood defaults. */
  readonly mood: Mood;
}

export interface ChapterManifest {
  /**
   * Id of the volume the chapter belongs to — the directory `src/volumes/<volume>/`. Filled in when the chapter
   * is registered (`bindChapter`); authors do not write it. The full chapter id is `<volume>/<id>`.
   */
  readonly volume: string;
  /** URL-safe id, unique inside the volume; equals the directory name under `src/volumes/<volume>/chapters/`. */
  readonly id: string;
  /** Position on the main path (children are ordered among their siblings). */
  readonly order: number;
  readonly group: ChapterGroup;
  /** Parent chapter id: plant types are children of `plants`, labs of `home`. */
  readonly parent?: string;
  readonly title: string;
  readonly subtitle: string;
  /** The chapter's place on the volume's journey axis as shown on screen, e.g. `10⁻¹⁰ m`. */
  readonly axisLabel: string;
  /**
   * The same place as a number on the volume's journey axis (`VolumeManifest.journey.axis`) — for electricity
   * log₁₀ of the characteristic size in metres. Sets the node's height on the journey map and the zoom
   * direction of chapter transitions.
   */
  readonly axisValue: number;
  readonly theme: ChapterTheme;
  /** Ordered steps (≥ 1). */
  readonly steps: readonly StepManifest[];
  /** Lazy scene chunk: `() => import('./scene')`. */
  readonly load: () => Promise<{ default: SceneModule }>;
  /** Optional tiny model for the journey map: `() => import('./emblem')`. */
  readonly emblem?: () => Promise<{ default: () => Object3D }>;
  /** Development-only chapter: hidden from navigation unless `?debug`. */
  readonly dev?: boolean;
}

const ID = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** What a chapter's `index.ts` declares: the manifest without the volume (that is its directory). */
export type ChapterSpec = Omit<ChapterManifest, 'volume'>;

/** Declare a chapter. Validates ids eagerly so mistakes surface at startup, not on navigation. */
export function defineChapter<const M extends ChapterSpec>(spec: M): M & { readonly volume: string } {
  const manifest = { volume: '', ...spec };
  if (!ID.test(manifest.id)) throw new Error(`defineChapter: invalid chapter id '${manifest.id}'`);
  if (manifest.steps.length === 0)
    throw new Error(`defineChapter(${manifest.id}): a chapter needs at least one step`);
  const seen = new Set<string>();
  for (const step of manifest.steps) {
    if (!ID.test(step.id)) throw new Error(`defineChapter(${manifest.id}): invalid step id '${step.id}'`);
    if (seen.has(step.id)) throw new Error(`defineChapter(${manifest.id}): duplicate step id '${step.id}'`);
    seen.add(step.id);
  }
  return manifest;
}

/**
 * Bind a declared chapter to its volume (done once by discovery; tests of the platform bind by hand).
 * The manifest object keeps its identity, so `ctx.manifest` is the object the chapter's `index.ts` exports.
 */
export function bindChapter<M extends ChapterManifest>(manifest: M, volume: string): M {
  (manifest as { volume: string }).volume = volume;
  return manifest;
}

/** Full id of a chapter: `<volume>/<chapter>`. */
export function fullChapterId(chapter: { readonly volume: string; readonly id: string }): string {
  return `${chapter.volume}/${chapter.id}`;
}

/** Union of the step ids of a manifest declared with `defineChapter` (for compile-time checked step maps). */
export type StepIdOf<M extends ChapterManifest> = M['steps'][number]['id'];

export interface StepInfo {
  /** Step we came from (null when the chapter was just entered or deep-linked). */
  readonly from: string | null;
  /** Apply the state without animation (deep link, QA, chapter entry behind the transition). */
  readonly instant: boolean;
  /** +1 forward, −1 backward, 0 on entry. */
  readonly direction: 1 | -1 | 0;
  /** Index of the step in the manifest. */
  readonly index: number;
  /** Tween scope that is killed automatically when this step is left — use it for step-local sequences. */
  readonly scope: TweenScope;
}

/** Optional hooks returned by a scene factory. With `ctx.stage` most chapters only need `update`. */
export interface SceneHooks {
  /** Called after `ctx.stage` has applied the step's declarative state. Must be safe from ANY previous state. */
  enterStep?(stepId: string, info: StepInfo): void;
  /** Called every engine update while the chapter is active. `dt`/`t` are engine-clock seconds. */
  update?(dt: number, t: number): void;
  /** Extra cleanup (most resources are released automatically — see `ChapterContext.track`). */
  dispose?(): void;
}

export type SceneFactory = (ctx: ChapterContext) => SceneHooks | void | Promise<SceneHooks | void>;

export interface SceneModule {
  readonly isSceneModule: true;
  readonly create: SceneFactory;
}

/** Wrap the scene factory of a chapter: `export default defineScene(async (ctx) => { … })`. */
export function defineScene(create: SceneFactory): SceneModule {
  return { isSceneModule: true, create };
}

export interface Viewport {
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
  readonly aspect: number;
  /** Effective device pixel ratio of the render buffers. */
  readonly dpr: number;
}

/** Per-chapter control of the post stack (on top of the mood defaults). */
export interface PostControl {
  /** Live values (read-only for chapters). */
  readonly params: Readonly<PostParams>;
  /** Chapter-wide overrides of the mood defaults; call once during init. */
  base(overrides: PostOverrides): void;
  /**
   * Tween toward `mood defaults + chapter base + overrides`. `ctx.stage` calls this for each step's `post`;
   * call it yourself only for effects outside the step model.
   */
  apply(overrides?: PostOverrides, opts?: { duration?: number; instant?: boolean }): void;
}

/**
 * Engine services handed to a chapter scene. Small on purpose: libraries (`@/ui3d`, `@/fx`, `@/kit`,
 * `@/style`, `@/text`) are imported directly and take the context (or parts of it) as arguments.
 */
export interface ChapterContext {
  readonly manifest: ChapterManifest;
  /** The chapter's world scene (lights, fog and backdrop are managed by `env`). */
  readonly scene: Scene;
  /** Add your objects here. Everything under it is disposed automatically when the chapter is left. */
  readonly root: Group;
  /** Camera director: shots, moves, focus. */
  readonly camera: CameraDirector;
  /** Backdrop + light rig + fog. */
  readonly env: Environment;
  readonly post: PostControl;
  /** Declarative step states — the default way to make every step random-access safe. */
  readonly stage: Stage;
  /** Pointer interaction registration, scoped to this chapter. */
  readonly input: ScopedInput;
  /** Tweens/timelines on the engine clock, scoped to this chapter. */
  readonly tweens: TweenScope;
  readonly clock: ClockView;
  readonly quality: QualityView;
  readonly store: Store;
  readonly nav: Nav;
  /** HUD layer (camera-space UI scene) — passed to `@/ui3d` widgets. */
  readonly hud: HudLayer;
  /** Seeded random generator (deterministic per chapter). Use instead of `Math.random()`. */
  readonly random: Rng;
  readonly viewport: Viewport;
  /** For render targets / capability queries. Do not call `render()` or change global state. */
  readonly renderer: WebGLRenderer;
  /** True when the user (or OS) asked for reduced motion. */
  readonly reducedMotion: boolean;
  /** Resolves on the first user gesture (pointer/key) — audio may start only after it. */
  readonly gesture: Promise<void>;
  /** True once the chapter has been disposed (check after `await` in long async work). */
  readonly disposed: boolean;
  /** Register a resource with `dispose()` (render target, standalone material/texture, …). */
  track<T extends Disposable>(resource: T): T;
  /** Register an arbitrary cleanup callback. */
  onDispose(fn: DisposeFn): void;
  /** Subscribe to viewport changes; unsubscribed automatically on dispose. */
  onResize(fn: (viewport: Viewport) => void): Unsubscribe;
  /** Report loading progress 0…1 during `init` (drives the loading indicator). */
  progress(fraction: number): void;
  /**
   * `await ctx.breathe()` between heavy build steps: yields to the next animation frame when the current
   * one has run long, so chapter loading never freezes the outgoing scene.
   */
  breathe(): Promise<void>;
  /**
   * QA hooks (M3). `qa.probe('rotor', mesh)` names a scene object / point for interaction tests, which find it
   * with `window.__app.locate('rotor')` (CSS px). Works in production builds; cleared with the chapter.
   */
  readonly qa: QaApi;
}
