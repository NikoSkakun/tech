/**
 * Input plumbing the WebGL UI needs: key capture (a focused control or an open overlay takes keys before the
 * engine's step navigation sees them). The interface never follows the pointer (DECISIONS §59 p).
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
