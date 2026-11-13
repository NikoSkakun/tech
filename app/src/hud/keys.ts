/**
 * Input plumbing the WebGL UI needs: key capture (a focused control or an open overlay takes keys before the
 * engine's step navigation sees them) and the pointer position for the HUD's subtle parallax.
 */
import { uiFocus } from '@/ui3d';
import type { Hud } from './shell';

/** Lets the open full-screen view / overlay handle a key first; return true when consumed. */
export type KeyHandler = (e: KeyboardEvent) => boolean;

/**
 * Takes keys through the engine's key-capture hook at priority 100 (above chapters' default 0). The engine skips
 * DOM text fields, calls `preventDefault()` on a consumed key and then emits no step action.
 */
export function installKeys(hud: Hud, overlayKey: KeyHandler): () => void {
  return hud.engine.input.captureKeys(
    (e) => {
      // overlays first (the map travels with the arrows, the glossary types into its filter) …
      let used = hud.overlay !== null && overlayKey(e);
      // … then the focused control (a slider takes ←/→ away from step navigation)
      // (Esc belongs to an open overlay: it must close it even while one of its controls has focus)
      if (!used && !(e.code === 'Escape' && hud.overlay !== null)) used = uiFocus.handleKey(e);
      // while a view covers the scene, step keys must not move the chapter underneath
      if (!used && hud.overlay !== null && /^(Arrow|Page|Space|Home|End)/.test(e.code)) used = true;
      return used;
    },
    { priority: 100 },
  );
}

/**
 * Pointer parallax: the whole HUD plane leans a fraction of a degree toward the pointer, so panels at
 * different depths shift against each other (STYLE_GUIDE §6). Off with reduced motion.
 */
export function installParallax(hud: Hud): void {
  const target = { x: 0, y: 0 };
  const canvas = hud.engine.canvas;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    target.x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
    target.y = ((e.clientY - r.top) / Math.max(r.height, 1)) * 2 - 1;
  });
  canvas.addEventListener('pointerleave', () => {
    target.x = target.y = 0;
  });
  const MAX = 0.012; // radians
  hud.engine.onUpdate((dt) => {
    const s = hud.surface;
    const on = !hud.engine.reducedMotion;
    const k = 1 - Math.exp(-5 * dt);
    s.rotation.y += ((on ? target.x * MAX : 0) - s.rotation.y) * k;
    s.rotation.x += ((on ? target.y * MAX * 0.7 : 0) - s.rotation.x) * k;
  });
}
