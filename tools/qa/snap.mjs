#!/usr/bin/env node
// Deterministic PNG snapshots of every step of the given chapters (deep link, frozen clock) — the material
// for a before / after comparison of a platform change ("desktop must not change").
//
//   node tools/qa/snap.mjs --chapters _sandbox-ui,atom --sizes 1280x720,1920x1080 --out <dir> [--base <url>]
//   node tools/qa/snap.mjs --compare <dirA> <dirB>        # pixel differences per file (ImageMagick AE)
//
//   --chapters a,b,…   chapter ids (short or `volume/chapter`)       --sizes WxH,…  (default 1920x1080)
//   --q <tier>         quality (default high)                         --freeze <s>   (default 3)
//   --extra k=v&k2=v2  extra URL parameters (e.g. ff=phone)           --dpr <n>      deviceScaleFactor (default 1)
//   --touch            emulate a touch screen (coarse pointer)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, parseArgs, parseSize } from './lib.mjs';

const args = parseArgs();

if (args.compare) {
  const [a, b] = [String(args.compare), String(args._[0] ?? '')];
  const files = readdirSync(a).filter((f) => f.endsWith('.png')).sort();
  let differing = 0;
  let missing = 0;
  for (const f of files) {
    if (!existsSync(`${b}/${f}`)) {
      missing++;
      console.log(`MISSING ${f}`);
      continue;
    }
    // ImageMagick prints the metric on stderr and exits 1 when the images differ
    const run = spawnSync('compare', ['-metric', 'AE', `${a}/${f}`, `${b}/${f}`, 'null:'], { encoding: 'utf8' });
    const out = `${run.stderr ?? ''}${run.stdout ?? ''}`;
    const n = Number(/^[\d.e+]+/.exec(out.trim())?.[0] ?? NaN);
    if (n !== 0) {
      differing++;
      console.log(`DIFF ${f}: ${Number.isNaN(n) ? out.trim().slice(0, 80) : `${n} px`}`);
    }
  }
  console.log(`${files.length} files · ${differing} differ · ${missing} missing`);
  process.exit(differing + missing > 0 ? 1 : 0);
}

const base = baseUrl(args);
const out = ensureDir(String(args.out ?? `/srv/electricity/qa/${process.env.QA_ID ?? 'misc'}/snap`));
const sizes = String(args.sizes ?? '1920x1080').split(',').map((s) => parseSize(s));
const chapters = String(args.chapters ?? '').split(',').filter(Boolean);
const q = String(args.q ?? 'high');
const freeze = Number(args.freeze ?? 3);
const extra = Object.fromEntries(new URLSearchParams(String(args.extra ?? '')));
let failed = false;

for (const [width, height] of sizes) {
  const { browser, page } = await launch({ width, height, dpr: Number(args.dpr ?? 1), touch: !!args.touch });
  try {
    await openApp(page, appUrl(base, { q, freeze, extra }));
    const all = await page.evaluate(() => window.__app.listChapters());
    for (const id of chapters) {
      const ch = all.find((c) => c.fullId === id || c.id === id);
      if (!ch) {
        failed = true;
        console.log(`unknown chapter ${id}`);
        continue;
      }
      for (const step of ch.steps) {
        const stepId = typeof step === 'string' ? step : step.id;
        await page.goto('about:blank');
        await openApp(page, appUrl(base, { route: `${ch.fullId}/${stepId}`, q, freeze, extra }));
        await page.evaluate(() => window.__app.settled());
        await page.screenshot({ path: `${out}/${ch.id}-${stepId}-${width}x${height}.png`, type: 'png' });
        const errors = await appErrors(page);
        if (errors.length) console.log(`  ${ch.id}/${stepId} ${width}x${height}: ${errors.length} console messages`);
      }
      console.log(`snap ${ch.id} ${width}x${height}: ${ch.steps.length} steps`);
    }
  } catch (e) {
    failed = true;
    console.error(`snap failed at ${width}x${height}: ${e.message}`);
  } finally {
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
