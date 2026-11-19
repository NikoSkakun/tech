#!/usr/bin/env node
/* global process, console, window, document, Buffer */
// The whole volume as a reader walks it — the volume's regression test of its seams (lenovo; dev or preview up):
//
//   node tools/qa/volume-walk.mjs circuit --port 5320 [--size 1280x720 | --touch] [--out DIR] [--no-back]
//                                 [--from wire/plastic --until battery]   (a part of the walk, for development)
//                                 [--map]   (instead of the walk: every stop of the «Мапа» overlay and of the map
//                                            step, through to its chapter — `walk-map.mjs`)
// The deployed site: `--port 8080` (or `--base http://<host>:8080/`) — the walk only reads, never writes.
//
// A fresh browser (= after «Почати з нуля»), the plain address (`?noaudio` only, real clock): «Почати подорож» →
// the map's first stop → «Почати» of the opening card → then «Далі» only, step after step, chapter after chapter.
// A step whose navigator waits for its goal (stepUi `nav.hiddenUntil`) gets it the reader's way: a tap on the
// scene probe the volume's table below names. Every frame is sampled (`walk-parts.mjs`: camera pose, mean
// luminance of the 3D picture). At each chapter border the last frame of N and the first frame of N+1 are shot
// and compared; the crossing is checked for camera and light jumps and for a flash; with `--back` (default) the
// border is crossed back with «Назад» and forward again. Console errors are collected per step.
// `--touch`: 390×844, touch input, DPR 2. Output: `<out>/<size>/` frames + `walk.json`; exit 1 on any finding.
import { writeFileSync } from 'node:fs';
import { baseUrl, ensureDir, launch, openApp, parseArgs, parseSize, QA_ROOT } from './lib.mjs';
import { closingCard } from './next-chapter.mjs';
import { mapWalk } from './walk-map.mjs';
import { drain, frameDiff, installSampler, jumps, lightCourse, shoot } from './walk-parts.mjs';

/** Per volume: the scene probe that reaches the goal of a step whose navigator waits for it. */
const GATES = { circuit: { 'prologue/click': 'switch' } };
/** A border frame pair differs visibly above these (thumbnail mean / worst block, 0…255). */
const DIFF = { mean: 6, block: 24 };
/** Frames on each side of the swap that make the seam (≈ 0.3 s at 60 Hz). */
const SEAM = 18;

const args = parseArgs();
const volume = String(args._[0] ?? 'circuit');
const touch = !!args.touch;
const [width, height] = touch ? [390, 844] : parseSize(args.size, [1280, 720]);
const back = !args['no-back'];
const out = ensureDir(`${args.out ?? `${QA_ROOT}/volume-walk`}/${volume}-${width}x${height}`);
const { browser, page, pageErrors } = await launch({
  width,
  height,
  touch,
  dpr: touch ? 2 : 1,
});
const findings = [];
const log = {
  volume,
  size: `${width}x${height}`,
  steps: [],
  borders: [],
  errors: [],
};
const fail = (what) => {
  findings.push(what);
  console.log(`  FAIL ${what}`);
};
const wait = (s) => page.waitForTimeout(Math.round(s * 1000));
const pos = () => page.evaluate(() => window.__app.position());
const save = (shot, file) => writeFileSync(`${out}/${file}`, Buffer.from(shot.jpg.split(',')[1], 'base64'));

/** Press a DOM control the reader's way (a tap on touch). */
async function press(sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  const b = await loc.boundingBox();
  if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function tapAt(x, y) {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Wait until navigation has settled and the camera rests (idle breathing only), at least `min` s. */
async function settle(min = 2.5, max = 16) {
  const t0 = Date.now();
  await wait(min);
  for (;;) {
    const calm = await page.evaluate(() => {
      const s = window.__walk.samples.slice(-24);
      if (s.length < 24 || window.__app.engine.runtime.busy) return false;
      return s.slice(1).every((x, i) => Math.hypot(...x.p.map((v, k) => v - s[i].p[k])) < 0.006);
    });
    if (calm || Date.now() - t0 > max * 1000) return calm;
    await wait(0.25);
  }
}

/** Errors the app captured since the last call. */
async function errorsNow(where) {
  const errs = await page.evaluate(() => {
    const e = window.__app.errors().filter((m) => m.level === 'error');
    window.__app.clearErrors();
    return e.map((m) => m.message);
  });
  for (const m of [...errs, ...pageErrors.splice(0)]) {
    log.errors.push({ where, message: m });
    fail(`console error at ${where}: ${m.slice(0, 160)}`);
  }
}

const shown = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }, sel);

/** «Почати» of a chapter's opening card, when it stands before step 1. */
async function opening() {
  if (await shown('[data-ui="path-opening"] button')) {
    await press('[data-ui="path-opening"] button');
    await wait(0.8);
  }
}

/**
 * «Далі» on a chapter's last step: the platform first shows the chapter's closing card in the step panel
 * (`next-chapter.mjs` `closingCard`, the shared helper) — the scene stays as it is behind it; the second «Далі»
 * (pressed by `cross`, sampled) goes to the next chapter.
 */
async function closingCardFirst() {
  const card = await closingCard(page, (s) => wait(s));
  if (!card.shown) fail(`no closing card on ${card.position.chapterId}/${card.position.stepId}`);
  await settle(0.5);
}

/** Is the reader on the last step of the chapter? */
const onLastStep = () =>
  page.evaluate((v) => {
    const p = window.__app.position();
    const c = window.__app.listChapters(v).find((x) => x.id === p.chapterId);
    return !!c && c.steps.at(-1)?.id === p.stepId;
  }, volume);

let shotNo = 0;
/** One press of «Далі» (`next`) or «Назад» (`prev`), sampled; a crossed border is shot and compared. */
async function cross(dir) {
  const border = dir === 'next' && (await onLastStep());
  if (border) await closingCardFirst();
  const from = await pos();
  const tag = `${String(++shotNo).padStart(3, '0')}`;
  await shoot(page, `last-${tag}`);
  const pre = await drain(page);
  const last = pre.shots.find((s) => s.name === `last-${tag}`);
  // the frames just before the press belong to the crossing (the «before» light)
  const lead = pre.samples.slice(-10);
  const pressedAt = await page.evaluate(() => performance.now());
  await press(dir === 'next' ? '[data-ui="nav-next"]' : '[data-ui="nav-prev"]');
  let calm = await settle(dir === 'next' ? 2.5 : 2);
  // across a border the reader then looks at the new chapter's entry before going on (≥ 2.5 s after the swap)
  if ((await pos()).chapterId !== from.chapterId) calm = await settle(2.5);
  await shoot(page, `settled-${tag}`);
  const run = await drain(page);
  const to = await pos();
  const where = `${from.chapterId}/${from.stepId} → ${to.chapterId}/${to.stepId}`;
  const samples = [...lead, ...run.samples];
  const j = jumps(samples);
  const entry = {
    dir,
    from,
    to,
    frames: samples.length,
    calm,
    largest: j.largest,
    jumps: j.found,
  };
  if (!calm) console.log(`  note  ${where}: the camera did not come to rest`);
  if (from.chapterId === to.chapterId) {
    log.steps.push(entry);
    for (const f of j.found)
      console.log(`  warn  ${where}: ${f.kind} jump ${f.size.toFixed(2)} (frame ${f.at})`);
    return entry;
  }
  // a border
  // the outgoing chapter's last frame before the swap (after its walk to the border), else the one before the press
  const edge = run.shots.find((s) => s.name.startsWith('edge-')) ?? last;
  const first = run.shots.find((s) => s.name.startsWith('enter-'));
  const free = run.shots.find((s) => s.name.startsWith('idle-')) ?? first;
  const settled = run.shots.find((s) => s.name === `settled-${tag}`);
  const name = `${tag}-${dir}-${from.chapterId}-${to.chapterId}`;
  save(last, `${name}-0-pressed.jpg`);
  save(edge, `${name}-a-last.jpg`);
  if (first) save(first, `${name}-b-first.jpg`);
  if (free && free !== first) save(free, `${name}-c-free.jpg`);
  save(settled, `${name}-d-settled.jpg`);
  const dFirst = first ? frameDiff(edge.thumb, first.thumb) : null;
  const dFree = free ? frameDiff(edge.thumb, free.thumb) : null;
  // the seam itself: the frames around the swap (the walk to the border and the step's own entry are motion of
  // the chapters — their jumps are listed as warnings, as inside a chapter)
  const swapAt = samples.findIndex((x) => x.ch === to.chapterId);
  const near = (i) => swapAt >= 0 && Math.abs(i - swapAt) <= SEAM;
  const light = lightCourse(samples.slice(Math.max(0, swapAt - SEAM), swapAt + SEAM + 1));
  // the walk to the border: from the press to the swap (seconds)
  const walkS = swapAt >= 0 ? (samples[swapAt].t - pressedAt) / 1000 : null;
  Object.assign(entry, { name, dFirst, dFree, light, walkS });
  log.borders.push(entry);
  console.log(
    `  border ${where} (${walkS?.toFixed(1)} s): first Δ ${dFirst?.mean.toFixed(1)}/${dFirst?.block.toFixed(0)}, free Δ ` +
      `${dFree?.mean.toFixed(1)}/${dFree?.block.toFixed(0)}, light ${light.before.toFixed(0)}→${light.after.toFixed(0)} ` +
      `(excursion ${light.excursion.toFixed(0)}), largest step pos ${j.largest.pos.toFixed(2)} deg ${j.largest.deg.toFixed(1)} lum ${j.largest.lum.toFixed(1)}`,
  );
  for (const [k, d] of [
    ['first', dFirst],
    ['free', dFree],
  ])
    if (d && (d.mean > DIFF.mean || d.block > DIFF.block))
      fail(
        `${where}: the ${k} frame differs from the last one (mean ${d.mean.toFixed(1)}, block ${d.block.toFixed(0)})`,
      );
  if (light.excursion > 8)
    fail(`${where}: a flash (light leaves both ends by ${light.excursion.toFixed(0)})`);
  for (const f of j.found) {
    const what = `${where}: ${f.kind} jump ${f.size.toFixed(2)} at frame ${f.at}${f.swap ? ' (the swap)' : ''}`;
    if (near(f.at)) fail(what);
    else console.log(`  warn  ${what} — ${f.at < swapAt ? 'leaving' : 'arriving'}, ${f.step}`);
  }
  return entry;
}

let code = 1;
try {
  const base = baseUrl(args);
  console.log(`volume-walk ${volume} ${width}x${height}${touch ? ' touch' : ''} — ${base}?noaudio`);
  const part = typeof args.from === 'string';
  await openApp(page, `${base}?noaudio${part ? `#/${volume}/${args.from}` : ''}`);
  await installSampler(page);
  await wait(2);
  if (part && (await page.evaluate(() => window.__ui.overlay())) !== null)
    await page.evaluate(() => window.__ui.close());
  // the title screen of a first visit → «Почати подорож» opens the map → the first stop's card → go
  const first = await page.evaluate((v) => window.__app.listChapters(v)[0]?.id, volume);
  if (!part && (await page.evaluate(() => window.__ui.overlay())) === 'home') {
    await press('[data-ui="home-start"]');
    await wait(1.5);
  }
  if (!part && (await page.evaluate(() => window.__ui.overlay())) === 'map') {
    const node = await page.evaluate((c) => window.__ui.mapNode(c), first);
    if (!node) throw new Error(`no map node for ${first}`);
    await tapAt(node.x, node.y);
    await wait(1);
    await press('[data-ui="map-go"]');
  }
  if (args.map) {
    // the map mode: the overlay opened by «Почати подорож» is where it starts
    log.map = await mapWalk({
      page,
      volume,
      press,
      tapAt,
      wait,
      fail,
      log: (line) => console.log(line),
      save: (file) => page.screenshot({ path: `${out}/${file}`, type: 'jpeg', quality: 80 }),
    });
    await errorsNow('map');
  } else {
    await settle(2);
    await opening();
    await drain(page);
    const seen = new Set();
    for (let guard = 0; guard < 200; guard++) {
      const p = await pos();
      const key = `${p.chapterId}/${p.stepId}`;
      if (p.volumeId !== volume) throw new Error(`left the volume at ${p.volumeId}/${key}`);
      if (part && p.chapterId === args.until) break;
      seen.add(key);
      // a step that waits for its goal: the reader does it (a tap on the probe), at most three times
      for (let k = 0; k < 3 && (await page.evaluate(() => window.__ui.navHidden())); k++) {
        const probe = GATES[volume]?.[key];
        if (!probe)
          throw new Error(`«Далі» waits for the goal of ${key} and the walk has no way to reach it`);
        const at = await page.evaluate((n) => window.__app.locate(n), probe);
        await tapAt(at.x, at.y);
        await wait(1.5);
      }
      await errorsNow(key);
      // the volume's end: the last chapter's closing card, then the walk is over
      const lastChapter = await page.evaluate(
        (v) =>
          window.__app
            .listChapters(v)
            .filter((c) => !c.dev)
            .at(-1)?.id,
        volume,
      );
      if (p.chapterId === lastChapter && (await onLastStep())) {
        await closingCardFirst();
        await shoot(page, 'volume-end');
        const end = (await drain(page)).shots.find((x) => x.name === 'volume-end');
        if (end) save(end, 'volume-end.jpg');
        break;
      }
      const canNext = await page.evaluate(() => !document.querySelector('[data-ui="nav-next"]')?.disabled);
      if (!canNext) break;
      const e = await cross('next');
      if (e.from.chapterId !== e.to.chapterId) {
        if (back) {
          await cross('prev');
          await cross('next');
        }
        await opening();
      }
    }
    await errorsNow('end');
    const chapters = await page.evaluate((v) => window.__app.listChapters(v).filter((c) => !c.dev), volume);
    const total = chapters.reduce((n, c) => n + c.steps.length, 0);
    if (!part && seen.size !== total) fail(`walked ${seen.size} of ${total} steps`);
    console.log(`  walked ${seen.size} steps, ${log.borders.length} border crossings`);
  }
  code = findings.length ? 1 : 0;
} catch (e) {
  fail(`the walk stopped: ${e.message}`);
} finally {
  log.findings = findings;
  writeFileSync(`${out}/walk.json`, JSON.stringify(log, null, 1));
  await browser.close();
}
console.log(findings.length ? `FAIL (${findings.length}) — ${out}` : `PASS — ${out}`);
process.exit(code);
