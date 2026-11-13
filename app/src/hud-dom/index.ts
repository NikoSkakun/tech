/**
 * `@/hud-dom` — the interface as DOM over the canvas (DECISIONS §59, design in docs/HUD_DOM.md).
 *
 * SPIKE (D0): with `?hud=dom` the header, the step panel and the step navigator are DOM; everything else is
 * still the WebGL HUD. The WebGL header and step panel stay in the layout but are transparent (the column and
 * the board are placed relative to them), the WebGL navigator is hidden. Each DOM region is a `HudModule`
 * whose node is an invisible phantom of its box, so the shell reports camera insets from the DOM boxes.
 */
import type { HudMetrics } from '@/engine/api';
import type { Hud } from '@/hud/shell';
import type { UiNode } from '@/ui3d';
import { h, setClass, setStyle } from './dom';
import { loadWebFonts } from './fonts';
import { createDomHeader } from './header';
import { createDomNavigator } from './navigator';
import { DomRegion, nodeRect } from './region';
import { createDomStepPanel } from './step-panel';
import { applyAccent, applyTokens } from './tokens';
import './hud.css';

export interface WebglParts {
  readonly header: UiNode;
  readonly navigator: UiNode;
}

function findNode(root: UiNode, name: string): UiNode | undefined {
  let hit: UiNode | undefined;
  root.walk((n) => {
    if (!hit && n.name === name) hit = n;
  });
  return hit;
}

export function mountDomHud(hud: Hud, webgl: WebglParts): void {
  const root = h('div.kd-root', { id: 'kd-hud', lang: 'uk', 'data-hud': 'dom' });
  applyTokens(root);
  root.hidden = true; // until the web fonts are in: no flash of fallback text
  document.getElementById('app')?.after(root);
  void loadWebFonts().then(() => (root.hidden = false));

  const header = createDomHeader(hud);
  const panel = createDomStepPanel(hud);
  const navigator = createDomNavigator(hud);
  root.append(header.el, panel.el, navigator.el);
  webgl.header.opacity = 0;
  webgl.navigator.visible = false;

  const headerRegion = new DomRegion(hud, header.el);
  const navRegion = new DomRegion(hud, navigator.el);
  let metrics: HudMetrics = hud.metrics;
  let gl: UiNode | undefined;
  const place = (m: HudMetrics): void => {
    metrics = m;
    const k = m.pxPerUnit;
    setStyle(root, '--u', `${k}px`);
    setStyle(root, '--safe', `${m.safeMargin * k}px`);
    setClass(root, 'wide', m.layout === 'wide');
    // centred in the area the step panel leaves free on wide screens (as hud/navigator.ts)
    const shift = m.layout === 'wide' ? -(hud.engine.hud.insetFractions().right * m.cssWidth) / 2 : 0;
    setStyle(navigator.el, '--shift', `${shift.toFixed(1)}px`);
    headerRegion.sync();
    navRegion.sync();
  };

  hud.mount(
    {
      node: headerRegion.node,
      onChapter: (m) => {
        applyAccent(root, m.theme.accent);
        header.onChapter(m);
        panel.onChapter(m);
        navigator.onChapter(m);
      },
      onContent: (c) => panel.onContent(c),
      onStep: (id, instant) => {
        panel.onStep(id, instant);
        navigator.sync();
      },
      onLayout: place,
      update: () => {
        // the chrome's reveal / conceal (transitions, full-screen views) drives the DOM layer too
        const o = hud.chrome.visible ? hud.chrome.opacity : 0;
        setStyle(root, 'opacity', o.toFixed(3));
        setClass(root, 'inert', o < 0.5);
        // spike: the DOM panel takes the box of the transparent WebGL panel (the WebGL dock stays under it)
        gl ??= findNode(hud.surface.root, 'step-panel');
        if (gl) {
          gl.opacity = 0;
          const r = nodeRect(hud, gl);
          setStyle(panel.el, 'left', `${r.x.toFixed(1)}px`);
          setStyle(panel.el, 'top', `${r.y.toFixed(1)}px`);
          setStyle(panel.el, 'width', `${r.w.toFixed(1)}px`);
          setStyle(panel.el, 'max-height', `${r.h.toFixed(1)}px`);
          setClass(panel.el, 'off', !gl.visible);
          panel.syncBadges(gl.children[2]);
        }
        if (metrics.cssWidth !== hud.metrics.cssWidth) place(hud.metrics);
      },
    },
    { side: 'top', extra: 8 },
  );
  hud.mount({ node: navRegion.node }, { side: 'bottom', extra: 8 });
}
