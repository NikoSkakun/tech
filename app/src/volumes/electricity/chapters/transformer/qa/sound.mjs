#!/usr/bin/env node
/* global process, console, window */
// Sound level check of `transformer` (real time, audio unlocked by a click):
//
//   QA_PORT=5248 node app/src/volumes/electricity/chapters/transformer/qa/sound.mjs
//
// For every step: master RMS / peak over 1,5 s through `window.__audio.level()` — must be audible (RMS > 0) and never
// clip (peak < 0,99). Step 6: «Послухати» must raise the level. Leaving the chapter: the chapter's loops fade out
// (the level falls back to the mood pad of the next chapter).
import { appErrors, baseUrl, launch, openApp, parseArgs } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const { browser, page } = await launch({ width: 1280, height: 720 });
const failures = [];
const wait = (ms) => page.waitForTimeout(ms);
const level = async (ms = 1500) => {
  let rms = 0;
  let peak = 0;
  for (let t = 0; t < ms; t += 100) {
    const l = await page.evaluate(() => window.__audio?.level() ?? { rms: 0, peak: 0 });
    rms = Math.max(rms, l.rms);
    peak = Math.max(peak, l.peak);
    await wait(100);
  }
  return { rms: +rms.toFixed(4), peak: +peak.toFixed(3) };
};
const STEPS = ['mutual-induction', 'turns-ratio', 'why-high-voltage', 'anatomy', 'tap-changer', 'losses-efficiency', 'three-phase-groups', 'types', 'voltage-ladder'];
try {
  // appUrl() adds ?noaudio; this check needs sound
  await openApp(page, `${baseUrl(args)}?debug&overlay=0&q=high#/transformer/mutual-induction`);
  await page.mouse.click(640, 360); // the first gesture unlocks audio
  await wait(800);
  if (!(await page.evaluate(() => window.__audio?.unlocked()))) failures.push('audio did not unlock');
  for (const s of STEPS) {
    await page.evaluate((id) => window.__app.goto('transformer', id, { instant: true }), s);
    await wait(1200);
    const l = await level();
    console.log(`${s.padEnd(20)} rms ${l.rms}  peak ${l.peak}`);
    if (!(l.rms > 0)) failures.push(`${s}: silent`);
    if (l.peak >= 0.99) failures.push(`${s}: clipping (${l.peak})`);
  }
  // the chapter's requested loop levels: «Послухати» must raise the hum (the live analyser is dominated by the mood
  // pad and the limiter, so the request itself is asserted)
  const req = () => page.evaluate(() => window.__app.read('sound'));
  await page.evaluate(() => window.__app.goto('transformer', 'losses-efficiency', { instant: true }));
  await wait(800);
  const quiet = await req();
  await page.evaluate(() => window.__ui.press('listen6'));
  await wait(1500);
  const loud = await req();
  console.log(`listen: hum ${quiet.hum.toFixed(2)} → ${loud.hum.toFixed(2)} (pitch ${loud.humPitch}), buzz ${loud.buzz.toFixed(2)}`);
  if (!(loud.hum > quiet.hum * 3 && loud.humPitch === 2 && loud.buzz > 0.3)) failures.push('«Послухати» does not raise the 100 Hz hum');
  const l = await level(1000);
  if (l.peak >= 0.99) failures.push(`listening clips (${l.peak})`);
  await page.evaluate(() => window.__app.goto('atom'));
  await wait(4000);
  const after = await page.evaluate(() => window.__app.read('sound'));
  console.log(`after leaving: chapter probe ${JSON.stringify(after)}`);
  if (after) failures.push('the chapter still drives its loops after leaving');
  for (const e of await appErrors(page)) failures.push(`console ${e.level}: ${e.message.slice(0, 160)}`);
} catch (e) {
  failures.push(`exception: ${e.stack ?? e}`);
} finally {
  await browser.close();
}
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(failures.length ? `FAILED: ${failures.length}` : 'PASS: sound levels');
process.exit(failures.length ? 1 : 0);
