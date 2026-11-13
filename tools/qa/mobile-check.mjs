#!/usr/bin/env node
// Mobile acceptance check of one chapter (F5, docs/MOBILE.md): touch-only, on phone and tablet profiles.
//
//   node tools/qa/mobile-check.mjs <chapter> [--profiles all|pp,pa,pl,tp,tl] [options]
//
// Profiles: phone-portrait 390×844 @3 (pp, with an iPhone-like safe area) · phone-small 360×800 @3 (pa) ·
//           phone-landscape 844×390 @3 (pl) · tablet-portrait 820×1180 @2 (tp) · tablet-landscape 1180×820 @2 (tl).
// Per profile, with touch input only (Chrome device emulation: coarse pointer, no hover):
//   1. device   — the app classifies the device and picks the shell and the `mobile` tier by itself;
//   2. steps    — every step by deep link: no console output, no control off screen (`__ui.offscreen()`), HUD
//                 text ≥ 14 CSS px, touch targets ≥ 44 px (48 on tablets); world text below 14 px is flagged
//                 (warning); every sheet tab is opened by a tap and checked the same way; the first reachable
//                 slider is dragged and the first button tapped; screenshot per step → contact sheets
//                 <out>/<chapter>/mobile-<profile>.jpg (+ -tabs.jpg for the «Керування» / «Графіки» views);
//   3. gestures — on the first step: one-finger drag and two-finger pinch in the scene, the sheet dragged to
//                 every snap height (portrait) or collapsed and reopened (landscape), long-press tooltip;
//   4. travel   — «Далі» / back by touch, then the journey map: open, pick another chapter, jump, come back;
//                 the menu; where the library level is shown (`_demo`): glossary scope switch, library screen,
//                 opening another volume;
//   5. rotation — the viewport is rotated and rotated back without a reload: same step, right shell, no errors;
//   6. perf     — frame time per step on the `mobile` tier at the profile's pixel budget (min of --perf-rounds).
//                 On lenovo this is the RTX; for a weak-GPU proxy run the tool on the Intel adapter:
//                 QA_CHROME_ARGS="--use-gl=angle --use-angle=gl-egl --enable-gpu --ignore-gpu-blocklist --no-sandbox"
//                 QA_ALLOW_SOFTWARE=1 node tools/qa/mobile-check.mjs <chapter> --profiles pp --only perf
// Fails (exit 1) on any failed assertion; warnings and notes never fail. Report: <out>/<chapter>/mobile-report.json
//
// Options: --profiles (all) · --only steps,gestures,travel,rotation,perf · --skip … · --budget <ms> (16.6: a
//          phone frame at 60 Hz; over budget is a warning unless --perf-fail) · --perf-rounds (2) · --perf-frames (90)
//          --other <chapter> for the map jump · --freeze <s> (3) · --out <dir> · --port / --base
//          --extra k=v&k2=v2 extra URL parameters on every page (e.g. level=simple)
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { measurePerf } from './check-parts.mjs';
import { appErrors, appUrl, baseUrl, ensureDir, fmt, launch, openApp, outRoot, parseArgs, screenshot } from './lib.mjs';
import { PROFILES, PROFILE_ALIASES, operateControls, sceneGestures, settle, touchLayout, walkTabs } from './mobile-parts.mjs';
import { libraryLevel, longPress, rotation, sheetGestures, travel } from './mobile-flows.mjs';
import { touch } from './touch.mjs';

const args = parseArgs();
const urlExtra = Object.fromEntries(new URLSearchParams(String(args.extra ?? '')));
let chapterId = String(args._[0] ?? '');
if (!chapterId) {
  console.error('usage: mobile-check.mjs <chapter | volume/chapter> [--profiles all|pp,pa,pl,tp,tl]');
  process.exit(2);
}
const names =
  !args.profiles || args.profiles === 'all'
    ? Object.keys(PROFILES)
    : String(args.profiles).split(',').map((p) => PROFILE_ALIASES[p] ?? p);
const ALL_PARTS = ['steps', 'gestures', 'travel', 'rotation', 'perf'];
const only = typeof args.only === 'string' ? args.only.split(',') : ALL_PARTS;
const skip = typeof args.skip === 'string' ? args.skip.split(',') : [];
const runs = (part) => only.includes(part) && !skip.includes(part);
const base = baseUrl(args);
const freeze = Number(args.freeze ?? 3);
const budget = Number(args.budget ?? 16.6);
const sheetTool = fileURLToPath(new URL('./sheet.sh', import.meta.url));

const failures = [];
const warnings = [];
const notes = [];
const fail = (m) => (failures.push(m), console.log(`  FAIL ${m}`));
const warn = (m) => (warnings.push(m), console.log(`  warn ${m}`));
const note = (m) => (notes.push(m), console.log(`  note: ${m}`));
const report = { chapter: chapterId, base, profiles: {}, failures, warnings, notes };
let out = '';

for (const name of names) {
  const profile = PROFILES[name];
  if (!profile) {
    fail(`unknown profile '${name}'`);
    continue;
  }
  console.log(`\n== ${name} ${profile.width}x${profile.height} @${profile.dpr}`);
  const extra = { ...urlExtra, ...(profile.safe ? { safe: profile.safe } : {}) };
  const url = (route, frozen = true) => appUrl(base, { route, q: 'auto', freeze: frozen ? freeze : null, extra });
  const { browser, page } = await launch({ width: profile.width, height: profile.height, dpr: profile.dpr, touch: true });
  const entry = (report.profiles[name] = { steps: {}, perf: {} });
  const errors = async (where) => {
    for (const e of await appErrors(page)) fail(`${where}: console ${e.level}: ${e.message.slice(0, 220)}`);
    await page.evaluate(() => window.__app.clearErrors());
  };
  try {
    const gpu = await openApp(page, url(''));
    const all = await page.evaluate(() => window.__app.listChapters());
    const chapter = all.find((c) => c.fullId === chapterId || c.id === chapterId);
    if (!chapter) throw new Error(`unknown chapter '${chapterId}'`);
    chapterId = chapter.fullId;
    out = ensureDir(`${outRoot(args)}/${chapter.id}`);
    const others = all.filter((c) => c.volume === chapter.volume && c.id !== chapter.id);
    const other = (typeof args.other === 'string' && others.find((c) => c.id === args.other)) || others[0] || null;
    const t = await touch(page);

    // 1. device
    const dev = await page.evaluate(() => ({ d: window.__app.device(), tier: window.__app.stats().quality, shell: window.__ui.sheet()?.shell ?? 'desk' }));
    if (dev.d.formFactor !== profile.formFactor || dev.d.pointer !== 'coarse')
      fail(`${name}: classified as ${dev.d.formFactor} / ${dev.d.pointer}, expected ${profile.formFactor} / coarse`);
    if (dev.tier !== 'mobile') fail(`${name}: quality tier '${dev.tier}', expected the automatic 'mobile'`);
    entry.device = dev.d;
    entry.gpu = gpu.renderer;

    // 2. steps
    const shots = [];
    const tabShots = [];
    if (runs('steps')) {
      for (const step of chapter.steps) {
        const where = `${name} ${chapter.id}/${step.id}`;
        await page.goto('about:blank');
        await openApp(page, url(`${chapterId}/${step.id}`));
        await page.evaluate(() => window.__app.settled());
        await settle(page, 20);
        const shell = await page.evaluate(() => window.__ui.sheet()?.shell ?? 'desk');
        if (shell !== profile.shell) fail(`${where}: shell '${shell}', expected '${profile.shell}'`);
        const stats = await page.evaluate(() => window.__app.stats());
        const rec = (entry.steps[step.id] = { render: `${stats.width}x${stats.height}`, drawCalls: stats.drawCalls, triangles: stats.triangles });
        if (stats.width * stats.height > dev.d.pixelBudget * 1.02) fail(`${where}: renders ${stats.width}x${stats.height}, over the pixel budget`);
        shots.push(await screenshot(page, `${out}/m-${name}-${step.id}.jpg`, 82));
        const tt = await touch(page);
        rec.tabs = await walkTabs(page, tt, {
          where,
          fail,
          each: async (tab) => {
            rec[tab] = await touchLayout(page, { where: `${where} [${tab}]`, profile, fail, warn, worldText: tab === 'text' });
            if (tab !== 'text') {
              tabShots.push(await screenshot(page, `${out}/m-${name}-${step.id}-${tab}.jpg`, 82));
              rec[`${tab}Touch`] = await operateControls(page, tt, { where, tab, fail, note });
            }
          },
        });
        await errors(where);
        await tt.detach();
      }
      const sheetOf = (file, images, title) => {
        if (!images.length) return;
        const cols = profile.width > profile.height ? 3 : 6;
        try {
          console.log('  ' + execFileSync(sheetTool, [file, '--cols', String(cols), '--tile', profile.width > profile.height ? '560' : '300', '--title', title, ...images]).toString().trim());
        } catch (e) {
          fail(`contact sheet failed: ${e.message.slice(0, 160)}`);
        }
      };
      sheetOf(`${out}/mobile-${name}.jpg`, shots, `${chapter.id} · ${name}`);
      sheetOf(`${out}/mobile-${name}-tabs.jpg`, tabShots, `${chapter.id} · ${name} · tabs`);
    }

    // 3–5: gestures, travel and rotation on the first step (fresh load, frozen clock)
    if (runs('gestures') || runs('travel') || runs('rotation')) {
      const first = chapter.steps[0].id;
      const where = `${name} ${chapter.id}/${first}`;
      await page.goto('about:blank');
      await openApp(page, url(`${chapterId}/${first}`));
      await page.evaluate(() => window.__app.settled());
      await settle(page, 20);
      const tt = await touch(page);
      if (runs('gestures')) {
        await sceneGestures(page, tt, { where, fail, note });
        await sheetGestures(page, tt, { where, fail });
        await longPress(page, tt, { where, fail });
        await errors(`${where} gestures`);
      }
      if (runs('travel')) {
        await travel(page, tt, { where, chapter, other, fail, note });
        await errors(`${where} travel`);
        const layout = (at) => touchLayout(page, { where: at, profile, fail, warn, worldText: false });
        await libraryLevel(page, tt, { where, fail, note, layout });
        await errors(`${where} library level`);
      }
      if (runs('rotation')) {
        await rotation(page, { where, profile, fail });
        await errors(`${where} rotation`);
      }
      await tt.detach();
    }

    // 6. perf: real time, the tier and the resolution the device would get
    if (runs('perf')) {
      await page.goto('about:blank');
      await openApp(page, url(`${chapterId}/${chapter.steps[0].id}`, false));
      await page.evaluate(() => window.__app.settled());
      const perf = await measurePerf(page, {
        chapterId,
        steps: chapter.steps.map((s) => s.id),
        rounds: Number(args['perf-rounds'] ?? 2),
        frames: Number(args['perf-frames'] ?? 90),
      });
      const st = await page.evaluate(() => window.__app.stats());
      console.log(`  perf · ${st.quality} · ${st.width}x${st.height} · ${gpu.renderer.replace(/^ANGLE \(|\)$/g, '').slice(0, 70)}`);
      for (const [step, r] of perf) {
        const b = r.best;
        entry.perf[step] = { frameAvg: b.frameAvg, gpuAvg: b.gpuAvg, cpuAvg: b.cpuAvg, syncAvg: b.syncAvg, drawCalls: b.drawCalls, triangles: b.triangles, spread: r.spread };
        const over = b.frameAvg > budget;
        console.log(`    ${step.padEnd(22)} frame ${fmt(b.frameAvg)} ms (gpu ${b.gpuAvg === null ? 'n/a' : fmt(b.gpuAvg)} · cpu ${fmt(b.cpuAvg)} · sync ${fmt(b.syncAvg)}) · ${b.drawCalls} calls · ${(b.triangles / 1000).toFixed(0)}k tris${over ? '  OVER' : ''}`);
        if (over) (args['perf-fail'] ? fail : warn)(`${name} ${chapter.id}/${step}: frame ${fmt(b.frameAvg)} ms > ${budget} ms on the mobile tier`);
      }
      entry.render = `${st.width}x${st.height}`;
      await errors(`${name} perf`);
    }
    await t.detach();
  } catch (e) {
    fail(`${name}: ${e.message}`);
  } finally {
    await browser.close();
  }
}

if (out) writeFileSync(`${out}/mobile-report.json`, JSON.stringify(report, null, 1));
console.log(`\nmobile-check ${chapterId}: ${failures.length ? 'FAIL' : 'PASS'} — ${failures.length} failure(s), ${warnings.length} warning(s), ${notes.length} note(s)${out ? ` · ${out}/mobile-report.json` : ''}`);
process.exit(failures.length ? 1 : 0);
