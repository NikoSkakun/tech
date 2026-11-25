#!/usr/bin/env node
/* global process, console, window, document */
// Interaction test of chapter `circuit/wire` (lenovo; dev server or production preview up), under ?hud=dom:
//
//   node app/src/volumes/circuit/chapters/wire/qa/interactions.mjs --port 5286 [--size 1280x720] [--out <dir>]
//
// Every goal of the script is reached by real pointer input (click an atom, drag the slider, drag electrons,
// press «Додати атоми», mark an electron, drag the lens); after each one the panel must show «Висновок».
// «Докладніше» is opened once, the «Згадайте» link is checked, the closing card is reached; no console errors.
// Frozen engine clock (`?freeze`): deterministic. Exit code 1 on any failure.
import { turnRing } from '../../prologue/qa/ring.mjs';
import {
  appErrors,
  appUrl,
  baseUrl,
  decodePng,
  ensureDir,
  launch,
  openApp,
  parseArgs,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';
import {
  advance,
  at,
  click,
  clickProbe,
  clickTrack,
  dragFrom,
  press,
  read,
  scrub,
  sceneY,
  shown,
} from './helpers.mjs';
import { nextChapter } from '../../../../../../../tools/qa/next-chapter.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const out = args.out ? ensureDir(String(args.out)) : null;
const { browser, page } = await launch({ width, height });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(12)} ${what}${detail === '' ? '' : `  [${detail}]`}`,
  );
};
const takeaway = () => shown(page, '[data-ui="path-takeaway"]');
const snap = async (name) => out && screenshot(page, `${out}/${width}x${height}-${name}.jpg`);
/** Arrive at a step the way a reader does: the previous step on screen, then the move (not a deep link). */
const enter = async (id, settle = 2.6) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('wire', s), id);
  await advance(page, settle);
  check('no takeaway before the goal', !(await takeaway()));
};
/**
 * Light of the lower floors (regression of docs/requests/W2-circuit-copper.md §5b: the stand's light rig took the
 * environment back below the stand and the atoms went dark crimson): the hero atom's colour, median of a 9×9 patch
 * at the composed world's probe `copper-hero`, sRGB, compared with the copper showcase measured on the same day
 * (`_dev/_sandbox-circuit-copper`: `rows` lamp off 197,71,79 · `rows-lit` lamp on 237,80,76).
 */
const SHOWCASE = { off: [197, 71, 79], on: [237, 80, 76] };
const atomColour = async () => {
  const p = await at(page, 'copper-hero');
  const png = decodePng(await page.screenshot({ type: 'png' }));
  const patch = [];
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const i = (png.width * (Math.round(p.y) + dy) + Math.round(p.x) + dx) * 4;
      patch.push([png.data[i], png.data[i + 1], png.data[i + 2]]);
    }
  return [0, 1, 2].map((c) => patch.map((q) => q[c]).sort((a, b) => a - b)[40]);
};
const lightCheck = async (lamp) => {
  const c = await atomColour();
  const ref = SHOWCASE[lamp];
  // lamp on, the hero atom of `atoms` swells and pulses: it may be brighter than the showcase, never darker
  const ok =
    lamp === 'on'
      ? c[0] >= ref[0] - 25 && Math.abs(c[1] - ref[1]) <= 25 && Math.abs(c[2] - ref[2]) <= 25
      : c.every((v, i) => Math.abs(v - ref[i]) <= 25);
  check(`atoms lit as in the copper showcase (lamp ${lamp})`, ok, `${c.join(',')} vs ${ref.join(',')}`);
};
const away = async (probe, from) => {
  const a = await at(page, probe);
  const c = await at(page, from);
  const n = Math.hypot(a.x - c.x, a.y - c.y) || 1;
  return [a, (a.x - c.x) / n, (a.y - c.y) / n];
};

const steps = {
  async atoms() {
    check('opening card', await shown(page, '[data-ui="path-opening"]'));
    await press(page, '[data-ui="path-opening"] .btn');
    check('«Згадайте» link to prologue/dive', await shown(page, '[data-ui="path-recall"]'));
    check('no takeaway before the goal', !(await takeaway()));
    await clickProbe(page, 'atom-side');
    const s = await read(page, 'atoms');
    check(
      'the touched side ball becomes the atom the dive opens',
      s.selected > 0 && s.hero === s.selected,
      `hero ${s.hero}`,
    );
    await advance(page, 1);
    check('takeaway after the touch', await takeaway());
    // the focus ring on the lens is the dive (F-lens-ring): the reader is in lens mode, the ring is the rim's bottom arc
    const atoms = () => read(page, 'atoms');
    let r = await atoms();
    const nav = await page.evaluate(() => document.querySelector('[data-ui="navigator"]')?.getBoundingClientRect().top ?? 0);
    const l = r.ring.layout;
    check(
      'lens mode at the rows: the ring pinned as the bottom arc, above the navigator',
      r.lensMode && r.ring.amount === 1 && l.pinned > 0.95 && l.cy + l.r + l.t <= nav + 1,
      `bottom ${(l.cy + l.r + l.t).toFixed(0)}, navigator ${nav.toFixed(0)}`,
    );
    check('no depth slider in the panel', !(await page.evaluate(() => !!document.querySelector('[data-ui="ctl-depth"]'))));
    check('the last mark took the new word', r.ring.marks.at(-1)?.label === 'ряди атомів', r.ring.marks.at(-1)?.label);
    await turnRing(page, atoms, -500, { until: (s) => s.position <= 1.4 });
    r = await atoms();
    check('turning the ring scrubs the dive up', r.position <= 1.4 && r.position > 1.2, r.position.toFixed(2));
    await advance(page, 1);
    check('let go mid-way, the dive stays there', Math.abs((await atoms()).position - r.position) < 1e-6);
    // a drag over the atoms sways the camera, it springs back
    const side = await at(page, 'atom-hero');
    await page.mouse.move(side.x, side.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(side.x + i * 20, side.y);
      await advance(page, 0.02);
    }
    const sw = await atoms();
    check('a drag over the atoms sways the camera (held)', sw.sway.held && Math.abs(sw.sway.yaw) > 0.03, sw.sway.yaw.toFixed(3));
    await page.mouse.up();
    await advance(page, 1.6);
    check('…and it springs back', Math.abs((await atoms()).sway.yaw) < 1e-3);
    const chip = await page.evaluate(() => {
      const e = document.querySelector('[data-ui="depth-ring:1"]')?.getBoundingClientRect();
      return e ? [e.x + e.width / 2, e.y + e.height / 2] : null;
    });
    await page.mouse.click(...chip);
    await advance(page, 0.3);
    const mid = (await atoms()).position;
    check('a click on the mark «ряди атомів» travels (not a jump)', mid > r.position && mid < 1.99, mid.toFixed(2));
    let w;
    for (let i = 0; i < 20 && (w = await read(page, 'wire')).position < 1.999; i++) await advance(page, 0.5);
    check('…and arrives at the rows', Math.abs(w.deep - 2) < 0.01, `${w.deep.toFixed(3)} after the travel`);
    await press(page, '[data-ui="path-more"]');
    check(
      '«Докладніше» opens',
      await page.evaluate(
        () => document.querySelector('[data-ui="path-more"]')?.getAttribute('aria-expanded') === 'true',
      ),
    );
    await snap('atoms');
  },
  async 'inside-atom'() {
    let release = await scrub(page, 'apart', 0, 0.5);
    let a = (await read(page, 'inside-atom')).apart;
    check(
      'a drag scrubs «Розсунути атом» (the atom is where the thumb is)',
      Math.abs(a - 0.5) < 0.06,
      a.toFixed(2),
    );
    await release();
    check('no takeaway half-way', !(await takeaway()));
    await clickTrack(page, 'apart', 1);
    await advance(page, 0.15);
    a = (await read(page, 'inside-atom')).apart;
    check('a click on the track eases there', a > 0.52 && a < 0.95, a.toFixed(2));
    await advance(page, 1.5);
    const s = await read(page, 'inside-atom');
    check('slider «Розсунути атом» to the end opens the atom', s.apart > 0.95, s.apart.toFixed(2));
    check('takeaway', await takeaway());
    await snap('inside-atom');
  },
  async outer() {
    let [p, ux, uy] = await away('near-electron', 'nucleus-outer');
    let release = await dragFrom(page, p, ux * 0.2, uy * 0.2);
    check('a near electron is in the hand', (await read(page, 'outer')).held >= 0);
    await release(1.2);
    check('…and springs back: near attempt counted', (await read(page, 'outer')).nearDone);
    check('no takeaway after the near one alone', !(await takeaway()));
    [p, ux, uy] = await away('outer-electron', 'nucleus-outer');
    release = await dragFrom(page, p, ux * 0.3, uy * 0.3);
    check('the outer electron comes off', (await read(page, 'outer')).freed);
    await release(0.6);
    check('takeaway', await takeaway());
    await snap('outer');
    await advance(page, 3);
    check('after the takeaway the outer electron is home', !(await read(page, 'outer')).freed);
  },
  async shared() {
    for (let i = 1; i <= 3; i++) {
      await click(page, 'add-atoms');
      await advance(page, 2);
      check(`«Додати атоми» → stage ${i}`, (await read(page, 'shared')).stage === i);
    }
    check('takeaway at the piece of copper', await takeaway());
    await snap('shared');
  },
  async restless() {
    await lightCheck('off');
    await clickProbe(page, 'free-electron');
    const m = await read(page, 'restless');
    check('a free electron is marked', m.marked >= 0, m.marked);
    let r = m;
    let gap = 0;
    for (let i = 0; i < 90 && !(r.left >= 10 && r.right >= 10); i++) {
      await advance(page, 0.5);
      r = await read(page, 'restless');
      gap = Math.max(gap, Math.abs(r.left - r.right));
    }
    check('the frame counted ≥ 10 each way', r.left >= 10 && r.right >= 10, `${r.left} / ${r.right}`);
    check('the counts never part by more than two', gap <= 2, `largest gap ${gap}`);
    await advance(page, 0.5);
    check('takeaway', await takeaway());
    await snap('restless');
  },
  async plastic() {
    // half a screen up — in strokes that start on the scene: in a narrow window the step sheet covers its lower part
    const c = { x: width * 0.38, y: await sceneY(page, width * 0.38, height * 0.6) };
    const strokes = Math.ceil((0.5 * height) / Math.max(c.y - 0.08 * height, 1));
    let release;
    for (let i = 0; i < strokes; i++) {
      release = await dragFrom(page, c, 0, -0.5 / strokes);
      await release(i === strokes - 1 ? 2.6 : 0.3);
    }
    check('the lens is over the plastic', (await read(page, 'plastic')).onPlastic);
    release = await dragFrom(page, { x: c.x, y: height * 0.25 }, 0, 0.55);
    await release(0.6);
    check('…and back on the copper', (await read(page, 'plastic')).onCopper);
    check('takeaway', await takeaway());
    await snap('plastic');
    await advance(page, 9);
    check(
      'after the takeaway the chapter flies back to the stand',
      (await read(page, 'wire')).deep < 0.01,
      (await read(page, 'wire')).deep,
    );
    // the chapter's end (tools/qa/next-chapter.mjs): «Далі» brings the closing card, «Далі» again the next chapter
    const border = await nextChapter(page, (s) => advance(page, s));
    check(
      'closing card after the last step: its three lines and the bridge',
      border.card.shown && border.card.lines === 3 && border.card.bridge.length > 0,
      `${border.card.lines} lines`,
    );
    check(
      '«Далі» on the card: the next chapter',
      border.landed.chapterId === 'charge',
      `${border.landed.chapterId}/${border.landed.stepId}`,
    );
  },
};

try {
  const base = baseUrl(args);
  await openApp(page, appUrl(base, { route: 'circuit/wire/atoms', freeze: 1, extra: { hud: 'dom' } }));
  await advance(page, 2);
  step = 'atoms';
  await lightCheck('on');
  await steps.atoms();
  for (const id of ['inside-atom', 'outer', 'shared', 'restless', 'plastic']) {
    await enter(id);
    await steps[id]();
  }
  const errors = await appErrors(page);
  step = 'console';
  check('no console errors or warnings', errors.length === 0, JSON.stringify(errors).slice(0, 300));
} catch (e) {
  check(`threw: ${e.message}`, false);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed ? `FAIL ${failed} of ${results.length}` : `PASS ${results.length} checks at ${width}x${height}`,
);
process.exit(failed ? 1 : 0);
