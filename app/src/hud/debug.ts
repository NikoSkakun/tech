/**
 * QA hook `window.__ui` (inert unless called; used by `tools/qa/ui-check.mjs`, chapter-check and chapter tests):
 * locate named UI elements in CSS pixels, read control values, list interactive targets with their hit sizes,
 * toggle the HUD for cost measurements. A facade over two backends (docs/HUD_DOM.md §12): the DOM interface
 * (`@/hud-dom`, registered with `setUiDomBackend` under `?hud=dom`) answers first, the WebGL HUD
 * (`debug-gl.ts`) for everything the DOM does not draw — so a half-ported interface answers every name.
 */
import { Vector3 } from 'three';
import { onUiSound, uiSurfaces, type UiNode } from '@/ui3d';
import type { OverlayName } from './context';
import { glBackend } from './debug-gl';
import {
  CHROME_REGIONS,
  type ChromeRegion,
  type OffscreenNode,
  type UiBackend,
  type UiBox,
  type UiOverlap,
  type UiTextSize,
} from './debug-types';
import type { SheetSnap } from './touch/geometry';
import type { SheetTab } from './touch/sheet';
import type { JourneyMap } from './map/map';
import type { Hud } from './shell';
import { bindingOf, notifyChange, specOf } from './step-ui';

export type { OffscreenNode, UiBackend, UiBox, UiOverlap, UiTextSize, ChromeRegion } from './debug-types';

export interface UiDebug {
  /** Centre and size (CSS px) of the first visible element / node with this name, or null. */
  locate(name: string): UiBox | null;
  /** Names of all visible named elements / nodes. */
  names(): string[];
  overlay(): string | null;
  /** Open / close a full-screen view or modal (`library`, `map`, `home`, `glossary`, `settings`, `help`). */
  open(name: OverlayName, arg?: unknown): void;
  close(): void;
  /** Value of a step control of the chapter on screen; `reading-level` = the reading level in effect. */
  value(id: string): number | boolean | string | undefined;
  /**
   * Interactive targets smaller than 44 px-eq in either direction. With `minCssPx` (F5, touch profiles) the
   * size is judged in real CSS px instead, as the pointer sees it on this device.
   */
  smallTargets(minCssPx?: number): string[];
  /** Visible text drawn smaller than `minCssPx` (default 14) real CSS px: `"<node>: <px> «text»"` (F5). */
  smallText(minCssPx?: number): string[];
  /** Every visible piece of interface text: size in HUD units (px-eq) and real CSS px (D1). */
  textSizes(): UiTextSize[];
  /** Pairs of chrome regions (header, spine, system, column, board, navigator, sheet) whose boxes intersect. */
  overlaps(): UiOverlap[];
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
   * Interactive targets on screen whose hit target leaves the viewport (or, with `clipped`, is cut by a scroll
   * view it lives in). Empty = every control is reachable. Boxes in CSS px (centre + size).
   */
  offscreen(opts?: { clipped?: boolean; partial?: boolean; margin?: number }): OffscreenNode[];
  /** Press a step button of the chapter on screen by control id (same as `ui.press`). */
  press(id: string): void;
  /** Set a step control by id; `notify` runs its change handlers like a user gesture (same as `ui.set`). */
  set(id: string, value: number | boolean | string, notify?: boolean): void;
}

declare global {
  interface Window {
    __ui?: UiDebug;
  }
}

let dom: (UiBackend & { setVisible(on: boolean): void }) | null = null;

/** The DOM interface registers its backend here when it mounts (`@/hud-dom`); null removes it. */
export function setUiDomBackend(backend: (UiBackend & { setVisible(on: boolean): void }) | null): void {
  dom = backend;
}

/** WebGL nodes of the chrome regions (for `overlaps`), supplied by the HUD plugin. */
export type ChromeNodes = () => Partial<Record<ChromeRegion, UiNode | null>>;

const _v = new Vector3();
const _w = new Vector3();

/** Intersection of two centre + size boxes (null when they only touch or are apart). */
function intersect(a: UiBox, b: UiBox): { w: number; h: number } | null {
  const w = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const h = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return w > 0.5 && h > 0.5 ? { w, h } : null;
}

export function installUiDebug(hud: Hud, map: () => JourneyMap | null, chrome: ChromeNodes = () => ({})): void {
  const gl = glBackend(hud, chrome);
  /** DOM first, WebGL for what the DOM does not draw; lists merge both. */
  const both = <T>(fn: (b: UiBackend) => T[]): T[] => [...(dom ? fn(dom) : []), ...fn(gl)];
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
    locate: (name) => dom?.locate(name) ?? gl.locate(name),
    names: () => [...new Set(both((b) => b.names()))],
    overlay: () => hud.overlay,
    open: (name, arg) => hud.open(name, arg),
    close: () => void hud.close(),
    value: (id) => (id === 'reading-level' ? hud.engine.readingLevel() : binding()?.values.get(id)),
    smallTargets: (minCssPx) => both((b) => b.smallTargets(minCssPx)),
    smallText: (minCssPx = 14) => both((b) => b.smallText(minCssPx)),
    textSizes: () => both((b) => b.textSizes()),
    overlaps() {
      const boxes: [ChromeRegion, UiBox][] = [];
      for (const name of CHROME_REGIONS) {
        const box = dom?.region(name) ?? gl.region(name);
        if (box) boxes.push([name, box]);
      }
      const out: UiOverlap[] = [];
      boxes.forEach(([a, ba], i) => {
        for (const [b, bb] of boxes.slice(i + 1)) {
          const cut = intersect(ba, bb);
          if (cut) out.push({ a, b, ...cut });
        }
      });
      return out;
    },
    sheet() {
      const s = hud.touch.sheet;
      if (!s || hud.metrics.shell === 'desk') return null;
      const tabs: SheetTab[] = ['text'];
      if (window.__ui?.locate('sheet-tabs:controls')) tabs.push('controls');
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
      dom?.setVisible(on);
    },
    offscreen: (opts = {}) => both((b) => b.offscreen(opts)),
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
