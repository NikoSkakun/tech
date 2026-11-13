#!/usr/bin/env node
/* global process, console, window */
// Audio acceptance check (run on lenovo, dev server up):
//
//   QA_PORT=5203 node app/src/audio/qa/audio-check.mjs [--out /srv/electricity/qa/F3-fx/audio.json]
//
// 1. locked: every API call before the first gesture is a silent no-op without errors;
// 2. live: a real click unlocks audio, then every one-shot / loop / mood is triggered and the master
//    analyser must show signal (RMS > 0) and no clipping (peak < 1);
// 3. offline: every sound is rendered through the master chain in an OfflineAudioContext and must be
//    non-silent (loops / moods: RMS > 0.001; one-shots: peak > 0.01) and non-clipping (peak < 0.99);
// 4. `?noaudio`: the same calls stay locked and silent, without errors.
import { writeFileSync } from 'node:fs';
import { appErrors, baseUrl, launch, openApp, parseArgs } from '../../../../tools/qa/lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const out = typeof args.out === 'string' ? args.out : '/srv/electricity/qa/F3-fx/audio.json';
const url = (noaudio) => `${base}?debug&overlay=0&q=high${noaudio ? '&noaudio' : ''}#/_sandbox-fx/characters`;
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

/** Poll the live analyser for `ms` and return the largest RMS / peak seen. */
async function listen(page, ms) {
  let rms = 0;
  let peak = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const l = await page.evaluate(() => window.__audio.level());
    rms = Math.max(rms, l.rms);
    peak = Math.max(peak, l.peak);
    await page.waitForTimeout(25);
  }
  return { rms, peak };
}

const callEverything = (page) =>
  page.evaluate(() => {
    const a = window.__audio;
    for (const n of a.names.oneShots) a.play(n);
    for (const n of a.names.loops) a.loop(n, { gain: 0.5, pitch: 1.1 });
    for (const n of a.names.moods) a.mood(n);
    a.stopLoops();
    a.mood(null);
  });

const report = { live: {}, offline: {}, locked: null, noaudio: null };
const { browser, page } = await launch({ width: 960, height: 540 });
try {
  await openApp(page, url(false));
  const names = await page.evaluate(() => window.__audio.names);

  // 1. locked
  await callEverything(page);
  report.locked = await page.evaluate(() => ({ unlocked: window.__audio.unlocked(), state: window.__audio.state() }));
  check(report.locked.unlocked === false, 'audio must be locked before the first gesture');

  // 2. live
  await page.mouse.click(480, 270);
  await page.waitForFunction(() => window.__audio.unlocked() && window.__audio.state() === 'running', null, { timeout: 5000 });
  await page.evaluate(() => window.__audio.mood(null));
  await page.waitForTimeout(400);
  for (const n of names.oneShots) {
    await page.evaluate((name) => window.__audio.play(name), n);
    report.live[`oneshot:${n}`] = await listen(page, 260);
    await page.waitForTimeout(n.startsWith('whoosh') ? 1100 : 250);
  }
  for (const n of names.loops) {
    await page.evaluate((name) => window.__audio.loop(name, { gain: 0.8, pitch: 1 }), n);
    await page.waitForTimeout(450);
    report.live[`loop:${n}`] = await listen(page, 350);
    await page.evaluate((name) => window.__audio.loop(name, { pitch: 1.5 }), n); // pitch change must not throw
    await page.evaluate(() => window.__audio.stopLoops());
    await page.waitForTimeout(700);
  }
  for (const n of names.moods) {
    await page.evaluate((name) => window.__audio.mood(name), n);
    await page.waitForTimeout(2600);
    report.live[`mood:${n}`] = await listen(page, 400);
  }
  await page.evaluate(() => window.__audio.mood(null));
  for (const [key, l] of Object.entries(report.live)) {
    check(l.rms > 1e-4, `live ${key}: silent (rms ${l.rms.toExponential(2)})`);
    check(l.peak < 1, `live ${key}: clipping (peak ${l.peak.toFixed(3)})`);
  }

  // 3. offline
  const refs = [
    ...names.oneShots.map((name) => ({ kind: 'oneshot', name })),
    ...names.loops.map((name) => ({ kind: 'loop', name })),
    ...names.moods.map((name) => ({ kind: 'mood', name })),
  ];
  for (const ref of refs) {
    const seconds = ref.kind === 'oneshot' ? 1.3 : ref.kind === 'loop' ? 2 : 4;
    // a 30 ms tick has a tiny RMS over a 1.3 s window: one-shots are judged by their peak
    const stats = await page.evaluate(([r, s]) => window.__audio.renderOffline(r, s), [ref, seconds]);
    report.offline[`${ref.kind}:${ref.name}`] = stats;
    check(ref.kind === 'oneshot' ? stats.peak > 0.01 : stats.rms > 1e-3, `offline ${ref.kind}:${ref.name}: silent (rms ${stats.rms.toExponential(2)}, peak ${stats.peak.toFixed(4)})`);
    check(stats.peak < 0.99, `offline ${ref.kind}:${ref.name}: clipping (peak ${stats.peak.toFixed(3)})`);
  }
  const errors = await appErrors(page);
  check(errors.length === 0, `console errors with audio on: ${errors.map((e) => e.message).join(' | ').slice(0, 400)}`);

  // 4. ?noaudio
  await openApp(page, url(true));
  await page.mouse.click(480, 270);
  await page.waitForTimeout(300);
  await callEverything(page);
  await page.waitForTimeout(300);
  report.noaudio = await page.evaluate(() => ({ unlocked: window.__audio.unlocked(), state: window.__audio.state(), level: window.__audio.level() }));
  check(report.noaudio.unlocked === false, '?noaudio: audio must stay locked after a gesture');
  const errors2 = await appErrors(page);
  check(errors2.length === 0, `console errors with ?noaudio: ${errors2.map((e) => e.message).join(' | ').slice(0, 400)}`);
} catch (e) {
  failures.push(`exception: ${e.message}`);
} finally {
  await browser.close();
}

writeFileSync(out, JSON.stringify({ report, failures }, null, 2));
const fmt = (v) => v.toFixed(4).padStart(8);
console.log('sound                    live rms live peak | offline rms  peak');
for (const key of Object.keys(report.offline)) {
  const l = report.live[key] ?? { rms: 0, peak: 0 };
  const o = report.offline[key];
  console.log(`${key.padEnd(22)} ${fmt(l.rms)} ${fmt(l.peak)}  | ${fmt(o.rms)} ${fmt(o.peak)}`);
}
console.log(`locked: ${JSON.stringify(report.locked)}   noaudio: ${JSON.stringify(report.noaudio)}`);
console.log(failures.length ? `FAIL (${failures.length}):\n  ${failures.join('\n  ')}` : `PASS — report: ${out}`);
process.exit(failures.length ? 1 : 0);
