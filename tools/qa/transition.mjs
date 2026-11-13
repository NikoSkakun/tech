#!/usr/bin/env node
// Capture a chapter transition as a frame sequence (contact sheet) and measure hitches.
//
//   node tools/qa/transition.mjs <fromChapter>[/step] <toChapter>[/step] [options]
//
//   --frames N     number of captured frames across the transition (default 12)
//   --size WxH     viewport (default 1280x720)     --q <tier> (default high)
//   --out <dir>    output directory (default /srv/electricity/qa/$QA_ID/transitions)
//
// Pass 1 (deterministic): the clock is paused, the transition is stepped in fixed increments and a screenshot
// is taken at each — proves "no blank frame" and shows the scale-zoom.
// Pass 2 (real time): the same navigation runs live while frame intervals are recorded — reports the longest
// frame during loading and during the zoom (budget: no hitch > 50 ms).
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appErrors, appUrl, baseUrl, ensureDir, fmt, launch, openApp, outRoot, parseArgs, parseSize, screenshot } from './lib.mjs';

const args = parseArgs();
const [from, to] = args._.map(String);
if (!from || !to) {
  console.error('usage: transition.mjs <fromChapter>[/step] <toChapter>[/step]');
  process.exit(2);
}
const [width, height] = parseSize(args.size, [1280, 720]);
const frames = Number(args.frames ?? 12);
const q = String(args.q ?? 'high');
const base = baseUrl(args);
const outDir = ensureDir(typeof args.out === 'string' ? args.out : `${outRoot(args)}/transitions`);
const tag = `${from.split('/')[0]}--${to.split('/')[0]}`;
const [toChapter, toStep] = to.split('/');

const { browser, page } = await launch({ width, height });
let failed = false;
try {
  /* ---- pass 1: stepped capture ---- */
  await openApp(page, appUrl(base, { route: from, q }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__app.pause());
  const shots = [await screenshot(page, `${outDir}/${tag}-00.jpg`)];
  // start navigating; with the clock paused the zoom waits at progress 0 once the target chunk is ready
  await page.evaluate(([c, s]) => void window.__app.engine.nav.goto(c, s), [toChapter, toStep ?? null]);
  await page.waitForFunction(() => window.__app.engine.store.get().transition.phase === 'animating', null, { timeout: 30000 });
  const duration = 1.5; // slightly longer than MOTION.transition so the last frame is the settled scene
  const per = Math.round((duration * 60) / frames);
  for (let i = 1; i <= frames; i++) {
    await page.evaluate((n) => window.__app.step(1 / 60, n), per);
    shots.push(await screenshot(page, `${outDir}/${tag}-${String(i).padStart(2, '0')}.jpg`));
  }
  const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));
  console.log(execFileSync(sheetTool, [`${outDir}/${tag}-sheet.jpg`, '--cols', '4', '--tile', '480', '--title', `transition ${from} → ${to} (${per} frames ≈ ${(per / 60).toFixed(2)} s between tiles)`, ...shots]).toString().trim());

  /* ---- pass 2: live hitch measurement ---- */
  await openApp(page, appUrl(base, { route: from, q, extra: { n: 'live' } }));
  await page.waitForTimeout(1200);
  const hitch = await page.evaluate(
    async ([c, s]) => {
      const app = window.__app;
      const store = app.engine.store;
      const samples = [];
      let last = performance.now();
      let running = true;
      const tick = (now) => {
        samples.push({ dt: now - last, phase: store.get().transition.phase, progress: app.engine.pipeline.transition.progress });
        last = now;
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await app.goto(c, s);
      running = false;
      const max = (phase) => Math.max(0, ...samples.filter((x) => x.phase === phase).map((x) => x.dt));
      const count = (phase) => samples.filter((x) => x.phase === phase).length;
      const worst = samples.filter((x) => x.phase === 'animating').sort((a, b) => b.dt - a.dt)[0];
      return {
        loadingMax: max('loading'),
        animatingMax: max('animating'),
        loadingFrames: count('loading'),
        animatingFrames: count('animating'),
        worstAt: worst ? worst.progress : 0,
        over50: samples.filter((x) => x.phase === 'animating' && x.dt > 50).length,
      };
    },
    [toChapter, toStep ?? null],
  );
  console.log(
    `live ${from} → ${to}: longest frame while loading ${fmt(hitch.loadingMax, 1)} ms (${hitch.loadingFrames} frames), during zoom ${fmt(hitch.animatingMax, 1)} ms (${hitch.animatingFrames} frames; worst at progress ${fmt(hitch.worstAt)}, ${hitch.over50} frame(s) > 50 ms)`,
  );
  if (hitch.animatingMax > 50) {
    failed = true;
    console.log('  FAIL hitch > 50 ms during the transition animation');
  }
  if (hitch.loadingMax > 50) console.log('  note: a frame > 50 ms occurred while the target chapter was loading (scene still live)');
  const errors = await appErrors(page);
  if (errors.length) {
    failed = true;
    for (const e of errors.slice(0, 8)) console.log(`  [${e.level}] ${e.message.slice(0, 240)}`);
  }
} catch (e) {
  failed = true;
  console.error(`transition capture failed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
