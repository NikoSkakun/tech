#!/usr/bin/env node
// Acceptance check of one chapter (PLAN §5 "Критерії приймання модуля", items 2, 3, 6).
//
//   node tools/qa/chapter-check.mjs <chapter> [options]
//
//   <chapter> is a chapter id (`atom`: looked up in the default volume first, then in the others — so
//   `_sandbox-ui` still works) or a full id `<volume>/<chapter>` (`electricity/atom`, `_demo/signal`).
//
// What it does:
//   1. deep link  — every step opened by a fresh page load of #/<chapter>/<step> (deterministic clock),
//                   screenshot per step → contact sheet <out>/<chapter>/sheet-<W>x<H>.jpg
//   2. sequential — forward and backward through all steps with animated transitions
//   3. random     — seeded random jumps, including rapid step spamming; final position must be the last request;
//                   screenshots of each step entered this way → sheet-random.jpg (compare with the deep-link sheet)
//   4. perf       — frame time per step = GPU timer queries + CPU (budget: avg ≤ 8 ms at 1080p high);
//                   the blocking-readPixels wall time is printed as a pessimistic cross-check
//   5. leaks      — leave to another chapter and come back ×3; geometry / texture / program counts must not grow
//   Deep-link frames are also checked for colour discipline: more than --max-hues (4) strong hue families fails.
//   Sizes (M3): --sizes all = 1920x1080 (primary), 1280x720, 3840x2160; or --sizes WxH,WxH…; default --size
//   (1920x1080) plus --also-size. Every size gets deep-link screenshots, a contact sheet and the layout checks;
//   stats, hue check, perf and the other passes run at the primary size. 1280x720 and 1920x1080 are always
//   layout-checked (by resizing when they are not in the size list).
//   Layout (M3), per deep-linked step:
//     - controls off screen: `window.__ui.offscreen()` (HUD hook) must return an empty list, at every size;
//     - text size at 1280x720: every visible world Text3D (`__app.textSizes()`) must be ≥ --min-text (16) px-eq
//       (px at 1080p). ui3d surfaces are not measured by the engine (`__ui.worldTextSizes()` is used if present);
//     - SDF text magnified more than --sdf-max-mag (4) × the atlas resolution → warning (soft corners);
//     - interface text (D8, both renderers, every size): `__ui.textSizes()` below `UI.text.caption` (15 units =
//       10.5 CSS px at 1280x720) → fail; chrome regions overlapping (`__ui.overlaps()`) → fail (dom-parts.mjs).
//   Interface (D8): --hud dom|gl opens every page with ?hud= (default: the app's); report.gpu.hud names it.
//   Zoom (D8): --zoom 2 = 200 % browser zoom: every size's CSS viewport halved at DPR 2 (1920x1080 → 960x540);
//   offscreen / text / overlap checks as above; the DPR-2 compare is skipped; output in <out>/<chapter>-zoom2/.
//   Perf (M3): --perf-rounds (3) interleaved passes over all steps; the minimum per step is held against the
//   budget and the spread (max − min) is reported — robust to other GPU users on a shared machine. With
//   3840x2160 in the size list a second perf pass runs at 4K: warn above --budget-4k (14 ms), fail above
//   --fail-4k (16.6 ms). A step whose best sample is over the (warn) budget gets up to 3 more samples, 4 s apart,
//   before it is reported — sustained load from another GPU user otherwise fails a chapter.
//   DPR 2 (with --sizes all or --dpr2): every step at 1920x1080 with deviceScaleFactor 2; HUD node rectangles,
//   probe positions and small-hit-target list must match DPR 1 within 2 CSS px.
//   Fails (exit 1) on any console error or warning, page error, third-party network request, wrong position,
//   leak, or frame-time budget overrun (use --no-perf-fail to only report perf). Warnings never fail.
//
//   Mobile (F5): --mobile [all|pp,pa,pl,tp,tl] runs tools/qa/mobile-check.mjs on the touch profiles afterwards
//   (phone portrait / small / landscape, tablet portrait / landscape — docs/MOBILE.md §6); its failures fail the run.
// Options: --size WxH (1920x1080) · --sizes all|WxH,… · --also-size WxH · --q <tier> (high) · --freeze <s> (3)
//          --out <dir> · --port/--base · --other <chapter> chapter used for the leave/return test
//          --budget <ms> (8) · --budget-4k <ms> (14) · --fail-4k <ms> (16.6) · --no-perf-fail · --dpr2
//          --skip perf,leaks,random,layout,dpr2 · --perf-rounds <n> (3) · --perf-frames <n> (90)
//          --min-text <px-eq> (16) · --sdf-max-mag <×> (4) · --hud dom|gl · --zoom <z> (1)
import { execFileSync } from 'node:child_process';
import { compareSnapshots, confirmPerf, layoutAt, measurePerf, settleFrames, uiSnapshot } from './check-parts.mjs';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  appErrors,
  appUrl,
  baseUrl,
  decodePng,
  ensureDir,
  fmt,
  hueFamilies,
  launch,
  openApp,
  outRoot,
  parseArgs,
  parseSize,
  screenshot,
  thirdPartyRequests,
} from './lib.mjs';

const args = parseArgs();
// the argument as given; replaced by the full id `<volume>/<chapter>` once the app has listed its chapters
let chapterId = String(args._[0] ?? '');
if (!chapterId) {
  console.error('usage: chapter-check.mjs <chapter | volume/chapter> [--size WxH] [--q tier] [--out dir]');
  process.exit(2);
}
const ALL_SIZES = [[1920, 1080], [1280, 720], [3840, 2160]];
// --zoom <z> (D8): browser zoom at z×100 % — each size keeps its device pixels, the CSS viewport shrinks by z and
// the device pixel ratio grows by z (200 % on a 1080p screen = 960x540 CSS at DPR 2; docs/HUD_DOM.md §14)
const zoom = Math.max(1, Number(args.zoom ?? 1));
const zoomed = (list) => list.map(([w, h]) => [Math.round(w / zoom), Math.round(h / zoom)]);
const sizes = zoomed(
  args.sizes === 'all'
    ? ALL_SIZES
    : typeof args.sizes === 'string'
      ? args.sizes.split(',').map((v) => parseSize(v))
      : [parseSize(args.size), ...(typeof args['also-size'] === 'string' ? [parseSize(args['also-size'])] : [])],
);
const [width, height] = sizes[0];
const has = (w, h) => sizes.some(([a, b]) => a === w && b === h);
const q = String(args.q ?? 'high');
const freeze = Number(args.freeze ?? 3);
const budget = Number(args.budget ?? 8);
const maxHues = Number(args['max-hues'] ?? 4);
const perfRounds = Math.max(1, Number(args['perf-rounds'] ?? 3));
const perfFrames = Math.max(30, Number(args['perf-frames'] ?? 90));
const minText = Number(args['min-text'] ?? 16);
const sdfMaxMag = Number(args['sdf-max-mag'] ?? 4);
const budget4k = Number(args['budget-4k'] ?? 14);
const fail4k = Number(args['fail-4k'] ?? 16.6);
const dpr2 = (args.sizes === 'all' || Boolean(args.dpr2)) && !String(args.skip ?? '').includes('dpr2') && zoom === 1;
// reference sizes that are always layout-checked; the ones missing from `sizes` are reached by resizing
const EXTRA_LAYOUT = zoomed([[1280, 720], [1920, 1080]]).filter(([w, h]) => !has(w, h));
const base = baseUrl(args);
const skip = new Set(String(args.skip ?? '').split(',').filter(Boolean));
const outDir = ensureDir(`${outRoot(args)}/${chapterId.replace(/\//g, '-')}${zoom > 1 ? `-zoom${zoom}` : ''}`);
const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));

const failures = [];
const warnings = [];
const report = { chapterId, size: `${width}x${height}`, sizes: sizes.map(([w, h]) => `${w}x${h}`), quality: q, gpu: null, steps: [], perf: [], perf4k: [], layout: [], dpr2: [], leaks: null, failures, warnings, notes: [] };
report.zoom = zoom;
const warn = (msg) => {
  warnings.push(msg);
  console.log(`  WARN ${msg}`);
};
const note = (msg) => {
  if (report.notes.includes(msg)) return;
  report.notes.push(msg);
  console.log(`  note: ${msg}`);
};
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL ${msg}`);
};
const checkErrors = async (page, where) => {
  const errors = await appErrors(page);
  for (const e of errors) fail(`${where}: console ${e.level}: ${e.message.slice(0, 240)}`);
  await page.evaluate(() => window.__app.clearErrors());
};
const sheet = (file, images, cols, title) => {
  try {
    console.log('  ' + execFileSync(sheetTool, [file, '--cols', String(cols), '--tile', '640', '--title', title, ...images]).toString().trim());
  } catch (e) {
    fail(`contact sheet failed: ${e.message.slice(0, 200)}`);
  }
};

const layoutOpts = (step) => ({ step, minText, sdfMaxMag, fail, note, warn });

/** Layout checks at the current size, then at the reference sizes missing from the size list (by resizing). */
const layoutCheck = async (page, step) => {
  report.layout.push(await layoutAt(page, layoutOpts(step)));
  if (!EXTRA_LAYOUT.length) return;
  const restore = page.viewportSize();
  for (const [w, h] of EXTRA_LAYOUT) {
    await page.setViewportSize({ width: w, height: h });
    await settleFrames(page);
    report.layout.push(await layoutAt(page, layoutOpts(step)));
  }
  await page.setViewportSize(restore);
  await settleFrames(page, 1);
};
const dpr1Snapshots = new Map();

const { browser, page, requests, pageErrors } = await launch({ width, height, dpr: zoom });
try {
  /* -------------------------------------------------------------------------------- 1. deep links */
  console.log(`[1/5] deep links — ${chapterId} @ ${sizes.map(([w, h]) => `${w}x${h}`).join(', ')} ${q}${zoom > 1 ? ` · zoom ${zoom * 100} % (DPR ${zoom})` : ''}`);
  report.gpu = await openApp(page, appUrl(base, { route: chapterId, q, freeze }));
  const chapters = await page.evaluate(() => window.__app.listChapters());
  // chapters come in library order (default volume first), so a short id prefers the default volume
  const chapter = chapters.find((c) => c.fullId === chapterId) ?? chapters.find((c) => c.id === chapterId);
  if (!chapter) throw new Error(`chapter '${chapterId}' is not registered (known: ${chapters.map((c) => c.fullId).join(', ')})`);
  chapterId = chapter.fullId;
  report.chapterId = chapterId;
  const where = (pos) => `${pos.volumeId}/${pos.chapterId}`;
  const steps = chapter.steps.map((s) => s.id);
  await checkErrors(page, 'boot');
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    const shots = [];
    for (const [i, step] of steps.entries()) {
      // a different query string forces a real page load, so this is a true deep link
      await openApp(page, appUrl(base, { route: `${chapterId}/${step}`, q, freeze, extra: { n: String(i) } }));
      const pos = await page.evaluate(() => window.__app.position());
      if (where(pos) !== chapterId || pos.stepId !== step) fail(`deep link ${step}: landed on ${where(pos)}/${pos.stepId}`);
      const file = `${outDir}/${String(i + 1).padStart(2, '0')}-${step}-${w}x${h}.jpg`;
      shots.push(await screenshot(page, file));
      if (w === width) {
        const s = await page.evaluate(() => window.__app.stats());
        report.steps.push({ step, drawCalls: s.drawCalls, triangles: s.triangles });
        if (s.drawCalls > 350) fail(`${step}: ${s.drawCalls} draw calls (budget 350)`);
        if (s.triangles > 1_500_000) fail(`${step}: ${s.triangles} triangles (budget 1.5 M)`);
        // colour discipline: a frame with 5–6 strong hue families reads as "rainbow" (STYLE_GUIDE §2)
        const hues = hueFamilies(decodePng(await page.screenshot({ type: 'png' })));
        report.steps[report.steps.length - 1].hues = hues;
        console.log(`  ${step.padEnd(18)} hue families: ${hues.families.join(', ')}`);
        if (hues.families.length > maxHues) fail(`${step}: ${hues.families.length} strong hue families (${hues.families.join(', ')}) — limit ${maxHues}; use one dominant hue + 1–2 accents`);
        if (!skip.has('layout')) await layoutCheck(page, step);
      } else if (!skip.has('layout')) report.layout.push(await layoutAt(page, layoutOpts(step)));
      if (dpr2 && w === 1920 && h === 1080) dpr1Snapshots.set(step, await uiSnapshot(page));
      await checkErrors(page, `deep link ${step}`);
    }
    sheet(`${outDir}/sheet-${w}x${h}.jpg`, shots, Math.min(3, steps.length), `${chapterId} — deep links ${w}x${h} ${q}`);
  }
  await page.setViewportSize({ width, height });

  /* -------------------------------------------------------------------------------- 2. sequential */
  console.log('[2/5] sequential navigation (animated)');
  await openApp(page, appUrl(base, { route: `${chapterId}/${steps[0]}`, q, freeze: 2 }));
  for (const step of [...steps.slice(1), ...steps.slice(0, -1).reverse()]) {
    await page.evaluate(([c, s]) => window.__app.goto(c, s), [chapterId, step]);
    const pos = await page.evaluate(() => window.__app.position());
    if (pos.stepId !== step) fail(`sequential → ${step}: position is ${pos.stepId}`);
  }
  await checkErrors(page, 'sequential');

  /* ------------------------------------------------------------------------------------ 3. random */
  if (!skip.has('random')) {
    console.log('[3/5] random-access navigation + step spamming');
    let seed = 12345;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const order = [];
    for (let i = 0; i < steps.length * 2; i++) order.push(steps[Math.floor(rand() * steps.length)]);
    // make sure every step is entered at least once from "somewhere else"
    for (const s of steps) if (!order.includes(s)) order.push(s);
    const seen = new Map();
    for (const step of order) {
      // spam: fire three other navigations without waiting, then the real target
      await page.evaluate(
        ([c, spam, target]) => {
          for (const s of spam) void window.__app.engine.nav.goto(c, s);
          return window.__app.goto(c, target);
        },
        [chapterId, [0, 1, 2].map(() => steps[Math.floor(rand() * steps.length)]), step],
      );
      const pos = await page.evaluate(() => window.__app.position());
      if (pos.stepId !== step) fail(`random → ${step}: position is ${pos.stepId}`);
      if (!seen.has(step)) seen.set(step, await screenshot(page, `${outDir}/random-${String(steps.indexOf(step) + 1).padStart(2, '0')}-${step}.jpg`));
    }
    await checkErrors(page, 'random');
    sheet(`${outDir}/sheet-random.jpg`, steps.map((s) => seen.get(s)).filter(Boolean), Math.min(3, steps.length), `${chapterId} — random access (compare with deep links)`);
  }

  /* -------------------------------------------------------------------------------------- 4. perf */
  if (!skip.has('perf')) {
    const perfPass = async ([w, h], warnAt, failAt, out) => {
      console.log(`[4/5] frame time per step @${w}x${h} (gpu + cpu; ${warnAt < failAt ? `warn > ${warnAt}, ` : ''}budget ${failAt} ms; min of ${perfRounds} interleaved rounds × ${perfFrames} frames)`);
      await page.setViewportSize({ width: w, height: h });
      await openApp(page, appUrl(base, { route: `${chapterId}/${steps[0]}`, q }));
      // the minimum per step is the chapter's own cost; the spread shows how noisy the shared GPU was
      const perf = await measurePerf(page, { chapterId, steps, rounds: perfRounds, frames: perfFrames });
      // over budget? re-sample those steps a few times after pauses before believing it (shared GPU)
      await confirmPerf(page, perf, { chapterId, limit: warnAt, frames: perfFrames });
      for (const step of steps) {
        const { best, samples, spread } = perf.get(step);
        out.push({ step, ...best, samples, spread });
        const gpu = best.gpuAvg === null ? 'n/a' : fmt(best.gpuAvg);
        console.log(`  ${step.padEnd(18)} frame ${fmt(best.frameAvg)} ms (gpu ${gpu} + cpu ${fmt(best.cpuAvg)}; sync ${fmt(best.syncAvg)}, p95 ${fmt(best.syncP95)}) · spread ${fmt(spread)} ms over ${samples.length} · ${best.drawCalls} calls · ${(best.triangles / 1000).toFixed(0)}k tris`);
        const msg = `${step} @${w}x${h}: min avg frame ${fmt(best.frameAvg)} ms (samples ${samples.map((f) => fmt(f)).join(' / ')})`;
        if (best.frameAvg > failAt && !args['no-perf-fail']) fail(`${msg} > ${failAt} ms`);
        else if (best.frameAvg > warnAt) warn(`${msg} > ${warnAt} ms`);
      }
      await checkErrors(page, `perf ${w}x${h}`);
    };
    await perfPass([width, height], budget, budget, report.perf);
    if (has(3840, 2160)) await perfPass([3840, 2160], budget4k, fail4k, report.perf4k);
    await page.setViewportSize({ width, height });
  }

  /* ------------------------------------------------------------------------------------- 5. leaks */
  if (!skip.has('leaks')) {
    // leave to another chapter: one of the same volume if there is one
    const other =
      typeof args.other === 'string'
        ? args.other
        : (chapters.find((c) => c.volume === chapter.volume && c.fullId !== chapterId) ?? chapters.find((c) => c.fullId !== chapterId))?.fullId;
    if (!other) {
      console.log('[5/5] leak check skipped: no other chapter to leave to');
    } else {
      console.log(`[5/5] leak check: ${chapterId} ⇄ ${other} ×3`);
      await openApp(page, appUrl(base, { route: `${chapterId}/${steps[0]}`, q, freeze: 1 }));
      const snap = () => page.evaluate(() => { const s = window.__app.stats(); return { geometries: s.geometries, textures: s.textures, programs: s.programs, tweens: s.tweens }; });
      const rounds = [await snap()];
      for (let i = 0; i < 3; i++) {
        await page.evaluate((c) => window.__app.goto(c), other);
        await page.evaluate(([c, s]) => window.__app.goto(c, s), [chapterId, steps[0]]);
        rounds.push(await snap());
      }
      report.leaks = { other, rounds };
      console.log('  ' + rounds.map((r) => `geo ${r.geometries} tex ${r.textures} prog ${r.programs}`).join('  →  '));
      // the first return may legitimately add engine-lifetime caches; after that nothing may grow
      const a = rounds[1];
      const b = rounds[3];
      for (const key of ['geometries', 'textures', 'programs']) {
        if (b[key] > a[key]) fail(`leak: ${key} grew ${a[key]} → ${b[key]} over two enter/leave cycles`);
      }
      await checkErrors(page, 'leaks');
    }
  }

  /* --------------------------------------------------------------------- 6. DPR 2 (4K laptop use) */
  if (dpr2) {
    console.log('[6/6] 1920x1080 at deviceScaleFactor 2: layout and hit targets must match DPR 1');
    const hi = await launch({ width: 1920, height: 1080, dpr: 2 });
    try {
      for (const [i, step] of steps.entries()) {
        await openApp(hi.page, appUrl(base, { route: `${chapterId}/${step}`, q, freeze, extra: { n: String(i), dpr: '2' } }));
        const snap = await uiSnapshot(hi.page);
        const ref = dpr1Snapshots.get(step);
        const diffs = ref ? compareSnapshots(ref, snap) : [];
        report.dpr2.push({ step, nodes: Object.keys(snap.nodes).length, probes: Object.keys(snap.probes).length, compared: Boolean(ref), diffs });
        for (const d of diffs.slice(0, 4)) fail(`${step} @1920x1080 DPR 2: ${d}`);
        if (!skip.has('layout')) report.layout.push({ dpr: 2, ...(await layoutAt(hi.page, layoutOpts(step))) });
        for (const e of await appErrors(hi.page)) fail(`DPR 2 ${step}: console ${e.level}: ${e.message.slice(0, 240)}`);
        await hi.page.evaluate(() => window.__app.clearErrors());
        if (i === 0) await screenshot(hi.page, `${outDir}/dpr2-${step}.jpg`);
      }
      for (const e of hi.pageErrors) fail(`DPR 2 page error: ${e.slice(0, 240)}`);
    } finally {
      await hi.browser.close();
    }
  }

  for (const e of pageErrors) fail(`page error: ${e.slice(0, 240)}`);
  const foreign = thirdPartyRequests(requests, base);
  for (const u of [...new Set(foreign)].slice(0, 10)) fail(`third-party request: ${u}`);
  report.requests = { total: requests.length, thirdParty: foreign.length };
} catch (e) {
  fail(`check aborted: ${e.message}`);
  try {
    for (const er of await appErrors(page)) fail(`console ${er.level}: ${er.message.slice(0, 240)}`);
  } catch {
    // the app is gone
  }
} finally {
  await browser.close();
}

writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
if (warnings.length) console.log(`${warnings.length} warning(s) (not failures) — see report.json`);
console.log(failures.length === 0 ? `PASS ${chapterId} — report: ${outDir}/report.json` : `FAILED ${chapterId}: ${failures.length} problem(s) — report: ${outDir}/report.json`);
// --mobile [profiles]: the touch profiles of tools/qa/mobile-check.mjs (F5, docs/MOBILE.md) after the desktop check
let mobileFailed = false;
if (args.mobile) {
  const tool = fileURLToPath(new URL('./mobile-check.mjs', import.meta.url));
  const pass = [chapterId, '--profiles', args.mobile === true ? 'all' : String(args.mobile)];
  for (const key of ['port', 'base', 'out']) if (typeof args[key] === 'string') pass.push(`--${key}`, args[key]);
  if (typeof args.skip === 'string' && args.skip.split(',').includes('perf')) pass.push('--skip', 'perf');
  try {
    execFileSync(process.execPath, [tool, ...pass], { stdio: 'inherit' });
  } catch {
    mobileFailed = true;
  }
}
process.exit(failures.length === 0 && !mobileFailed ? 0 : 1);
