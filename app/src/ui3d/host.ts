/**
 * Creating surfaces from a chapter: `uiHost(ctx)` adapts the chapter context, `hudSurface(ctx)` gives a
 * camera-anchored surface in the HUD layer, `worldSurface(ctx, …)` a console placed in the world scene.
 * Both are removed and disposed with the chapter.
 */
import { OVERLAY_LAYER, type ChapterContext, type InputLayer } from '@/engine/api';
import { UiSurface, type UiHost } from './core/surface';
import { setAccent } from './theme';

export function uiHost(ctx: ChapterContext, layer: InputLayer = 'world'): UiHost {
  return { tweens: ctx.tweens, input: ctx.input, layer, reducedMotion: () => ctx.reducedMotion };
}

/**
 * A full-screen surface in the HUD layer owned by the chapter (1 unit = 1 px-eq, origin at the screen centre).
 * Use it only for chapter-specific overlays; the standard step UI comes from `stepUi(ctx)` in `@/hud`.
 */
export function hudSurface(ctx: ChapterContext, name = 'chapter-hud'): UiSurface {
  const m = ctx.hud.metrics;
  const surface = new UiSurface(uiHost(ctx, 'hud'), {
    width: m.width,
    height: m.height,
    name,
    renderOrder: 900,
  });
  setAccent(surface.root, ctx.manifest.theme.accent);
  ctx.hud.root.add(surface);
  const off = ctx.hud.onResize((next) => surface.setSize(next.width, next.height));
  ctx.onDispose(() => {
    off();
    surface.dispose();
  });
  return surface;
}

export interface WorldSurfaceOptions {
  /** Size of the console in px-equivalent units. */
  width: number;
  height: number;
  /** World units per px-eq unit (e.g. 0.01 → a 400-unit-wide console is 4 world units wide). */
  unit: number;
  /**
   * `overlay` (default): drawn after depth of field, always crisp, never occluded.
   * `scene`: a real object of the scene — occluded by geometry in front, blurred when out of focus.
   */
  mode?: 'overlay' | 'scene';
  name?: string;
}

/** A console in the chapter's world: add the returned surface to `ctx.root` (or to the machine it belongs to). */
export function worldSurface(ctx: ChapterContext, opts: WorldSurfaceOptions): UiSurface {
  const surface = new UiSurface(uiHost(ctx, 'world'), {
    width: opts.width,
    height: opts.height,
    name: opts.name ?? 'console',
    renderOrder: 500,
  });
  surface.scale.setScalar(opts.unit);
  setAccent(surface.root, ctx.manifest.theme.accent);
  if ((opts.mode ?? 'overlay') === 'overlay') surface.setLayerMask(1 << OVERLAY_LAYER);
  else surface.setDepthTest(true);
  ctx.onDispose(() => surface.dispose());
  return surface;
}
