/**
 * Area `charts` of the DOM interface (docs/HUD_DOM.md §16) — Chart, PhasorScope, RadarChart, HeatMap (D4).
 * D1 stub: mounts nothing yet, so the WebGL HUD keeps drawing these regions (hybrid `?hud=dom`). D4 replaces
 * the body: build the elements, `dom.claim(…)` each region it takes over and place it with `dom.region(…)`.
 */
import type { DomHud } from '../core/context';

export function mount(_dom: DomHud): void {}
