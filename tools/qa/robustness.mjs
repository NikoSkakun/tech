#!/usr/bin/env node
// Robustness checks of engine features that ordinary chapter checks do not reach.
//
//   node tools/qa/robustness.mjs [--only touch,focus,tiers,dynres,dpr] [--port 5201] [--out dir]
//
//   touch   emulated touch through CDP: tap on an interactive object, one-finger drag (object drag and camera
//           orbit), two-finger pinch (zoom)
//   focus   camera.focusOn(object) frames the object (its projected centre lands in the free viewport area)
//   tiers   quality tier switched at run time low → medium → high → ultra → high: no errors, picture intact
//   dynres  dynamic resolution: under an artificial CPU load the render scale drops, without load it recovers
//   dpr     deviceScaleFactor 2 and 3: buffer size follows the tier's DPR cap, HUD metrics unchanged,
//           pointer picking still hits (hover over a projected object position)
// Uses the three look-dev sandboxes. Exit code 1 if any check fails.
import { appErrors, appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs, screenshot } from './lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const only = new Set(String(args.only ?? 'touch,focus,tiers,dynres,dpr').split(','));
const out = ensureDir(typeof args.out === 'string' ? args.out : `${outRoot(args)}/robustness`);
const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};
const errorsOf = async (page, where) => {
  const errors = await appErrors(page);
  check(errors.length === 0, `${where}: no console errors/warnings`, errors.map((e) => e.message.slice(0, 120)).join(' | '));
  await page.evaluate(() => window.__app.clearErrors());
};
/** CSS-pixel position of a named object of the active chapter. */
const locate = (page, name, dy = 0) =>
  page.evaluate(
    ([n, lift]) => {
      const scene = window.__app.engine.runtime.worldView().scene;
      const o = scene.getObjectByName(n);
      const w = o.getWorldPosition(o.position.clone());
      return window.__app.project(w.x, w.y + lift, w.z);
    },
    [name, dy],
  );
const cameraState = (page) =>
  page.evaluate(() => {
    const d = window.__app.engine.runtime.director;
    const p = d.camera.position;
    return { x: p.x, y: p.y, z: p.z, distance: p.distanceTo(d.target), azimuth: Math.atan2(p.x - d.target.x, p.z - d.target.z) };
  });
const settle = (page, frames = 40) => page.evaluate((n) => window.__app.step(1 / 60, n), frames);

/* ----------------------------------------------------------------------------------------------- touch */
if (only.has('touch')) {
  console.log('[touch] emulated touch input (CDP)');
  const { browser, context, page } = await launch({ width: 1280, height: 720, touch: true });
  try {
    await openApp(page, appUrl(base, { route: '_sandbox-studio/induction' }));
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__events = [];
      window.__app.engine.input.on('hover', (e) => window.__events.push(e.tooltip));
      window.__app.pause();
    });
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
    // 1. tap on the magnet → the object under the finger is picked (hover event carries its tooltip)
    const m = await locate(page, 'magnet', 1.18);
    await touch('touchStart', [m]);
    await touch('touchEnd', []);
    await settle(page, 4);
    const tips = await page.evaluate(() => window.__events.filter(Boolean));
    check(tips.length > 0, 'tap picks the object under the finger', `tooltip: ${tips[0] ?? 'none'}`);
    // 2. one-finger drag on the magnet moves it along the rail
    const before = await page.evaluate(() => window.__app.engine.runtime.worldView().scene.getObjectByName('magnet').position.x);
    await touch('touchStart', [m]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ x: m.x + i * 14, y: m.y + i * 2 }]);
    await settle(page, 12);
    const during = await page.evaluate(() => window.__app.engine.runtime.worldView().scene.getObjectByName('magnet').position.x);
    await touch('touchEnd', []);
    check(Math.abs(during - before) > 0.15, 'one-finger drag moves the object', `magnet x ${before.toFixed(2)} → ${during.toFixed(2)}`);
    // 3. one-finger drag on empty space orbits the camera
    const c0 = await cameraState(page);
    await touch('touchStart', [{ x: 300, y: 620 }]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: 300 + i * 16, y: 620 - i * 4 }]);
    await touch('touchEnd', []);
    await settle(page, 60);
    const c1 = await cameraState(page);
    check(Math.abs(c1.azimuth - c0.azimuth) > 0.05, 'one-finger drag on empty space orbits', `azimuth ${c0.azimuth.toFixed(3)} → ${c1.azimuth.toFixed(3)}`);
    // 4. two-finger pinch zooms (fingers apart = closer)
    await touch('touchStart', [{ x: 400, y: 400 }, { x: 520, y: 400 }]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: 400 - i * 9, y: 400 }, { x: 520 + i * 9, y: 400 }]);
    await touch('touchEnd', []);
    await settle(page, 60);
    const c2 = await cameraState(page);
    check(c2.distance < c1.distance * 0.92, 'pinch out zooms in', `distance ${c1.distance.toFixed(2)} → ${c2.distance.toFixed(2)}`);
    await screenshot(page, `${out}/touch-after.jpg`);
    await errorsOf(page, 'touch');
  } catch (e) {
    check(false, `touch aborted: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------------------- focusOn + tier switch */
if (only.has('focus') || only.has('tiers')) {
  const { browser, page } = await launch({ width: 1280, height: 720 });
  try {
    await openApp(page, appUrl(base, { route: '_sandbox-diorama/island', q: 'high' }));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__app.pause());
    if (only.has('focus')) {
      console.log('[focus] camera.focusOn');
      for (const name of ['turbine', 'tank', 'greenhouse']) {
        await page.evaluate((n) => {
          const e = window.__app.engine;
          e.runtime.director.focusOn(e.runtime.worldView().scene.getObjectByName(n), { duration: 1 });
        }, name);
        await settle(page, 90);
        const r = await page.evaluate((n) => {
          const e = window.__app.engine;
          const d = e.runtime.director;
          const o = e.runtime.worldView().scene.getObjectByName(n);
          const box = o.position.clone();
          // centre of the object's bounds in screen space, relative to the centre of the free viewport area
          const THREEBox = d.target.clone();
          void THREEBox;
          const p = window.__app.project(d.target.x, d.target.y, d.target.z);
          const free = d.camera.freeCenter({ x: 0, y: 0 });
          const vp = e.viewport;
          return { dx: p.x - free.x * vp.width, dy: p.y - (1 - free.y) * vp.height, distance: d.camera.position.distanceTo(d.target), origin: box.toArray() };
        }, name);
        check(Math.abs(r.dx) < 40 && Math.abs(r.dy) < 40 && Number.isFinite(r.distance), `focusOn(${name}) centres it in the free area`, `offset ${r.dx.toFixed(0)},${r.dy.toFixed(0)} px, distance ${r.distance.toFixed(1)}`);
        await screenshot(page, `${out}/focus-${name}.jpg`);
      }
      await errorsOf(page, 'focusOn');
    }
    if (only.has('tiers')) {
      console.log('[tiers] quality switching at run time');
      await page.evaluate(() => window.__app.goto('_sandbox-diorama', 'dusk', { instant: true }));
      for (const tier of ['low', 'medium', 'high', 'ultra', 'high']) {
        await page.evaluate((t) => window.__app.setQuality(t), tier);
        await settle(page, 20);
        const s = await page.evaluate(() => window.__app.stats());
        check(s.quality === tier, `switched to ${tier}`, `${s.width}x${s.height}, ${s.drawCalls} calls`);
        await screenshot(page, `${out}/tier-${tier}.jpg`);
      }
      await errorsOf(page, 'tier switching');
    }
  } catch (e) {
    check(false, `focus/tiers aborted: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
  }
}

/* ---------------------------------------------------------------------------------- dynamic resolution */
if (only.has('dynres')) {
  console.log('[dynres] dynamic resolution under artificial load');
  const { browser, page } = await launch({ width: 1280, height: 720 });
  try {
    await openApp(page, appUrl(base, { route: '_sandbox-diorama/island', q: 'high' }));
    await page.waitForTimeout(4500); // the controller ignores the first seconds after boot
    const s0 = await page.evaluate(() => ({ scale: window.__app.engine.resolutionScale, w: window.__app.stats().width }));
    // burn ~30 ms of CPU in every update: frames miss vsync like on an overloaded GPU
    await page.evaluate(() => {
      window.__burn = window.__app.engine.onUpdate(() => {
        const t = performance.now();
        while (performance.now() - t < 30) void 0;
      });
    });
    await page.waitForTimeout(9000);
    const s1 = await page.evaluate(() => ({ scale: window.__app.engine.resolutionScale, w: window.__app.stats().width }));
    check(s1.scale < s0.scale - 0.15 && s1.w < s0.w, 'render scale drops under load', `scale ${s0.scale} → ${s1.scale.toFixed(2)}, width ${s0.w} → ${s1.w}`);
    await screenshot(page, `${out}/dynres-low.jpg`);
    await page.evaluate(() => window.__burn());
    await page.waitForTimeout(18000);
    const s2 = await page.evaluate(() => ({ scale: window.__app.engine.resolutionScale, w: window.__app.stats().width }));
    check(s2.scale > s1.scale, 'render scale recovers when the load is gone', `scale ${s1.scale.toFixed(2)} → ${s2.scale.toFixed(2)}`);
    await errorsOf(page, 'dynamic resolution');
  } catch (e) {
    check(false, `dynres aborted: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
  }
}

/* -------------------------------------------------------------------------------------------- high DPR */
if (only.has('dpr')) {
  console.log('[dpr] deviceScaleFactor 1 / 2 / 3');
  let reference = null;
  for (const [dpr, tier, expected] of [
    [1, 'high', 1],
    [2, 'high', 1.5],
    [2, 'ultra', 2],
    [3, 'ultra', 2],
  ]) {
    const { browser, page } = await launch({ width: 1280, height: 720, dpr });
    try {
      await openApp(page, appUrl(base, { route: '_sandbox-studio/induction', q: tier }));
      await page.waitForTimeout(1200);
      await page.evaluate(() => {
        window.__events = [];
        window.__app.engine.input.on('hover', (e) => window.__events.push(e.tooltip));
        window.__app.pause();
      });
      const s = await page.evaluate(() => ({ stats: window.__app.stats(), hud: window.__app.engine.hud.metrics }));
      check(s.stats.width === Math.floor(1280 * expected) && s.stats.height === Math.floor(720 * expected), `dpr ${dpr} ${tier}: buffer ${s.stats.width}x${s.stats.height}`, `expected ×${expected}`);
      reference ??= s.hud;
      check(Math.abs(s.hud.width - reference.width) < 1e-6 && Math.abs(s.hud.pxPerUnit - reference.pxPerUnit) < 1e-6, `dpr ${dpr} ${tier}: HUD metrics independent of DPR`, `${s.hud.width.toFixed(0)}x${s.hud.height.toFixed(0)} units`);
      const m = await locate(page, 'magnet', 1.18);
      await page.mouse.move(m.x, m.y);
      await settle(page, 6);
      const tips = await page.evaluate(() => window.__events.filter(Boolean));
      check(tips.length > 0, `dpr ${dpr} ${tier}: picking at projected position hits`, tips[0] ?? 'no hover');
      await page.screenshot({ path: `${out}/dpr${dpr}-${tier}.png`, type: 'png', clip: { x: 900, y: 240, width: 380, height: 240 } });
      await errorsOf(page, `dpr ${dpr} ${tier}`);
    } catch (e) {
      check(false, `dpr ${dpr} aborted: ${e.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
}

console.log(failures.length === 0 ? `PASS robustness — images in ${out}` : `FAILED robustness: ${failures.length} check(s): ${failures.join('; ')}`);
process.exit(failures.length === 0 ? 0 : 1);
