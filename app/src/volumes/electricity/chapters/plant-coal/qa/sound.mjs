#!/usr/bin/env node
/* global process, console, window */
// Sound level check of the chapter (dev server or production build), real time, no frozen clock:
//
//   QA_PORT=5250 node app/src/volumes/electricity/chapters/plant-coal/qa/sound.mjs
//
// A real click unlocks audio; then every step is opened and the master output is sampled for ≈ 3 s
// (`__audio.level()`: RMS and peak). Fails on clipping (peak ≥ 0.99) and on a silent chapter; prints the level
// ≈ 6 s after leaving for `atom` (its own ambient bed only — the chapter's loops must have faded).
import { baseUrl, launch, openApp, parseArgs } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const STEPS = ['overview', 'coal', 'coal-to-dust', 'boiler', 'steam-params', 'turbine', 'feedwater', 'flue-gas', 'ash-co2', 'chp-flex', 'role-ukraine'];
const { browser, page } = await launch({ width: 1280, height: 720 });
const failures = [];
const sample = async (seconds) => {
  let rms = 0;
  let peak = 0;
  const n = Math.round(seconds * 5);
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(200);
    const l = await page.evaluate(() => window.__audio?.level() ?? { rms: 0, peak: 0 });
    rms += l.rms / n;
    peak = Math.max(peak, l.peak);
  }
  return { rms: Math.round(rms * 1e4) / 1e4, peak: Math.round(peak * 1e3) / 1e3 };
};
try {
  // `appUrl` adds `noaudio`: build the URL by hand (like app/src/audio/qa/audio-check.mjs)
  await openApp(page, `${baseUrl(args)}?debug&overlay=0&q=medium#/plant-coal/overview`);
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__audio?.unlocked() && window.__audio.state() === 'running', null, { timeout: 5000 });
  console.log('audio state', await page.evaluate(() => window.__audio?.state()));
  let loud = 0;
  for (const id of STEPS) {
    await page.evaluate((s) => window.__app.goto('plant-coal', s), id);
    await page.waitForTimeout(2500);
    const l = await sample(3);
    loud = Math.max(loud, l.rms);
    console.log(`  ${id.padEnd(14)} rms ${l.rms.toFixed(4)}  peak ${l.peak.toFixed(3)}`);
    if (l.peak >= 0.99) failures.push(`${id}: clipping (peak ${l.peak})`);
  }
  if (loud < 0.002) failures.push('the chapter is silent');
  await page.evaluate(() => window.__app.goto('atom'));
  await page.waitForTimeout(6000);
  const after = await sample(2);
  console.log(`  after leaving  rms ${after.rms.toFixed(4)}  peak ${after.peak.toFixed(3)} (atom's own bed included)`);
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL — ${failures.join('; ')}` : 'PASS — sound levels sampled per step');
process.exit(failures.length ? 1 : 0);
