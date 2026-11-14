/**
 * `@/engine/api` — everything a chapter (or kit/plugin) may import from the engine.
 * Chapters must not import other engine modules directly (enforced by ESLint): services arrive through
 * `ChapterContext`, plugins receive the `Engine` in `mount()`.
 */
export {
  bindChapter,
  defineChapter,
  defineScene,
  fullChapterId,
  type ChapterContext,
  type ChapterGroup,
  type ChapterManifest,
  type ChapterSpec,
  type ChapterTheme,
  type PostControl,
  type SceneFactory,
  type SceneHooks,
  type SceneModule,
  type StepIdOf,
  type StepInfo,
  type StepManifest,
  type Viewport,
} from './chapter';
export type { Engine, EnginePlugin, FrameStats, HudRenderer, UrlFlags } from './app';
export type {
  CameraDirector,
  FocusOptions,
  Insets,
  MoveOptions,
  OrbitLimits,
  Shot,
  ShotFit,
  Vec3Like,
} from './camera/director';
export type { ClockView } from './clock';
export type { DeviceState, EdgeInsets, FormFactor, Orientation, PointerKind } from './device';
export { markShared, type Disposable, type DisposeFn } from './disposables';
export { Emitter, type Unsubscribe } from './events';
export type { HudLayer, HudLayout, HudMetrics, HudShell } from './hud';
export { OVERLAY_LAYER, WORLD_LAYER, toOverlay, worldBounds } from './layers';
export type {
  DragInfo,
  HoverEvent,
  InputEvents,
  InputLayer,
  KeyCapture,
  InteractionHandlers,
  KeyAction,
  PinchCapture,
  PointerInfo,
  ScopedInput,
} from './input';
export type { ChapterRef, Library, LibraryConfig, VolumeSource } from './library';
export type { GotoOptions, Nav } from './nav';
export type { Mood, PostOverrides, PostParams } from './pipeline/post-params';
export type { QualityProfile, QualityTier, QualityView } from './quality';
export type { LocatedProbe, ProbeOptions, ProbeTarget, QaApi } from './qa-probes';
export { Rng } from './random';
export type { RuntimeEvents } from './runtime';
export type { Actor, ActorOptions, AppearMode, ColorParam, Param, PoseSpec, Stage, StepSpec } from './stage';
export {
  samePosition,
  DEFAULT_READING_LEVEL,
  isReadingLevel,
  type ReadingLevel,
  type AppState,
  type Position,
  type Progress,
  type Settings,
  type Store,
  type TransitionState,
} from './store';
export {
  DEFAULT_MAP_LAYOUT,
  defineVolume,
  groupLabel,
  type FixtureChapter,
  type FixtureGlossaryRow,
  type JourneyAxis,
  type JourneyGroup,
  type JourneyLayout,
  type VolumeFixtures,
  type VolumeIdentity,
  type VolumeManifest,
  type VolumeSpec,
  type VolumeStatus,
} from './volume';
export {
  EASE,
  damp,
  resolveEase,
  type EaseFn,
  type EaseLike,
  type EaseName,
  type Timeline,
  type Tween,
  type TweenOptions,
  type TweenScope,
} from './tween';
