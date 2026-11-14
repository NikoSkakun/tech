/**
 * Keyboard focus and UI sound hooks shared by every surface.
 *
 * Focus: one focusable node at a time. Pointer presses focus silently; the ring only shows after keyboard
 * use (Tab). While a node is focused its `onKey` sees keys first — that is how a focused slider takes the
 * arrow keys away from step navigation. The HUD plugin feeds `handleKey` from a capturing DOM listener.
 *
 * Sound: widgets call `sfx(name)`; the audio plugin subscribes with `onUiSound`. Silent until it does.
 */
import { Emitter, type Unsubscribe } from '@/engine/api';
import type { UiNode } from './node';

export interface Focusable extends UiNode {
  /** Handle a key while focused; return true when consumed. */
  onKey(e: KeyboardEvent): boolean;
  /** Focus gained / lost; `ring` = show the focus ring (keyboard modality). */
  onFocus(focused: boolean, ring: boolean): void;
}

/** Providers of focusable nodes in tab order (surfaces register themselves). */
type Provider = () => Focusable[];

class FocusManager {
  current: Focusable | null = null;
  /**
   * DOM interface (`?hud=dom`, docs/HUD_DOM.md §3): Tab belongs to the browser, which walks the DOM controls.
   * The focus ring here is then limited to world surfaces holding the pointer's last click; Tab leaves them.
   */
  browserTab = false;
  private readonly providers = new Set<Provider>();

  provide(fn: Provider): Unsubscribe {
    this.providers.add(fn);
    return () => this.providers.delete(fn);
  }

  set(node: Focusable | null, ring = false): void {
    if (node === this.current) {
      if (node && ring) node.onFocus(true, true);
      return;
    }
    this.current?.onFocus(false, false);
    this.current = node;
    node?.onFocus(true, ring);
  }

  /** Drop focus if it is on `node` or inside its subtree. */
  release(node: UiNode): void {
    for (let n: UiNode | null = this.current; n; n = n.parent) {
      if (n === node) {
        this.set(null);
        return;
      }
    }
  }

  /** Returns true when the key was consumed by the focus system. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (this.current && !this.current.interactive) this.set(null);
    if (e.code === 'Tab') {
      if (this.browserTab) {
        this.set(null);
        return false;
      }
      const all: Focusable[] = [];
      for (const p of this.providers) all.push(...p());
      if (all.length === 0) return false;
      const i = this.current ? all.indexOf(this.current) : -1;
      const next = all[(i + (e.shiftKey ? -1 : 1) + all.length) % all.length]!;
      this.set(next, true);
      return true;
    }
    if (!this.current) return false;
    if (e.code === 'Escape') {
      this.set(null);
      return true;
    }
    return this.current.onKey(e);
  }
}

export const uiFocus = new FocusManager();

export type UiSound =
  | 'hover'
  | 'tap'
  | 'toggleOn'
  | 'toggleOff'
  | 'slide'
  | 'snap'
  | 'open'
  | 'close'
  | 'page'
  | 'success'
  | 'error'
  | 'hint';

const sounds = new Emitter<{ play: UiSound }>();

/** Sound hook: no-op until the audio plugin subscribes. */
export function sfx(name: UiSound): void {
  sounds.emit('play', name);
}

export function onUiSound(fn: (name: UiSound) => void): Unsubscribe {
  return sounds.on('play', fn);
}
