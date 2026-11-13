// Touch gestures for the QA tools (F5, docs/MOBILE.md): real touch input through the Chrome DevTools protocol
// (`Input.dispatchTouchEvent`), which the page receives as Pointer Events with `pointerType: 'touch'` — the
// same path a finger takes. Coordinates are CSS px of the viewport.
//
//   const t = await touch(page);
//   await t.tap(x, y);                       await t.longPress(x, y, 700);
//   await t.drag([x0, y0], [x1, y1], { steps: 12, hold: 0 });
//   await t.pinch([cx, cy], 60, 180);        // fingers 60 px apart → 180 px apart (zoom in)

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Gesture helpers bound to a Playwright page (Chromium only). */
export async function touch(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, y], id) => ({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, id, radiusX: 8, radiusY: 8, force: 1 })),
    });
  /** One animation frame of the page, so the app sees every intermediate position. */
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

  return {
    async tap(x, y) {
      await send('touchStart', [[x, y]]);
      await frame();
      await send('touchEnd', []);
      await frame();
    },
    /** Hold a finger still (long press: the app shows the tooltip after 480 ms). */
    async longPress(x, y, ms = 700) {
      await send('touchStart', [[x, y]]);
      await wait(ms);
      await frame();
      await send('touchEnd', []);
      await frame();
    },
    /** One-finger drag. `hold`: ms to rest before lifting (0 = a flick with the velocity of the last steps). */
    async drag(from, to, { steps = 12, hold = 120 } = {}) {
      await send('touchStart', [from]);
      await frame();
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        await send('touchMove', [[from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]]);
        await frame();
      }
      if (hold > 0) await wait(hold);
      await send('touchEnd', []);
      await frame();
    },
    /** Two-finger pinch around `centre`: finger distance `from` → `to` px (horizontal fingers). */
    async pinch(centre, from, to, { steps = 12 } = {}) {
      const at = (d) => [
        [centre[0] - d / 2, centre[1]],
        [centre[0] + d / 2, centre[1]],
      ];
      await send('touchStart', [at(from)[0]]);
      await send('touchStart', at(from));
      await frame();
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', at(from + ((to - from) * i) / steps));
        await frame();
      }
      await send('touchEnd', []);
      await frame();
    },
    /** Tap the centre of a named HUD node (`__ui.locate`); throws when it is not on screen. */
    async tapNode(name) {
      const box = await page.evaluate((n) => window.__ui.locate(n), name);
      if (!box) throw new Error(`touch.tapNode: '${name}' is not on screen`);
      await this.tap(box.x, box.y);
      return box;
    },
    detach: () => cdp.detach(),
  };
}
