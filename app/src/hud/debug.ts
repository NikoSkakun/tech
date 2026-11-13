/**
 * QA hook `window.__ui` (inert unless called; used by `tools/qa/ui-check.mjs`): locate named UI nodes in CSS
 * pixels, read control values, list interactive nodes with their hit sizes, toggle the HUD for cost measurements.
 */
import { Vector3 } from 'three';
import { onUiSound, uiPointer, uiSurfaces, type UiNode } from '@/ui3d';
import type { OverlayName } from './context';
import type { SheetSnap } from './touch/geometry';
import type { SheetTab } from './touch/sheet';
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
  /**
   * Interactive nodes whose pointer target is smaller than 44 px-eq in either direction. With `minCssPx` (F5,
   * touch profiles) the size is judged in real CSS px instead, as the pointer sees it on this device.
   */
  smallTargets(minCssPx?: number): string[];
  /** Visible text drawn smaller than `minCssPx` (default 14) real CSS px: `"<node>: <px> «text»"` (F5). */
  smallText(minCssPx?: number): string[];
  /**
   * Controls the step on screen declares (`stepUi`): id, type and where they live (F5; `mobile-check` picks a
   * slider and a button to operate by touch from this list).
   */
  controls(): { id: string; type: string; where: 'dock' | 'board' }[];
  /** UI feedback sounds since boot by name (`tap`, `slide`, `toggleOn`…): proof that a control was activated. */
  sounds(): Record<string, number>;
  /**
   * On-screen size of the text on ui3d surfaces placed in the world (`worldSurface`, `worldConsole`): one entry
   * per visible label, 1 em in CSS px (F5). The engine's `__app.textSizes()` covers `Text3D` only.
   */
  surfaceTextSizes(): { text: string; px: number; surface: string }[];
  /** Touch shells (F5): the sheet's state — null on desktops. */
  sheet(): { shell: string; snap: SheetSnap; tab: SheetTab; tabs: SheetTab[] } | null;
  /** Touch shells: move the sheet to a snap height and / or show a tab, as the user would. */
  setSheet(state: { snap?: SheetSnap; tab?: SheetTab }): void;
  /** CSS px of a chapter's node on the journey map. */
  mapNode(chapterId: string): { x: number; y: number } | null;
  /** Show / hide everything the HUD draws (cost measurements). */
  setVisible(on: boolean): void;
  /**
   * Interactive nodes on screen whose hit target leaves the viewport (or, with `clipped`, is cut by a scroll
   * view it lives in). Empty = every control is reachable. Boxes in CSS px (centre + size).
   */
  offscreen(opts?: { clipped?: boolean; partial?: boolean; margin?: number }): OffscreenNode[];
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
const _w = new Vector3();

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
  const sounds: Record<string, number> = {};
  onUiSound((name) => {
    sounds[name] = (sounds[name] ?? 0) + 1;
  });
  window.__ui = {
    controls() {
      const s = hud.engine.store.get();
      const spec = s.stepId ? binding()?.specs.get(s.stepId) : undefined;
      return [
        ...(spec?.controls ?? []).map((c) => ({ id: c.id, type: c.type, where: 'dock' as const })),
        ...(spec?.board?.children ?? []).map((c) => ({ id: c.id, type: c.type, where: 'board' as const })),
      ];
    },
    sounds: () => ({ ...sounds }),
    surfaceTextSizes() {
      const out: { text: string; px: number; surface: string }[] = [];
      const camera = hud.engine.runtime.director?.camera;
      if (!camera) return out;
      const m = hud.metrics;
      const css = (v: Vector3): { x: number; y: number } => ({ x: (v.x * 0.5 + 0.5) * m.cssWidth, y: (0.5 - v.y * 0.5) * m.cssHeight });
      for (const surface of uiSurfaces) {
        if (surface.host.layer !== 'world' || !surface.parent) continue;
        let seen = true;
        for (let o: typeof surface.parent | null = surface; seen && o; o = o.parent) seen = o.visible;
        if (!seen) continue;
        surface.root.walk((n) => {
          const label = n as UiNode & { style?: { size?: number }; text?: unknown };
          if (typeof label.text !== 'string' || label.text === '' || !label.style) return;
          if (n.slot < 0 || n.worldOpacity <= 0.5) return;
          for (let p: UiNode | null = n; p; p = p.parent) if (!p.visible) return;
          // one surface unit at the label, projected with this frame's world camera
          const w = n.world;
          const a = _v.set(w[3]!, w[7]!, w[11]!).applyMatrix4(surface.matrixWorld).project(camera);
          if (a.z > 1 || Math.abs(a.x) > 1 || Math.abs(a.y) > 1) return; // behind the camera or off screen
          const pa = css(a);
          const b = _w.set(w[3]!, w[7]! + Math.abs(w[5]!), w[11]!).applyMatrix4(surface.matrixWorld).project(camera);
          const pb = css(b);
          const px = Math.hypot(pb.x - pa.x, pb.y - pa.y) * (label.style.size ?? 19);
          out.push({ text: label.text.slice(0, 28), px, surface: surface.name });
        });
      }
      return out;
    },
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
    smallTargets(minCssPx) {
      const out: string[] = [];
      const k = hud.metrics.pxPerUnit;
      hud.surface.root.walk((n) => {
        if (
          !n.handlers?.click ||
          !shown(n) ||
          !n.interactive ||
          (n as { clickable?: boolean }).clickable === false
        )
          return;
        // the same rule as the pick test (`UiSurface.hitTest`): the kit minimum, raised on touch devices
        const min = n.minHit > 0 && uiPointer.minHitPx > 0 ? Math.max(n.minHit, uiPointer.minHitPx / k) : n.minHit;
        let w = Math.max(n.bw, min);
        let h = Math.max(n.bh, min);
        let limit = 43.5;
        if (minCssPx !== undefined) {
          w *= Math.abs(n.world[0]!) * k;
          h *= Math.abs(n.world[5]!) * k;
          limit = minCssPx - 0.5;
        }
        if (w < limit || h < limit)
          out.push(`${n.constructor.name}:${n.name || '?'} ${w.toFixed(0)}x${h.toFixed(0)}`);
      });
      return out;
    },
    smallText(minCssPx = 14) {
      const out: string[] = [];
      const k = hud.metrics.pxPerUnit;
      hud.surface.root.walk((n) => {
        const label = n as UiNode & { style?: { size?: number }; text?: unknown };
        if (typeof label.text !== 'string' || label.text === '' || !label.style || !shown(n)) return;
        const px = (label.style.size ?? 19) * Math.abs(n.world[5]!) * k;
        if (px < minCssPx - 0.05) out.push(`${n.name || n.parent?.name || '?'}: ${px.toFixed(1)} «${label.text.slice(0, 24)}»`);
      });
      return out;
    },
    sheet() {
      const s = hud.touch.sheet;
      if (!s || hud.metrics.shell === 'desk') return null;
      const tabs: SheetTab[] = ['text'];
      if (hud.surface.root && window.__ui?.locate('sheet-tabs:controls')) tabs.push('controls');
      if (window.__ui?.locate('sheet-tabs:board')) tabs.push('board');
      return { shell: hud.metrics.shell, snap: s.snap, tab: s.tab, tabs };
    },
    setSheet(state) {
      const s = hud.touch.sheet;
      if (!s) return;
      if (state.tab) s.setTab(state.tab);
      if (state.snap) s.setSnap(state.snap);
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
          // `partial`: a target cut by its scroll view counts as clipped too (a tap at its centre may miss it)
          if (y1 - y0 < (opts.partial ? b.h - 1 : 1)) {
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
