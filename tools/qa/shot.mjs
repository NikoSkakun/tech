#!/usr/bin/env node
// Screenshot of a route.
//
//   node tools/qa/shot.mjs <route> [options]
//   <route>: `volume/chapter/step`, or `chapter/step` (default volume first, then the others)
//
//   --out <file.jpg>     output file (default /srv/electricity/qa/$QA_ID/<chapter>-<step>-<W>x<H>.jpg)
//   --size WxH           viewport (default 1920x1080)        --q <tier>  quality (default high)
//   --freeze <seconds>   deterministic clock: simulate N s after entering the step (default 3; "off" = real time)
//   --wait <ms>          extra real-time wait before the shot (only useful with --freeze off)
//   --eval "<js>"        async JS run in the page before the shot; `app` is window.__app. The value is printed
//                        (`eval → …`): an expression's value, or what statements `return`
//                        e.g. --eval "await app.goto('atom','nucleus'); await app.step(1/60, 30)"
//                             --eval "app.locate('rotor')"     --eval "const s = app.stats(); return s.drawCalls"
//   --script <file.mjs>  module exporting `default async (page, helpers) => {…}` for scripted pointer interactions
//   --dpr <n>            deviceScaleFactor (default 1; 2 = how 4K laptops run 1920x1080)
//   --touch              emulate a touch screen (coarse pointer → phone / tablet adaptation by viewport size)
//   --extra "k=v&k2=v2"  extra URL parameters, e.g. "ff=phone&safe=47,0,34,0" (docs/MOBILE.md); --q auto
//   --port / --base      where the app is served (default port 5201)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { appErrors, appUrl, baseUrl, launch, openApp, outRoot, parseArgs, parseSize, screenshot } from './lib.mjs';

const args = parseArgs();
const AsyncFunction = (async () => {}).constructor;

/** Page source for `--eval`: an expression is evaluated as one (its value returned), anything else as a body. */
function evalSource(src) {
  let expression = true;
  try {
    new AsyncFunction('app', `return (${src}\n);`);
  } catch {
    expression = false;
  }
  const body = expression ? `return (${src}\n);` : src;
  return `(async () => { const app = window.__app; const __v = await (async () => { ${body}\n })(); await app.settled(); return __v; })()`;
}

function printable(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 0);
  return text.length > 4000 ? `${text.slice(0, 4000)}… (${text.length} chars)` : text;
}
const route = String(args._[0] ?? '');
const [width, height] = parseSize(args.size);
const freeze = args.freeze === 'off' ? null : Number(args.freeze ?? 3);
const base = baseUrl(args);
const out =
  typeof args.out === 'string' && /\.jpe?g$/i.test(args.out)
    ? args.out
    : `${outRoot(args)}/${(route || 'home').replace(/\//g, '-')}-${width}x${height}.jpg`;

const extra = Object.fromEntries(new URLSearchParams(String(args.extra ?? '')));
const { browser, page } = await launch({ width, height, dpr: Number(args.dpr ?? 1), touch: !!args.touch });
let failed = false;
try {
  const gpu = await openApp(page, appUrl(base, { route, q: String(args.q ?? 'high'), freeze, extra }));
  if (typeof args.eval === 'string') {
    const value = await page.evaluate(evalSource(args.eval));
    if (value !== undefined) console.log(`eval → ${printable(value)}`);
  }
  if (typeof args.script === 'string') {
    const mod = await import(pathToFileURL(resolve(args.script)).href);
    await mod.default(page, { base, width, height });
    await page.evaluate(() => window.__app.settled());
  }
  if (args.wait) await page.waitForTimeout(Number(args.wait));
  await screenshot(page, out);
  const errors = await appErrors(page);
  const stats = await page.evaluate(() => window.__app.stats());
  console.log(`shot ${out}  [${gpu.renderer.replace(/^ANGLE \(|\)$/g, '').slice(0, 60)}]`);
  console.log(`  ${stats.width}x${stats.height} ${stats.quality} · ${stats.drawCalls} calls · ${(stats.triangles / 1000).toFixed(1)}k tris · t=${stats.time.toFixed(2)}`);
  if (errors.length) {
    failed = true;
    console.log(`  ${errors.length} console errors/warnings:`);
    for (const e of errors.slice(0, 12)) console.log(`   [${e.level}] ${e.message.slice(0, 300)}`);
  }
} catch (e) {
  failed = true;
  console.error(`shot failed: ${e.message}`);
  try {
    const errors = await appErrors(page);
    for (const er of errors.slice(0, 12)) console.error(`   [${er.level}] ${er.message.slice(0, 400)}`);
  } catch {
    // app never booted
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
