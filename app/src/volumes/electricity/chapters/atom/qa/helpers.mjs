/* global window */
// Playwright helpers shared by the chapter's QA scripts (run on lenovo through tools/qa/shot.mjs --script or
// directly: see interactions.mjs).
//
// Only hooks that exist in production builds are used, and every position comes from them in CSS px, so one
// script serves 1280×720, 1920×1080 and 3840×2160:
//   HUD controls   `__ui.locate('ctl-<id>')`, segmented items `ctl-<id>:<item>`, values `__ui.value(id)`
//   scene objects  `__app.locate('<probe>')`   (the chapter's `ctx.qa.probe`)
//   chapter state  `__app.read('<name>')`      (the chapter's `ctx.qa.expose`)

/** Advance the frozen engine clock by `seconds` (QA runs with ?freeze, so nothing moves by itself). */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  // HUD annotations ease per *rendered* frame: render a few single frames so fades settle in the picture
  for (let i = 0; i < 14; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** CSS rectangle { x, y, w, h } (centre + size) of a named HUD node; throws when it is not on screen. */
export async function locateNode(page, name) {
  const rect = await page.evaluate((n) => window.__ui.locate(n), name);
  if (!rect) throw new Error(`HUD node '${name}' is not on screen`);
  return rect;
}

/** Rectangle of a step control by its step-UI id. */
export const locate = (page, id) => locateNode(page, `ctl-${id}`);

export const value = (page, id) => page.evaluate((k) => window.__ui.value(k), id);

/** State published by the chapter with `ctx.qa.expose(name, …)`. */
export const read = (page, name) => page.evaluate((n) => window.__app.read(n), name);

/** Screen position { x, y } of a scene object published with `ctx.qa.probe(name, …)`. */
export async function at(page, name) {
  const p = await page.evaluate((n) => window.__app.locate(n), name);
  if (!p) throw new Error(`probe '${name}' is unknown`);
  return p;
}

/** Click a button / toggle by its id; `fx` (0…1) picks a horizontal position inside it (a toggle's switch). */
export async function click(page, id, fx = 0.5) {
  const r = await locate(page, id);
  await page.mouse.click(r.x - r.w / 2 + r.w * fx, r.y);
  await advance(page, 0.2);
}

/** Click item `item` of the segmented control `id` (`ctl-<id>:<item>`), or a part of a custom control. */
export async function pick(page, id, item) {
  const r = await locateNode(page, `ctl-${id}:${item}`);
  await page.mouse.click(r.x, r.y);
  await advance(page, 0.2);
}

/** Press and hold a named HUD node for `seconds` of engine time, then release. */
export async function hold(page, name, seconds) {
  const r = await locateNode(page, name);
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await advance(page, seconds);
  await page.mouse.up();
  await advance(page, 0.2);
}

/** Drag a slider's knob to the fraction `fx` (0…1) of its track. */
export async function slide(page, id, fx) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18; // the track sits in the lower half of the control, under its label
  const x0 = r.x - r.w / 2 + r.w * 0.04;
  const x1 = r.x + r.w / 2 - r.w * 0.04;
  await page.mouse.move(x0 + (x1 - x0) * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * fx, y, { steps: 6 });
  await page.mouse.up();
  await advance(page, 0.2);
}

/**
 * Press on a probe and drag by a fraction of the viewport height (`fx`, `fy`: right / down positive), keeping
 * the button down. Returns the release function. Fractions, not pixels: the same gesture at every size.
 */
export async function dragProbe(page, name, fx, fy, { settle = 0.6 } = {}) {
  const p = await at(page, name);
  const h = page.viewportSize().height;
  await page.mouse.move(p.x, p.y);
  // one frame, so that the engine picks what is under the pointer now (the clock is frozen: no frame, no
  // hover) — and not more: moving targets (orbiting quarks) do not wait
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  await page.mouse.down();
  await page.mouse.move(p.x + fx * h, p.y + fy * h, { steps: 12 });
  await advance(page, settle);
  return async (after = 0.2) => {
    await page.mouse.up();
    await advance(page, after);
  };
}

/** Click a scene object by its probe. */
export async function clickProbe(page, name) {
  const p = await at(page, name);
  await page.mouse.click(p.x, p.y);
  await advance(page, 0.2);
}
