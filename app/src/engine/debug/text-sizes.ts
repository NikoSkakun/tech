/**
 * On-screen size of world `Text3D` (M3, for `chapter-check`): 1 em projected with the matrix the text was
 * last drawn with (billboard / screenSpace texts rewrite `matrixWorld` in `onBeforeRender`, so call this
 * right after a rendered frame). Reported in px-equivalent (px at 1080p, STYLE_GUIDE §6).
 *
 * Not covered: ui3d surfaces (they batch their own glyphs) — those report through `window.__ui` if the HUD
 * offers a hook.
 */
import { Vector3, type Camera, type Object3D } from 'three';
import type { Text3D } from '@/text';

export interface TextSize {
  /** First characters of the text (for the report). */
  text: string;
  /** 1 em on screen in CSS px. */
  px: number;
  /** The same in px-equivalent (px at 1080p). */
  pxEq: number;
  /**
   * Drawing-buffer pixels per em ÷ atlas pixels per em: how far the SDF glyphs are magnified. Above ≈ 4 the
   * single-channel SDF rounds glyph corners visibly (4K close-ups of world text).
   */
  magnification: number;
  screenSpace: boolean;
  /** Object name path (closest named ancestors), to find the text in code. */
  path: string;
}

const _a = new Vector3();
const _b = new Vector3();

function shownInTree(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

function namePath(o: Object3D): string {
  const names: string[] = [];
  for (let p: Object3D | null = o; p && names.length < 3; p = p.parent) if (p.name) names.push(p.name);
  return names.reverse().join('/');
}

function toScreen(v: Vector3, camera: Camera, w: number, h: number): { x: number; y: number; ok: boolean } {
  const front = v.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  v.project(camera);
  return {
    x: (v.x / 2 + 0.5) * w,
    y: (0.5 - v.y / 2) * h,
    ok: front && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1,
  };
}

/** Sizes of every visible, non-empty `Text3D` under `root` whose centre is on screen. */
export function measureTexts(
  root: Object3D,
  camera: Camera,
  width: number,
  height: number,
  pixelRatio = 1,
  atlasEm = 48,
): TextSize[] {
  const out: TextSize[] = [];
  root.traverseVisible((o) => {
    const t = o as Partial<Text3D> & Object3D;
    if (t.isText3D !== true) return;
    const text = (t.text ?? '').trim();
    if (!text || (t.opacity ?? 1) * (t.fade ?? 1) < 0.05 || !shownInTree(o)) return;
    const m = t.metrics!;
    if (m.width <= 0) return;
    const cx = (m.left + m.right) / 2;
    const cy = (m.top + m.bottom) / 2;
    const em = t.fontSize ?? 1;
    // matrixWorld as last drawn (see file comment)
    _a.set(cx, cy, 0).applyMatrix4(o.matrixWorld);
    _b.set(cx, cy + em, 0).applyMatrix4(o.matrixWorld);
    const a = toScreen(_a, camera, width, height);
    const b = toScreen(_b, camera, width, height);
    if (!a.ok) return;
    const px = Math.hypot(b.x - a.x, b.y - a.y);
    out.push({
      text: text.slice(0, 40),
      px,
      pxEq: (px * 1080) / height,
      magnification: (px * pixelRatio) / atlasEm,
      screenSpace: t.screenSpace === true,
      path: namePath(o),
    });
  });
  return out;
}
