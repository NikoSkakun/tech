#!/usr/bin/env node
/* global process, console, window, setTimeout */
// Interaction test of the chapter (run on lenovo; dev server or `pnpm preview` of a production build):
//
//   QA_PORT=5243 node app/src/volumes/electricity/chapters/plant-hydro/qa/interaction.mjs [--size 1280x720] [--out <dir>]
//
// Every control of every step is operated once with real pointer input and must cause an observable change:
// its own value (`__ui.value`), the state the scene exposes (`ctx.qa.expose` → `__app.read`), or both. Also
// covered: painting the PSH day on the chart (step 8), the station pins of the hologram (step 9), hotspot cards and
// the links of step 9. Positions come from `__ui.locate` / `__app.locate` in CSS px, so the same
// script runs at 1280×720, 1920×1080 and 3840×2160; only hooks that exist in production builds are used.
// Fails (exit 1) on a failed check or on any console error / warning. The clock is frozen and stepped by hand.
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
import { STEPS } from './interaction-steps.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size ?? '1280x720');
const out = ensureDir(
  typeof args.out === 'string'
    ? args.out
    : `/srv/electricity/qa/B-plant-hydro/interaction-${width}x${height}`,
);
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const failures = [];
let checks = 0;

const { browser, page } = await launch({ width, height });
const step = (frames = 30) => page.evaluate((n) => window.__app.step(1 / 60, n), frames);
/** What a test case may observe. */
const see = {
  value: (id) => page.evaluate((i) => window.__ui.value(i), id),
  read: (name) => page.evaluate((n) => window.__app.read(n), name),
  locate: (name) => page.evaluate((n) => window.__app.locate(n), name),
  position: () =>
    page.evaluate(() => {
      const p = window.__app.position();
      return `${p.volumeId}/${p.chapterId}/${p.stepId}`;
    }),
};
const ui = async (name) => {
  const r = await page.evaluate((n) => window.__ui.locate(n), name);
  if (!r) throw new Error(`'${name}' is not on screen`);
  if (r.y < 0 || r.y > height || r.x < 0 || r.x > width)
    throw new Error(`'${name}' is outside the viewport (${Math.round(r.x)}, ${Math.round(r.y)})`);
  return r;
};
const click = async (x, y, frames = 20) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await step(frames);
};
const drag = async (from, to, frames = 30) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  await page.mouse.up();
  await step(frames);
};

/** The gestures a test case may use. */
const act = {
  /** Drag a slider's knob to the fraction `f` of its track. */
  async slider(id, f) {
    const r = await ui(`ctl-${id}`);
    const y = r.y + r.h * 0.22; // the track is the lower part of the widget
    const x = (k) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * k);
    await drag({ x: x(0.5), y }, { x: x(f), y });
  },
  async toggle(id) {
    const r = await ui(`ctl-${id}`);
    await click(r.x - r.w / 2 + r.h * 0.6, r.y);
  },
  async button(id) {
    const r = await ui(`ctl-${id}`);
    await click(r.x, r.y);
  },
  /** Click one item of a segmented control. */
  async segment(id, item) {
    const r = await ui(`ctl-${id}:${item}`);
    await click(r.x, r.y);
  },
  /** Click a named HUD node (a «Див. також» chip). */
  async node(name) {
    const r = await ui(name);
    await click(r.x, r.y, 40);
  },
  /** Drag along a chart: from the fraction `a` to the fraction `b` of its width. */
  async scrub(id, a, b) {
    const r = await ui(`ctl-${id}`);
    const x = (k) => r.x - r.w / 2 + r.w * k;
    await drag({ x: x(a), y: r.y }, { x: x(b), y: r.y });
  },
  /** Click a probed scene point (a hotspot marker, a portal). */
  async tap(probe, frames = 40) {
    const p = await see.locate(probe);
    if (!p || !p.visible) throw new Error(`probe '${probe}' is not visible`);
    await click(p.x, p.y, frames);
  },
  /** Drag a probed scene object by a screen offset given in fractions of the viewport height. */
  async dragProbe(probe, dx, dy) {
    const p = await see.locate(probe);
    if (!p || !p.visible) throw new Error(`probe '${probe}' is not visible`);
    await drag(p, { x: p.x + dx * height, y: p.y + dy * height }, 90);
  },
  step,
  /** Real time (a chapter change loads a chunk). */
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
};

try {
  for (const s of STEPS) {
    if (only && !only.includes(s.id)) continue;
    // a new query string (`n`) forces a real page load: a hash-only change would be a real-time in-app transition
    await openApp(
      page,
      appUrl(baseUrl(args), { route: `plant-hydro/${s.id}`, q: 'high', freeze: 2, extra: { n: s.id } }),
    );
    await step(30);
    for (const c of s.cases) {
      checks++;
      try {
        const before = await c.read(see);
        await c.do(act);
        const after = await c.read(see);
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
    await screenshot(page, `${out}/${s.id}.jpg`);
    for (const e of await appErrors(page))
      failures.push(`${s.id}: console ${e.level}: ${e.message.slice(0, 200)}`);
  }
} finally {
  await browser.close();
}
console.log(
  failures.length
    ? `FAIL — ${failures.length} of ${checks} checks @${width}x${height}:\n  ${failures.join('\n  ')}`
    : `PASS — ${checks} interaction checks @${width}x${height}, screenshots in ${out}`,
);
process.exit(failures.length ? 1 : 0);
