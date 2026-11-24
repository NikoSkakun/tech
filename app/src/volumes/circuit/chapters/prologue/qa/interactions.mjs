#!/usr/bin/env node
/* global process, console, window, document, getComputedStyle, innerWidth, requestAnimationFrame */
// Interaction test of `circuit/prologue` (run on lenovo; dev server or preview up), under the 2D interface:
//
//   node app/src/volumes/circuit/chapters/prologue/qa/interactions.mjs --port 5285 [--size 1920x1080]
//
// Every goal of every step is reached with real pointer input (scene probes `__app.locate`, HUD controls
// `__ui.locate`), every takeaway must appear only after its goal, «Докладніше» is opened once, and the console
// must stay clean. Frozen engine clock (`?freeze`): deterministic. Exit code 1 on any failure.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';
import { TUCKED, advance, at, fromSeats, read, sheetTab } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const results = [];
let step = '';
const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok) });
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(7)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
};
const shown = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, sel);
const takeaway = () => shown('[data-ui="path-takeaway"]');
const state = () => read(page, 'prologue');
const tap = async (probe) => {
  const p = await at(page, probe);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
  await advance(page, 0.1);
};
const enter = async (id) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('circuit/prologue/' + s, undefined, { instant: true }), id);
  await advance(page, 1.5);
  // the opening card of the chapter stands before step 1: go on to the step itself
  if (await shown('[data-ui="path-opening"] button')) {
    await page.click('[data-ui="path-opening"] button');
    await advance(page, 0.6);
  }
  check('no takeaway before the goal', !(await takeaway()));
};

let failed = true;
try {
  await openApp(
    page,
    appUrl(baseUrl(args), { route: 'circuit/prologue/click', freeze: 1, extra: { hud: 'dom' } }),
  );
  await enter('click');
  // the battery and the lamp are inside the closed flashlight, not loose on the stand beside it (F-click-parts)
  const seats0 = await fromSeats(page);
  check('battery and lamp inside the flashlight', seats0.battery > TUCKED && seats0.lamp > TUCKED, JSON.stringify(seats0));
  const navHidden = () => page.evaluate(() => window.__ui.navHidden());
  check('the navigator waits for the first light', (await navHidden()) === true);
  // the slider is pushed toward the flashlight's head to light it (screen right in `flashlight`), back to open
  const open0 = await at(page, 'switch');
  // the first light: the navigator comes in over several frames (fades and rises), never in one
  await page.mouse.click(open0.x, open0.y);
  const navLook = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-ui="navigator"]');
      return { o: Number(getComputedStyle(el).opacity), y: el.getBoundingClientRect().y };
    });
  const ramp = [];
  for (let f = 0; f < 50; f++) {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    ramp.push(await navLook());
  }
  const between = ramp.filter((r) => r.o > 0.05 && r.o < 0.95).length;
  const fadeStep = Math.max(...ramp.slice(1).map((r, i) => r.o - ramp[i].o));
  check(
    'the navigator fades in over several frames',
    between >= 12 && fadeStep < 0.15 && ramp.at(-1).o > 0.99,
    `${between} frames in between, largest step ${fadeStep.toFixed(2)}`,
  );
  check('…rising into its place', ramp.find((r) => r.o > 0.05).y > ramp.at(-1).y + 2);
  const closed0 = await at(page, 'switch');
  check(
    'closed = slider toward the head',
    closed0.x > open0.x + 3,
    `open x ${open0.x.toFixed(0)}, closed x ${closed0.x.toFixed(0)}`,
  );
  await advance(page, 0.5);
  for (let i = 0; i < 2; i++) {
    await tap('switch');
    await advance(page, 0.7);
  }
  const c = await state();
  check(
    'lamp lit twice and on now',
    c.lightings >= 2 && c.glow > 0.5,
    `lightings ${c.lightings}, glow ${c.glow.toFixed(2)}`,
  );
  check('takeaway shown', await takeaway());
  check('…and is there once the lamp has lit', (await navHidden()) === false);

  // «Далі» from `click`: the flashlight unfolds into the stand by itself — no slider, the lamp never goes out
  // the reader turns the view first (drag + wheel): «Далі» must leave from that pose, never snap to the shot
  await page.mouse.move(width * 0.3, height * 0.75);
  await page.mouse.down();
  await page.mouse.move(width * 0.3 + width / 3, height * 0.55, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, 400);
  await advance(page, 1.2);
  const posed = (await state()).camera;
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // the names of 3D objects on hover (WebGL tooltips): the engine's hover events carry them
  await page.evaluate(() => {
    window.__tips = [];
    window.__app.engine.input.on('hover', (e) => window.__tips.push(e.tooltip));
  });
  const tips = () => page.evaluate(() => window.__tips.splice(0));
  /** Rest the pointer on a probe for one frame; the names it was given (hover events) since the last call. */
  const restOn = async (probe) => {
    const p = await at(page, probe);
    // from a fresh spot off the object each time: the engine names what is under the pointer when that changes,
    // so the pointer must leave the object first — a fraction of the viewport, not pixels: at 1920×1080 the lens
    // is ≈ 75 px in radius and a 40 px step stayed on it (no hover event, Q-prologue-phone-qa)
    const off = 0.14 * height;
    await page.mouse.move(p.x + off, p.y - off);
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    await tips();
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    return tips();
  };
  await page.evaluate(() => window.__app.next());
  step = 'dive';
  // `?freeze=1` simulates 1 s after a navigation: the camera has waited (0.42 s) and only begun to move
  const left = (await state()).camera;
  const path = [left];
  for (let f = 0; f < 60; f++) {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    path.push((await state()).camera);
  }
  const stride = Math.max(...path.slice(1).map((p, i) => gap(p, path[i])));
  check(
    '«Далі» leaves from the pose the reader left, no snap',
    gap(posed, left) < 1 && stride < 0.15,
    `moved ${gap(posed, left).toFixed(2)} in the first second, largest frame step ${stride.toFixed(3)}`,
  );
  const u0 = await state();
  check(
    '«Далі» starts the unfolding by itself',
    u0.unfold.playing && u0.unfold.value < 0.35,
    u0.unfold.value.toFixed(2),
  );
  // …and nothing to use either: the depth slider waits with the text (the phone sheet showed it greyed early)
  const sliderShown = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-ui="ctl-depth"]');
      if (!el || el.closest('[hidden]')) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && Number(getComputedStyle(el).opacity) > 0.05;
    });
  // a narrow window: text and controls share a bottom sheet through tabs — the reader looks under «Керування»
  await sheetTab(page, 'controls');
  check('no slider while it unfolds',!(await sliderShown()));
  // the script: no text to read mid-motion (stepUi `panel.hiddenUntil`): an empty plate until the last beat
  const panelHeld = () =>
    page.evaluate(() => {
      const p = document.querySelector('[data-ui="step-panel"]');
      return (
        p.classList.contains('held') &&
        getComputedStyle(p.querySelector('.sp-scroll')).visibility === 'hidden'
      );
    });
  check('the panel holds its text while the flashlight unfolds', await panelHeld());
  // the lens is inside the flashlight / growing out of its holder: its spot names nothing (no callout, no hover,
  // no grab cursor) — with an orbited camera that spot is empty air on screen (F-lens-hover)
  let dark = 0;
  const early = { named: 0, tips: [], cursor: 0 };
  for (let k = 0; k < 14; k++) {
    await page.evaluate(() => window.__app.step(1 / 60, 30));
    const s = await state();
    if (s.glow < 0.5) dark++;
    if (!s.unfold.playing) continue;
    early.tips.push(...(await restOn('lens')).filter((t) => t));
    if ((await state()).dive.named) early.named++;
    if ((await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).cursor)) === 'grab') early.cursor++;
  }
  check(
    'no «лупа» over the lens spot while it unfolds (callout, hover, cursor)',
    early.named === 0 && early.tips.length === 0 && early.cursor === 0,
    `callout ${early.named}, tips ${early.tips.join('|') || '–'}, grab ${early.cursor}`,
  );
  const u1 = await state();
  check(
    'it ends on the stand in ≈ 7 s, the lamp lit all the way',
    !u1.unfold.playing && u1.unfold.value > 0.999 && dark === 0,
    `dark frames ${dark}`,
  );
  await advance(page, 0.2);
  await sheetTab(page, 'text');
  check('…and shows it with the last beat', !(await panelHeld()) && (await shown('[data-ui="path-step"]')));
  await sheetTab(page, 'controls');
  check('…the slider with it', await sliderShown());
  const lensTips = await restOn('lens');
  check('…then hovering the lens names it', lensTips.includes('лупа'), lensTips.join('|') || '–');
  const named = u1.names;
  check('the parts are named as they land', named.length === 4, named.join(', '));
  await sheetTab(page, 'text');
  await page.click('[data-ui="path-more"]');
  await advance(page, 0.4);
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  check('no takeaway before the goal', !(await takeaway()));

  // the switch is the reader's here too: a tap opens it (the lamp goes out), another closes it
  await tap('switch');
  await advance(page, 0.6);
  const s0 = await state();
  check('a tap on the switch opens it: dark', !s0.closed && s0.glow < 0.1 && s0.light < 0.5);
  await tap('switch');
  await advance(page, 0.6);
  const s1 = await state();
  check('…another closes it: lit', s1.closed && s1.glow > 0.5);
  await tap('switch');
  await advance(page, 0.6);

  // the slider is the dive from the lens in its holder on (the owner, 2026-11-17): its first stretch (0 … 0.5)
  // lifts the lens out of its holder and lays it on the wire, the camera coming with it; then the dive goes on
  await sheetTab(page, 'controls');
  const track = await page.evaluate(() => {
    const i = document.querySelector('[data-ui="ctl-depth"] input.dk-range');
    const r = i?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y + r.height / 2, w: r.width, disabled: i.disabled } : null;
  });
  check('the slider is there to use from the start (lens in its holder)', track && !track.disabled);
  const MAX = 2.5;
  const LEAD = 0.5;
  const xAt = (v) => track.x + 8 + (track.w - 16) * (v / MAX);
  const frame = async () => {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    return { s: await state(), lens: await at(page, 'lens') };
  };
  const before = await frame();
  check('the switch is open, the lens in its holder', !before.s.closed && before.s.dive.lens < 0.01);
  await page.mouse.move(xAt(0), track.y);
  await page.mouse.down();
  await page.mouse.move(xAt(0.08), track.y); // past the half-thumb the press landed in: the range moves
  let f = await frame();
  check(
    'the first move of the slider closes the switch: light in that frame',
    f.s.closed && f.s.light > 0.5,
    `light ${f.s.light.toFixed(2)}`,
  );
  // small even steps of the hand: every quantity moves by small amounts only (no jump anywhere)
  let prev = before;
  let jump = { cam: 0, px: 0, deep: 0 };
  let lag = 0;
  let lensUp = 0;
  let monotone = true;
  const sweep = async (from, to, dv) => {
    for (let v = from; dv > 0 ? v <= to + 1e-9 : v >= to - 1e-9; v += dv) {
      await page.mouse.move(xAt(v), track.y);
      f = await frame();
      jump.cam = Math.max(jump.cam, Math.hypot(...f.s.camera.map((c, i) => c - prev.s.camera[i])));
      jump.px = Math.max(jump.px, Math.hypot(f.lens.x - prev.lens.x, f.lens.y - prev.lens.y));
      jump.deep = Math.max(jump.deep, Math.abs(f.s.deep - prev.s.deep));
      lag = Math.max(lag, Math.abs(f.s.dive.at - f.s.dive.slider));
      if (dv > 0 && f.s.dive.lens < prev.s.dive.lens - 1e-6) monotone = false;
      if (f.s.dive.lens > 0.05 && f.s.dive.at < 0.2) lensUp = f.s.dive.lens;
      prev = f;
    }
  };
  prev = f;
  await sweep(0.09, 0.9, 0.01);
  const fwd = f.s;
  check(
    'dragging from 0 lifts the lens out of its holder at once, and on, continuously',
    lensUp > 0.05 && monotone && fwd.dive.lens > 0.99,
    `lens ${lensUp.toFixed(2)} by 0.2`,
  );
  check(
    '…the lens on the wire at the end of the stretch, and the dive goes on',
    fwd.deep > 0.1 && fwd.dive.position > 0.35,
    `deep ${fwd.deep.toFixed(2)}`,
  );
  check('a drag scrubs with the hand', lag < 0.03, `lag ${lag.toFixed(3)}`);
  const h = page.viewportSize().height;
  check(
    'no jump: small changes only between neighbouring slider values',
    jump.cam < 0.3 && jump.px < 0.05 * h && jump.deep < 0.02,
    `camera ${jump.cam.toFixed(3)}, lens ${jump.px.toFixed(1)} px, deep ${jump.deep.toFixed(3)}`,
  );
  // back to 0: the lens goes back into its holder, the camera back to the stand plan, as smoothly
  jump = { cam: 0, px: 0, deep: 0 };
  await sweep(0.89, 0, -0.01);
  await page.mouse.move(xAt(-0.2), track.y);
  f = await frame();
  await page.mouse.up();
  await advance(page, 0.5);
  const back = await state();
  // «the stand plan again» = the same look-at point and distance, the view direction within the idle drift: the
  // director orbits the camera around its target by slow sines for ever (azimuth ≤ 0.0034 rad/s, polar ≤ 0.0015,
  // director.ts), so after the ≈ 3.6 s of this sweep the camera *position* may sit ≈ 0.1 off by drift alone (it
  // did at 390×844, a pure phase effect); the view direction by ≤ 0.014 rad (+ ≈ 0.002 from the rounding)
  const sub = (a, b) => a.map((c, i) => c - b[i]);
  const len = (v) => Math.hypot(...v);
  const arm = (s) => sub(s.camera, s.look);
  const lookOff = len(sub(back.look, before.s.look));
  const distOff = Math.abs(len(arm(back)) / len(arm(before.s)) - 1);
  const dot = arm(back).reduce((a, c, i) => a + c * arm(before.s)[i], 0) / (len(arm(back)) * len(arm(before.s)));
  const turn = Math.acos(Math.min(1, dot));
  check(
    'back to 0: the lens in its holder, the stand plan again',
    back.dive.lens < 0.01 &&
      back.deep === 0 &&
      lookOff < 0.02 &&
      distOff < 0.01 &&
      turn < 0.02 &&
      jump.cam < 0.3 &&
      jump.px < 0.05 * h,
    `lens ${back.dive.lens.toFixed(3)}, look ${lookOff.toFixed(3)} off, distance ${(distOff * 100).toFixed(2)} %, turned ${turn.toFixed(3)} rad; steps: camera ${jump.cam.toFixed(3)}, lens ${jump.px.toFixed(1)} px`,
  );
  check('…and it stays where let go', !back.dive.moving && back.dive.at === 0);
  // a tap on the lens glides the slider through the lens stretch (the same motion), and closes an open switch
  await tap('switch');
  await advance(page, 0.6);
  check('the switch open again', !(await state()).closed);
  const p = await at(page, 'lens');
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  await page.mouse.down();
  await page.mouse.up();
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const g0 = await state();
  check('a lens tap: switch closed, light in that frame', g0.closed && g0.light > 0.5);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const g1 = await state();
  check(
    '…the slider glides through the lens stretch (no jump)',
    g1.dive.moving && g1.dive.at > 0.02 && g1.dive.at < LEAD - 0.05 && g1.dive.slider === LEAD,
    `at ${g1.dive.at.toFixed(2)}`,
  );
  const midFill = await page.evaluate(() =>
    Number(document.querySelector('[data-ui="ctl-depth"] [style*="--c"]')?.style.getPropertyValue('--c')),
  );
  check(
    '…its fill follows the lens, the thumb waits at the target',
    Math.abs(midFill * MAX - g1.dive.at) < 0.02,
  );
  await advance(page, 2);
  const g2 = await state();
  check(
    '…and stops with the lens on the wire',
    g2.dive.lens > 0.99 && Math.abs(g2.dive.at - LEAD) < 1e-3 && !g2.dive.moving && g2.deep === 0,
  );
  // a click on the track glides there, speed-limited
  await page.mouse.click(track.x + track.w - 1, track.y);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const t1 = await state();
  check(
    'a click on the track travels (does not jump)',
    t1.dive.moving && t1.dive.position < 1.2,
    t1.dive.position.toFixed(2),
  );
  await advance(page, 5);
  const fill = () =>
    page.evaluate(() =>
      Number(document.querySelector('[data-ui="ctl-depth"] [style*="--c"]')?.style.getPropertyValue('--c')),
    );
  check('the track fill shows where the dive is (current)', Math.abs((await fill()) - 1) < 0.01);
  const t2 = await state();
  check('…and arrives at the rows', t2.dive.position > 1.99 && !t2.dive.moving, t2.dive.position.toFixed(2));
  await advance(page, 2.2);
  // «де ми»: the platform's floor ladder lights the floor on screen, by its plain name in the prologue
  check(
    'floor ladder: «ряди кульок» lit',
    (await page.evaluate(
      () => document.querySelector('[data-ui="floor-ladder"] .fl-row.on')?.textContent,
    )) === 'ряди кульок',
  );
  const d2 = await state();
  check('2 s on the rows', d2.deep > 1.99 && d2.dive.dwell >= 2, `deep ${d2.deep.toFixed(2)}`);
  await sheetTab(page, 'text');
  check('takeaway shown', await takeaway());

  // «Назад» to `click` from the rows: the dive rewinds in one eased glide (≤ 1.8 s: the lens back into its holder,
  // the camera to the stand plan), then the unfolding plays backwards as a rewind of ≈ 3 s (the owner,
  // 2026-11-17; forwards it is 7 s), the camera arriving on the closed flashlight with the parts; then the dark
  step = 'back';
  await page.evaluate(() => window.__app.prev());
  let r = await state();
  let rewind = 0;
  let camJump = 0;
  let last = r.camera;
  while (!r.unfold.playing && rewind < 300) {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    rewind += 1;
    r = await state();
    camJump = Math.max(camJump, Math.hypot(...r.camera.map((c, i) => c - last[i])));
    last = r.camera;
  }
  check(
    'the dive rewinds first: lens in its holder, stand plan, ≤ 1.8 s',
    r.unfold.playing && r.deep === 0 && r.dive.lens < 0.01 && rewind <= 1.9 * 60,
    `${(rewind / 60).toFixed(2)} s`,
  );
  let frames = 0;
  while (r.unfold.playing && frames < 600) {
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    frames += 1;
    r = await state();
    camJump = Math.max(camJump, Math.hypot(...r.camera.map((c, i) => c - last[i])));
    last = r.camera;
  }
  const FLASHLIGHT = [-0.6, 5.2, 8.6];
  const camOff = Math.hypot(...r.camera.map((c, i) => c - FLASHLIGHT[i]));
  check(
    'then the flashlight closes in ≈ 3 s',
    frames >= 2.8 * 60 && frames <= 3.2 * 60 && r.unfold.value < 0.001,
    `${(frames / 60).toFixed(2)} s`,
  );
  check(
    '…the camera there with it, never a cut',
    camOff < 0.3 && camJump < 0.5,
    `${camOff.toFixed(2)} from the shot, largest step ${camJump.toFixed(2)}`,
  );
  await advance(page, 0.5);
  check('…then the dark of `click`', (await state()).glow < 0.1);
  const seats1 = await fromSeats(page);
  check('…the battery and the lamp folded in with it', seats1.battery > TUCKED && seats1.lamp > TUCKED, JSON.stringify(seats1));

  // `riddle` on the crawl: one slider of true time is the moment of the scene (DECISIONS §60 t)
  await enter('riddle');
  const r0 = await state();
  check(
    'entry: time 0, lamp dark, the scene in place',
    r0.riddle.seconds === 0 && !r0.riddle.lampOn && r0.riddle.ready,
  );
  check(
    'no button, no clock: one slider',
    await page.evaluate(
      () =>
        !document.querySelector('[data-ui="ctl-go"], [data-ui="ctl-clock"]') &&
        !!document.querySelector('[data-ui="ctl-riddle-time"] input.dk-range'),
    ),
  );
  await advance(page, 16);
  check('a hint after 15 s', await shown('[data-ui="path-hint"]'));
  await sheetTab(page, 'controls');
  const rt = await page.evaluate(() => {
    const r = document.querySelector('[data-ui="ctl-riddle-time"] input.dk-range').getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, w: r.width };
  });
  const tAt = (f) => rt.x + 8 + (rt.w - 16) * f;
  // the lamp follows the time in the same frame: on just above 0, off again at 0
  await page.mouse.move(tAt(0), rt.y);
  await page.mouse.down();
  await page.mouse.move(tAt(0.03), rt.y, { steps: 2 });
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const on = await state();
  check(
    'the time leaves 0: the lamp shines in that frame',
    on.light > 0.5 && on.riddle.seconds > 0,
    `light ${on.light.toFixed(2)}, ${on.riddle.seconds.toFixed(1)} s`,
  );
  await page.mouse.move(tAt(-0.05), rt.y, { steps: 2 });
  await page.evaluate(() => window.__app.step(1 / 60, 1));
  const off = await state();
  check(
    'back to 0: dark again',
    off.riddle.seconds === 0 && off.light < 0.5,
    `light ${off.light.toFixed(2)}`,
  );
  // a drag scrubs the scene with the hand
  let timeLag = 0;
  for (let k = 1; k <= 10; k++) {
    await page.mouse.move(tAt(k * 0.05), rt.y);
    await page.evaluate(() => window.__app.step(1 / 60, 1));
    const s = (await state()).riddle;
    timeLag = Math.max(timeLag, Math.abs(s.seconds - s.target));
  }
  await page.mouse.up();
  check('a drag is the moment of the scene', timeLag < 0.2, `lag ${timeLag.toFixed(2)} s`);
  // a click on the track's end glides there; the takeaway waits for a second at the end
  await page.mouse.click(rt.x + rt.w - 1, rt.y);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const mid = (await state()).riddle;
  check(
    'a click on the track travels (the snail crawls, no jump)',
    mid.seconds > 70 && mid.seconds < 136,
    `${mid.seconds.toFixed(1)} s`,
  );
  await advance(page, 3.2);
  const end = (await state()).riddle;
  check(
    'at the end: snail ≈ 13.6 cm, spark ≈ 6.0 mm',
    Math.abs(end.snailCm - 13.6) < 0.1 && Math.abs(end.sparkMm - 6.0) < 0.05,
    `${end.snailCm.toFixed(2)} cm, ${end.sparkMm.toFixed(2)} mm`,
  );
  await advance(page, 1.2);
  await sheetTab(page, 'text');
  check('takeaway after a second at the end', await takeaway());
  await page.click('[data-ui="path-more"]');
  await advance(page, 0.4);
  check('«Докладніше» opens', (await page.getAttribute('[data-ui="path-more"]', 'aria-expanded')) === 'true');
  const sw = await at(page, 'switch');
  await page.mouse.click(sw.x, sw.y);
  await advance(page, 0.3);
  check("the stand's switch is inert here", (await state()).riddle.lampOn);

  await enter('map');
  // the platform's journey map on the step's board (journeyInset): the stops are real buttons
  check('the journey map is on the board', await shown('[data-ui="journey-stop:wire"]'));
  check('takeaway hidden before the stops are opened', !(await takeaway()));
  for (const id of ['wire', 'charge', 'battery', 'flow', 'resistance', 'lamp', 'drain']) {
    await page.click(`[data-ui="journey-stop:${id}"]`);
    await advance(page, 0.5);
  }
  check(
    'the card names the last stop',
    (await page.textContent('[data-ui="journey-card"]'))?.includes('Чому батарейка сідає?'),
  );
  const m = await state();
  check('all seven stops opened', m.map.opened === 7, `${m.map.opened} / ${m.map.of}`);
  check('takeaway shown', await takeaway());

  step = 'console';
  const errors = await appErrors(page);
  check(
    'no console errors or warnings',
    errors.length === 0,
    errors
      .slice(0, 2)
      .map((e) => e.message.slice(0, 160))
      .join(' | '),
  );
  // regression (B-circuit-prologue §6.4): a frozen deep link straight into `map` laid the journey map out in a
  // loop of resize notifications («ResizeObserver loop completed …») — four fresh loads, no console error
  // F-navbar-glide: the step bar never jumps. The owner's way: the opening card is left as it is, the flashlight
  // lit, «Далі». The bar must come in where it stays (the middle of the area the step column leaves free) and,
  // frame by frame through «Далі», move by no more than a hair — it once sat at the screen's middle and jumped
  // there by half the column in one frame (its place was one layout pass old)
  // the stale place showed only on the real clock (a fresh page, the step column filled in a later frame): a page
  // of its own, no `?freeze`; the trail is read per rendered frame
  step = 'bar';
  const live = await page.context().newPage();
  await openApp(live, appUrl(baseUrl(args), { route: 'circuit/prologue/click' }));
  await live.waitForTimeout(2500);
  const lamp = await at(live, 'switch');
  await live.mouse.click(lamp.x, lamp.y);
  await live.waitForTimeout(2500);
  const lit = await live.evaluate(() => {
    const r = document.querySelector('[data-ui="navigator"]').getBoundingClientRect();
    const wide = document.getElementById('kd-hud').classList.contains('wide');
    const right = wide ? window.__app.engine.hud.insetFractions().right * innerWidth : 0;
    return { cx: r.x + r.width / 2, free: (innerWidth - right) / 2 };
  });
  check(
    'the bar comes in at the middle of the free area',
    Math.abs(lit.cx - lit.free) < 2,
    `centre ${lit.cx.toFixed(1)}, free middle ${lit.free.toFixed(1)}`,
  );
  await live.evaluate(() => {
    const el = document.querySelector('[data-ui="navigator"]');
    window.__trail = [];
    const tick = () => {
      const r = el.getBoundingClientRect();
      window.__trail.push(r.x + r.width / 2);
      if (window.__trail.length < 90) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await live.click('[data-ui="nav-next"]');
  await live.waitForTimeout(2000);
  const trail = await live.evaluate(() => window.__trail);
  const hop = Math.max(...trail.slice(1).map((x, i) => Math.abs(x - trail[i])));
  check(
    '«Далі»: the bar stays put, no frame jumps',
    trail.length >= 60 && hop <= 2,
    `${trail.length} frames, largest frame step ${hop.toFixed(2)} px`,
  );
  await live.close();

  step = 'deep map';
  for (let n = 0; n < 4; n++) {
    await openApp(
      page,
      appUrl(baseUrl(args), {
        route: 'circuit/prologue/map',
        freeze: 3,
        extra: { hud: 'dom', n: String(n) },
      }),
    );
    await advance(page, 1);
    const deep = await appErrors(page);
    check(
      `deep link #${n + 1}: no console error`,
      deep.length === 0,
      deep.map((e) => e.message.slice(0, 120)).join(' | '),
    );
  }
  failed = results.some((x) => !x.ok);
  console.log(
    `${failed ? 'FAIL' : 'PASS'} prologue interactions — ${results.filter((x) => x.ok).length}/${results.length} checks at ${width}x${height}`,
  );
} catch (e) {
  console.error(`interaction test crashed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
