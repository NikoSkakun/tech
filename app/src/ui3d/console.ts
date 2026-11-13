/**
 * `worldConsole(ctx, …)` — the preset for a panel in the world next to a machine (title, chart, readouts…):
 * a `worldSurface` with a standard `Panel`, optionally turned toward the camera, that keeps its text legible.
 * Every frame it measures how many screen pixels its smallest text (the caption size, 15 px-eq) takes,
 * normalised to a 1280×720 window; below `minPx` (16) it grows (up to `maxGrow`, default ×3) and, if that is
 * still not enough, logs one warning — which fails `chapter-check`, so an illegible console cannot ship.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { UiNode } from './core/node';
import type { UiSurface } from './core/surface';
import { worldSurface } from './host';
import { UI } from './theme';
import { Label } from './widgets/label';
import { Panel } from './widgets/panel';

export interface WorldConsoleOptions {
  /** Title line (Ukrainian, DECISIONS §54). */
  title?: string;
  /** Panel width in px-eq. Default 420. */
  width?: number;
  children: readonly UiNode[];
  /** World units per px-eq at scale 1 (e.g. 0.01 in a metre scene). */
  unit: number;
  /** Smallest text on screen, in CSS px at 1280×720. Default 16. */
  minPx?: number;
  /** Largest automatic growth factor. Default 3. */
  maxGrow?: number;
  /** Turn toward the camera around Y every frame. Default true. */
  billboard?: boolean;
  mode?: 'overlay' | 'scene';
  name?: string;
}

export interface WorldConsole {
  readonly surface: UiSurface;
  readonly panel: Panel;
  /** Smallest text size on screen right now, CSS px normalised to 720 p (Infinity while off-screen). */
  readonly textPx: number;
  /** Current automatic growth factor (1 = as declared). */
  readonly grow: number;
}

const _a = new Vector3();
const _b = new Vector3();
const _right = new Vector3();

export function worldConsole(ctx: ChapterContext, opts: WorldConsoleOptions): WorldConsole {
  const width = opts.width ?? 420;
  const panel = new Panel({
    width,
    gap: 12,
    pad: [18, 22],
    children: [
      opts.title ? new Label(opts.title, { font: 'display', size: UI.text.h3 }, { width: 'fill' }) : null,
      ...opts.children,
    ],
  });
  // the surface is sized generously; the panel hugs its content at the top
  const surface = worldSurface(ctx, {
    width: width + 40,
    height: 900,
    unit: opts.unit,
    mode: opts.mode,
    name: opts.name ?? 'world-console',
  });
  surface.root.add(panel);
  panel.float = { ax: 0.5, ay: 0, dy: 20 };
  const minPx = opts.minPx ?? 16;
  const maxGrow = opts.maxGrow ?? 3;
  const state = { textPx: Infinity, grow: 1 };
  let warned = false;
  // runs right before the surface is drawn (every rendered frame while it is visible)
  surface.beforeFlush = () => {
    const cam = ctx.camera.camera;
    if (!surface.parent) return;
    if (opts.billboard ?? true) {
      surface.getWorldPosition(_a);
      surface.rotation.y = Math.atan2(cam.position.x - _a.x, cam.position.z - _a.z);
    }
    // on-screen size of one caption: project the surface origin and a point one caption-height to the right
    surface.getWorldPosition(_a);
    const toCam = _b.copy(cam.position).sub(_a);
    if (toCam.dot(cam.getWorldDirection(_right)) > 0) {
      state.textPx = Infinity; // behind the camera
      return;
    }
    _right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    const world = opts.unit * state.grow * UI.text.caption;
    _b.copy(_a).addScaledVector(_right, world).project(cam);
    _a.project(cam);
    // NDC → CSS px of a 720 p window (projection scales with the viewport height, so this is size-independent)
    state.textPx = Math.hypot((_b.x - _a.x) * 0.5 * 720 * cam.aspect, (_b.y - _a.y) * 0.5 * 720);
    if (state.textPx < minPx * 0.98 && state.grow < maxGrow) {
      state.grow = Math.min(state.grow * (minPx / Math.max(state.textPx, 1)), maxGrow);
      surface.scale.setScalar(opts.unit * state.grow);
    } else if (state.grow > 1 && state.textPx > minPx * 1.3) {
      state.grow = Math.max((state.grow * (minPx * 1.15)) / state.textPx, 1);
      surface.scale.setScalar(opts.unit * state.grow);
    }
    if (!warned && state.grow >= maxGrow && state.textPx < minPx * 0.98) {
      warned = true;
      console.warn(
        `worldConsole '${opts.title ?? opts.name ?? ''}': text ${state.textPx.toFixed(1)} px < ${minPx} px at 1280×720 — move the camera closer or raise \`unit\``,
      );
    }
  };
  return {
    surface,
    panel,
    get textPx() {
      return state.textPx;
    },
    get grow() {
      return state.grow;
    },
  };
}
