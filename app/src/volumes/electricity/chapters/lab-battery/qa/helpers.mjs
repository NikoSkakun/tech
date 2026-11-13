/* global window */
// Helpers of the `lab-battery` interaction test. Only hooks that exist in production builds are used:
//   __app.read('probe')      the observable state of the step on screen (`ctx.qa.expose` in scene.ts)
//   __app.locate(name)       CSS px of a scene object named with `ctx.qa.probe` (rungs, pedestals, glasses …)
//   __ui.locate('ctl-<id>')  CSS px of a HUD control; segmented items are `ctl-<id>:<item>`
//   __ui.set / value / press / offscreen
// Positions always come from these hooks, so one script serves every window size.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseSize,
  screenshot,
} from '../../../../../../../tools/qa/lib.mjs';

export async function session(args) {
  const [width, height] = parseSize(args.size, [1280, 720]);
  // `--touch`: the same scenarios with one finger (touch events through CDP) instead of the mouse
  const touch = args.touch === true;
  const { browser, page } = await launch({ width, height, touch });
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  // `--reduced`: the same scenarios with `prefers-reduced-motion: reduce` (the engine's `reducedMotion`)
  if (args.reduced === true) await page.emulateMedia({ reducedMotion: 'reduce' });
  const finger = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  /** Pointer primitives: a tap / click, and press – move – release. */
  const tap = async (x, y) => {
    if (!touch) return page.mouse.click(x, y);
    await finger('touchStart', x, y);
    await finger('touchEnd', x, y);
  };
  const pointer = {
    down: (x, y) => (touch ? finger('touchStart', x, y) : page.mouse.move(x, y).then(() => page.mouse.down())),
    move: (x, y) => (touch ? finger('touchMove', x, y) : page.mouse.move(x, y)),
    up: (x, y) => (touch ? finger('touchEnd', x, y) : page.mouse.up()),
  };
  const failures = [];
  let checks = 0;
  const check = (ok, message) => {
    checks++;
    if (!ok) failures.push(message);
    return ok;
  };
  const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
  const probe = () => page.evaluate(() => window.__app.read('probe'));
  const value = (id) => page.evaluate((i) => window.__ui.value(i), id);
  /** Set a control exactly like a user gesture would (listeners run): precise slider values, toggles. */
  const set = async (id, v, n = 30) => {
    await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
    await frames(n);
  };
  const locateUi = (name) => page.evaluate((k) => window.__ui.locate(k), name);
  /** Real pointer click on a named HUD node; `fx`, `fy` pick a point inside its box (0…1). */
  const clickUi = async (name, { fx = 0.5, fy = 0.5, n = 30 } = {}) => {
    const r = await locateUi(name);
    if (!check(r !== null, `HUD node '${name}' not found`)) return;
    await tap(r.x + (fx - 0.5) * r.w, r.y + (fy - 0.5) * r.h);
    await frames(n);
  };
  /** Real click on a button of the step (`ctl-<id>`); when it is scrolled out of view, the scripted press. */
  const press = async (id, n = 30) => {
    const r = await locateUi(`ctl-${id}`);
    const inside = r && r.x > 0 && r.y > 0 && r.x < width && r.y < height;
    if (inside) await tap(r.x, r.y);
    else await page.evaluate((i) => window.__ui.press(i), id);
    await frames(n);
  };
  /** Real click on one item of a segmented control. */
  const pick = (id, item, n = 30) => clickUi(`ctl-${id}:${item}`, { n });
  const locate3d = async (name) => {
    const p = await page.evaluate((k) => window.__app.locate(k), name);
    check(p !== null && p.visible && p.shown, `scene probe '${name}' is not on screen`);
    return p ?? { x: 0, y: 0 };
  };
  /** Real pointer click on a scene object named with `ctx.qa.probe`. */
  const click3d = async (name, n = 30) => {
    const s = await locate3d(name);
    if (!touch) await page.mouse.move(s.x, s.y); // hover first, like a real mouse
    await frames(2);
    await tap(s.x, s.y);
    await frames(n);
  };
  /** Real pointer drag from a scene object by (dx, dy) px, or onto another named object. */
  const drag3d = async (name, to, n = 20) => {
    const s = await locate3d(name);
    const e = typeof to === 'string' ? await locate3d(to) : { x: s.x + to.dx, y: s.y + to.dy };
    await pointer.down(s.x, s.y);
    await frames(2);
    for (let k = 1; k <= 8; k++) {
      await pointer.move(s.x + ((e.x - s.x) * k) / 8, s.y + ((e.y - s.y) * k) / 8);
      await frames(1);
    }
    await pointer.up(e.x, e.y);
    await frames(n);
  };
  const goto = async (step) => {
    await page.evaluate((s) => window.__app.goto('lab-battery', s, { instant: true }), step);
    await page.evaluate(() => window.__app.settled());
    await frames(20);
    // every control of the step must be reachable at this window size
    const off = await page.evaluate(() => window.__ui.offscreen().map((o) => o.name ?? String(o)));
    check(off.length === 0, `${step}: controls outside the viewport: ${off.join(', ')}`);
  };
  await openApp(page, appUrl(baseUrl(args), { route: 'lab-battery/what-is-battery', freeze: 3 }));
  return {
    page,
    browser,
    failures,
    check,
    frames,
    probe,
    value,
    set,
    clickUi,
    press,
    pick,
    click3d,
    drag3d,
    goto,
    size: `${width}x${height}`,
    count: () => checks,
    near: (a, b, tol) => Math.abs(a - b) <= tol,
    shot: (file) => screenshot(page, file, 86),
    errors: () => appErrors(page),
  };
}
