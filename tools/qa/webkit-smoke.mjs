#!/usr/bin/env node
// WebKit smoke test with an iPhone profile (F5, docs/MOBILE.md) — the nearest thing to iOS Safari this machine
// has: Playwright's WebKit build (Linux port, software GL), the iPhone 13 device descriptor (390×844 @3, touch,
// mobile viewport, Safari user agent). It is NOT iOS Safari: no notch, no browser bars, no iOS audio or memory
// rules — see the real-device checklist in docs/MOBILE.md.
//
//   node tools/qa/webkit-smoke.mjs [chapter …] [--landscape] [--out <dir>] [--port / --base]
//
// Checks, with touch taps only: the app boots and classifies the device as a phone (sheet shell, `mobile`
// tier); every step of the chapters is reached with the «Далі» button; each sheet tab opens by a tap; no
// console output; no control off screen; text ≥ 14 CSS px. Screenshots → <out>/webkit-iphone-sheet.jpg
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appUrl, baseUrl, ensureDir, outRoot, parseArgs, playwright } from './lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const outDir = ensureDir(typeof args.out === 'string' ? args.out : `${outRoot(args)}/webkit`);
const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));
const wanted = args._.map(String);
const device = playwright.devices[args.landscape ? 'iPhone 13 landscape' : 'iPhone 13'];
const tag = args.landscape ? 'iphone-landscape' : 'iphone';
const problems = [];
const frame = (page, n = 30) => page.evaluate((k) => window.__app.step(1 / 60, k), n);

let browser;
try {
  browser = await playwright.webkit.launch({ headless: true });
} catch (e) {
  console.log(`webkit: cannot launch — ${String(e.message).split('\n')[0]}`);
  process.exit(1);
}
try {
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`page error: ${String(e).slice(0, 200)}`));
  await page.goto(appUrl(base, { q: 'auto', freeze: 2 }), { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout: 120000 });
  await page.evaluate(() => window.__app.ready);
  const info = await page.evaluate(() => ({
    gpu: window.__app.gpu(),
    device: window.__app.device(),
    tier: window.__app.stats().quality,
    chapters: window.__app.listChapters(),
    coarse: matchMedia('(pointer: coarse)').matches,
    fullscreen: window.__app.engine.canFullscreen,
    ua: navigator.userAgent,
  }));
  console.log(`webkit ${tag}: ${info.gpu.renderer.slice(0, 60)} · ${info.device.formFactor}/${info.device.orientation}/${info.device.pointer} · tier ${info.tier} · fullscreen API ${info.fullscreen}`);
  if (info.device.formFactor !== 'phone') problems.push(`classified as ${info.device.formFactor} (pointer: coarse = ${info.coarse})`);
  if (info.tier !== 'mobile') problems.push(`tier ${info.tier}, expected mobile`);
  const tap = async (name) => {
    const box = await page.evaluate((n) => window.__ui.locate(n), name);
    if (!box) return false;
    await page.touchscreen.tap(box.x, box.y);
    return true;
  };
  const shots = [];
  for (const chapter of info.chapters.filter((c) => (wanted.length ? wanted.includes(c.id) || wanted.includes(c.fullId) : c.volume !== '_dev' && c.volume !== '_demo'))) {
    await page.evaluate(([c, s]) => window.__app.goto(c, s, { instant: true }), [chapter.fullId, chapter.steps[0].id]);
    await page.evaluate(() => window.__app.settled());
    // a session without a deep link lands on the title screen: leave it by its own button, by touch
    if ((await page.evaluate(() => window.__ui.overlay())) !== null) {
      await page.evaluate(() => window.__ui.close());
      await frame(page, 40);
    }
    for (const [i, step] of chapter.steps.entries()) {
      const where = `${chapter.id}/${step.id}`;
      if (i > 0) {
        if (!(await tap('nav-next'))) problems.push(`${where}: no «Далі» button on screen`);
        await page.evaluate(() => window.__app.settled());
      }
      await frame(page);
      const pos = await page.evaluate(() => window.__app.position());
      if (pos.stepId !== step.id) problems.push(`${where}: «Далі» by touch landed on ${pos.chapterId}/${pos.stepId}`);
      const file = `${outDir}/${tag}-${chapter.id}-${step.id}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
      shots.push(file);
      const sheet = await page.evaluate(() => window.__ui.sheet());
      for (const t of sheet?.tabs.filter((x) => x !== 'text') ?? []) {
        await tap(`sheet-tabs:${t}`);
        await frame(page, 40);
        if ((await page.evaluate(() => window.__ui.sheet().tab)) !== t) problems.push(`${where}: tab «${t}» did not open by touch`);
      }
      if (sheet && sheet.tabs.length > 1) {
        await tap('sheet-tabs:text');
        await frame(page, 40);
      }
      const r = await page.evaluate(() => {
        const errors = window.__app.errors();
        window.__app.clearErrors();
        return { errors, off: window.__ui.offscreen().map((n) => n.name), small: window.__ui.smallText(14) };
      });
      for (const e of r.errors) problems.push(`${where}: console ${e.level}: ${e.message.slice(0, 200)}`);
      if (r.off.length) problems.push(`${where}: off screen: ${r.off.slice(0, 3).join(', ')}`);
      if (r.small.length) problems.push(`${where}: text below 14 px: ${r.small.slice(0, 2).join('; ')}`);
      console.log(`  ${where} ok`);
    }
  }
  if (shots.length)
    console.log('  ' + execFileSync(sheetTool, [`${outDir}/webkit-${tag}-sheet.jpg`, '--cols', args.landscape ? '3' : '6', '--tile', args.landscape ? '560' : '300', '--title', `WebKit · ${tag}`, ...shots]).toString().trim());
} catch (e) {
  problems.push(String(e.message).split('\n')[0]);
} finally {
  await browser.close();
}
for (const p of [...new Set(problems)].slice(0, 30)) console.log(`  FAIL ${p}`);
console.log(`webkit ${tag}: ${problems.length ? `${problems.length} problem(s)` : 'PASS'}`);
process.exit(problems.length ? 1 : 0);
