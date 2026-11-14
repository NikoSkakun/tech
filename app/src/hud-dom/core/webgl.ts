/**
 * Hybrid helpers (until the cut-over, HUD_DOM §16): find a node of the WebGL HUD and its CSS-px rectangle, for
 * DOM regions that still sit inside or next to a WebGL region (e.g. the step panel over the WebGL dock).
 */
import { Vector3 } from 'three';
import type { Hud } from '@/hud/shell';
import type { UiNode } from '@/ui3d';

/** First node named `name` under `root` (depth-first). */
export function findNode(root: UiNode, name: string): UiNode | undefined {
  let hit: UiNode | undefined;
  root.walk((n) => {
    if (!hit && n.name === name) hit = n;
  });
  return hit;
}

const _v = new Vector3();

/** CSS-px rectangle of a WebGL HUD node (top-left + size), from its world matrix — as `__ui.locate` does. */
export function nodeRect(hud: Hud, n: UiNode): { x: number; y: number; w: number; h: number } {
  const m = hud.metrics;
  const w = n.world;
  _v.set(w[3]!, w[7]!, w[11]!).applyMatrix4(hud.surface.matrixWorld).project(hud.engine.hud.camera);
  const cx = (_v.x * 0.5 + 0.5) * m.cssWidth;
  const cy = (0.5 - _v.y * 0.5) * m.cssHeight;
  const bw = n.bw * Math.abs(w[0]!) * m.pxPerUnit;
  const bh = n.bh * Math.abs(w[5]!) * m.pxPerUnit;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}
