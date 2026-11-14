/**
 * The layer root of the DOM interface (docs/HUD_DOM.md §3, §6): `#kd-hud` with its five layers over the canvas,
 * the region helper (element into a layer + `Hud.mountDom` for direct rectangle insets) and the region claims
 * of the hybrid flag. The chrome and world layers follow `Hud.showChrome` — the very tween of the WebGL chrome
 * (opacity + 1.015 scale on the engine clock), mirrored each frame; below 0.5 opacity a layer is `inert`.
 */
import type { HudMetrics } from '@/engine/api';
import type { Hud } from '@/hud/shell';
import type { UiNode } from '@/ui3d';
import { DOM_LAYERS, type DomHud, type DomLayer, type RegionName, type WebglParts } from './context';
import { h, setClass, setStyle } from './dom';
import { syncMotion } from './motion';
import { applyAccent, applyTokens } from './tokens';

/** Mirror a WebGL chrome node's reveal / conceal state onto a layer. */
function mirror(layer: HTMLElement, node: UiNode): void {
  const o = node.visible ? node.opacity : 0;
  setStyle(layer, 'opacity', o >= 1 ? '' : o.toFixed(3));
  setStyle(layer, 'transform', node.scale === 1 ? '' : `scale(${node.scale.toFixed(4)})`);
  const inert = o < 0.5;
  if (layer.inert !== inert) layer.inert = inert;
}

/** Root-level metrics: unit, safe margin, layout and shell classes. */
function place(root: HTMLElement, m: HudMetrics): void {
  setStyle(root, '--u', `${m.pxPerUnit}px`);
  setStyle(root, '--safe', `${m.safeMargin * m.pxPerUnit}px`);
  setClass(root, 'wide', m.layout === 'wide');
  for (const s of ['desk', 'sheet', 'side'] as const) setClass(root, `kd-shell-${s}`, m.shell === s);
  for (const f of ['phone', 'tablet', 'desktop'] as const) setClass(root, `kd-ff-${f}`, m.formFactor === f);
}

/** Create `#kd-hud` after `#app` and return the core context the areas mount with. */
export function createDomHud(hud: Hud, webgl: WebglParts): DomHud {
  const root = h('div.kd-root', { id: 'kd-hud', lang: 'uk', 'data-hud': 'dom' });
  const layers = {} as Record<DomLayer, HTMLElement>;
  for (const name of DOM_LAYERS) layers[name] = h('div.kd-layer', { 'data-layer': name });
  root.append(...DOM_LAYERS.map((name) => layers[name]));
  applyTokens(root);
  document.getElementById('app')?.after(root);

  // mounted before every DOM region: `--u` is set before the regions are measured in the same layout pass
  hud.mountDom({
    el: root,
    onChapter: (m) => applyAccent(root, m.theme.accent),
    onLayout: (m) => place(root, m),
    update: () => {
      mirror(layers.chrome, hud.chrome);
      mirror(layers.world, hud.world);
      syncMotion();
    },
  });

  const claims = new Set<RegionName>();
  return {
    hud,
    root,
    layers,
    webgl,
    region(mod, opts = {}) {
      if (opts.region) mod.el.dataset.region = opts.region;
      layers[opts.layer ?? 'chrome'].append(mod.el);
      const unmount = hud.mountDom(mod, opts.inset);
      return () => {
        unmount();
        mod.el.remove();
      };
    },
    claim(name) {
      if (claims.has(name)) throw new Error(`hud-dom: region '${name}' is claimed twice`);
      claims.add(name);
      root.dataset.regions = [...claims].join(' ');
    },
    claimed: (name) => claims.has(name),
  };
}
