#!/usr/bin/env node
// Cost of the DOM interface per step of a chapter (D8, docs/HUD_DOM.md §15).
//
//   node tools/qa/dom-cost.mjs <chapter> [--size WxH] [--tier high|mobile|…] [--frames 120] [--hud dom|gl]
//                              [--port <n> | --base <url>] [--out <dir>] [--no-fail]
//
// Per step (entered with an animated transition from the previous one, then left alone ~1 s), over --frames real
// frames (live clock, no freeze):
//   step change   layout time (Performance.getMetrics LayoutDuration) from the goto to the settled step  ≤ 4 ms (mobile 8)
//   steady        layouts in the window (0) · style recalc per frame (≤ 0.2 ms) · script per frame of the whole page
//   HUD script    per frame in `src/hud-dom/**` (dom) and `src/hud/**` + `src/ui3d/**` (gl), V8 sampling profile,
//                 innermost matching frame (incl. the DOM / style work it calls)                           ≤ 0.5 ms (mobile 1.0)
//   nodes         elements in #kd-hud                                                                    ≤ 1500
//   HUD on/off    `__app.measure()` frame time with the interface shown vs `__ui.setVisible(false)` (both
//                 renderers; min of 3 interleaved pairs): the difference                                ≤ 1.5 ms (mobile 2.5)
//   (steady layouts: a window with layouts is sampled once more and the smaller count kept)
// `__app.measure()` sees the engine's frame only; the CDP metrics see the DOM's script, style and layout
// (compositing is in neither — see HUD_DOM §15). HUD script needs the dev server (`bundled` = not attributed).
// Default --hud dom. Writes <out>/dom-cost/<chapter>-<W>x<H>-<tier>-<hud>.json and prints one line per step plus
// a summary line; exit 1 when a budget is exceeded (--no-fail: report only).
import { writeFileSync } from 'node:fs';
import { domNodes, metricWindow, profileWindow, rafFrames } from './cost-parts.mjs';
import { appUrl, baseUrl, ensureDir, fmt, launch, openApp, outRoot, parseArgs, parseSize } from './lib.mjs';

const args = parseArgs();
if (!args.hud) process.env.QA_HUD = 'dom';
const chapterArg = String(args._[0] ?? '');
if (!chapterArg) {
  console.error('usage: dom-cost.mjs <chapter | volume/chapter> [--size WxH] [--tier high|mobile] [--frames 120]');
  process.exit(2);
}
const [width, height] = parseSize(args.size);
const tier = String(args.tier ?? args.q ?? 'high');
const frames = Math.max(30, Number(args.frames ?? 120));
const mobile = tier === 'mobile';
const BUDGET = {
  stepLayoutMs: mobile ? 8 : 4,
  steadyLayouts: 0,
  recalcMs: 0.2,
  hudScriptMs: mobile ? 1.0 : 0.5,
  nodes: 1500,
  onOffMs: mobile ? 2.5 : 1.5,
};
const base = baseUrl(args);
const out = ensureDir(`${outRoot(args)}/dom-cost`);
const PATTERNS = { dom: /\/src\/hud-dom\//, gl: /\/src\/(hud|ui3d)\// };

const { browser, page } = await launch({ width, height });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const rows = [];
const failures = [];
let gpu = null;
try {
  gpu = await openApp(page, appUrl(base, { route: chapterArg, q: tier }));
  const chapters = await page.evaluate(() => window.__app.listChapters());
  const chapter = chapters.find((c) => c.fullId === chapterArg) ?? chapters.find((c) => c.id === chapterArg);
  if (!chapter) throw new Error(`chapter '${chapterArg}' is not registered`);
  console.log(`[dom-cost] ${chapter.fullId} @${width}x${height} ${tier} · interface ${gpu.hud} · ${frames} frames`);
  // the page still lays out a few times during the first ~3 s after boot (measured at 4K): not a steady cost
  await page.waitForTimeout(4000);
  for (const s of chapter.steps) {
    // step change: an ordinary animated transition, layout summed until the step is settled
    const change = await metricWindow(page, cdp, 1, () => page.evaluate(([c, id]) => window.__app.goto(c, id), [chapter.fullId, s.id]));
    await page.waitForTimeout(1000);
    // a layout in the window may be a late one-off (boot, a font): only a second window with layouts counts
    let steady = await metricWindow(page, cdp, frames);
    if (steady.layouts > 0) {
      const again = await metricWindow(page, cdp, frames);
      if (again.layouts < steady.layouts) steady = again;
    }
    const prof = await profileWindow(page, cdp, frames, PATTERNS);
    const nodes = await domNodes(page);
    const measure = async (on) => {
      await page.evaluate((v) => window.__ui.setVisible(v), on);
      await rafFrames(page, 20);
      return (await page.evaluate((n) => window.__app.measure(n), frames)).frameAvg;
    };
    // three interleaved off / on pairs, the minimum of each: other users of the shared GPU spoil single samples
    const offs = [];
    const ons = [];
    for (let r = 0; r < 3; r++) {
      offs.push(await measure(false));
      ons.push(await measure(true));
    }
    const off = Math.min(...offs);
    const on = Math.min(...ons);
    const row = {
      step: s.id,
      stepLayoutMs: change.layoutMs,
      steadyLayouts: steady.layouts,
      recalcMs: steady.recalcMs,
      scriptMs: steady.scriptMs,
      hudScriptMs: prof.dom,
      glHudScriptMs: prof.gl,
      bundled: prof.bundled,
      nodes,
      frameOn: on,
      frameOff: off,
      onOffMs: on - off,
    };
    const over = Object.keys(BUDGET).filter((k) => !(k === 'hudScriptMs' && row.bundled) && row[k] > BUDGET[k]);
    row.over = over;
    rows.push(row);
    for (const k of over) failures.push(`${s.id}: ${k} ${fmt(row[k])} > ${BUDGET[k]}`);
    console.log(
      `  ${s.id.padEnd(18)} change layout ${fmt(row.stepLayoutMs)} ms · steady ${row.steadyLayouts} layouts, recalc ${fmt(row.recalcMs, 3)} ms/f · ` +
        `script ${fmt(row.scriptMs)} ms/f (hud-dom ${row.bundled ? 'n/a' : fmt(row.hudScriptMs, 3)}, gl hud ${row.bundled ? 'n/a' : fmt(row.glHudScriptMs, 3)}) · ` +
        `${nodes} nodes · on/off ${fmt(on)} / ${fmt(off)} ms${over.length ? `  OVER: ${over.join(', ')}` : ''}`,
    );
  }
} catch (e) {
  failures.push(`aborted: ${e.message}`);
  console.log(`  FAIL aborted: ${e.message}`);
} finally {
  await browser.close();
}

const max = (k) => (rows.length ? Math.max(...rows.map((r) => r[k])) : null);
const summary = Object.fromEntries(Object.keys(BUDGET).map((k) => [k, max(k)]));
const file = `${out}/${chapterArg.replace(/\//g, '-')}-${width}x${height}-${tier}-${gpu?.hud ?? 'x'}.json`;
writeFileSync(file, JSON.stringify({ chapter: chapterArg, size: `${width}x${height}`, tier, hud: gpu?.hud, frames, budget: BUDGET, summary, rows, failures }, null, 2));
console.log(
  `${failures.length ? 'OVER BUDGET' : 'PASS'} dom-cost ${chapterArg} ${width}x${height} ${tier} ${gpu?.hud ?? ''}: max step-change layout ${fmt(summary.stepLayoutMs ?? 0)} ms, ` +
    `steady layouts ${summary.steadyLayouts}, recalc ${fmt(summary.recalcMs ?? 0, 3)} ms/f, hud-dom script ${fmt(summary.hudScriptMs ?? 0, 3)} ms/f, ` +
    `${summary.nodes} nodes, on−off ${fmt(summary.onOffMs ?? 0)} ms — ${file}`,
);
process.exit(failures.length && !args['no-fail'] ? 1 : 0);
