#!/usr/bin/env node
/* global process, console, window */
// The reader's hands on the stand of `prologue/dive` (F-stand-hands), driven by real pointer events on a frozen
// clock (`?freeze`): the battery strains and pops out, is carried (limits), dropped (falls, rests inside the loop),
// picked up and put back (lit again); the lamp turns sideways a little, screws in when dragged down, unscrews by
// itself when dragged up, is dropped, picked up and screwed home (lit again); leaving the step brings both home.
//
//   node app/src/volumes/circuit/chapters/prologue/qa/hands.mjs --port 5411 [--size 1280x720] [--frames <dir>]
//
// `--frames <dir>` records every second frame of each sequence (`<dir>/battery/`, `<dir>/lamp/`) for a video.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';
import { at, read } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const dir = typeof args.frames === 'string' ? args.frames : null;
const { browser, page } = await launch({ width, height });
let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
/** Inside the loop where let-go parts rest (shared/stage/hands/parts.ts `REST`), with a hair of tolerance. */
const REST = { x0: -2.27, x1: 2.27, z0: -1.72, z1: 1.23 };
const inside = (p) => p[0] >= REST.x0 && p[0] <= REST.x1 && p[2] >= REST.z0 && p[2] <= REST.z1;

let seq = 'battery';
let frameNo = 0;
let shotNo = 0;
const ptr = { x: 0, y: 0 };
const frame = async (k = 1) => {
  for (let i = 0; i < k; i++) {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    if (dir && frameNo++ % 2 === 0)
      await screenshot(page, `${dir}/${seq}/${String(shotNo++).padStart(4, '0')}.jpg`, 82);
  }
};
const state = async () => {
  const s = await read(page, 'prologue');
  return { ...s.hands, glow: s.glow };
};
const moveTo = async (x, y, frames) => {
  const x0 = ptr.x;
  const y0 = ptr.y;
  for (let i = 1; i <= frames; i++) {
    ptr.x = x0 + ((x - x0) * i) / frames;
    ptr.y = y0 + ((y - y0) * i) / frames;
    await page.mouse.move(ptr.x, ptr.y);
    await frame();
  }
};
const press = async (x, y) => {
  ptr.x = x;
  ptr.y = y;
  await page.mouse.move(x, y);
  await frame();
  await page.mouse.down();
  await frame();
};
const release = async () => {
  await page.mouse.up();
  await frame();
};
/** Steer the pointer until the probe `part` sits over the probe `over` (or `until` holds). */
const steer = async (part, over, until, frames = 120) => {
  for (let i = 0; i < frames; i++) {
    const s = await state();
    if (until(s)) return s;
    const a = await at(page, part);
    const b = await at(page, over);
    await moveTo(ptr.x + (b.x - a.x) * 0.3, ptr.y + (b.y - a.y) * 0.3, 1);
  }
  return state();
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/prologue/dive', freeze: 3 }));
  await frame(30);
  let s = await state();
  if (args.debug) { console.log(JSON.stringify(await read(page, 'prologue')).slice(0, 600)); await screenshot(page, String(args.debug)); }
  check('both parts start in place, the lamp lit', s.inPlace && s.glow > 0.9, `glow ${s.glow.toFixed(2)}`);

  /* ---------------------------------------------------------------- battery */
  const b0 = await at(page, 'hand-battery');
  await press(b0.x + 40, b0.y);
  let strained = 0;
  let popPx = 0;
  for (let i = 0; i < 60; i++) {
    await moveTo(ptr.x, ptr.y - 3, 1);
    s = await state();
    if (s.battery.state === 'strain') strained++;
    if (s.battery.state === 'held') {
      popPx = b0.y - ptr.y;
      break;
    }
  }
  check('the battery strains in its clamps first, then pops out', strained >= 5 && s.battery.state === 'held',
    `${strained} frames of strain, out after ${popPx.toFixed(0)} px`);
  await frame(24);
  s = await state();
  check('battery out: the circuit is broken, the lamp goes dark', !s.inPlace && s.glow < 0.15, `glow ${s.glow.toFixed(2)}`);
  await moveTo(width * 0.4, height * 0.45, 30);
  await frame(10);
  s = await state();
  check('it follows the pointer while held', s.battery.state === 'held', JSON.stringify(s.battery.at));
  await moveTo(width * 0.4, 10, 25);
  await frame(15);
  s = await state();
  check('not past the far wire', s.battery.at[2] >= -1.851, `z ${s.battery.at[2]}`);
  await moveTo(5, height * 0.45, 25);
  await frame(15);
  s = await state();
  check('not past the stand\'s left edge', s.battery.at[0] >= -3.3 + 1.2, `x ${s.battery.at[0]}`);
  await moveTo(width * 0.42, height * 0.42, 25);
  await release();
  await frame(200);
  s = await state();
  check('let go, it falls and comes to rest inside the loop', s.battery.state === 'free' && s.battery.asleep && inside(s.battery.at),
    JSON.stringify(s.battery));
  const lying = await at(page, 'hand-battery');
  await press(lying.x, lying.y);
  await moveTo(ptr.x + 6, ptr.y - 6, 4);
  s = await state();
  check('picked up again', s.battery.state === 'held');
  s = await steer('hand-battery', 'hand-battery-over', (v) => v.battery.state !== 'held');
  await frame(20);
  await release();
  await frame(40);
  s = await state();
  check('put back: drawn into its clamps, the lamp lights again', s.battery.state === 'home' && s.inPlace && s.glow > 0.8,
    `${s.battery.state}, glow ${s.glow.toFixed(2)}`);

  /* ---------------------------------------------------------------- lamp */
  seq = 'lamp';
  shotNo = 0;
  const l0 = await at(page, 'hand-lamp');
  await press(l0.x, l0.y + 20);
  await moveTo(ptr.x + 70, ptr.y, 30);
  await frame(10);
  s = await state();
  const turned = Number(s.lamp.state.split(' ')[1] ?? 0);
  check('dragged sideways it unscrews part of a turn (and only so far)', s.lamp.state.startsWith('threaded') && turned > 0.1 && turned < 2,
    s.lamp.state);
  check('turned out, the lamp is dark', s.glow < 0.2, `glow ${s.glow.toFixed(2)}`);
  await moveTo(ptr.x, ptr.y + 60, 12);
  await frame(60);
  s = await state();
  check('dragged down it screws itself home and lights', s.lamp.state === 'threaded 0.00' && s.glow > 0.5, `${s.lamp.state}, glow ${s.glow.toFixed(2)}`);
  await moveTo(ptr.x, ptr.y - 110, 15);
  let unscrewing = 0;
  for (let i = 0; i < 120 && s.lamp.state !== 'held'; i++) {
    await frame();
    s = await state();
    if (s.lamp.state.startsWith('threaded') && s.lamp.state !== 'threaded 0.00') unscrewing++;
  }
  check('dragged up it unscrews by itself and comes free', s.lamp.state === 'held', `${unscrewing} frames turning`);
  await moveTo(width * 0.45, height * 0.42, 40);
  await release();
  await frame(220);
  s = await state();
  check('let go, the lamp falls and rests inside the loop', s.lamp.state === 'free' && s.lamp.asleep && inside(s.lamp.at), JSON.stringify(s.lamp));
  const lyingLamp = await at(page, 'hand-lamp');
  await press(lyingLamp.x, lyingLamp.y);
  await moveTo(ptr.x + 6, ptr.y - 6, 4);
  s = await steer('hand-lamp', 'hand-lamp-over', (v) => v.lamp.state !== 'held', 160);
  check('carried over the socket, the thread catches it', s.lamp.state !== 'held', s.lamp.state);
  await frame(90);
  await release();
  await frame(30);
  s = await state();
  check('it screws itself home and the lamp lights again', s.lamp.state === 'threaded 0.00' && s.glow > 0.8, `${s.lamp.state}, glow ${s.glow.toFixed(2)}`);

  /* ---------------------------------------------------------------- leaving the step */
  seq = 'leave';
  shotNo = 0;
  const b1 = await at(page, 'hand-battery');
  await press(b1.x + 40, b1.y);
  await moveTo(ptr.x, ptr.y - 160, 40);
  await moveTo(width * 0.45, height * 0.4, 20);
  await release();
  await frame(60);
  await page.evaluate(() => window.__app.goto('circuit/prologue/riddle'));
  await frame(120);
  s = await state();
  check('leaving the step brings the battery home', s.battery.state === 'home' && s.lamp.state === 'threaded 0.00', `${s.battery.state} / ${s.lamp.state}`);
  const errors = await appErrors(page);
  check('console clean', errors.length === 0, errors.map((e) => e.message).join(' | ').slice(0, 300));
} catch (e) {
  failed++;
  console.error(e);
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
