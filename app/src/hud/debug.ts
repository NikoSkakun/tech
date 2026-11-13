/**
 * QA hook `window.__ui` (inert unless called; used by `tools/qa/ui-check.mjs`): locate named UI nodes in CSS
 * pixels, read control values, list interactive nodes with their hit sizes, toggle the HUD for cost measurements.
 */
import { Vector3 } from 'three';
import type { UiNode } from '@/ui3d';
import type { OverlayName } from './context';
import type { JourneyMap } from './map/map';
import type { Hud } from './shell';
import { bindingOf, notifyChange, specOf } from './step-ui';

export interface UiDebug {
  /** Centre and size (CSS px) of the first visible node with this name, or null. */
  locate(name: string): { x: number; y: number; w: number; h: number } | null;
  /** Names of all visible named nodes. */
  names(): string[];
  overlay(): string | null;
  /** Open / close a full-screen view or modal (`library`, `map`, `home`, `glossary`, `settings`, `help`). */
  open(name: OverlayName, arg?: unknown): void;
  close(): void;
  /** Value of a step control of the chapter on screen; `reading-level` = the reading level in effect. */
  value(id: string): number | boolean | string | undefined;
  /** Interactive nodes whose pointer target is smaller than 44 px-eq in either direction. */
  smallTargets(): string[];
  /** CSS px of a chapter's node on the journey map. */
  mapNode(chapterId: string): { x: number; y: number } | null;
  /** Show / hide everything the HUD draws (cost measurements). */
  setVisible(on: boolean): void;
  /**
   * Interactive nodes on screen whose hit target leaves the viewport (or, with `clipped`, is cut by a scroll
   * view it lives in). Empty = every control is reachable. Boxes in CSS px (centre + size).
   */
  offscreen(opts?: { clipped?: boolean; margin?: number }): OffscreenNode[];
  /** Press a step button of the chapter on screen by control id (same as `ui.press`). */
  press(id: string): void;
  /** Set a step control by id; `notify` runs its change handlers like a user gesture (same as `ui.set`). */
  set(id: string, value: number | boolean | string, notify?: boolean): void;
}

export interface OffscreenNode {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  reason: 'viewport' | 'clipped';
}

declare global {
  interface Window {
    __ui?: UiDebug;
  }
}

const _v = new Vector3();

export function installUiDebug(hud: Hud, map: () => JourneyMap | null): void {
  const toCss = (x: number, y: number, z: number): { x: number; y: number } => {
    const m = hud.metrics;
    _v.set(x, y, z).applyMatrix4(hud.surface.matrixWorld).project(hud.engine.hud.camera);
    return { x: (_v.x * 0.5 + 0.5) * m.cssWidth, y: (0.5 - _v.y * 0.5) * m.cssHeight };
  };
  /** Drawn right now: a hidden ancestor (a closed overlay keeps its nodes) hides the node whatever it cached. */
  const shown = (n: UiNode): boolean => {
    if (n.slot < 0 || n.worldOpacity <= 0.5) return false;
    for (let p: UiNode | null = n; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  /** CSS box of a node (centre + size), from its world matrix. */
  const box = (n: UiNode, hit = 0): { x: number; y: number; w: number; h: number } => {
    const w = n.world;
    const c = toCss(w[3]!, w[7]!, w[11]!);
    const k = hud.metrics.pxPerUnit;
    return {
      x: c.x,
      y: c.y,
      w: Math.max(n.bw, hit) * Math.abs(w[0]!) * k,
      h: Math.max(n.bh, hit) * Math.abs(w[5]!) * k,
    };
  };
  const binding = () => {
    const s = hud.engine.store.get();
    return s.chapterId ? bindingOf(`${s.volumeId}/${s.chapterId}`) : undefined;
  };
  window.__ui = {
    locate(name) {
      let hit: UiNode | null = null;
      hud.surface.root.walk((n) => {
        if (!hit && n.name === name && shown(n)) hit = n;
      });
      if (!hit) return null;
      const n = hit as UiNode;
      const w = n.world;
      const c = toCss(w[3]!, w[7]!, w[11]!);
      const k = hud.metrics.pxPerUnit;
      return { x: c.x, y: c.y, w: n.bw * Math.abs(w[0]!) * k, h: n.bh * Math.abs(w[5]!) * k };
    },
    names() {
      const out: string[] = [];
      hud.surface.root.walk((n) => {
        if (n.name && shown(n)) out.push(n.name);
      });
      return out;
    },
    overlay: () => hud.overlay,
    open: (name, arg) => hud.open(name, arg),
    close: () => void hud.close(),
    value: (id) => (id === 'reading-level' ? hud.engine.readingLevel() : binding()?.values.get(id)),
    smallTargets() {
      const out: string[] = [];
      hud.surface.root.walk((n) => {
        if (
          !n.handlers?.click ||
          !shown(n) ||
          !n.interactive ||
          (n as { clickable?: boolean }).clickable === false
        )
          return;
        const w = Math.max(n.bw, n.minHit);
        const h = Math.max(n.bh, n.minHit);
        if (w < 43.5 || h < 43.5)
          out.push(`${n.constructor.name}:${n.name || '?'} ${w.toFixed(0)}x${h.toFixed(0)}`);
      });
      return out;
    },
    mapNode(chapterId) {
      const m = map();
      const node = m?.layout.byId(chapterId);
      if (!m || !node) return null;
      const out = { x: 0, y: 0, visible: false, scale: 1 };
      m.camera.project(node.x, node.y + node.radius * 0.4, node.z, out);
      const k = hud.metrics;
      return { x: out.x * k.pxPerUnit + k.cssWidth / 2, y: k.cssHeight / 2 - out.y * k.pxPerUnit };
    },
    setVisible(on) {
      hud.surface.visible = on;
    },
    offscreen(opts = {}) {
      const m = hud.metrics;
      const margin = opts.margin ?? 0;
      const out: OffscreenNode[] = [];
      const visit = (n: UiNode, clips: UiNode[], owner: string): void => {
        if (!n.visible) return;
        const inner = n.clip ? [...clips, n] : clips;
        const target =
          n.interactive && !!n.handlers?.click && (n as { clickable?: boolean }).clickable !== false;
        if (target && shown(n) && !(n as { disabled?: boolean }).disabled) {
          // judge the part of the box its scroll views leave visible: scrolled out of a scroll view is not
          // off-screen (the user scrolls to it), but a visible part outside the viewport is
          const b = box(n);
          // a slider's track or a tab segment reports the named control it belongs to
          const name = n.name || (owner ? `${owner}>${n.constructor.name}` : `${n.constructor.name}?`);
          let y0 = b.y - b.h / 2;
          let y1 = b.y + b.h / 2;
          for (const c of clips) {
            const cb = box(c);
            y0 = Math.max(y0, cb.y - cb.h / 2);
            y1 = Math.min(y1, cb.y + cb.h / 2);
          }
          if (y1 - y0 < 1) {
            if (opts.clipped) out.push({ name, ...b, reason: 'clipped' });
          } else if (
            b.x - b.w / 2 < -margin ||
            b.x + b.w / 2 > m.cssWidth + margin ||
            y0 < -margin ||
            y1 > m.cssHeight + margin
          )
            out.push({ name, ...b, reason: 'viewport' });
        }
        for (const ch of n.children) visit(ch, inner, n.name || owner);
      };
      visit(hud.surface.root, [], '');
      return out;
    },
    press(id) {
      const b = binding();
      const spec = b ? specOf(b, id) : undefined;
      if (!b || spec?.type !== 'button') throw new Error(`__ui.press: no button '${id}'`);
      b.flash?.(id);
      spec.onClick();
    },
    set(id, value, notify = false) {
      const b = binding();
      if (!b) return;
      b.values.set(id, value);
      b.push?.(id, value);
      if (notify) notifyChange(b, id, value);
    },
  };
}
