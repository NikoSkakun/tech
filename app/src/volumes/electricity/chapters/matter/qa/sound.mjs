#!/usr/bin/env node
/* global process, console, window */
// Sound level check of chapter `matter` (dev server or production preview, real time — no frozen clock):
//
//   node app/src/volumes/electricity/chapters/matter/qa/sound.mjs [--port 5245]
//
// Unlocks audio with a real click, then visits every step with the state that drives its loops (field on,
// high voltage, current through the diode …) and samples the master output: it must stay below clipping, and
// after going back to a quiet step the level must fall back to the ambient pad (no loop left playing).
import { appErrors, baseUrl, launch, openApp, parseArgs } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const { browser, page } = await launch({ width: 1280, height: 720 });
const failures = [];
const level = async (ms) => {
  let rms = 0;
  let peak = 0;
  for (let t = 0; t < ms; t += 100) {
    const l = await page.evaluate(() => window.__audio?.level() ?? { rms: 0, peak: 0 });
    rms = Math.max(rms, l.rms);
    peak = Math.max(peak, l.peak);
    await page.waitForTimeout(100);
  }
  return { rms: +rms.toFixed(4), peak: +peak.toFixed(3) };
};
const visit = async (step, setup = '') => {
  await page.evaluate(
    ([s, js]) => window.__app.goto('matter', s).then(() => new Function(js)()),
    [step, setup],
  );
  await page.waitForTimeout(1200);
  return level(1500);
};
try {
  // appUrl() always adds ?noaudio — this check needs sound
  await openApp(page, `${baseUrl(args)}?debug&overlay=0&q=high#/matter/lattice`);
  await page.mouse.click(640, 360);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__audio?.unlocked()))) failures.push('audio did not unlock');
  const quiet = await visit('lattice');
  console.log(`  lattice (pad only)        ${JSON.stringify(quiet)}`);
  const cases = [
    ['electron-sea', "__ui.set('field2', true, true); __ui.set('E2', 1, true)"],
    ['bands', "__ui.set('mat3', 'Cu', true)"],
    ['insulators', "__ui.set('U4', 2.95, true)"],
    ['resistance', "__ui.set('T5', 300, true)"],
    ['silicon', "__ui.set('T6', 450, true)"],
    ['doping', ''],
    ['pn-junction', "__ui.set('Us8', 6, true)"],
    ['devices', "__ui.set('dev9', 'mosfet', true); __ui.set('ugs9', 10, true)"],
  ];
  for (const [step, js] of cases) {
    const l = await visit(step, js);
    console.log(`  ${step.padEnd(25)} ${JSON.stringify(l)}`);
    if (l.peak >= 0.99) failures.push(`${step}: clipping (peak ${l.peak})`);
  }
  const after = await visit('lattice');
  console.log(`  back to lattice           ${JSON.stringify(after)}`);
  if (after.rms > quiet.rms * 1.6 + 0.004)
    failures.push(`loops still playing after leaving: ${after.rms} vs ${quiet.rms}`);
  for (const e of await appErrors(page)) failures.push(`console ${e.level}: ${e.message.slice(0, 160)}`);
} finally {
  await browser.close();
}
console.log(
  failures.length ? `FAIL\n  ${failures.join('\n  ')}` : 'PASS — sound levels within range, loops stop',
);
process.exit(failures.length ? 1 : 0);
