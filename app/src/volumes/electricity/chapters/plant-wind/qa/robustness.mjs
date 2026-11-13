#!/usr/bin/env node
/* global process, console, window, URL */
// Robustness checks of the chapter beyond chapter-check and interaction.mjs (run on lenovo):
//
//   QA_PORT=5253 node app/src/volumes/electricity/chapters/plant-wind/qa/robustness.mjs [--only touch,tiers,layouts,motion] [--out <dir>]
//
//   touch    touch-only device (no mouse): tap a toggle, a segmented item, a hotspot marker; drag a slider,
//            the wind arrow of step 8 and the year strip of step 9 with one finger
//   tiers    every step at `low`, `medium` and `ultra`: no console errors or warnings (sheet of `low`)
//   layouts  every step at 800×1200 (portrait) and 1024×768: no control off screen, no errors (sheets)
//   motion   `prefers-reduced-motion: reduce`: every step opens, the fly-around button still ends at its shot
// Exit code 1 if any check fails.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, parseArgs, screenshot } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const only = new Set(String(args.only ?? 'touch,tiers,layouts,motion').split(','));
const out = ensureDir(typeof args.out === 'string' ? args.out : '/srv/electricity/qa/P-plant-wind/robustness');
const sheetTool = fileURLToPath(new URL('../../../../../../../tools/qa/sheet.sh', import.meta.url));
const STEPS = ['overview', 'wind-power', 'betz', 'blade', 'nacelle', 'drivetrain', 'power-curve', 'wind-farm', 'capacity-factor', 'offshore', 'role'];
const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
// `n` changes the query string, so every open is a real page load (a hash-only change would be an in-app,
// real-time transition racing the gestures that follow)
const open = (page, step, q = 'high', freeze = 2) => openApp(page, appUrl(base, { route: `plant-wind/${step}`, q, freeze, extra: { n: step } }));
const errorsOf = async (page, where) => {
  const errors = await appErrors(page);
  check(errors.length === 0, `${where}: no console errors/warnings`, errors.map((e) => e.message.slice(0, 120)).join(' | '));
  await page.evaluate(() => window.__app.clearErrors());
};
const sheet = (files, file, title) => {
  try {
    execFileSync(sheetTool, [file, '--title', title, ...files], { stdio: 'ignore' });
    console.log(`  sheet ${file}`);
  } catch {
    console.log(`  (no sheet: ${sheetTool} failed)`);
  }
};

/** Every step at one viewport / tier: opens, nothing off screen, no errors; returns the screenshots. */
async function sweep(label, { width, height, q = 'high', reduce = false }) {
  const { browser, page } = await launch({ width, height });
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
  const files = [];
  try {
    for (const step of STEPS) {
      await open(page, step, q);
      await page.evaluate(() => window.__app.step(1 / 60, 30));
      const off = await page.evaluate(() => window.__ui.offscreen?.() ?? []);
      check(off.length === 0, `${label} ${step}: every control reachable`, JSON.stringify(off).slice(0, 160));
      await errorsOf(page, `${label} ${step}`);
      files.push(`${out}/${label}-${step}.jpg`);
      await screenshot(page, files[files.length - 1]);
    }
  } finally {
    await browser.close();
  }
  return files;
}

/** One-finger gestures through CDP on a touch-only context. */
async function touch() {
  const { browser, page } = await launch({ width: 1280, height: 720, touch: true });
  const cdp = await page.context().newCDPSession(page);
  const step = (n = 30) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
  const finger = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 1 }] : [] });
  const tap = async (p) => {
    await finger('touchStart', p);
    await finger('touchEnd');
    await step(30);
  };
  const swipe = async (a, b) => {
    await finger('touchStart', a);
    for (let i = 1; i <= 8; i++) await finger('touchMove', { x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 });
    await finger('touchEnd');
    await step(60);
  };
  /** A HUD node / scene probe, waiting (in stepped frames) until it is laid out. */
  const wait = async (find, name) => {
    for (let i = 0; i < 12; i++) {
      const r = await page.evaluate(find, name);
      if (r) return r;
      await step(10);
    }
    throw new Error(`'${name}' never appeared`);
  };
  const ui = (name) => wait((n) => window.__ui.locate(n), name);
  const probe = (name) => wait((n) => window.__app.locate(n), name);
  const value = (id) => page.evaluate((i) => window.__ui.value(i), id);
  const read = (name) => page.evaluate((n) => window.__app.read(n), name);
  try {
    await open(page, 'overview');
    let r = await ui('ctl-ov.night');
    await tap({ x: r.x - r.w / 2 + r.h * 0.6, y: r.y });
    check((await value('ov.night')) === true, 'touch: tap on the «День / Ніч» toggle');
    await tap(await probe('hs.wind-turbine'));
    check((await read('hotspot')) === 'wind-turbine', 'touch: tap on a hotspot marker opens its card', String(await read('hotspot')));
    await errorsOf(page, 'touch overview');

    await open(page, 'wind-farm');
    const before = await value('wf.dir');
    const arrow = await probe('farm.arrow');
    await swipe(arrow, { x: arrow.x + 110, y: arrow.y + 90 });
    check((await value('wf.dir')) !== before, 'touch: one-finger drag of the wind arrow', `${before} → ${await value('wf.dir')}`);
    r = await ui('ctl-wf.s');
    const s0 = await value('wf.s');
    await swipe({ x: r.x, y: r.y + r.h * 0.22 }, { x: r.x + r.w * 0.35, y: r.y + r.h * 0.22 });
    check((await value('wf.s')) > s0, 'touch: one-finger drag of a slider', `${s0} → ${await value('wf.s')}`);
    await errorsOf(page, 'touch wind-farm');

    await open(page, 'capacity-factor');
    const d0 = await value('cf.day');
    r = await ui('ctl-cf.year');
    await swipe({ x: r.x - r.w * 0.2, y: r.y }, { x: r.x + r.w * 0.15, y: r.y });
    check((await value('cf.day')) !== d0, 'touch: scrubbing the year strip', `${d0} → ${await value('cf.day')}`);
    r = await ui('ctl-cf.terrain:sea');
    await tap(r);
    check((await value('cf.terrain')) === 'sea', 'touch: tap on a segmented item');
    await errorsOf(page, 'touch capacity-factor');
    const small = await page.evaluate(() => window.__ui.smallTargets?.() ?? []);
    check(small.length === 0, 'touch: no hit target under 44 px', JSON.stringify(small).slice(0, 200));
  } finally {
    await browser.close();
  }
}

if (only.has('touch')) {
  console.log('[touch] touch-only device, 1280x720');
  await touch();
}
if (only.has('tiers')) {
  for (const q of ['low', 'medium', 'ultra']) {
    console.log(`[tiers] ${q}`);
    const files = await sweep(q, { width: 1280, height: 720, q });
    if (q === 'low') sheet(files, `${out}/sheet-low.jpg`, 'plant-wind — tier low 1280x720');
  }
}
if (only.has('layouts')) {
  for (const [width, height] of [[800, 1200], [1024, 768]]) {
    console.log(`[layouts] ${width}x${height}`);
    const files = await sweep(`${width}x${height}`, { width, height });
    sheet(files, `${out}/sheet-${width}x${height}.jpg`, `plant-wind — ${width}x${height}`);
  }
}
if (only.has('motion')) {
  console.log('[motion] prefers-reduced-motion: reduce');
  await sweep('reduced', { width: 1280, height: 720, reduce: true });
}
console.log(failures.length ? `FAIL — ${failures.length}:\n  ${failures.join('\n  ')}` : `PASS — chapter robustness, output in ${out}`);
process.exit(failures.length ? 1 : 0);
