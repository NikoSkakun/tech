/**
 * WebGL backend of the QA hook `window.__ui` (`debug.ts`): named nodes of the HUD surface, measured from their
 * world matrices in CSS px. Answers for everything the WebGL HUD draws (all of it under `?hud=gl`).
 */
import { Vector3 } from 'three';
import { uiPointer, type UiNode } from '@/ui3d';
import type { ChromeRegion, OffscreenNode, UiBackend, UiBox, UiTextSize } from './debug-types';
import type { Hud } from './shell';

type LabelLike = UiNode & { style?: { size?: number }; text?: unknown };

const _v = new Vector3();

export function glBackend(hud: Hud, regions: () => Partial<Record<ChromeRegion, UiNode | null>>): UiBackend {
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
  const box = (n: UiNode, hit = 0): UiBox => {
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
  /** Visible labels of the HUD surface with their size in units and CSS px. */
  const labels = (): UiTextSize[] => {
    const out: UiTextSize[] = [];
    const k = hud.metrics.pxPerUnit;
    hud.surface.root.walk((n) => {
      const label = n as LabelLike;
      if (typeof label.text !== 'string' || label.text === '' || !label.style || !shown(n)) return;
      const units = (label.style.size ?? 19) * Math.abs(n.world[5]!);
      const name = n.name || n.parent?.name || '?';
      out.push({ name, text: label.text.slice(0, 24), units, px: units * k });
    });
    return out;
  };

  return {
    locate(name) {
      let hit: UiNode | null = null;
      hud.surface.root.walk((n) => {
        if (!hit && n.name === name && shown(n)) hit = n;
      });
      return hit ? box(hit) : null;
    },
    names() {
      const out: string[] = [];
      hud.surface.root.walk((n) => {
        if (n.name && shown(n)) out.push(n.name);
      });
      return out;
    },
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
    smallText(minCssPx) {
      return labels()
        .filter((l) => l.px < minCssPx - 0.05)
        .map((l) => `${l.name}: ${l.px.toFixed(1)} «${l.text}»`);
    },
    textSizes: labels,
    region(name) {
      const n = regions()[name];
      return n && shown(n) ? box(n) : null;
    },
    offscreen: (opts) => offscreenNodes(hud, opts, shown, box),
  };
}

function offscreenNodes(
  hud: Hud,
  opts: { clipped?: boolean; partial?: boolean; margin?: number },
  shown: (n: UiNode) => boolean,
  box: (n: UiNode) => UiBox,
): OffscreenNode[] {
  const m = hud.metrics;
  const margin = opts.margin ?? 0;
  const out: OffscreenNode[] = [];
  const visit = (n: UiNode, clips: UiNode[], owner: string): void => {
    if (!n.visible) return;
    const inner = n.clip ? [...clips, n] : clips;
    const target = n.interactive && !!n.handlers?.click && (n as { clickable?: boolean }).clickable !== false;
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
}
