/* global window */
// Playwright helpers shared by the chapter's QA scripts (run on lenovo through tools/qa/shot.mjs --script or
// directly: see interactions.mjs). Controls are addressed by their step-UI id (HUD node name `ctl-<id>`).

/** Advance the frozen engine clock by `seconds` (QA runs with ?freeze, so nothing moves by itself). */
export async function advance(page, seconds) {
  await page.evaluate((n) => window.__app.step(1 / 60, n), Math.max(1, Math.round(seconds * 60)));
  // HUD annotations ease per *rendered* frame: render a few single frames so fades settle in the picture
  for (let i = 0; i < 14; i++) await page.evaluate(() => window.__app.step(1 / 60, 1));
}

/** CSS rectangle { x, y, w, h } (centre + size) of a step control; throws when it is not on screen. */
export async function locate(page, id) {
  const rect = await page.evaluate((name) => window.__ui.locate(name), `ctl-${id}`);
  if (!rect) throw new Error(`control '${id}' is not on screen`);
  return rect;
}

export const value = (page, id) => page.evaluate((k) => window.__ui.value(k), id);

/** Click a button / toggle; `fx` picks a horizontal position inside it (0…1) — a segmented control's item. */
export async function click(page, id, fx = 0.5) {
  const r = await locate(page, id);
  await page.mouse.click(r.x - r.w / 2 + r.w * fx, r.y);
  await advance(page, 0.2);
}

/** Drag a slider's knob to the fraction `fx` (0…1) of its track. */
export async function slide(page, id, fx) {
  const r = await locate(page, id);
  const y = r.y + r.h * 0.18; // the track sits in the lower half of the control, under its label
  const x0 = r.x - r.w / 2 + 14;
  const x1 = r.x + r.w / 2 - 14;
  await page.mouse.move(x0 + (x1 - x0) * 0.5, y);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * fx, y, { steps: 6 });
  await page.mouse.up();
  await advance(page, 0.2);
}

/** World point → CSS px. */
export const project = (page, x, y, z) =>
  page.evaluate(([a, b, c]) => window.__app.project(a, b, c), [x, y, z]);

/** Drag in the scene from one world point to another (CSS px offsets allowed through `dx`, `dy`). */
export async function dragWorld(page, from, to, { steps = 12, hold = 0 } = {}) {
  const a = await project(page, ...from);
  const b = await project(page, ...to);
  await page.mouse.move(a.x, a.y);
  await advance(page, 0.1);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await advance(page, 0.2 + hold);
  return {
    release: async () => {
      await page.mouse.up();
      await advance(page, 0.2);
    },
  };
}

/**
 * Rectangle of the `index`-th visible HUD widget of a class ('Tabs', 'Readout', 'Chart' …). The HUD names only
 * sliders, toggles and buttons `ctl-<id>` (segmented controls and readouts have no name — reported in
 * docs/requests/B-atom.md), so they are found by class in the HUD's node tree.
 */
export async function locateWidget(page, className, index = 0) {
  const rect = await page.evaluate(
    ([cls, i]) => {
      // every UiSurface is an Object3D under the engine's HUD root with a `root` UiNode
      const layer = window.__app.engine.hud;
      const hits = [];
      layer.root.traverse((o) => {
        if (!o.root || typeof o.root.walk !== 'function') return;
        o.root.walk((n) => {
          if (n.constructor.name === cls && n.slot >= 0 && n.worldOpacity > 0.5) hits.push([o, n]);
        });
      });
      if (!hits[i]) return null;
      const [surface, n] = hits[i];
      const m = layer.metrics;
      const w = n.world;
      const v = surface.position.clone().set(w[3], w[7], w[11]);
      v.applyMatrix4(surface.matrixWorld).project(layer.camera);
      const k = m.pxPerUnit;
      return {
        x: (v.x * 0.5 + 0.5) * m.cssWidth,
        y: (0.5 - v.y * 0.5) * m.cssHeight,
        w: n.bw * Math.abs(w[0]) * k,
        h: n.bh * Math.abs(w[5]) * k,
      };
    },
    [className, index],
  );
  if (!rect) throw new Error(`no visible ${className} #${index}`);
  return rect;
}

/** Click item `item` (0-based) of `count` in the `index`-th segmented control on screen. */
export async function pickTab(page, index, item, count) {
  const r = await locateWidget(page, 'Tabs', index);
  await page.mouse.click(r.x - r.w / 2 + (r.w * (item + 0.5)) / count, r.y);
  await advance(page, 0.2);
}
