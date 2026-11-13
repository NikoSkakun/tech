#!/usr/bin/env node
// Interaction acceptance checks of the UI kit, the HUD and the Journey Map (owner: F2-ui).
//
//   node tools/qa/ui-check.mjs [--port 5202] [--size 1920x1080] [--out dir] [--no-perf]
//
// Drives the real pointer / keyboard through Playwright against `_sandbox-ui` (deterministic clock) and asserts:
//   button click → step changes · slider drag → value changes · focused slider takes the arrow keys ·
//   toggle click · keyboard step navigation · map open / close (M, Esc) · jump via the map · jump via the spine ·
//   settings toggle writes the store · every pointer target ≥ 44 px-eq · no DOM UI · no console errors ·
//   step API (press / set+notify / patch / `visible`) · segmented items by `ctl-<id>:<item>` ·
//   layout sweep at 1280×720, 1920×1080, 1024×768, 800×1200, 3840×2160 and 1920×1080 @2x over the overflow,
//   board and controls steps: `__ui.offscreen()` empty, board beside the column, proportionate panel, pointer drag ·
//   HUD cost (frame time and draw calls with the HUD on vs off) within the budget (≤ 1.5 ms, ≤ 60 calls), also at 4K.
// Exit code 1 on any failure. Screenshots of each stage go to <out>/ui-check/.
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs, parseSize, screenshot } from './lib.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size);
const base = baseUrl(args);
const out = ensureDir(`${outRoot(args)}/ui-check`);
const failures = [];
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(what);
};

const { browser, page } = await launch({ width, height });
const step = (frames = 45) => page.evaluate((n) => window.__app.step(1 / 60, n), frames);
const pos = () => page.evaluate(() => window.__app.position());
const at = async (name) => {
  const r = await page.evaluate((n) => window.__ui.locate(n), name);
  if (!r) throw new Error(`node '${name}' is not on screen`);
  return r;
};
const click = async (name, frames = 45) => {
  const r = await at(name);
  await page.mouse.move(r.x, r.y);
  await step(4);
  await page.mouse.down();
  await page.mouse.up();
  await step(frames);
};
const settle = async () => {
  await page.evaluate(() => window.__app.settled());
  await step(30);
};

try {
  await openApp(page, appUrl(base, { route: '_sandbox-ui/controls', freeze: 3 }));
  await page.waitForFunction(() => typeof window.__ui === 'object' && window.__ui.locate('sys-map') !== null);
  console.log(`[ui-check] ${width}x${height}`);

  // 1. button → state
  await click('nav-next');
  await settle();
  check((await pos()).stepId === 'readouts', 'click «Далі» moves to the next step', JSON.stringify(await pos()));
  await click('nav-prev');
  await settle();
  check((await pos()).stepId === 'controls', 'click «Назад» returns');

  // 2. slider drag → value
  const before = await page.evaluate(() => window.__ui.value('G'));
  const g = await at('ctl-G');
  const trackY = g.y + 8; // the track is the lower part of the slider
  await page.mouse.move(g.x + g.w * 0.3, trackY);
  await step(4);
  await page.mouse.down();
  for (let k = 0; k <= 10; k++) {
    await page.mouse.move(g.x + g.w * (0.3 - 0.06 * k), trackY);
    await step(2);
  }
  await screenshot(page, `${out}/1-slider-drag.jpg`);
  await page.mouse.up();
  await step(30);
  const after = await page.evaluate(() => window.__ui.value('G'));
  check(typeof after === 'number' && after < before, 'dragging a slider changes its value', `${before} → ${after}`);

  // 3. focused slider takes the arrow keys (the step must not change)
  await page.keyboard.press('ArrowRight');
  await step(20);
  const nudged = await page.evaluate(() => window.__ui.value('G'));
  check(nudged > after && (await pos()).stepId === 'controls', 'a focused slider consumes ←/→', `${after} → ${nudged}`);
  await page.keyboard.press('Escape'); // drop focus
  await step(10);

  // 4. toggle
  const t0 = await page.evaluate(() => window.__ui.value('line'));
  await click('ctl-line');
  check((await page.evaluate(() => window.__ui.value('line'))) === !t0, 'clicking a toggle flips it');

  // 5. keyboard step navigation
  await page.keyboard.press('ArrowRight');
  await settle();
  check((await pos()).stepId === 'readouts', '→ goes to the next step');
  await page.keyboard.press('ArrowLeft');
  await settle();
  check((await pos()).stepId === 'controls', '← goes back');

  // 6. map open / close
  await page.keyboard.press('KeyM');
  await step(120);
  check((await page.evaluate(() => window.__ui.overlay())) === 'map', 'M opens the journey map');
  await screenshot(page, `${out}/2-map.jpg`);
  await page.keyboard.press('KeyM');
  await step(60);
  check((await page.evaluate(() => window.__ui.overlay())) === null, 'M closes it again');

  // 7. jump via the map: select another chapter's node, then one of its steps
  await click('sys-map', 150);
  await click('map-overview', 150); // the map lands on the current chapter; zoom out to see the others
  const node = await page.evaluate(() => window.__ui.mapNode('_sandbox-micro'));
  await page.mouse.move(node.x, node.y);
  await step(10);
  await page.mouse.down();
  await page.mouse.up();
  await step(150);
  await screenshot(page, `${out}/3-map-node.jpg`);
  await click('map-step-electron', 30);
  await settle();
  const jumped = await pos();
  check(jumped.chapterId === '_sandbox-micro' && jumped.stepId === 'electron', 'map: node → step jumps through the engine', JSON.stringify(jumped));
  check((await page.evaluate(() => window.__ui.overlay())) === null, 'the map closes after the jump');

  // 8. jump via the spine
  await step(60);
  await click('spine-_sandbox-ui', 30);
  await settle();
  check((await pos()).chapterId === '_sandbox-ui', 'spine: one click jumps to a chapter', JSON.stringify(await pos()));

  // 9. settings write the store
  const audio0 = await page.evaluate(() => window.__app.engine.store.get().settings.audio);
  await click('sys-sound');
  check((await page.evaluate(() => window.__app.engine.store.get().settings.audio)) === !audio0, 'sound button toggles settings.audio');
  await click('sys-settings', 60);
  check((await page.evaluate(() => window.__ui.overlay())) === 'settings', 'settings overlay opens');
  await screenshot(page, `${out}/4-settings.jpg`);
  await page.keyboard.press('Escape');
  await step(40);
  check((await page.evaluate(() => window.__ui.overlay())) === null, 'Esc closes the overlay');

  // 10. targets, DOM, console
  const small = await page.evaluate(() => window.__ui.smallTargets());
  check(small.length === 0, 'every pointer target is at least 44 px-eq', small.slice(0, 6).join('; '));
  // the boot splash and the fatal-error screen are the only HTML (STYLE_GUIDE §6) and must be hidden by now
  const dom = await page.evaluate(() =>
    [...document.body.querySelectorAll('*')]
      // (#live is the invisible aria-live region for screen readers)
      .filter((e) => e.tagName !== 'CANVAS' && e.tagName !== 'SCRIPT' && e.id !== 'app' && e.id !== 'live')
      .filter((e) => e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && e.getBoundingClientRect().width > 0)
      .map((e) => `${e.tagName}#${e.id}`),
  );
  check(dom.length === 0, 'no visible DOM UI (WebGL only)', dom.slice(0, 5).join(', '));
  const errors = await appErrors(page);
  check(errors.length === 0, 'no console errors or warnings', errors.slice(0, 3).map((e) => e.message.slice(0, 120)).join(' | '));

  // 11. step API through the QA hook: press / set with notify / live patch / visibility predicates (M3)
  await openApp(page, appUrl(base, { route: '_sandbox-ui/board', freeze: 3 }));
  await step(30);
  await page.evaluate(() => window.__ui.set('bd-chem', 'nmc', true)); // notify → the chapter patches the slider range
  await step(10);
  await page.evaluate(() => window.__ui.press('bd-max'));
  await step(10);
  check((await page.evaluate(() => window.__ui.value('bd-v'))) === 4.2, '__ui.set(…, notify) + __ui.press reach the chapter handlers', String(await page.evaluate(() => window.__ui.value('bd-v'))));
  check((await page.evaluate(() => window.__ui.locate('ctl-bd-warn'))) !== null, 'a `visible` predicate shows a note when it holds');
  await click('ctl-bd-table-on', 40);
  check((await page.evaluate(() => window.__ui.locate('ctl-bd-table'))) === null, 'toggling hides the table (`visible` predicate)');
  await click('ctl-bd-table-on', 40);
  check((await page.evaluate(() => window.__ui.locate('ctl-bd-table'))) !== null, '… and shows it again');
  await click('ctl-bd-chem:lto', 30);
  check((await page.evaluate(() => window.__ui.value('bd-chem'))) === 'lto', 'a segmented item is located and clicked by `ctl-<id>:<item>`');
  check((await page.evaluate(() => window.__ui.value('bd-v'))) <= 2.8, 'ui.patch narrowed the slider range live (value clamped)');
  await screenshot(page, `${out}/5-board.jpg`);

  // 12. layout sweep: every control reachable (no hit target off-screen), board and column side by side, the HUD
  //     scaled in proportion to the viewport — at the usual sizes, in portrait, at 4K and at 1080p with DPR 2
  const SIZES = [[1280, 720, 1], [1920, 1080, 1], [1024, 768, 1], [800, 1200, 1], [3840, 2160, 1], [1920, 1080, 2]];
  const ROUTES = ['_sandbox-ui/overflow', '_sandbox-ui/board', '_sandbox-ui/controls'];
  for (const [w, h, dpr] of SIZES) {
    const tag = `${w}x${h}${dpr > 1 ? `@${dpr}x` : ''}`;
    const run = await launch({ width: w, height: h, dpr });
    try {
      const p = run.page;
      const frames = (n) => p.evaluate((k) => window.__app.step(1 / 60, k), n);
      for (const route of ROUTES) {
        await openApp(p, appUrl(base, { route, freeze: 3 }));
        await frames(40);
        const sheet = await p.evaluate(() => window.__ui.locate('sheet-tabs'));
        let off = await p.evaluate(() => window.__ui.offscreen());
        if (sheet) {
          // bottom sheet: the controls live behind «Керування»
          const tab = await p.evaluate(() => window.__ui.locate('sheet-tabs:controls'));
          await p.mouse.click(tab.x, tab.y);
          await frames(40);
          off = off.concat(await p.evaluate(() => window.__ui.offscreen()));
        }
        check(off.length === 0, `${tag} ${route}: every hit target on screen`, off.slice(0, 4).map((o) => `${o.name}@${Math.round(o.x)},${Math.round(o.y)}`).join(' '));
        await screenshot(p, `${out}/sweep-${tag}-${route.split('/')[1]}.jpg`, 80);
        if (route === '_sandbox-ui/board') {
          const b = await p.evaluate(() => window.__ui.locate('board'));
          const c = await p.evaluate(() => window.__ui.locate('step-column'));
          const apart = b && c && (sheet ? b.y + b.h / 2 <= c.y - c.h / 2 + 2 : b.x + b.w / 2 <= c.x - c.w / 2 + 2);
          check(!!apart, `${tag}: board and step column do not overlap`, JSON.stringify({ b, c }));
        }
        if (route === '_sandbox-ui/overflow') {
          // proportion: the panel takes a similar share of the screen at every size of the same layout
          const panel = await p.evaluate(() => window.__ui.locate('step-panel') ?? window.__ui.locate('step-column'));
          const share = panel.w / w;
          const ok = sheet ? share > 0.45 && share <= 1 : share > 0.2 && share < 0.32;
          check(ok, `${tag}: step panel width is proportionate`, `${(share * 100).toFixed(1)} % of the width`);
          // a real pointer drag on a dock slider works at this size
          const before = await p.evaluate(() => window.__ui.value('ov-a'));
          const s = await p.evaluate(() => window.__ui.locate('ctl-ov-a'));
          if (s) {
            await p.mouse.move(s.x - s.w * 0.1, s.y + s.h * 0.2);
            await frames(3);
            await p.mouse.down();
            for (let k = 1; k <= 6; k++) {
              await p.mouse.move(s.x - s.w * (0.1 + 0.05 * k), s.y + s.h * 0.2);
              await frames(2);
            }
            await p.mouse.up();
            await frames(10);
          }
          const after = await p.evaluate(() => window.__ui.value('ov-a'));
          check(after < before, `${tag}: pointer drag on a dock slider`, `${before} → ${after}`);
        }
      }
      const errs = await appErrors(p);
      check(errs.length === 0, `${tag}: no console errors or warnings`, errs.slice(0, 2).map((e) => e.message.slice(0, 120)).join(' | '));
    } finally {
      await run.browser.close();
    }
  }

  // 13. HUD cost: the same view with the HUD drawn and hidden — at the run size and at 4K
  if (!args['no-perf']) {
    const cost = async (p, tag) => {
      await openApp(p, appUrl(base, { route: '_sandbox-ui/controls' }));
      await p.waitForFunction(() => typeof window.__ui === 'object' && window.__ui.locate('sys-map') !== null);
      await p.waitForTimeout(1500);
      const measure = async (on) => {
        await p.evaluate((v) => window.__ui.setVisible(v), on);
        await p.waitForTimeout(300);
        const m = await p.evaluate(() => window.__app.measure(240));
        const st = await p.evaluate(() => window.__app.stats());
        return { frame: m.frameAvg, calls: st.drawCalls };
      };
      const off = await measure(false);
      const on = await measure(true);
      const ms = on.frame - off.frame;
      const calls = on.calls - off.calls;
      check(ms <= 1.5, `${tag}: HUD frame cost ≤ 1.5 ms`, `${ms.toFixed(2)} ms (${off.frame.toFixed(2)} → ${on.frame.toFixed(2)})`);
      check(calls <= 60, `${tag}: HUD draw calls ≤ 60`, `${calls} (${off.calls} → ${on.calls})`);
    };
    await cost(page, `${width}x${height}`);
    const big = await launch({ width: 3840, height: 2160 });
    try {
      await cost(big.page, '3840x2160');
    } finally {
      await big.browser.close();
    }
  }
} catch (e) {
  failures.push(`exception: ${e.message}`);
  console.error(`  FAIL exception: ${e.message}`);
  await screenshot(page, `${out}/exception.jpg`).catch(() => undefined);
} finally {
  await browser.close();
}
console.log(failures.length ? `FAILED ui-check: ${failures.length} problem(s)` : 'PASS ui-check');
process.exit(failures.length ? 1 : 0);
