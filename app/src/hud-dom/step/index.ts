/**
 * Area `step` of the DOM interface (docs/HUD_DOM.md §16): header, step panel (sections, «Див. також»,
 * reading-level switch) and step navigator. D1 moved the D0 spike's three regions here on the new core
 * (direct rectangle insets); D2 completes them.
 */
import type { DomHud } from '../core/context';
import { setClass, setStyle } from '../core/dom';
import { findNode, nodeRect } from '../core/webgl';
import { createDomHeader } from './header';
import { createDomNavigator } from './navigator';
import { createDomStepPanel } from './step-panel';
import './step.css';

export function mount(dom: DomHud): void {
  const { hud, webgl } = dom;
  const header = createDomHeader(hud);
  const panel = createDomStepPanel(hud, webgl.column);
  const navigator = createDomNavigator(hud);

  dom.claim('header');
  // D2: the WebGL header stays in the layout at opacity 0 — the column and the board are placed under it
  webgl.header.opacity = 0;
  dom.region({ el: header.el, onChapter: (m) => header.onChapter(m) }, { inset: { side: 'top', extra: 8 }, region: 'header' });

  dom.claim('step-panel');
  dom.region({
    el: panel.el,
    onContent: (c) => panel.onContent(c),
    onChapter: (m) => panel.onChapter(m),
    onStep: (id, instant) => panel.onStep(id, instant),
    update: () => {
      // D2: spike shortcut — the DOM panel takes the box of the transparent WebGL panel (the WebGL dock stays
      // under it) and mirrors its honesty chips; D2 gives the column a CSS layout and a view model of its own
      const gl = findNode(webgl.column, 'step-panel');
      if (!gl) return;
      gl.opacity = 0;
      const r = nodeRect(hud, gl);
      setStyle(panel.el, 'left', `${r.x.toFixed(1)}px`);
      setStyle(panel.el, 'top', `${r.y.toFixed(1)}px`);
      setStyle(panel.el, 'width', `${r.w.toFixed(1)}px`);
      setStyle(panel.el, 'max-height', `${r.h.toFixed(1)}px`);
      setClass(panel.el, 'off', !gl.visible);
      panel.syncBadges(gl.children[2]);
    },
  });

  dom.claim('navigator');
  webgl.navigator.visible = false;
  dom.region(
    {
      el: navigator.el,
      onChapter: (m) => navigator.onChapter(m),
      onStep: () => navigator.sync(),
      onLayout: (m) => {
        // centred in the area the step column leaves free on wide screens (as hud/navigator.ts)
        // D2: reads last layout's inset; the WebGL navigator computes it from the column node
        const shift = m.layout === 'wide' ? -(hud.engine.hud.insetFractions().right * m.cssWidth) / 2 : 0;
        setStyle(navigator.el, '--shift', `${shift.toFixed(1)}px`);
      },
    },
    { inset: { side: 'bottom', extra: 8 }, region: 'navigator' },
  );
}
