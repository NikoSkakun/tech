#!/usr/bin/env node
// «Версія для комп'ютера» on a phone, end to end with touch input only (Chrome device emulation: coarse pointer,
// no hover), on the 2D interface the app picks by itself:
//   «Меню» → «Версія для комп'ютера» → the desktop shell (kd-shell-desk, a computer's metrics); the prologue's first
//   step by touch (switch tap, depth slider drag, «Далі»), a one-finger drag in the scene; reload → still desktop;
//   «Мобільна версія» → the touch shell again; desktop once more, then «Почати з нуля» → the touch shell.
//
//   node tools/qa/desk-toggle.mjs [--port 5298 | --base URL] [--profiles pl,pp,ll] [--out DIR]
//
// Frozen engine clock (`?freeze`), stepped by hand. Screenshots per profile in <out>/<profile>-NN-*.jpg.
// Exit 1 on any failed check.
import { launch, openApp, appUrl, baseUrl, parseArgs, ensureDir, QA_ROOT } from './lib.mjs';
import { PROFILES, PROFILE_ALIASES, settle } from './mobile-parts.mjs';
import { touch } from './touch.mjs';

const args = parseArgs();
const base = baseUrl({ port: 5298, ...args });
const out = args.out ?? `${QA_ROOT}/desk-toggle`;
ensureDir(out);
// plus a large phone held sideways (932 × 430, iPhone Pro Max class) next to mobile-check's profiles
const ALL = { ...PROFILES, 'phone-large-land': { width: 932, height: 430, dpr: 3, safe: '0,59,21,59', shell: 'side' } };
const ALIASES = { ...PROFILE_ALIASES, ll: 'phone-large-land' };
const profiles = String(args.profiles ?? 'pl,pp').split(',').map((p) => ALIASES[p] ?? p);
const fails = [];

async function run(name) {
  const profile = ALL[name];
  const where = name;
  const check = (ok, what, detail = '') => {
    console.log(`${ok ? '  ok  ' : '  FAIL'} ${where.padEnd(16)} ${what}${detail === '' ? '' : `  [${detail}]`}`);
    if (!ok) fails.push(`${where}: ${what}`);
  };
  const { browser, page, pageErrors } = await launch({ ...profile, touch: true });
  const t = await touch(page);
  let n = 0;
  // CSS-pixel frames (the profiles run at DPR 3): small enough to look at
  const shot = (label) =>
    page.screenshot({ path: `${out}/${name}-${String(n++).padStart(2, '0')}-${label}.jpg`, type: 'jpeg', quality: 85, scale: 'css' });
  /** Shell classes on the interface root and what the HUD reports. */
  const shell = () =>
    page.evaluate(() => {
      const root = document.querySelector('.kd-root');
      const m = window.__app.engine.hud.metrics;
      return {
        desk: !!root?.classList.contains('kd-shell-desk'),
        touch: !!root?.classList.contains('kd-touch'),
        forced: !!root?.classList.contains('kd-desk-forced'),
        shell: m.shell,
        formFactor: m.formFactor,
        pointer: m.pointer,
        device: window.__app.engine.device.formFactor,
        saved: JSON.parse(localStorage.getItem('electricity:v2') ?? '{}').settings?.deskShell ?? null,
        errors: window.__app.errors(),
      };
    });
  /** The centre of a visible DOM element (null when hidden or zero-sized). */
  const box = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el || el.closest('[hidden]')) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(el).display === 'none') return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, r: r.right, b: r.bottom };
    }, sel);
  const tapSel = async (sel) => {
    // an item below the fold of a scrolling list (the «Меню» on a phone held sideways): the reader scrolls to it
    await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'nearest' }), sel);
    const b = await box(sel);
    if (!b) throw new Error(`not on screen: ${sel}`);
    await t.tap(b.x, b.y);
    await settle(page, 30);
  };
  const ready = async () => {
    await page.waitForFunction(() => typeof window.__app === 'object');
    await page.evaluate(() => window.__app.ready);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await settle(page, 60);
  };
  /** Nothing of the interface outside the viewport, and the system row inside the window's width. */
  const layout = async (what) => {
    const off = await page.evaluate(() => window.__ui.offscreen().map((o) => o.name));
    check(off.length === 0, `${what}: no control off screen`, off.slice(0, 6).join(', '));
    const row = await box('.kd-system');
    check(!!row && row.r <= profile.width + 0.5, `${what}: the system row fits the width`, row ? `right ${Math.round(row.r)}` : 'none');
  };
  const toDesk = async (what) => {
    await tapSel('[data-ui="sys-menu"]');
    check((await box('[data-ui="menu-desk"]')) !== null, `${what}: «Версія для комп'ютера» is in the «Меню»`);
    await shot('menu');
    await tapSel('[data-ui="menu-desk"]');
    await settle(page, 60);
    const s = await shell();
    check(s.desk && !s.touch && s.forced && s.shell === 'desk', `${what}: the desktop shell`, JSON.stringify(s).slice(0, 160));
    check(s.formFactor === 'desktop' && s.pointer === 'coarse' && s.device === 'phone', `${what}: a computer's layout, the phone's touch`);
    check(s.saved === true, `${what}: the choice is saved`);
    check((await box('[data-ui="sys-mobile"]')) !== null, `${what}: «Мобільна версія» in the system row`);
  };

  try {
    const url = appUrl(base, { route: 'circuit/prologue/click', q: 'auto', freeze: 1, extra: profile.safe ? { safe: profile.safe } : {} });
    await openApp(page, url);
    await ready();
    await page.evaluate(() => window.__ui.close()); // past the title screen
    await settle(page, 60);
    const s0 = await shell();
    check(s0.touch && !s0.desk && s0.shell === profile.shell, 'a phone starts on its touch shell', s0.shell);
    check((await box('[data-ui="sys-mobile"]')) === null, '«Мобільна версія» is not shown on the touch shell');
    await toDesk('menu');
    await layout('desktop shell');
    await shot('desk');

    // the prologue by touch: the opening card, the switch in the scene, «Далі», the next step's depth slider
    const opening = await box('[data-ui="path-opening"] button');
    if (opening) await tapSel('[data-ui="path-opening"] button');
    const prologue = () => page.evaluate(() => window.__app.read('prologue'));
    const sw = await page.evaluate(() => window.__app.locate('switch'));
    const p0 = await prologue();
    await t.tap(sw.x, sw.y);
    await settle(page, 40);
    const p1 = await prologue();
    check(p1.closed !== p0.closed, 'a tap on the switch in the scene toggles it', `${p0.closed} → ${p1.closed}`);
    if (!p1.closed) {
      await t.tap(sw.x, sw.y);
      await settle(page, 40);
    }
    await page.evaluate(() => window.__app.engine.runtime.director.resetOrbit());
    await settle(page, 60);
    // one finger in the free scene area of the first step (upper left, away from the stand) orbits the camera
    const pose = () =>
      page.evaluate(() => {
        const c = window.__app.engine.runtime.director.camera;
        return { p: c.position.toArray(), d: c.position.distanceTo(window.__app.engine.runtime.director.target) };
      });
    const a = await pose();
    const f = await page.evaluate(() => window.__app.engine.hud.insetFractions());
    const sx = (f.left + 0.08) * profile.width;
    const sy = (f.top + 0.2) * profile.height;
    await t.drag([sx, sy], [sx + 110, sy + 12], { steps: 10, hold: 60 });
    await settle(page, 40);
    const b = await pose();
    const moved = Math.hypot(...b.p.map((x, i) => x - a.p[i]));
    check(moved > a.d * 0.01, 'a one-finger drag in the scene orbits the camera', `moved ${moved.toFixed(3)} of ${a.d.toFixed(2)}`);
    await page.evaluate(() => window.__app.engine.runtime.director.resetOrbit());
    await settle(page, 60);

    const before = await page.evaluate(() => location.hash);
    await tapSel('[data-ui="nav-next"]');
    await settle(page, 600); // the next step unfolds the stand (≈ 7 s) before its text and slider show
    const after = await page.evaluate(() => location.hash);
    check(after !== before, '«Далі» by touch goes to the next step', `${before} → ${after}`);
    await layout('next step');
    await shot('next');
    // the desktop's portrait layout: «Опис» and «Керування» share the sheet through a tab switch
    if (await box('[data-ui="sheet-tabs:controls"]')) await tapSel('[data-ui="sheet-tabs:controls"]');
    const track = await page.evaluate(() => {
      const r = document.querySelector('[data-ui="ctl-depth"] input.dk-range')?.getBoundingClientRect();
      return r && r.width > 0 ? { x: r.x, y: r.y + r.height / 2, w: r.width } : null;
    });
    check(!!track, 'the depth slider is on screen in the control dock');
    if (track) {
      const v = () => page.evaluate(() => Number(document.querySelector('[data-ui="ctl-depth"] input.dk-range').value));
      const v0 = await v();
      await t.drag([track.x + 8, track.y], [track.x + track.w * 0.45, track.y], { steps: 14, hold: 80 });
      await settle(page, 60);
      const v1 = await v();
      check(v1 > v0, 'dragging the depth slider by touch moves it', `${v0} → ${v1}`);
      await shot('slider');
    }
    // reload: the desktop shell from the first frame on
    // every shell class the interface root ever carries after the reload: a touch shell first would be a flash
    await page.addInitScript(() => {
      const seen = (window.__shellsSeen = []);
      new MutationObserver(() => {
        const root = document.querySelector('.kd-root');
        const s = root && [...root.classList].find((c) => c.startsWith('kd-shell-'));
        if (s && seen[seen.length - 1] !== s) seen.push(s);
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.reload({ waitUntil: 'load' });
    await ready();
    const seen = await page.evaluate(() => window.__shellsSeen);
    const s2 = await shell();
    check(s2.desk && s2.forced && seen.join() === 'kd-shell-desk', 'after a reload: the desktop shell from the first frame', seen.join(' → '));
    await shot('reload');

    await tapSel('[data-ui="sys-mobile"]');
    await settle(page, 60);
    const s3 = await shell();
    check(s3.touch && s3.shell === profile.shell && s3.saved === false && !s3.forced, '«Мобільна версія» → the touch shell', s3.shell);
    await layout('back on touch');
    await shot('mobile');

    await toDesk('again');
    await tapSel('[data-ui="sys-reset"]');
    check((await page.evaluate(() => window.__ui.overlay())) === 'reset', '«Почати з нуля» asks first');
    const reloaded = page.waitForEvent('load', { timeout: 30000 });
    const confirm = await box('[data-ui="reset-confirm"]');
    await t.tap(confirm.x, confirm.y); // the page reloads: no settling on the old one
    await reloaded;
    await ready();
    const s4 = await shell();
    check(s4.touch && s4.shell === profile.shell && s4.saved !== true, '«Почати з нуля» → the touch shell', s4.shell);
    check(s4.errors.length === 0 && pageErrors.length === 0, 'no app errors', JSON.stringify([...s4.errors, ...pageErrors]).slice(0, 200));
    await shot('reset');
  } catch (e) {
    check(false, 'flow ran', e.message);
  } finally {
    await browser.close();
  }
}

for (const p of profiles) await run(p);
console.log(fails.length ? `FAIL (${fails.length})` : 'PASS');
process.exit(fails.length ? 1 : 0);
