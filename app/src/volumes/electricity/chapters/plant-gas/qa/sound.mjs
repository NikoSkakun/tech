#!/usr/bin/env node
/* global process, console, window */
// Sound level check of chapter `plant-gas` (dev server or production preview, real time — no frozen clock):
//
//   node app/src/volumes/electricity/chapters/plant-gas/qa/sound.mjs [--port 5241]
//
// Unlocks audio with a real click, then visits every step in the state that drives its loops (the gas turbine
// roaring in the hall, all engines running, the boiler with duct burners …) and samples the master output: it
// must stay below clipping, and after going back to a quiet step the level must fall back to the ambient
// (no loop left playing).
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
  await page.evaluate(([s, js]) => window.__app.goto('plant-gas', s).then(() => new Function(js)()), [step, setup]);
  await page.waitForTimeout(2200);
  return level(1500);
};
try {
  // appUrl() always adds ?noaudio — this check needs sound
  await openApp(page, `${baseUrl(args)}?debug&overlay=0&q=high#/plant-gas/role`);
  await page.mouse.click(640, 360);
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.__audio?.unlocked()))) failures.push('audio did not unlock');
  const quiet = await visit('role');
  console.log(`  role (ambient)            ${JSON.stringify(quiet)}`);
  const cases = [
    ['overview', "__ui.set('ov.mode', 'peak', true)"],
    ['natural-gas', ''],
    ['gas-turbine', ''],
    ['brayton-sim', "__ui.set('br.tit', 1700, true)"],
    ['hot-section', ''],
    ['combined-cycle', "__ui.set('cc.firing', 100, true)"],
    ['flexibility', "__ui.press('fx.trip')"],
    ['gas-engines', ''],
    ['emissions-hydrogen', ''],
  ];
  for (const [step, js] of cases) {
    const l = await visit(step, js);
    console.log(`  ${step.padEnd(25)} ${JSON.stringify(l)}`);
    if (l.peak >= 0.99) failures.push(`${step}: clipping (peak ${l.peak})`);
  }
  const after = await visit('role');
  console.log(`  back to role              ${JSON.stringify(after)}`);
  if (after.rms > quiet.rms * 1.6 + 0.004) failures.push(`loops still playing after leaving: ${after.rms} vs ${quiet.rms}`);
  for (const e of await appErrors(page)) failures.push(`console ${e.level}: ${e.message.slice(0, 160)}`);
} finally {
  await browser.close();
}
console.log(failures.length ? `FAIL\n  ${failures.join('\n  ')}` : 'PASS — sound levels within range, loops stop');
process.exit(failures.length ? 1 : 0);
