/**
 * Lens mode (F-lens-ring): while the reader looks through the magnifier, empty space belongs to it — a drag sways
 * the camera a few degrees and springs back on release (`sway.ts`), the wheel and a two-finger pinch turn the focus
 * ring (shortcuts for the same value). Outside lens mode nothing here is active and the step's camera works as before.
 *
 * Empty space is an unrendered sphere round the camera (layer 31, seen from inside): every registered object in the
 * scene is nearer, so it only gets what nothing else takes. Pinch: the engine has no chapter hook for it, so the
 * canvas's own touch pointers are followed here (the engine's own pinch zoom is off while the rail owns the camera).
 */
import { BackSide, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import type { ChapterContext, InteractionHandlers } from '@/engine/api';
import type { FocusRing } from '@circuit/shared/stage/tools/focus-ring';
import type { Sway } from './sway';

/** Value per unit of log pinch scale (fingers twice as far apart ≈ half a floor deeper). */
const PINCH = 0.7;
const PICK_ONLY_LAYER = 31;

export interface LensMode {
  /** QA: the sway hand is down. */
  readonly swaying: boolean;
  /** Every frame, after the camera has moved: the sphere follows it. */
  update(): void;
  /**
   * The same drag (sway) and wheel (ring) for a step's own see-through targets that cover the frame (the atoms'
   * proxies of `wire/atoms`): spread into their registration so a drag that starts on one still sways.
   */
  readonly space: Pick<InteractionHandlers, 'dragStart' | 'drag' | 'dragEnd' | 'wheel'>;
}

export function lensMode(
  ctx: ChapterContext,
  o: { active: () => boolean; ring: FocusRing; sway: Sway },
): LensMode {
  const catcher = new Mesh(
    new SphereGeometry(4000, 16, 8),
    new MeshBasicMaterial({ side: BackSide }),
  );
  catcher.name = 'lens-mode:space';
  catcher.layers.set(PICK_ONLY_LAYER);
  catcher.frustumCulled = false;
  ctx.root.add(catcher);
  let swaying = false;
  const space: LensMode['space'] = {
    dragStart: () => {
      if (o.active()) swaying = true;
    },
    drag: (e) => {
      if (swaying) o.sway.hold(e.totalX, e.totalY, ctx.viewport.height);
    },
    dragEnd: () => {
      if (!swaying) return;
      swaying = false;
      o.sway.release();
    },
    wheel: (dy) => {
      if (!o.active()) return false;
      o.ring.nudge(-dy * 0.002);
      return true;
    },
  };
  ctx.input.register(catcher, { cursor: 'grab', enabled: o.active, ...space });

  // two fingers on the canvas: their spread turns the ring
  const canvas = ctx.renderer.domElement;
  const touches = new Map<number, { x: number; y: number }>();
  let spread = 0;
  const distance = (): number => {
    const [a, b] = [...touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const down = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    spread = touches.size === 2 ? distance() : 0;
  };
  const move = (e: PointerEvent): void => {
    const t = touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (touches.size !== 2 || spread <= 0) return;
    const d = distance();
    if (d > 0 && o.active()) o.ring.nudge(Math.log(d / spread) * PINCH);
    spread = d;
  };
  const up = (e: PointerEvent): void => {
    touches.delete(e.pointerId);
    spread = touches.size === 2 ? distance() : 0;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  ctx.onDispose(() => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  });
  return {
    space,
    get swaying() {
      return swaying;
    },
    update() {
      // the sphere's middle is always where the reader stands
      ctx.root.worldToLocal(catcher.position.copy(ctx.camera.camera.position));
      catcher.updateMatrixWorld();
    },
  };
}
