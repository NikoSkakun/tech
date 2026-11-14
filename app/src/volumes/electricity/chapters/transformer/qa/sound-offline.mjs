#!/usr/bin/env node
/* global console, process, window */
// Offline sound check of `transformer` (no sound card, no listening):
//
//   QA_PORT=5251 node app/src/volumes/electricity/chapters/transformer/qa/sound-offline.mjs
//
// For every step (frozen clock, 2 s in): the loop levels the chapter asks for (`__app.read('sound')`) are rendered
// through the engine's master chain (`__audio.renderOffline`) at the step's pitch and scaled by the requested gain
// (sound.ts: hum × 1, buzz × 0,6). Step 6 also at the peak of «Послухати». Every one-shot the chapter plays is
// rendered at the gain sound.ts uses. Prints dBFS (RMS / peak); fails if a step is silent or anything clips.
import { appErrors, appUrl, baseUrl, launch, openApp, parseArgs } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const { browser, page } = await launch({ width: 1280, height: 720 });
const failures = [];
const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const render = (sound, seconds = 1.5) => page.evaluate(([s, t]) => window.__audio.renderOffline(s, t), [sound, seconds]);
const STEPS = ['mutual-induction', 'turns-ratio', 'why-high-voltage', 'anatomy', 'tap-changer', 'losses-efficiency', 'three-phase-groups', 'types', 'voltage-ladder'];

// `?noaudio` (appUrl) keeps the live engine silent; offline rendering does not need it
await openApp(page, appUrl(baseUrl(args), { route: 'transformer/mutual-induction', freeze: 3 }));
const loopLevel = async (name, gain, pitch) => {
  if (gain <= 0) return { rms: 0, peak: 0 };
  const r = await render({ kind: 'loop', name, pitch });
  return { rms: r.rms * gain, peak: r.peak * gain };
};
const measure = async (label) => {
  const s = await page.evaluate(() => window.__app.read('sound'));
  const hum = await loopLevel('hum', Math.min(1, s.hum), s.humPitch);
  const buzz = await loopLevel('buzz', Math.min(1, s.buzz) * 0.6, s.buzzPitch);
  // two loops add as uncorrelated signals (RMS) and at worst in phase (peak)
  const rms = Math.hypot(hum.rms, buzz.rms);
  const peak = hum.peak + buzz.peak;
  console.log(`${label.padEnd(22)} hum ${s.hum.toFixed(2)}@×${s.humPitch} buzz ${s.buzz.toFixed(2)}@×${s.buzzPitch}  → ${db(rms)} dBFS rms, ${db(peak)} dBFS peak`);
  if (rms < 1e-3) failures.push(`${label}: silent`);
  if (peak >= 0.99) failures.push(`${label}: clips (${peak.toFixed(3)})`);
  return rms;
};
for (const step of STEPS) {
  await page.evaluate((st) => window.__app.goto('transformer', st, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await page.evaluate(() => window.__app.step(1 / 60, 120));
  const base = await measure(step);
  if (step === 'losses-efficiency') {
    await page.evaluate(() => window.__ui.press('listen6'));
    await page.evaluate(() => window.__app.step(1 / 60, 150));
    const heard = await measure('  «Послухати»');
    if (heard < base * 2) failures.push(`«Послухати» does not raise the hum enough (${db(base)} → ${db(heard)} dBFS)`);
  }
}
// one-shots as sound.ts plays them (gain applied linearly to the rendered peak)
for (const [name, gain] of [['tick', 0.6], ['relay', 1], ['breaker', 0.7], ['zap', 1], ['spark', 0.7], ['success', 0.6], ['error', 0.6]]) {
  const r = await render({ kind: 'oneshot', name }, 1.2);
  console.log(`one-shot ${name.padEnd(13)} ${db(r.rms * gain)} dBFS rms, ${db(r.peak * gain)} dBFS peak`);
  if (r.peak * gain >= 0.99) failures.push(`one-shot ${name} clips`);
  if (r.peak * gain < 0.01) failures.push(`one-shot ${name} inaudible`);
}
const errors = await appErrors(page);
if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);
await browser.close();
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS: sound offline');
process.exit(failures.length ? 1 : 0);
