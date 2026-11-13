/**
 * Chapter-wide contract between `scene.ts` and the step modules.
 *
 * Every step lives in `steps/<step-id>.ts` and exports one factory `(chapter) => StepModule`. The factory
 * builds the step's own objects, registers its camera shots, its declarative stage state (`ctx.stage.define`)
 * and its step UI (`ui.define`), and returns the per-frame hook. Nothing else is shared between steps except
 * the `World` (objects that several steps show).
 */
import { Vector3, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { StepUi } from '@/hud';
import type { StepId } from './content';
import type { World } from './world';

export interface Chapter {
  ctx: ChapterContext;
  ui: StepUi<StepId>;
  world: World;
}

export interface StepModule {
  /** Runs every frame while this step is on screen (engine-clock seconds). */
  update?(dt: number, t: number): void;
}

export type StepFactory = (chapter: Chapter) => StepModule;

const _dir = new Vector3();

/**
 * Anchor for a callout / hotspot that exists only while `on()` is true. While it is false the anchor reports
 * a point behind the camera, which makes the HUD fade the annotation out (UI_API §5) — the declarative step
 * UI has no per-annotation visibility flag.
 */
export function anchorWhen(
  ctx: ChapterContext,
  on: () => boolean,
  anchor: Object3D | (() => Vector3),
): () => Vector3 {
  const out = new Vector3();
  return () => {
    if (on()) return typeof anchor === 'function' ? out.copy(anchor()) : anchor.getWorldPosition(out);
    const camera = ctx.camera.camera;
    return out.copy(camera.position).addScaledVector(camera.getWorldDirection(_dir), -10);
  };
}

/** Smoothstep 0…1 of `x` between `a` and `b`. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

/** What a QA probe may report: a world point or a plain value. */
type Probe = () => Vector3 | number | string | boolean;

declare global {
  interface Window {
    /** QA hook of chapter `atom` (inert unless read): `window.__atomQa.<name>()`. */
    __atomQa?: Record<string, () => number[] | number | string | boolean>;
  }
}

/**
 * Register a named QA probe — a world point (reported as [x, y, z]; feed it to `__app.project`) or a state
 * value — for the Playwright interaction test (`qa/interactions.mjs`). The debug API has no way to find a
 * scene object by name, so the chapter publishes the few points the test has to grab.
 */
export function qaProbe(ctx: ChapterContext, name: string, get: Probe): void {
  const probes = (window.__atomQa ??= {});
  probes[name] = () => {
    const v = get();
    return v instanceof Vector3 ? [v.x, v.y, v.z] : v;
  };
  ctx.onDispose(() => delete probes[name]);
}
