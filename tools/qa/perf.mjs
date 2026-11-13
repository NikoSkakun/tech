#!/usr/bin/env node
// Frame-time statistics per route and quality tier.
//
//   node tools/qa/perf.mjs <route> [<route> …] [options]
//   <route>: `volume/chapter/step`, or `chapter/step` (default volume first, then the others)
//
//   --q high,ultra     comma-separated tiers (default high)
//   --size WxH         viewport (default 1920x1080)
//   --frames N         frames per measurement (default 300)
//   --warmup ms        real-time settle before measuring (default 1200)
//   --json <file>      also write the numbers as JSON
//   --uncapped         additionally report free-running throughput: Chrome is started without vsync / frame
//                      limit and the mean requestAnimationFrame interval is measured ("free" column)
//
// Columns: "frame" = gpu + cpu, the number held against the budget (ARCHITECTURE §1: avg ≤ 8 ms on the RTX 5060
// at 1920x1080 `high`); "gpu" = GPU time of the whole frame from timer queries; "cpu" = update + draw
// submission; "sync" = wall time with a blocking readPixels (includes several ms of fixed IPC overhead —
// a pessimistic cross-check); "free-run" (--uncapped) = requestAnimationFrame interval without vsync.
import { writeFileSync } from 'node:fs';
import { appErrors, appUrl, baseUrl, ensureParent, fmt, launch, openApp, parseArgs, parseSize } from './lib.mjs';

const args = parseArgs();
const routes = args._.length ? args._.map(String) : [''];
const tiers = String(args.q ?? 'high').split(',');
const [width, height] = parseSize(args.size);
const frames = Number(args.frames ?? 300);
const warmup = Number(args.warmup ?? 1200);
const base = baseUrl(args);

const uncapped = Boolean(args.uncapped);
const { browser, page } = await launch({ width, height, uncapped });
const rows = [];
let failed = false;
try {
  for (const tier of tiers) {
    for (const route of routes) {
      const gpu = await openApp(page, appUrl(base, { route, q: tier, extra: { n: `${tier}-${rows.length}` } }));
      await page.waitForTimeout(warmup);
      let free = null;
      if (uncapped) {
        // free-running: frame interval with no vsync and no sync points = real end-to-end frame cost
        await page.evaluate(() => window.__app.resetStats());
        await page.waitForTimeout(1500);
        free = await page.evaluate(() => window.__app.stats().intervalAvg);
      }
      const m = await page.evaluate((n) => window.__app.measure(n), frames);
      const s = await page.evaluate(() => window.__app.stats());
      rows.push({ route, tier, width: s.width, height: s.height, ...m, freeInterval: free, drawCalls: s.drawCalls, triangles: s.triangles, renderer: gpu.renderer });
      const gpuText = m.gpuAvg === null ? "n/a" : `${fmt(m.gpuAvg)} (p95 ${fmt(m.gpuP95)}, max ${fmt(m.gpuMax)})`;
      console.log(
        `${(route || '(start)').padEnd(30)} ${tier.padEnd(6)} ${s.width}x${s.height}  frame ${fmt(m.frameAvg)} ms = gpu ${gpuText} + cpu ${fmt(m.cpuAvg)} · sync ${fmt(m.syncAvg)}${free !== null ? ` · free-run ${fmt(free)} ms (${Math.round(1000 / free)} fps)` : ''}  |  ${s.drawCalls} calls · ${(s.triangles / 1000).toFixed(0)}k tris`,
      );
      const errors = await appErrors(page);
      if (errors.length) {
        failed = true;
        for (const e of errors.slice(0, 5)) console.log(`   [${e.level}] ${e.message.slice(0, 200)}`);
      }
    }
  }
} catch (e) {
  failed = true;
  console.error(`perf failed: ${e.message}`);
} finally {
  await browser.close();
}
if (typeof args.json === 'string') writeFileSync(ensureParent(args.json), JSON.stringify(rows, null, 2));
process.exit(failed ? 1 : 0);
