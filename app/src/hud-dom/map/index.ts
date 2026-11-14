/**
 * Area `map` of the DOM interface (docs/HUD_DOM.md §16) — home, library, journey-map title bar, overview and chapter card (D5).
 * D1 stub: mounts nothing yet, so the WebGL HUD keeps drawing these regions (hybrid `?hud=dom`). D5 replaces
 * the body: build the elements, `dom.claim(…)` each region it takes over and place it with `dom.region(…)`.
 */
import type { DomHud } from '../core/context';

export function mount(_dom: DomHud): void {}
