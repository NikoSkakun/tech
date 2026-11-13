// Building blocks of mobile-check (F5, docs/MOBILE.md): device profiles, per-step layout assertions on a
// touch shell, and touch interactions (sheet tabs, a slider, a button, the scene, the sheet itself).
import { settleFrames } from './check-parts.mjs';
import { fmt } from './lib.mjs';

/**
 * Device profiles (DECISIONS §57 g). `dpr` is the device's; the app caps it with the pixel budget. `safe`
 * emulates the safe-area insets of a notched phone (`?safe=top,right,bottom,left`): emulation has none.
 */
export const PROFILES = {
  'phone-portrait': { width: 390, height: 844, dpr: 3, safe: '47,0,34,0', formFactor: 'phone', shell: 'sheet', minHit: 44 },
  'phone-small': { width: 360, height: 800, dpr: 3, safe: '', formFactor: 'phone', shell: 'sheet', minHit: 44 },
  'phone-landscape': { width: 844, height: 390, dpr: 3, safe: '0,47,21,47', formFactor: 'phone', shell: 'side', minHit: 44 },
  'tablet-portrait': { width: 820, height: 1180, dpr: 2, safe: '', formFactor: 'tablet', shell: 'sheet', minHit: 48 },
  'tablet-landscape': { width: 1180, height: 820, dpr: 2, safe: '', formFactor: 'tablet', shell: 'side', minHit: 48 },
};
export const PROFILE_ALIASES = { pp: 'phone-portrait', pa: 'phone-small', pl: 'phone-landscape', tp: 'tablet-portrait', tl: 'tablet-landscape' };

/** Smallest text a touch profile may show, real CSS px (brief F5 §7). */
export const MIN_TEXT_PX = 14;

/** Advance the frozen clock so HUD tweens (sheet snaps, tab slides) finish. */
export const settle = (page, frames = 40) => page.evaluate((n) => window.__app.step(1 / 60, n), frames);

/**
 * Layout assertions of whatever the touch shell shows right now: nothing reachable only off screen, no text
 * below 14 CSS px, no pointer target below the profile's minimum. World text below the minimum is a warning
 * ("flagged"): it is the chapter's to fix (DECISIONS §57 a).
 */
export async function touchLayout(page, { where, profile, fail, warn, worldText = true }) {
  const r = await page.evaluate(
    ([minText, minHit]) => ({
      off: window.__ui.offscreen().map((n) => `${n.name} (y ${Math.round(n.y)})`),
      smallText: window.__ui.smallText(minText),
      smallTargets: window.__ui.smallTargets(minHit),
      // world text: Text3D (engine) and labels of ui3d surfaces placed in the world (consoles)
      texts: [...window.__app.textSizes(), ...(window.__ui.surfaceTextSizes?.() ?? [])],
    }),
    [MIN_TEXT_PX, profile.minHit],
  );
  if (r.off.length) fail(`${where}: ${r.off.length} control(s) outside the viewport: ${r.off.slice(0, 4).join(', ')}`);
  if (r.smallText.length) fail(`${where}: HUD text below ${MIN_TEXT_PX} CSS px: ${r.smallText.slice(0, 4).join('; ')}`);
  if (r.smallTargets.length) fail(`${where}: touch targets below ${profile.minHit} CSS px: ${r.smallTargets.slice(0, 4).join('; ')}`);
  const tiny = worldText ? r.texts.filter((t) => typeof t.px === 'number' && t.px < MIN_TEXT_PX) : [];
  if (tiny.length)
    warn(`${where}: ${tiny.length} world text(s) below ${MIN_TEXT_PX} CSS px, e.g. «${String(tiny[0].text).slice(0, 28)}» ${fmt(tiny[0].px, 1)} px — move it to the HUD (callout / board)`);
  return { offscreen: r.off.length, smallText: r.smallText.length, smallTargets: r.smallTargets.length, tinyWorldText: tiny.length };
}

/** Tap every tab of the sheet in turn; returns the tabs that exist. `each(tab)` runs while a tab is shown. */
export async function walkTabs(page, t, { where, fail, each }) {
  const before = await page.evaluate(() => window.__ui.sheet());
  if (!before) {
    fail(`${where}: no touch sheet (window.__ui.sheet() is null)`);
    return [];
  }
  for (const tab of before.tabs) {
    if (tab !== 'text') {
      await t.tapNode(`sheet-tabs:${tab}`);
      await settle(page);
      const now = await page.evaluate(() => window.__ui.sheet());
      if (now.tab !== tab) fail(`${where}: tapping the «${tab}» tab did not show it (tab is '${now.tab}')`);
      if (now.snap === 'peek') fail(`${where}: the sheet stayed collapsed after tapping the «${tab}» tab`);
    }
    await each(tab);
  }
  if (before.tabs.length > 1) {
    await t.tapNode('sheet-tabs:text');
    await settle(page);
  }
  return before.tabs;
}

/** Is the node fully inside the viewport and not cut by a scroll view? (then a finger can reach it now) */
async function reachable(page, name) {
  return page.evaluate((n) => {
    const box = window.__ui.locate(n);
    if (!box) return null;
    const hidden = window.__ui.offscreen({ clipped: true, partial: true }).some((o) => o.name === n || o.name.startsWith(`${n}>`));
    const inside = box.y - box.h / 2 >= 0 && box.y + box.h / 2 <= window.innerHeight && box.x - box.w / 2 >= 0 && box.x + box.w / 2 <= window.innerWidth;
    return hidden || !inside ? null : box;
  }, name);
}

/**
 * Operate the first reachable slider and button of the tab on screen by touch. A slider must change its value
 * when dragged along its track; a button must answer a tap (the kit's `tap` feedback). Returns what was done.
 */
export async function operateControls(page, t, { where, tab, fail, note }) {
  const done = { slider: null, button: null };
  const list = await page.evaluate(() => window.__ui.controls());
  const here = list.filter((c) => (tab === 'board' ? c.where === 'board' : c.where === 'dock'));
  for (const c of here.filter((x) => x.type === 'slider')) {
    const box = await reachable(page, `ctl-${c.id}`);
    if (!box) continue;
    const before = await page.evaluate((id) => window.__ui.value(id), c.id);
    // the track is the lower part of the slider's box; drag across the middle third, both ways if needed
    const y = box.y + box.h * 0.22;
    await t.drag([box.x - box.w * 0.05, y], [box.x + box.w * 0.3, y], { steps: 10, hold: 80 });
    await settle(page, 20);
    let after = await page.evaluate((id) => window.__ui.value(id), c.id);
    if (after === before) {
      await t.drag([box.x + box.w * 0.05, y], [box.x - box.w * 0.3, y], { steps: 10, hold: 80 });
      await settle(page, 20);
      after = await page.evaluate((id) => window.__ui.value(id), c.id);
    }
    if (after === before) fail(`${where}: dragging slider '${c.id}' by touch did not change its value (${before})`);
    else await page.evaluate(([id, v]) => window.__ui.set(id, v, true), [c.id, before]); // leave the step as it was
    await settle(page, 20);
    done.slider = c.id;
    break;
  }
  for (const c of here.filter((x) => x.type === 'button')) {
    const box = await reachable(page, `ctl-${c.id}`);
    if (!box) continue;
    const taps = await page.evaluate(() => window.__ui.sounds().tap ?? 0);
    const from = await page.evaluate(() => window.__app.position());
    await t.tap(box.x, box.y);
    await settle(page, 30);
    const now = await page.evaluate(() => window.__ui.sounds().tap ?? 0);
    if (now <= taps) fail(`${where}: tapping button '${c.id}' did nothing`);
    // a portal button («до наступної лабораторії») leaves the step: come back so the walk goes on where it was
    // (the travel is animated — wait for it before reading the address)
    await page.evaluate(() => window.__app.settled());
    const to = await page.evaluate(() => window.__app.position());
    if (to.chapterId !== from.chapterId || to.stepId !== from.stepId) {
      await page.evaluate(([ch, st]) => window.__app.goto(ch, st, { instant: true }), [from.chapterId, from.stepId]);
      await page.evaluate(() => window.__app.settled());
      await page.evaluate((tb) => window.__ui.setSheet({ tab: tb }), tab);
      await settle(page, 20);
    }
    done.button = c.id;
    break;
  }
  if (!done.slider && here.some((x) => x.type === 'slider')) note(`${where}: no slider reachable without scrolling in «${tab}»`);
  return done;
}

/** One-finger drag and two-finger pinch in the free scene area: the camera must answer (unless the shot is locked). */
export async function sceneGestures(page, t, { where, fail, note }) {
  const info = await page.evaluate(() => {
    const e = window.__app.engine;
    const f = e.hud.insetFractions();
    const d = e.runtime.director;
    return {
      x: ((f.left + (1 - f.right)) / 2) * window.innerWidth,
      y: ((f.top + (1 - f.bottom)) / 2) * window.innerHeight,
      w: (1 - f.left - f.right) * window.innerWidth,
      h: (1 - f.top - f.bottom) * window.innerHeight,
      locked: d?.currentShot.orbit?.enabled === false || d?.userControl === false,
    };
  });
  if (info.locked) {
    note(`${where}: the shot locks the camera — scene gestures not tested here`);
    return;
  }
  const pose = () =>
    page.evaluate(() => {
      const c = window.__app.engine.runtime.director.camera;
      const t = window.__app.engine.runtime.director.target;
      return { p: [c.position.x, c.position.y, c.position.z], d: c.position.distanceTo(t) };
    });
  const a = await pose();
  // start a little off the centre: the centre is where chapters put their draggable hero
  const sx = info.x - info.w * 0.3;
  const sy = info.y - info.h * 0.32;
  await t.drag([sx, sy], [sx + Math.min(info.w * 0.35, 120), sy + 10], { steps: 10, hold: 60 });
  await settle(page, 40);
  const b = await pose();
  const moved = Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]);
  if (moved < a.d * 0.01) note(`${where}: a one-finger drag at the scene's edge did not orbit (claimed by an object, or orbit limits ~0)`);
  await t.pinch([info.x, info.y - info.h * 0.3], 60, Math.min(info.w * 0.8, 220));
  await settle(page, 40);
  const c = await pose();
  if (!(c.d < b.d * 0.98)) fail(`${where}: a two-finger pinch did not zoom the camera in (distance ${fmt(b.d, 2)} → ${fmt(c.d, 2)})`);
  await page.evaluate(() => window.__app.engine.runtime.director.resetOrbit());
  await settle(page, 60);
}

export { settleFrames };
