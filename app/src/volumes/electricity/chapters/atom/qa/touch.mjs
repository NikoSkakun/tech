#!/usr/bin/env node
/* global process, console, window */
// Touch test of chapter `atom` (DECISIONS §57 b: every interaction works with one finger, nothing needs hover).
//
//   node app/src/volumes/electricity/chapters/atom/qa/touch.mjs --port 5251 [--size 1180x820] [--dpr 2]
//
// A touch-only browser context (no mouse): taps through `page.touchscreen`, one-finger drags through CDP
// `Input.dispatchTouchEvent`. Positions come from `__ui.locate` / `__app.locate` like in interactions.mjs.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';
import { advance, at, locate, locateNode, read, value } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height, touch: true, dpr: Number(args.dpr ?? 1) });
const cdp = await page.context().newCDPSession(page);
const results = [];
const check = (what, ok, detail = '') => {
  results.push(Boolean(ok));
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const tap = async (p) => {
  await page.touchscreen.tap(p.x, p.y);
  await advance(page, 0.3);
};
/** Compact layouts (tablet, portrait) share one sheet between «Опис» and «Керування»: open the controls. */
const showControls = async () => {
  const tab = await page.evaluate(() => window.__ui.locate('sheet-tabs:controls'));
  if (tab) await tap(tab);
};
const enter = async (id) => {
  await page.evaluate((s) => window.__app.goto('atom', s, { instant: true }), id);
  await advance(page, 1);
  await showControls();
};
const touch = (type, x, y) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }],
  });
/** One-finger drag from a point by (dx, dy) CSS px; returns the release function. */
const drag = async (p, dx, dy) => {
  await touch('touchStart', p.x, p.y);
  for (let i = 1; i <= 12; i++) await touch('touchMove', p.x + (dx * i) / 12, p.y + (dy * i) / 12);
  await advance(page, 0.5);
  return async () => {
    await touch('touchEnd');
    await advance(page, 0.3);
  };
};

let failed = true;
try {
  await openApp(page, appUrl(baseUrl(args), { route: 'atom/dive-in', q: 'high', freeze: 1 }));

  await enter('nucleus');
  const hero = await at(page, 'nucleus.hero');
  const centre = await at(page, 'nucleus.centre');
  const n = Math.hypot(hero.x - centre.x, hero.y - centre.y) || 1;
  const release = await drag(
    hero,
    ((hero.x - centre.x) / n) * height * 0.2,
    ((hero.y - centre.y) / n) * height * 0.2,
  );
  const r = (await read(page, 'nucleus')).r;
  check('nucleus: one-finger drag pulls the proton', r > 1.5, r.toFixed(2));
  await release();

  await enter('electron');
  await tap(await locate(page, 'add100'));
  check('electron: tap on a dock button', (await read(page, 'electron')).count === 100);
  await tap(await at(page, 'electron.scoop'));
  check('electron: tap on a scoop in the scene', (await read(page, 'electron')).count === 200);

  await enter('models');
  await tap(await locateNode(page, 'ctl-model:quantum'));
  check('models: tap on a segmented item', (await value(page, 'model')) === 'quantum');

  await enter('shells');
  await tap(await at(page, 'shells.tile'));
  check(
    'shells: tap on a tile (no hover needed)',
    (await read(page, 'shells')).z === 26,
    (await read(page, 'shells')).z,
  );

  await enter('atom-builder');
  await tap(await locateNode(page, 'ctl-nn:plus'));
  check('atom-builder: tap on «+»', (await read(page, 'builder')).nn === 1);
  const plus = await locateNode(page, 'ctl-nn:plus');
  await touch('touchStart', plus.x, plus.y);
  await advance(page, 1.4);
  await touch('touchEnd');
  await advance(page, 0.3);
  const held = (await read(page, 'builder')).nn;
  check('atom-builder: a held «+» auto-repeats under a finger', held >= 8 && held <= 12, held);
  await tap(await at(page, 'builder.basket'));
  check('atom-builder: tap on a basket', (await read(page, 'builder')).nn === held + 1);

  await enter('standard-model');
  await tap(await at(page, 'sm.token.electron'));
  check('standard-model: tap on a token opens its card', (await read(page, 'sm')).selected === 'electron');
  await tap(await at(page, 'sm.card'));
  check('standard-model: tap on the card closes it', (await read(page, 'sm')).selected === '');

  const small = await page.evaluate(() => window.__ui.offscreen());
  check('no control off screen', small.length === 0, small.slice(0, 3).join(', '));
  const errors = await appErrors(page);
  check(
    'no console errors or warnings',
    errors.length === 0,
    errors
      .slice(0, 2)
      .map((e) => e.message.slice(0, 140))
      .join(' | '),
  );
  failed = results.some((ok) => !ok);
  console.log(
    `${failed ? 'FAIL' : 'PASS'} atom touch — ${results.filter(Boolean).length}/${results.length} at ${width}x${height}`,
  );
} catch (e) {
  console.error(`touch test crashed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
