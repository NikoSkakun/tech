#!/usr/bin/env node
// Cross-browser smoke test: every step of every chapter in Playwright's Firefox and WebKit builds.
//
//   node tools/qa/xbrowser.mjs [chapterId …] [options]
//
//   --browsers firefox,webkit   which engines (default both; `chromium` = system Chrome on the GPU)
//   --size WxH                  viewport (default 960x540 — software GL is acceptable and slow)
//   --q <tier>                  quality tier (default medium)
//   --out <dir>                 output (default /srv/electricity/qa/$QA_ID/xbrowser)
//   --port / --base             where the app is served
//
// For each browser it checks: WebGL2 context, no shader compile/link errors, no console errors or warnings,
// every step reachable; it saves a screenshot per step and a contact sheet per browser, and prints which
// optional WebGL features the engine found (float render targets, timer queries, parallel shader compile).
// Firefox needs a (virtual) display for WebGL:  xvfb-run -a node tools/qa/xbrowser.mjs
// One-time setup on lenovo:  cd app && pnpm exec playwright-core install firefox webkit
//                            (+ `sudo pnpm exec playwright-core install-deps firefox webkit` if libraries are missing)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appUrl, baseUrl, ensureDir, outRoot, parseArgs, parseSize, playwright, GPU_ARGS } from './lib.mjs';

const args = parseArgs();
const browsers = String(args.browsers ?? 'firefox,webkit').split(',').filter(Boolean);
const [width, height] = parseSize(args.size, [960, 540]);
const q = String(args.q ?? 'medium');
const base = baseUrl(args);
const outDir = ensureDir(typeof args.out === 'string' ? args.out : `${outRoot(args)}/xbrowser`);
const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));
const wanted = args._.map(String);
let failed = false;

for (const name of browsers) {
  const problems = [];
  let browser;
  try {
    browser =
      name === 'chromium'
        ? await playwright.chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: GPU_ARGS })
        : await playwright[name].launch({
            // Firefox has no GL at all in true headless mode on Linux ("Exhausted GL driver options"): it needs
            // a display. Run this tool under `xvfb-run -a` and Firefox starts headed inside the virtual display.
            headless: !(name === 'firefox' && process.env.DISPLAY),
            // headless Firefox refuses WebGL on a software rasteriser unless told otherwise
            firefoxUserPrefs:
              name === 'firefox'
                ? { 'webgl.force-enabled': true, 'webgl.disable-fail-if-major-performance-caveat': true, 'layers.acceleration.force-enabled': true }
                : undefined,
          });
  } catch (e) {
    console.log(`${name}: cannot launch — ${String(e.message).split('\n')[0]}`);
    failed = true;
    continue;
  }
  try {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(appUrl(base, { q, freeze: 2 }), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => typeof window.__app === 'object', null, { timeout: 120000 });
    const booted = await page
      .evaluate(() => window.__app.ready.then(() => true))
      .catch((e) => String(e.message).split('\n')[0]);
    if (booted !== true) {
      const fatal = await page.evaluate(() => document.getElementById('fatal-title')?.textContent ?? '');
      throw new Error(`boot failed: ${booted} ${fatal}`);
    }
    const info = await page.evaluate(() => {
      const gl = window.__app.engine.renderer.getContext();
      const has = (e) => gl.getExtension(e) !== null;
      return {
        ...window.__app.gpu(),
        floatTargets: has('EXT_color_buffer_float') || has('EXT_color_buffer_half_float'),
        timerQuery: has('EXT_disjoint_timer_query_webgl2'),
        parallelCompile: has('KHR_parallel_shader_compile'),
        chapters: window.__app.listChapters(),
        hud: window.__app.engine.flags?.hud ?? "gl",
      };
    });
    console.log(
      `${name}: ${info.renderer.slice(0, 70)} · webgl2 ${info.webgl2} · float targets ${info.floatTargets} · timer query ${info.timerQuery} · parallel compile ${info.parallelCompile} · interface ${info.hud}`,
    );
    if (!info.webgl2) problems.push('no WebGL2 context');
    const shots = [];
    // chapters may be named by id (`atom`) or by full id (`electricity/atom`)
    for (const chapter of info.chapters.filter((c) => wanted.length === 0 || wanted.includes(c.id) || wanted.includes(c.fullId))) {
      for (const step of chapter.steps) {
        const t0 = Date.now();
        await page.evaluate(([c, s]) => window.__app.goto(c, s), [chapter.fullId, step.id]);
        const pos = await page.evaluate(() => window.__app.position());
        if (`${pos.volumeId}/${pos.chapterId}` !== chapter.fullId || pos.stepId !== step.id) problems.push(`${chapter.fullId}/${step.id}: landed on ${pos.volumeId}/${pos.chapterId}/${pos.stepId}`);
        const file = `${outDir}/${name}-${chapter.id}-${step.id}.jpg`;
        await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        shots.push(file);
        const errors = await page.evaluate(() => {
          const e = window.__app.errors();
          window.__app.clearErrors();
          return e;
        });
        for (const e of errors) problems.push(`${chapter.id}/${step.id}: console ${e.level}: ${e.message.slice(0, 260)}`);
        console.log(`  ${name} ${chapter.id}/${step.id} ok=${errors.length === 0} (${Date.now() - t0} ms)`);
      }
    }
    for (const e of pageErrors) problems.push(`page error: ${e.slice(0, 260)}`);
    if (shots.length) {
      console.log('  ' + execFileSync(sheetTool, [`${outDir}/${name}-sheet.jpg`, '--cols', '4', '--tile', '480', '--title', `${name} — ${info.renderer.slice(0, 60)}`, ...shots]).toString().trim());
    }
  } catch (e) {
    problems.push(String(e.message).split('\n')[0]);
  } finally {
    await browser.close();
  }
  if (problems.length) {
    failed = true;
    console.log(`${name}: ${problems.length} problem(s)`);
    for (const p of [...new Set(problems)].slice(0, 20)) console.log(`  FAIL ${p}`);
  } else {
    console.log(`${name}: PASS`);
  }
}
process.exit(failed ? 1 : 0);
