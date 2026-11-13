#!/usr/bin/env node
/* global process, console, window */
// Interaction test of the chapter (run on lenovo, dev server up):
//
//   QA_PORT=5222 node app/src/volumes/electricity/chapters/plant-wind/qa/interaction.mjs [--size 1280x720] [--out <dir>]
//
// Every control of every step is operated once with real pointer input and must cause an observable change:
// its own value (`__ui.value`), the live state of the scene (`window.__wind`), or both. Also covered: the one
// direct-manipulation control (dragging the wind arrow of step 8). Fails (exit 1) on a failed check or on any
// console error / warning. The clock is frozen and stepped by hand, so the run is deterministic.
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, parseArgs, parseSize, screenshot } from '../../../../../../../tools/qa/lib.mjs';
import { STEPS } from './interaction-steps.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size ?? '1280x720');
const out = ensureDir(typeof args.out === 'string' ? args.out : '/srv/electricity/qa/B-plant-wind/interaction');
const failures = [];
let checks = 0;

const { browser, page } = await launch({ width, height });
const step = (frames = 30) => page.evaluate((n) => window.__app.step(1 / 60, n), frames);
const value = (id) => page.evaluate((i) => window.__ui.value(i), id);
const wind = (expr) => page.evaluate(`(() => { const w = window.__wind; return ${expr}; })()`);
let dock = null; // x centre and width of the dock column, learnt from the first slider seen
const box = async (id) => {
  const r = await page.evaluate((i) => window.__ui.locate(`ctl-${i}`), id);
  if (!r) throw new Error(`control '${id}' is not on screen`);
  if (r.w > 0.15 * width) dock = { x: r.x, w: r.w };
  if (r.y + r.h / 2 > height) throw new Error(`control '${id}' is below the viewport (y = ${Math.round(r.y)})`);
  return r;
};
const click = async (x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await step(20);
};

/** The gestures a test case may use. */
const act = {
  /** Drag a slider's knob to the fraction `f` of its track. */
  async slider(id, f) {
    const r = await box(id);
    const y = r.y + r.h * 0.22; // the track is the lower part of the widget
    const x = (k) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * k);
    await page.mouse.move(x(0.5), y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x(0.5 + ((f - 0.5) * i) / 6), y);
    await page.mouse.up();
    await step(30);
  },
  async toggle(id) {
    const r = await box(id);
    await click(r.x - r.w / 2 + 24, r.y);
  },
  async button(id) {
    const r = await box(id);
    await click(r.x, r.y);
  },
  /**
   * Click item `i` of `n` of a segmented control. The HUD does not name segmented controls `ctl-<id>` yet
   * (see docs/requests/B-plant-wind.md), so it is found relative to a named neighbour: `dy` px (at 720p) from
   * the centre of control `refId`, spanning the dock column.
   */
  async segmentNear(refId, dy, i, n) {
    const r = await box(refId);
    if (!dock) throw new Error('dock column unknown: operate a slider first');
    await click(dock.x - dock.w / 2 + (dock.w * (i + 0.5)) / n, r.y + (dy * height) / 720);
  },
  /** Drag in the scene between two world points. */
  async dragWorld(from, to) {
    const p = await page.evaluate(([a, b]) => [window.__app.project(...a), window.__app.project(...b)], [from, to]);
    await page.mouse.move(p[0].x, p[0].y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(p[0].x + ((p[1].x - p[0].x) * i) / 8, p[0].y + ((p[1].y - p[0].y) * i) / 8);
    await page.mouse.up();
    await step(60);
  },
  step,
};

try {
  for (const s of STEPS) {
    await openApp(page, appUrl(baseUrl(args), { route: `plant-wind/${s.id}`, q: 'high', freeze: 2 }));
    await step(30);
    for (const c of s.cases) {
      checks++;
      try {
        const before = await c.read({ value, wind });
        await c.do(act);
        const after = await c.read({ value, wind });
        const ok = c.expect ? c.expect(before, after) : JSON.stringify(before) !== JSON.stringify(after);
        console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${s.id} · ${c.name}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
        if (!ok) failures.push(`${s.id} · ${c.name}`);
      } catch (e) {
        console.log(`  FAIL ${s.id} · ${c.name}: ${e.message}`);
        failures.push(`${s.id} · ${c.name}: ${e.message}`);
      }
    }
    await screenshot(page, `${out}/${s.id}.jpg`);
    for (const e of await appErrors(page)) failures.push(`${s.id}: console ${e.level}: ${e.message.slice(0, 200)}`);
  }
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL — ${failures.length} of ${checks} checks:\n  ${failures.join('\n  ')}` : `PASS — ${checks} interaction checks, screenshots in ${out}`);
process.exit(failures.length ? 1 : 0);
