/**
 * Area `touch` of the DOM interface (docs/HUD_DOM.md §16) — bottom / side sheet, menu, safe areas (F5 shells in CSS) (D7).
 * D1 stub: mounts nothing yet, so the WebGL HUD keeps drawing these regions (hybrid `?hud=dom`). D7 replaces
 * the body: build the elements, `dom.claim(…)` each region it takes over and place it with `dom.region(…)`.
 */
import type { DomHud } from '../core/context';

export function mount(_dom: DomHud): void {}
