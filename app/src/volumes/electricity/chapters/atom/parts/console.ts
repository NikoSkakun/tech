/**
 * World consoles of the chapter. Every card / diagram that lives in the scene is a `worldConsole` (`@/ui3d`):
 * the preset keeps its smallest text ≥ 16 px at 1280×720 (it grows when the camera is far and warns — failing
 * `chapter-check` — when even that is not enough) and is what the mobile layout re-homes into the HUD
 * (DECISIONS §57 a). Text that is *read* rather than looked at goes to the dock or the board instead.
 *
 * The preset hangs its panel from the top of an oversized surface, so a console is placed by the top-centre
 * of its panel: `pinConsole` keeps that point fixed while the console grows.
 */
import { Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { ChapterContext } from '@/engine/api';
import { worldConsole, type UiNode, type WorldConsole } from '@/ui3d';

/** Distance from the surface origin to the panel's top edge, px-eq (surface 900 high, panel 20 below its top). */
const TOP = 900 / 2 - 20;
/** Gap kept between a console and the left / right frame edge, in NDC (1 = half the frame width). */
const EDGE = 0.05;
const _p = new Vector3();
const _q = new Vector3();

/**
 * Slide a console sideways (in camera space) until its panel lies inside the frame. On portrait and narrow
 * layouts a console grows to stay legible while the frame gets narrower, so a card authored beside the model
 * would hang over the left / right edge. The panel's edges are taken through the surface's own matrix (its
 * billboard turn included) and the projection matrix (an off-centre frustum is respected).
 */
function keepInFrame(camera: PerspectiveCamera, surface: Object3D, halfPx: number): void {
  const parent = surface.parent;
  if (!parent) return;
  surface.updateWorldMatrix(true, false);
  const e = camera.projectionMatrix.elements; // column-major: x_ndc = (e0·x + e8·z) / −z
  const ndcX = (x: number): number => {
    _q.set(x, 0, 0).applyMatrix4(surface.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    return _q.z < 0 ? (e[0]! * _q.x + e[8]! * _q.z) / -_q.z : NaN;
  };
  const left = ndcX(-halfPx);
  const right = ndcX(halfPx);
  _p.set(0, 0, 0).applyMatrix4(surface.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
  const depth = -_p.z;
  if (!(depth > 0) || Number.isNaN(left) || Number.isNaN(right)) return;
  const lim = 1 - EDGE;
  let shift = 0;
  if (right - left > 2 * lim) shift = -(left + right) / 2;
  else if (right > lim) shift = lim - right;
  else if (left < -lim) shift = -lim - left;
  if (shift === 0) return;
  _p.x += (shift * depth) / e[0]!;
  _p.applyMatrix4(camera.matrixWorld);
  surface.position.copy(parent.worldToLocal(_p));
}

export interface PinnedConsole extends WorldConsole {
  /** World position of the top-centre of the panel. Change it freely; `pin()` applies it. */
  readonly top: { x: number; y: number; z: number };
  /** Re-apply `top` for the current growth factor — call every frame while the console is on screen. */
  pin(): void;
}

export interface ConsoleOptions {
  name: string;
  /** Panel width, px-eq. */
  width: number;
  /** World units per px-eq at growth 1. Choose it so that `grow` stays 1 in the step's default shot. */
  unit: number;
  title?: string;
  /** Turn toward the camera (default) or keep the authored orientation (flat diagrams beside a model). */
  billboard?: boolean;
  children: readonly UiNode[];
  top: readonly [number, number, number];
  /**
   * The dock shows the same information (a readout). On narrow / portrait layouts the scene is small and a
   * console would have to grow over it to stay legible, so a console with a twin steps aside there. Its
   * parent group — not the surface itself — must be what the stage shows and hides.
   */
  twin?: boolean;
}

export function createConsole(ctx: ChapterContext, opts: ConsoleOptions): PinnedConsole {
  const console3d = worldConsole(ctx, {
    name: opts.name,
    title: opts.title,
    width: opts.width,
    unit: opts.unit,
    billboard: opts.billboard ?? true,
    children: opts.children,
  });
  const top = { x: opts.top[0], y: opts.top[1], z: opts.top[2] };
  const pinned: PinnedConsole = Object.assign(console3d, {
    top,
    pin(): void {
      if (opts.twin) console3d.surface.visible = ctx.hud.metrics.layout === 'wide';
      const surface = console3d.surface;
      surface.position.set(top.x, top.y - TOP * surface.scale.y, top.z);
      keepInFrame(ctx.camera.camera, surface, Math.max(opts.width, console3d.panel.bw) / 2);
    },
  });
  pinned.pin();
  // growth of every console, for the QA sheet: `__app.read('consoles')` → { name: { grow, textPx } }
  consoles.set(opts.name, console3d);
  ctx.qa.expose('consoles', () =>
    Object.fromEntries(
      [...consoles].map(([name, c]) => [name, { grow: round(c.grow), textPx: round(c.textPx) }]),
    ),
  );
  ctx.onDispose(() => consoles.delete(opts.name));
  return pinned;
}

const consoles = new Map<string, WorldConsole>();
const round = (v: number): number | null => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
