/**
 * `@/hud-dom` — the interface as 2D HTML/CSS over the canvas (DECISIONS §59, design in docs/HUD_DOM.md).
 *
 * Loaded by the HUD plugin under `?hud=dom` (`flags.hud`, default `DEFAULT_HUD`). Hybrid until the cut-over
 * (D9): each area below mounts the regions it has ported and claims them; every other region is still drawn by
 * the WebGL HUD. The core (`core/`) owns the layer root, tokens, fonts, icons, rich text, motion, region
 * insets and the `__ui` DOM backend; every area owns one directory, so the packages D2–D7 never share files.
 */
import type { Hud } from '@/hud/shell';
import { setUiDomBackend } from '@/hud/debug';
import { uiFocus } from '@/ui3d';
import { mount as annotations } from './annotations';
import { mount as board } from './board';
import { mount as charts } from './charts';
import { mount as chrome } from './chrome';
import type { DomHud, WebglParts } from './core/context';
import { loadWebFonts } from './core/fonts';
import { initMotion } from './core/motion';
import { domBackend } from './core/qa';
import { createDomHud } from './core/regions';
import { mount as custom } from './custom';
import { mount as dock } from './dock';
import { mount as map } from './map';
import { mount as overlays } from './overlays';
import { mount as step } from './step';
import { mount as touch } from './touch';
import './core/base.css';

export type { DomHud, DomLayer, RegionName, RegionOptions, WebglParts } from './core/context';

/** Areas in mount order (the order of their regions in each layer = document and Tab order). */
const AREAS: readonly ((dom: DomHud) => void)[] = [
  step,
  chrome,
  dock,
  board,
  charts,
  custom,
  annotations,
  overlays,
  map,
  touch,
];

/** Mount the DOM interface over the canvas (once). */
export function mountDomHud(hud: Hud, webgl: WebglParts): DomHud {
  const dom = createDomHud(hud, webgl);
  initMotion(hud.engine, hud.host.tweens);
  // Tab walks the DOM controls (the browser's focus order); world surfaces keep focus only after a click
  uiFocus.browserTab = true;
  // no flash of fallback text: the layer shows once the first-screen faces are in (`__app.settled` waits too)
  dom.root.hidden = true;
  void loadWebFonts()
    .catch((e: unknown) => console.warn('hud-dom: web fonts did not load', e))
    .then(() => (dom.root.hidden = false));
  setUiDomBackend(domBackend(hud, dom.root));
  for (const area of AREAS) area(dom);
  return dom;
}
