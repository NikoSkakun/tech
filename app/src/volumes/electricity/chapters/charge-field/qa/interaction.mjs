#!/usr/bin/env node
/* global process, console, window */
// Interaction test of chapter `charge-field` (run on lenovo against a dev server or a production preview):
//
//   node app/src/volumes/electricity/chapters/charge-field/qa/interaction.mjs [--port 5241] [--size 1280x720]
//        [--only field,potential] [--out <dir>]
//
// Every control of every step and every direct manipulation in the scene is operated once with real pointer
// input and must cause an observable change (`__ui.value`, or the step's `ctx.qa.expose` state through
// `__app.read`). Positions come from `__ui.locate` / `__app.locate` / `__app.project` in CSS px, so the same
// script serves 1280×720, 1920×1080 and 3840×2160. Fails (exit 1) on a failed check, a control outside the
// viewport, or any console error / warning. The clock is frozen and stepped by hand: the run is deterministic.
import {
  appErrors,
  appUrl,
  baseUrl,
  ensureDir,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';
import { STEPS } from './cases.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size ?? '1280x720');
const out = ensureDir(
  typeof args.out === 'string'
    ? args.out
    : `/srv/electricity/qa/B-charge-field/interaction-${width}x${height}`,
);
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const failures = [];
let checks = 0;

const { browser, page } = await launch({ width, height });
const step = (frames = 30, dt = 1 / 60) => page.evaluate(([d, n]) => window.__app.step(d, n), [dt, frames]);
const value = (id) => page.evaluate((i) => window.__ui.value(i), id);
const read = (name) => page.evaluate((n) => window.__app.read(n), name);
const box = async (name) => {
  const r = await page.evaluate((n) => window.__ui.locate(n), name);
  if (!r) throw new Error(`'${name}' is not on screen`);
  if (r.x < 0 || r.x > width || r.y < 0 || r.y > height) throw new Error(`'${name}' is outside the viewport`);
  return r;
};
const click = async (x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await step(20);
};
/** Screen position of a scene probe (`ctx.qa.probe`) or of a world point [x, y, z]. */
const screen = async (target) => {
  const p = await page.evaluate(
    (t) => (typeof t === 'string' ? window.__app.locate(t) : window.__app.project(...t)),
    target,
  );
  if (!p) throw new Error(`cannot locate ${JSON.stringify(target)}`);
  return p;
};
const drag = async (from, via, frames = 20) => {
  const a = await screen(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (const target of via) {
    const b = await screen(target);
    for (let i = 1; i <= 6; i++)
      await page.mouse.move(a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6);
    Object.assign(a, b);
    await step(2);
  }
  await page.mouse.up();
  await step(frames);
};

/** The gestures a test case may use. */
const act = {
  step,
  /** Drag a slider's knob to the fraction `f` of its track. */
  async slider(id, f) {
    const r = await box(`ctl-${id}`);
    const y = r.y + r.h * 0.22; // the track is the lower part of the widget
    const x = (k) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * k);
    await page.mouse.move(x(0.5), y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x(0.5 + ((f - 0.5) * i) / 6), y);
    await page.mouse.up();
    await step(30);
  },
  async toggle(id) {
    const r = await box(`ctl-${id}`);
    await click(r.x - r.w / 2 + 24, r.y);
  },
  async button(id) {
    const r = await box(`ctl-${id}`);
    await click(r.x, r.y);
  },
  async segment(id, item) {
    const r = await box(`ctl-${id}:${item}`);
    await click(r.x, r.y);
  },
  /** Press on a scene probe and drag through the given targets (probe names or world points). */
  drag,
  /** Click a scene probe. */
  async tap(name) {
    const p = await screen(name);
    await click(p.x, p.y);
  },
};

try {
  for (const s of STEPS) {
    if (only && !only.includes(s.id)) continue;
    await openApp(page, appUrl(baseUrl(args), { route: `charge-field/${s.id}`, q: 'high', freeze: 2 }));
    await step(30);
    for (const c of s.cases) {
      checks++;
      try {
        const before = await c.read({ value, read });
        await c.do(act);
        const after = await c.read({ value, read });
        const ok = c.expect ? c.expect(before, after) : JSON.stringify(before) !== JSON.stringify(after);
        console.log(
          `  ${ok ? 'ok  ' : 'FAIL'} ${s.id} · ${c.name}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
        );
        if (!ok) failures.push(`${s.id} · ${c.name}`);
      } catch (e) {
        console.log(`  FAIL ${s.id} · ${c.name}: ${e.message}`);
        failures.push(`${s.id} · ${c.name}: ${e.message}`);
      }
    }
    const off = await page.evaluate(() => window.__ui.offscreen().map((n) => n.name ?? String(n)));
    if (off.length) failures.push(`${s.id}: controls outside the viewport: ${off.join(', ')}`);
    await screenshot(page, `${out}/${s.id}.jpg`);
    for (const e of await appErrors(page))
      failures.push(`${s.id}: console ${e.level}: ${e.message.slice(0, 200)}`);
  }
} finally {
  await browser.close();
}
console.log(
  failures.length
    ? `FAIL — ${failures.length} of ${checks} checks:\n  ${failures.join('\n  ')}`
    : `PASS — ${checks} interaction checks at ${width}x${height}, screenshots in ${out}`,
);
process.exit(failures.length ? 1 : 0);
