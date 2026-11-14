/**
 * Area `chrome` of the DOM interface (docs/HUD_DOM.md §16) — spine, system row, tooltips, toasts, loading pill, onboarding hints (D2).
 * D1 stub: mounts nothing yet, so the WebGL HUD keeps drawing these regions (hybrid `?hud=dom`). D2 replaces
 * the body: build the elements, `dom.claim(…)` each region it takes over and place it with `dom.region(…)`.
 */
import type { DomHud } from '../core/context';

export function mount(_dom: DomHud): void {}
