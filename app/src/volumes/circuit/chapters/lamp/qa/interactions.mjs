#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/lamp` (lenovo; dev server or production preview up), DOM interface:
//
//   node app/src/volumes/circuit/chapters/lamp/qa/interactions.mjs --port 5316 [--size 1280x720] [--touch] [--out <dir>]
//
// Every goal by real pointer input (mouse, or a finger with --touch), the reader's way from step to step («Далі»);
// after each goal the panel shows «Висновок» (never before); «Докладніше» opened once; per-frame continuity of the
// camera and the magnifier through every step change and every slider sweep (no cut: the largest per-frame step
// stays within a bound and within a multiple of the mean); console clean. Frozen engine clock. Exit 1 on failure.
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, parseArgs, parseSize, screenshot } from '../../../../../../../tools/qa/lib.mjs';
import { advance, at, continuity, jumps, pointer, press, rangeOf, read, shown, textTab } from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';
import { energy, glow, handover, hotSpot, story } from './steps-b.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const touch = Boolean(args.touch);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height, touch });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(9)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) => out && screenshot(page, `${out}/${width}x${height}-${name}.jpg`);
/** No cut: the largest per-frame move within `bound` (world units), and no spike (a move ≥ 3× both neighbours). */
const smooth = (what, j, bound) =>
  check(
    `${what}: no jump`,
    j.max <= bound && j.spike < 3,
    `max ${j.max.toFixed(3)} · mean ${j.mean.toFixed(3)} · spike ${j.spike.toFixed(2)}`,
  );
/** The reader's «Далі», the transition sampled frame by frame. */
const next = async (id, seconds = 3.2) => {
  const j = await continuity(page, seconds, () => page.evaluate(() => window.__app.next()));
  step = id;
  smooth('camera into the step', j.camera, 0.45);
  smooth('lens into the step', j.lens, 0.3);
  check('no takeaway before the goal', !(await takeaway()));
};
/** Sweep a slider by hand from `a` to `b` (track shares) in `n` moves, camera / lens sampled after each. */
const sweep = async (p, id, a, b, n = 40) => {
  const r = await rangeOf(page, id);
  const x = (f) => r.x - r.w / 2 + r.w * (0.04 + 0.92 * f);
  const y = r.y;
  const hold = await p.down(x(a), y);
  const cam = [];
  const lens = [];
  const rail = [];
  for (let i = 1; i <= n; i++) {
    await hold.move(x(a + ((b - a) * i) / n), y);
    const s = await read(page, 'lamp');
    cam.push(s.cameraRaw);
    lens.push(s.lens);
    rail.push([s.rail]);
  }
  await hold.up();
  if (process.env.LAMP_QA_DEBUG) console.log(JSON.stringify(rail.map((r) => +r[0].toFixed(3))));
  return { camera: jumps(cam), lens: jumps(lens) };
};

/**
 * Turn the focus ring on the lens (F-lens-ring) by hand: press on its marker, move along the arc's tangent in small
 * steps until `until(state)` (or `px` px), camera and lens sampled after each move.
 */
const turn = async (p, px, until) => {
  let r = (await read(page, 'inside')).ring;
  let x = r.marker.x;
  let y = r.marker.y;
  const hold = await p.down(x, y);
  const cam = [];
  const lens = [];
  for (let i = 0; i < Math.abs(px) / 5; i++) {
    const a = Math.atan2(x - r.layout.cx, y - r.layout.cy);
    x += Math.sign(px) * 5 * Math.cos(a);
    y -= Math.sign(px) * 5 * Math.sin(a);
    await hold.move(x, y);
    const s = await read(page, 'lamp');
    const st = await read(page, 'inside');
    r = st.ring;
    cam.push(s.cameraRaw);
    lens.push(s.lens);
    if (until(st)) break;
  }
  await hold.up();
  return { camera: jumps(cam), lens: jumps(lens) };
};

async function inside(p) {
  check('opening card', await shown(page, '[data-ui="path-opening"]'));
  await press(page, '[data-ui="path-opening"] .btn');
  check('«Згадайте» link', await shown(page, '[data-ui="path-recall"]'));
  check('no takeaway before the goal', !(await takeaway()));
  check('no depth slider, no ring before the lens is taken', !(await page.evaluate(() => !!document.querySelector('[data-ui="ctl-depth"]'))) && !(await read(page, 'inside')).ring.shown);
  const l = await at(page, 'lens');
  await p.tap(l.x, l.y);
  await advance(page, 2.5);
  let i = await read(page, 'inside');
  check('a tap on the lens lays it on the glass: lens mode, the ring at the bottom', i.lensMode && i.ring.amount === 1 && i.position === 0, `at ${i.position.toFixed(2)}`);
  const l0 = i.ring.layout;
  let j = await turn(p, 900, (st) => st.position >= 0.995);
  smooth('turning the ring down: camera', j.camera, 0.5);
  smooth('turning the ring down: lens', j.lens, 0.8);
  await advance(page, 1.2);
  const s = await read(page, 'lamp');
  check('down at the lamp', s.rail >= 0.98, s.rail.toFixed(3));
  i = await read(page, 'inside');
  check(
    '…the ring stays where it was (the bottom arc, apart from the lens)',
    i.ring.shown && ['cx', 'cy', 'r', 'half'].every((k) => Math.abs(i.ring.layout[k] - l0[k]) < 1e-6),
  );
  await snap('inside-down');
  // the mark along the way: contact → first support → coil → second support → thread
  const seq = ['path-mark', 'lamp-leadIn', 'lamp-coil', 'lamp-leadOut', 'lamp-thread'];
  const hold = await p.down(...Object.values(await at(page, seq[0])));
  for (const n of seq.slice(1)) {
    const q = await at(page, n);
    await hold.move(q.x, q.y, 24);
  }
  await hold.up();
  await advance(page, 1);
  check('takeaway once the mark reached the thread', await takeaway());
  await textTab(page);
  await page.click('[data-ui="path-more"]');
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  await snap('inside-goal');
  j = await turn(p, -900, (st) => st.position <= 0.2);
  smooth('turning the ring back up: camera', j.camera, 0.5);
  j = await turn(p, 900, (st) => st.position >= 0.995);
  smooth('…and down again: camera', j.camera, 0.5);
  await advance(page, 1.2);
}

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'circuit/lamp/inside', freeze: 0 }));
  await advance(page, 2);
  step = 'inside';
  const p = await pointer(page, touch);
  const ctx = { page, p, check, takeaway, snap, smooth, sweep, read, at, advance };
  await inside(p);
  await next('hot-spot');
  await hotSpot(ctx);
  await next('glow', 3.4);
  await glow(ctx);
  await next('energy', 3.4);
  await energy(ctx);
  await next('handover', 3.4);
  await handover(ctx);
  await next('story', 3.4);
  await story(ctx);
  step = 'closing';
  // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
  const border = await nextChapter(page, (s) => advance(page, s));
  check(
    'closing card after the last step: its three lines and the bridge',
    border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
    `${border.card.lines} lines`,
  );
  check(
    '«Далі» on the card: the next chapter',
    border.landed.chapterId === 'drain',
    `${border.landed.chapterId}/${border.landed.stepId}`,
  );
  step = 'console';
  const errors = await appErrors(page);
  check('no console errors or warnings', errors.length === 0, JSON.stringify(errors).slice(0, 300));
} catch (e) {
  check(`threw: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `FAIL ${failed} of ${results.length}` : `PASS ${results.length} checks at ${width}x${height}${touch ? ' touch' : ''}`);
process.exit(failed ? 1 : 0);
