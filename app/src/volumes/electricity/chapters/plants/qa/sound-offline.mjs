#!/usr/bin/env node
/* global console, process, window */
// Offline sound check of `plants` (no sound card, no listening):
//
//   QA_PORT=5253 node app/src/volumes/electricity/chapters/plants/qa/sound-offline.mjs
//
// For every step (frozen clock, 2 s in) the loop levels the chapter asks for (`__app.read('sound')`) are rendered
// through the engine's master chain (`__audio.renderOffline`) at the step's pitch and scaled by the gains of
// sound.ts (hum × 0,9 at pitch 2, turbine × 0,75, steam × 0,65, water × 0,75, fire × 0,65, wind × 0,65). Loops add
// as uncorrelated signals (RMS) and at worst in phase (peak). The chapter's mood pad is rendered for reference and
// every one-shot at the gain sound.ts uses. Then the app leaves the chapter: the plants probes must be gone (its
// update no longer drives the loops; the engine stops loops on every chapter change). Fails if a step is silent,
// anything clips, or the chapter still answers after leaving.
import { appErrors, appUrl, baseUrl, launch, openApp, parseArgs } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const { browser, page } = await launch({ width: 1280, height: 720 });
const failures = [];
const db = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const render = (sound, seconds = 1.5) => page.evaluate(([s, t]) => window.__audio.renderOffline(s, t), [sound, seconds]);
const STEPS = ['intro', 'turbine-generator', 'energy-chains', 'heat-engine', 'rankine', 'brayton', 'steam-island', 'metrics', 'flexibility', 'mix', 'gallery'];
const LOOPS = [['hum', 0.9, () => 2], ['turbine', 0.75, (s) => Math.max(0.2, s.turbinePitch)], ['steam', 0.65, () => 1], ['water', 0.75, () => 1], ['fire', 0.65, () => 1], ['wind', 0.65, () => 1]];

await openApp(page, appUrl(baseUrl(args), { route: 'plants/intro', freeze: 3 }));
const pad = await render({ kind: 'mood', name: 'dioramaDay' }, 3);
console.log(`mood pad dioramaDay     ${db(pad.rms)} dBFS rms, ${db(pad.peak)} dBFS peak (reference)`);
const measure = async (label) => {
  const s = await page.evaluate(() => window.__app.read('sound'));
  let sq = 0;
  let peak = 0;
  const parts = [];
  for (const [name, k, pitch] of LOOPS) {
    const gain = Math.min(1, s[name]) * k;
    if (gain <= 0) continue;
    const r = await render({ kind: 'loop', name, pitch: pitch(s) });
    sq += (r.rms * gain) ** 2;
    peak += r.peak * gain;
    parts.push(`${name} ${s[name].toFixed(2)}`);
  }
  const rms = Math.sqrt(sq);
  console.log(`${label.padEnd(22)} ${db(rms).padStart(6)} dBFS rms, ${db(peak).padStart(6)} peak  [${parts.join(', ')}]`);
  if (rms < 1e-3) failures.push(`${label}: silent`);
  if (peak >= 0.99) failures.push(`${label}: clips (${peak.toFixed(3)})`);
};
for (const step of STEPS) {
  await page.evaluate((st) => window.__app.goto('plants', st, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await page.evaluate(() => window.__app.step(1 / 60, 120));
  await measure(step);
}
for (const [name, gain] of [['tick', 0.6], ['relay', 1], ['whooshUp', 0.5], ['success', 0.6], ['error', 0.5]]) {
  const r = await render({ kind: 'oneshot', name }, 1.2);
  console.log(`one-shot ${name.padEnd(13)} ${db(r.rms * gain)} dBFS rms, ${db(r.peak * gain)} dBFS peak`);
  if (r.peak * gain >= 0.99) failures.push(`one-shot ${name} clips`);
  if (r.peak * gain < 0.01) failures.push(`one-shot ${name} inaudible`);
}
// leave the chapter: its probe (and its per-frame loop driver) must be gone; transformer exposes its own
// `sound` probe (hum / buzz), so the plants one is recognised by its `turbine` field
await page.evaluate(() => window.__app.goto('transformer', 'mutual-induction', { instant: true }));
await page.evaluate(() => window.__app.settled());
await page.evaluate(() => window.__app.step(1 / 60, 60));
const after = await page.evaluate(() => {
  try {
    return window.__app.read('sound') ?? null;
  } catch {
    return null;
  }
});
console.log(`after leaving: plants sound probe ${after === null || !('turbine' in after) ? 'gone' : JSON.stringify(after)}`);
if (after !== null && 'turbine' in after) failures.push('plants still drives loops after leaving');
const errors = await appErrors(page);
if (errors.length) failures.push(`page errors: ${errors.join(' | ')}`);
await browser.close();
console.log(failures.length ? `FAIL\n- ${failures.join('\n- ')}` : 'PASS: sound offline');
process.exit(failures.length ? 1 : 0);
