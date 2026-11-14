#!/usr/bin/env node
// Before / after contact sheets of the interface cut-over (D8, docs/HUD_DOM.md §16 criterion 3): every step of a
// chapter shot under ?hud=gl and ?hud=dom, side by side (one row per step, labelled), one sheet per size.
//
//   node tools/qa/hud-sheet.mjs <chapter> [--sizes all|WxH,…] [--level simple|detailed] [--mobile [all|pp,pa,pl,tp,tl]]
//                               [--pair gl,dom] [--freeze <s>] [--q <tier>] [--port <n> | --base <url>] [--out <dir>]
//
//   --sizes   desktop sizes (default all = 1280x720, 1920x1080, 3840x2160); `--sizes none` with --mobile = phones only
//   --level   reading level (?level=); default: the app's
//   --mobile  also the touch profiles of mobile-check (docs/MOBILE.md §6), each with its DPR, safe area, touch
//   --pair    the two columns, each `gl|dom[@port]` — e.g. `gl@5201,gl@5278` compares the WebGL interface of two
//             servers (pixel identity of a branch against main); default `gl,dom` on --port/--base
// Shots are deep links with a frozen clock (--freeze 3), so both columns show the same moment of the scene.
// Output: <out>/hud-sheet/<chapter>[-<level>]/<size>/NN-<step>-<column>.jpg and sheet-<size>.jpg next to them;
// the last line lists the sheets. A shot that fails to load is reported and the sheet is still written.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs, parseSize, screenshot } from './lib.mjs';
import { PROFILES, PROFILE_ALIASES } from './mobile-parts.mjs';

const args = parseArgs();
const chapterArg = String(args._[0] ?? '');
if (!chapterArg) {
  console.error('usage: hud-sheet.mjs <chapter> [--sizes all|WxH,…] [--level simple|detailed] [--mobile [all|pp,…]] [--pair gl,dom]');
  process.exit(2);
}
const ALL = ['1280x720', '1920x1080', '3840x2160'];
const sizeArg = String(args.sizes ?? 'all');
const desktop = sizeArg === 'none' ? [] : (sizeArg === 'all' ? ALL : sizeArg.split(',')).map((s) => parseSize(s));
const mobileNames =
  args.mobile === undefined
    ? []
    : args.mobile === true || args.mobile === 'all'
      ? Object.keys(PROFILES)
      : String(args.mobile).split(',').map((p) => PROFILE_ALIASES[p] ?? p);
const freeze = Number(args.freeze ?? 3);
const level = typeof args.level === 'string' ? args.level : null;
const columns = String(args.pair ?? 'gl,dom')
  .split(',')
  .map((c) => {
    const [hud, port] = c.split('@');
    if (hud !== 'gl' && hud !== 'dom') throw new Error(`--pair: '${c}' is not gl|dom[@port]`);
    return { hud, base: port ? `http://localhost:${port}/` : baseUrl(args), label: c };
  });
const outDir = ensureDir(`${outRoot(args)}/hud-sheet/${chapterArg.replace(/\//g, '-')}${level ? `-${level}` : ''}`);
const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));
const problems = [];
const sheets = [];

/** Every step of one viewport / profile in every column, then one sheet. */
async function shootSet(tag, ctx, { q, extra = {}, tile, cols }) {
  const { browser, page } = await launch(ctx);
  const dir = ensureDir(`${outDir}/${tag}`);
  const shots = [];
  try {
    await openApp(page, appUrl(columns[0].base, { route: chapterArg, q, freeze, extra: { hud: columns[0].hud, ...extra } }));
    const list = await page.evaluate(() => window.__app.listChapters());
    const chapter = list.find((c) => c.fullId === chapterArg) ?? list.find((c) => c.id === chapterArg);
    if (!chapter) throw new Error(`chapter '${chapterArg}' is not registered`);
    for (const [i, step] of chapter.steps.entries()) {
      for (const col of columns) {
        const file = `${dir}/${String(i + 1).padStart(2, '0')}-${step.id}-${col.label.replace(/[@:]/g, '-')}.jpg`;
        try {
          const url = appUrl(col.base, { route: `${chapter.fullId}/${step.id}`, q, freeze, extra: { ...extra, hud: col.hud, ...(level ? { level } : {}), n: `${col.label}-${i}` } });
          await openApp(page, url);
          await page.evaluate(() => window.__app.settled());
          shots.push(await screenshot(page, file, 85));
        } catch (e) {
          problems.push(`${tag} ${step.id} ${col.label}: ${String(e.message).split('\n')[0].slice(0, 160)}`);
        }
      }
    }
  } catch (e) {
    problems.push(`${tag}: ${String(e.message).split('\n')[0].slice(0, 200)}`);
  } finally {
    await browser.close();
  }
  if (!shots.length) return;
  const title = `${chapterArg} — ${columns.map((c) => c.label).join(' | ')} — ${tag}${level ? ` — ${level}` : ''}`;
  const sheet = `${outDir}/sheet-${tag}.jpg`;
  try {
    console.log('  ' + execFileSync(sheetTool, [sheet, '--cols', String(cols), '--tile', String(tile), '--title', title, ...shots]).toString().trim());
    sheets.push(sheet);
  } catch (e) {
    problems.push(`sheet ${tag}: ${e.message.slice(0, 160)}`);
  }
}

console.log(`[hud-sheet] ${chapterArg}: ${columns.map((c) => c.label).join(' vs ')} · ${[...desktop.map(([w, h]) => `${w}x${h}`), ...mobileNames].join(', ')}`);
for (const [w, h] of desktop) {
  await shootSet(`${w}x${h}`, { width: w, height: h }, { q: String(args.q ?? 'high'), tile: 640, cols: columns.length });
}
for (const name of mobileNames) {
  const p = PROFILES[name];
  if (!p) {
    problems.push(`unknown profile '${name}'`);
    continue;
  }
  const portrait = p.height > p.width;
  // phones: two steps per row (four tiles), so a sheet of a long chapter stays readable
  await shootSet(name, { width: p.width, height: p.height, dpr: p.dpr, touch: true }, { q: 'auto', extra: p.safe ? { safe: p.safe } : {}, tile: portrait ? 300 : 560, cols: portrait ? columns.length * 2 : columns.length });
}
for (const p of problems) console.log(`  FAIL ${p}`);
console.log(`${problems.length ? `${problems.length} problem(s)` : 'OK'} hud-sheet: ${sheets.length} sheet(s)\n${sheets.join('\n')}`);
process.exit(problems.length ? 1 : 0);
