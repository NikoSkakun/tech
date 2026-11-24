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
import { TUCKED, at, fromSeats, read } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const dir = typeof args.frames === 'string' ? args.frames : null;
const { browser, page } = await launch({ width, height });
let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
/** The part's whole outline inside the stand's limits (`clear`: shared/stage/hands/limits.ts), a hair of tolerance. */
const inside = (part) => part.clear > -0.01;
/** `--only battery,seat`: run some of the sequences (each starts and ends with both parts in place). */
const run = (name) => typeof args.only !== 'string' || args.only.split(',').includes(name);

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
  if (frames === 0) {
    ptr.x = x;
    ptr.y = y;
    return page.mouse.move(x, y);
  }
  const x0 = ptr.x;
  const y0 = ptr.y;
  for (let i = 1; i <= frames; i++) {
    ptr.x = x0 + ((x - x0) * i) / frames;
    ptr.y = y0 + ((y - y0) * i) / frames;
    await page.mouse.move(ptr.x, ptr.y);
    await frame();
  }
};
/** Each round-2 sequence starts afresh: the step entered again (both parts home, the stand shot). */
const fresh = async () => {
  // (another step first: the same step again is no navigation)
  await page.evaluate(() => window.__app.goto('circuit/prologue/riddle', undefined, { instant: true }));
  await frame(5);
  await page.evaluate(() => window.__app.goto('circuit/prologue/dive', undefined, { instant: true }));
  await frame(40);
  const v = await state();
  if (!(v.battery.state === 'home' && v.lamp.state === 'threaded 0.00')) throw new Error('not afresh: ' + JSON.stringify(v));
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
const steer = async (part, over, until, frames = 120, each = () => {}, gain = 0.3) => {
  for (let i = 0; i < frames; i++) {
    const s = await state();
    each(s);
    if (until(s)) return s;
    const a = await at(page, part);
    const b = await at(page, over);
    await moveTo(ptr.x + (b.x - a.x) * gain, ptr.y + (b.y - a.y) * gain, 1);
  }
  return state();
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/prologue/dive', freeze: 3 }));
  await frame(30);
  let s = await state();
  if (args.debug) { console.log(JSON.stringify(await read(page, 'prologue')).slice(0, 600)); await screenshot(page, String(args.debug)); }
  check('both parts start in place, the lamp lit', s.inPlace && s.glow > 0.9, `glow ${s.glow.toFixed(2)}`);

  /** Take the battery out of its clamps and bring it to the middle of the board. */
  const batteryOut = async () => {
    const b = await at(page, 'hand-battery');
    await press(b.x + 40, b.y);
    await moveTo(ptr.x, ptr.y - 160, 30);
    await moveTo(width * 0.4, height * 0.42, 20);
  };
  /** Unscrew the lamp by dragging it up and lay it on the board. */
  const lampOut = async () => {
    const l = await at(page, 'hand-lamp');
    await press(l.x, l.y + 20);
    await moveTo(ptr.x, ptr.y - 110, 15);
    for (let i = 0; i < 120 && (await state()).lamp.state !== 'held'; i++) await frame();
    await moveTo(width * 0.35, height * 0.45, 30);
    await release();
    await frame(200);
  };
  /** Put the battery back (from wherever it lies or is held). */
  const batteryBack = async () => {
    s = await state();
    if (s.battery.state !== 'held') {
      const b = await at(page, 'hand-battery');
      await press(b.x, b.y);
      await moveTo(ptr.x + 6, ptr.y - 6, 4);
    }
    await steer('hand-battery', 'hand-battery-seat', (v) => v.battery.state !== 'held');
    await release();
    await frame(40);
  };
  /* ---------------------------------------------------------------- battery */
  if (run('battery')) {
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
  check('not past the stand\'s left edge (its end eases to a stop at it)', s.battery.at[0] >= -3.3 + 0.98 - 0.02 && s.battery.clear > -0.01, `x ${s.battery.at[0]}, clearance ${s.battery.clear}`);
  await moveTo(width * 0.42, height * 0.42, 25);
  await release();
  await frame(200);
  s = await state();
  check('let go, it falls and comes to rest inside the limits', s.battery.state === 'free' && s.battery.asleep && inside(s.battery),
    JSON.stringify(s.battery));
  const lying = await at(page, 'hand-battery');
  await press(lying.x, lying.y);
  await moveTo(ptr.x + 6, ptr.y - 6, 4);
  s = await state();
  check('picked up again', s.battery.state === 'held');
  s = await steer('hand-battery', 'hand-battery-seat', (v) => v.battery.state !== 'held');
  await frame(20);
  await release();
  await frame(40);
  s = await state();
  check('put back: drawn into its clamps, the lamp lights again', s.battery.state === 'home' && s.inPlace && s.glow > 0.8,
    `${s.battery.state}, glow ${s.glow.toFixed(2)}`);
  }
  /* ---------------------------------------------------------------- lamp */
  if (run('lamp')) {
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
  check('let go, the lamp falls and rests inside the limits', s.lamp.state === 'free' && s.lamp.asleep && inside(s.lamp), JSON.stringify(s.lamp));
  const lyingLamp = await at(page, 'hand-lamp');
  await press(lyingLamp.x, lyingLamp.y);
  await moveTo(ptr.x + 6, ptr.y - 6, 4);
  s = await steer('hand-lamp', 'hand-lamp-seat', (v) => v.lamp.state !== 'held', 160);
  check('carried over the socket, the thread catches it', s.lamp.state !== 'held', s.lamp.state);
  await frame(90);
  await release();
  await frame(30);
  s = await state();
  check('it screws itself home and the lamp lights again', s.lamp.state === 'threaded 0.00' && s.glow > 0.8, `${s.lamp.state}, glow ${s.glow.toFixed(2)}`);
  }
  /* ---------------------------------------------------------------- round 2: throws at the edges */
  if (run('throw')) {
  await fresh();
  seq = 'throw';
  shotNo = 0;
  for (const [name, x, y] of [
    ['left edge', 5, height * 0.45],
    ['near side', width * 0.62, height - 5],
    ['far wire', width * 0.45, 5],
    ['right edge', width * 0.7, height * 0.42],
  ]) {
    await batteryOut();
    await moveTo(x, y, 5); // a fling: let go while the hand still moves
    await release();
    let worst = Infinity;
    for (let i = 0; i < 160; i++) {
      await frame();
      const b = (await state()).battery;
      if (b.state === 'free') worst = Math.min(worst, b.clear);
    }
    s = await state();
    check(`thrown at the ${name}: braked to a stop, never across, at rest inside`, worst > -0.01 && s.battery.asleep,
      `worst clearance ${worst.toFixed(3)}, ${JSON.stringify(s.battery.at)}`);
    await batteryBack();
  }
  s = await state();
  check('back in its clamps after the throws, lamp lit', s.battery.state === 'home' && s.glow > 0.8, `${s.battery.state}`);
  }
  /* ---------------------------------------------------------------- round 2: one carried over the other */
  if (run('over')) {
  await fresh();
  seq = 'over';
  shotNo = 0;
  const l1 = await at(page, 'hand-lamp');
  await press(l1.x, l1.y + 20);
  await moveTo(ptr.x, ptr.y - 110, 15);
  for (let i = 0; i < 120 && (await state()).lamp.state !== 'held'; i++) await frame();
  await moveTo(width * 0.42, height * 0.42, 40);
  await release();
  await frame(200);
  const lampRest = (await state()).lamp.at;
  await batteryOut();
  const lp = await at(page, 'hand-lamp');
  await moveTo(lp.x - 320, lp.y + 10, 25);
  let top = 0;
  for (let i = 1; i <= 70; i++) {
    await moveTo(lp.x - 320 + (640 * i) / 70, lp.y + 10, 1);
    top = Math.max(top, (await state()).battery.at[1]);
  }
  await moveTo(lp.x, lp.y + 200, 20);
  await moveTo(lp.x, lp.y - 220, 50);
  s = await state();
  const moved = Math.hypot(...s.lamp.at.map((v, i) => v - lampRest[i]));
  check('carried across the lying lamp, the battery glides over it on the field', top > 1.4, `highest ${top.toFixed(2)}`);
  check('…and the lying lamp is not touched', moved < 0.002, `moved ${moved.toFixed(4)}`);
  await batteryBack();
  }
  /* ---------------------------------------------------------------- round 2: coming to the seats low */
  if (run('seat')) {
  await fresh();
  seq = 'seat';
  shotNo = 0;
  const seatB = await at(page, 'hand-battery-seat');
  for (const [name, dx, dy] of [
    ['from the left', -380, -140],
    ['from behind', 40, -260],
    ['from the right', 330, -120],
  ]) {
    await batteryOut();
    if (args.debug) console.log('out', JSON.stringify((await state()).battery));
    await moveTo(seatB.x + dx, height * 0.3, 20);
    await moveTo(seatB.x + dx, seatB.y + dy, 20);
    // the reader points at the clamps (where the battery was grabbed: 40 px right of its middle) and waits
    let low = Infinity;
    const track = async (frames) => {
      for (let i = 0; i < frames; i++) {
        await frame();
        const v = await state();
        if (v.battery.state === 'held') low = Math.min(low, v.battery.at[1]);
      }
    };
    for (let i = 1; i <= 40; i++) {
      await moveTo(ptr.x + (seatB.x + 40 - ptr.x) / (41 - i), ptr.y + (seatB.y - ptr.y) / (41 - i), 0);
      await track(1);
    }
    await track(40);
    await release();
    await frame(40);
    s = await state();
    check(`battery to its clamps ${name}: comes down by itself, seats`, low < 0.8 && s.battery.state === 'home',
      `lowest carried centre ${low.toFixed(2)} (carried 1.30, seat 0.50), ${s.battery.state}`);
  }
  // the lamp lies on the board from above: bring it to the socket from two sides
  if ((await state()).lamp.state.startsWith('threaded')) await lampOut();
  for (const [name, dx, dy] of [
    ['from the left', -380, 40],
    ['from the front', -40, 260],
  ]) {
    const lq = await at(page, 'hand-lamp');
    await press(lq.x, lq.y);
    await moveTo(ptr.x + 6, ptr.y - 6, 4);
    const seatL = await at(page, 'hand-lamp-seat');
    await moveTo(seatL.x + dx, seatL.y + dy, 30);
    let low = Infinity;
    for (let i = 1; i <= 70; i++) {
      if (i <= 40) await moveTo(ptr.x + (seatL.x - ptr.x) / (41 - i), ptr.y + (seatL.y - ptr.y) / (41 - i), 0);
      await frame();
      const v = await state();
      if (v.lamp.state === 'held') low = Math.min(low, v.lamp.at[1]);
    }
    await frame(90);
    s = await state();
    check(`lamp to its socket ${name}: comes down by itself, the thread takes it`, low < 1.49 && s.lamp.state.startsWith('threaded'),
      `lowest carried centre ${low.toFixed(2)} (carried 1.55, caught below 1.48), ${s.lamp.state}`);
    await release();
    await frame(40);
    if (name === 'from the left') {
      // take it out again for the second approach
      await lampOut();
    }
  }
  s = await state();
  check('both back, the lamp lit', s.inPlace && s.glow > 0.8, `glow ${s.glow.toFixed(2)}`);
  }
  /* ---------------------------------------------------------------- leaving the step */
  if (run('leave')) {
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
  }
  /* ------------------------------------------- back to the closed flashlight (F-click-parts) */
  // a part let go on the stand goes home with the step change, and the closed flashlight has it inside again:
  // straight to `click` (a deep link) and by «Назад» (the dive rewinds, the parts glide home, then it folds)
  if (run('closed')) {
    seq = 'closed';
    for (const how of ['goto', 'back']) {
      await fresh();
      const b2 = await at(page, 'hand-battery');
      await press(b2.x + 40, b2.y);
      await moveTo(ptr.x, ptr.y - 160, 40);
      await moveTo(width * 0.45, height * 0.4, 20);
      await release();
      await frame(60);
      const out = await fromSeats(page);
      if (how === 'goto') await page.evaluate(() => window.__app.goto('circuit/prologue/click', undefined, { instant: true }));
      else await page.evaluate(() => window.__app.prev());
      await frame(how === 'goto' ? 10 : 8 * 60);
      const u = (await read(page, 'prologue')).unfold.value;
      const back = await fromSeats(page);
      check(`${how} to click: battery and lamp inside the closed flashlight`,
        out.battery > 0.3 && u < 0.001 && back.battery > TUCKED && back.lamp > TUCKED,
        `out ${out.battery.toFixed(2)}, unfold ${u.toFixed(3)}, ${JSON.stringify(back)}`);
    }
    await fresh();
    const home = await fromSeats(page);
    check('on the stand again both are in their places', home.battery < 0.01 && home.lamp < 0.01, JSON.stringify(home));
  }
  const errors = await appErrors(page);
  check('console clean', errors.length === 0, errors.map((e) => e.message).join(' | ').slice(0, 300));
} catch (e) {
  failed++;
  console.error(e);
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
