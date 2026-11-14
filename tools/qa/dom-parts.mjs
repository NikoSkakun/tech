// Interface checks that hold for both renderers (D8, docs/HUD_DOM.md §12), used by chapter-check's layout pass:
//  - interface text size: every visible piece of HUD text (`__ui.textSizes()`: DOM text nodes of #kd-hud plus the
//    WebGL labels of regions not ported yet) must be at least `UI.text.caption` HUD units (15 = 10.5 CSS px at
//    1280×720) → fail. Units are independent of the viewport, so this is checked at every size;
//  - region overlap: chrome regions (header, spine, system, column, board, navigator, sheet) whose boxes intersect
//    (`__ui.overlaps()`) → fail.
// World text (Text3D, world surfaces) keeps its own px-eq check in check-parts.mjs.
import { fmt } from './lib.mjs';

/** `UI.text.caption` (app/src/ui3d/theme.ts): the smallest text the interface may draw, in HUD units. */
export const CAPTION_UNITS = 15;

/**
 * Text-size and overlap checks of the interface at the current viewport. Adds `hudTextMin`, `hudTextCount`,
 * `overlaps` to `entry`; failures go through `fail`. Tolerates an older `__ui` without the hooks (note only).
 */
export async function hudChecks(page, entry, { step, size, fail, note, minUnits = CAPTION_UNITS }) {
  const r = await page.evaluate(async () => {
    const ui = window.__ui;
    // computed font sizes do not depend on the web fonts, region boxes do (text reflows): measure once they are in
    await document.fonts.ready;
    return {
      texts: typeof ui?.textSizes === 'function' ? ui.textSizes() : null,
      overlaps: typeof ui?.overlaps === 'function' ? ui.overlaps() : null,
    };
  });
  if (r.texts === null) note('HUD has no __ui.textSizes() hook — interface text size not checked');
  else {
    entry.hudTextCount = r.texts.length;
    entry.hudTextMin = r.texts.length ? Math.min(...r.texts.map((t) => t.units)) : null;
    const small = r.texts.filter((t) => t.units < minUnits - 0.05);
    for (const t of small.slice(0, 4))
      fail(`${step} @${size}: interface text «${t.text}» [${t.name}] is ${fmt(t.units, 1)} units (${fmt(t.px, 1)} CSS px) < caption ${minUnits}`);
    if (small.length > 4) fail(`${step} @${size}: … ${small.length - 4} more interface texts below ${minUnits} units`);
  }
  if (r.overlaps === null) note('HUD has no __ui.overlaps() hook — region overlap not checked');
  else {
    entry.overlaps = r.overlaps.map((o) => `${o.a}×${o.b} ${fmt(o.w, 0)}×${fmt(o.h, 0)}`);
    for (const o of r.overlaps) fail(`${step} @${size}: regions ${o.a} and ${o.b} overlap by ${fmt(o.w, 0)}×${fmt(o.h, 0)} CSS px`);
  }
  return entry;
}
