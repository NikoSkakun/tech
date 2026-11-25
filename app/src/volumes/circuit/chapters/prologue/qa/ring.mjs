/* global window, document */
// `prologue/dive` by the focus ring (F-lens-ring): the lens taken by a tap, the knurled ring on its rim, turned by a
// drag along it, the wheel, the keys and the names of its marks; lens mode's camera sway; the lens laid back.
// Called from interactions.mjs with the step entered, the switch open and the lens in its holder.

/** One rendered frame of engine time. */
const frame = (page) => page.evaluate(() => window.__app.step(1 / 60, 1));

/**
 * Press on the ring's marker and turn it by up to `px` (sign = direction) in small steps along the arc's tangent,
 * stopping early once `until(look())` holds. `look()` returns the step's state with the ring as `.ring`.
 */
export async function turnRing(page, look, px, { step = 5, each, until } = {}) {
  let r = (await look()).ring;
  let x = r.marker.x;
  let y = r.marker.y;
  await page.mouse.move(x, y, { steps: 3 });
  await frame(page);
  await page.mouse.down();
  const n = Math.ceil(Math.abs(px) / step);
  for (let i = 0; i < n; i++) {
    const l = r.layout;
    const a = Math.atan2(x - l.cx, y - l.cy);
    const d = Math.sign(px) * step;
    x += d * Math.cos(a);
    y -= d * Math.sin(a);
    await page.mouse.move(x, y);
    await frame(page);
    const s = await look();
    r = s.ring;
    if (each) await each();
    if (until?.(s)) break;
  }
  await page.mouse.up();
  await frame(page);
}

export async function diveByRing(page, { state, check, at, advance, takeaway, sheetTab }) {
  const dive = async () => (await state()).dive;
  const h = page.viewportSize().height;
  const w = page.viewportSize().width;
  const before = await state();
  check('the switch is open, the lens in its holder, no ring', !before.closed && before.dive.lens < 0.01 && !before.dive.ring.shown);
  // a tap on the lens takes it: the switch closes in that frame, the lens glides onto the wire, the ring comes after
  const p = await at(page, 'lens');
  await page.mouse.move(p.x, p.y, { steps: 4 });
  await frame(page);
  await page.mouse.down();
  await page.mouse.up();
  await frame(page);
  const g0 = await state();
  check('a lens tap: switch closed, light in that frame', g0.closed && g0.light > 0.5);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const g1 = await state();
  check(
    '…the lens glides onto the wire (no jump), no ring on the way',
    g1.dive.moving && g1.dive.position > -0.48 && g1.dive.position < -0.05 && !g1.dive.ring.shown,
    `at ${g1.dive.position.toFixed(2)}`,
  );
  const reveal = [];
  for (let i = 0; i < 150 && !(reveal.at(-1) >= 1); i++) {
    await frame(page);
    const s = await state();
    if (s.dive.ring.shown) reveal.push(s.dive.ring.amount);
  }
  const g2 = await state();
  check(
    '…on the wire: lens mode, the ring revealed over several frames',
    g2.dive.lensMode && g2.dive.lens > 0.99 && g2.deep === 0 && reveal.length >= 8 && reveal.at(-1) === 1,
    `${reveal.length} frames`,
  );
  const l0 = g2.dive.ring.layout;
  check('…riding the lens (not pinned), on screen', l0.pinned < 0.05 && l0.cy + l0.r + l0.t < h && l0.cx > 0 && l0.cx < w);
  check(
    '…the slider element is there for the keyboard',
    await page.evaluate(() => {
      const el = document.querySelector('[data-ui="depth-ring"]');
      return !!el && !el.hidden && el.getAttribute('role') === 'slider' && !!el.getAttribute('aria-label');
    }),
  );
  check('…and its marks are named', g2.dive.ring.marks.map((m) => m.label).join(' · ') === 'деталь · ряди кульок', g2.dive.ring.marks.map((m) => m.label).join(' · '));

  // a drag along the ring turns it: the dive follows the hand, small steps only, never backwards
  let prev = g2;
  const jump = { cam: 0, deep: 0 };
  let monotone = true;
  const track = async () => {
    const s = await state();
    jump.cam = Math.max(jump.cam, Math.hypot(...s.camera.map((c, i) => c - prev.camera[i])));
    jump.deep = Math.max(jump.deep, Math.abs(s.deep - prev.deep));
    if (s.dive.position < prev.dive.position - 1e-6) monotone = false;
    prev = s;
  };
  await turnRing(page, dive, 600, { each: track, until: (d) => d.position >= 1 });
  const d1 = await state();
  check('turning the ring dives, with the hand', d1.dive.position >= 1 && monotone, `at ${d1.dive.position.toFixed(2)}`);
  check('…no jump', jump.cam < 0.3 && jump.deep < 0.03, `camera ${jump.cam.toFixed(3)}, deep ${jump.deep.toFixed(3)}`);
  const l1 = d1.dive.ring.layout;
  const nav = await page.evaluate(() => document.querySelector('[data-ui="navigator"]')?.getBoundingClientRect().top ?? 0);
  check(
    '…the lens past the frame: the ring stays as the bottom arc, above the navigator, in the frame',
    l1.pinned > 0.95 && l1.cy + l1.r + l1.t <= nav + 1 && d1.dive.ring.ends.every((e) => e.x > 0 && e.x < w && e.y > 0 && e.y < h),
    `bottom ${(l1.cy + l1.r + l1.t).toFixed(0)} px, navigator ${nav.toFixed(0)}`,
  );
  await turnRing(page, dive, -300, { until: (d) => d.position <= 0.5 });
  const d2 = await state();
  check('…and back the other way', d2.dive.position <= 0.5, `at ${d2.dive.position.toFixed(2)}`);

  // the wheel over the scene: a shortcut for the same value (up = deeper), it glides
  await page.mouse.move(w * 0.3, h * 0.4);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -100);
    await frame(page);
  }
  const wh = await state();
  check('the wheel turns the ring (it glides)', wh.dive.goal > d2.dive.position + 0.5 && wh.dive.moving, `goal ${wh.dive.goal.toFixed(2)}`);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 100);
    await frame(page);
  }
  await advance(page, 3);

  // the keys on the focused ring (a screen reader's slider)
  await page.focus('[data-ui="depth-ring"]');
  const k0 = (await state()).dive.goal;
  await page.keyboard.press('ArrowRight');
  await frame(page);
  const k1 = await state();
  check('ArrowRight on the focused ring: a tenth deeper', Math.abs(k1.dive.goal - k0 - 0.1) < 1e-6, `${k0.toFixed(2)} → ${k1.dive.goal.toFixed(2)}`);
  check('…the step did not change', (await page.evaluate(() => window.__app.position().stepId)) === 'dive');
  await page.keyboard.press('Home');
  await advance(page, 4);
  const k2 = await state();
  const now = await page.evaluate(() => document.querySelector('[data-ui="depth-ring"]').getAttribute('aria-valuenow'));
  check('Home: back to the ring\'s start, aria-valuenow follows', k2.dive.position === 0 && Number(now) === 0, now);
  await page.evaluate(() => document.activeElement?.blur());

  // a tap on the lens with the ring at its start lays it back: lens mode ends, the ring goes
  const q = await at(page, 'lens');
  await page.mouse.move(q.x, q.y, { steps: 4 });
  await frame(page);
  await page.mouse.down();
  await page.mouse.up();
  await advance(page, 2.5);
  const b0 = await state();
  check('a lens tap at the start lays it back: in its holder, no ring', b0.dive.lens < 0.01 && !b0.dive.lensMode && b0.dive.ring.amount === 0);
  // take it again
  const q2 = await at(page, 'lens');
  await page.mouse.move(q2.x, q2.y, { steps: 4 });
  await frame(page);
  await page.mouse.down();
  await page.mouse.up();
  await advance(page, 2.5);
  check('…and a tap takes it again', (await state()).dive.lensMode);

  // a mark's name glides there: «ряди кульок»
  const chip = await page.evaluate(() => {
    const r = document.querySelector('[data-ui="depth-ring:1"]')?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  await page.mouse.click(chip.x, chip.y);
  await page.evaluate(() => window.__app.step(1 / 60, 30));
  const t1 = await state();
  check('a click on «ряди кульок» travels there (does not jump)', t1.dive.moving && t1.dive.position < 1.2 && t1.dive.goal === 2, t1.dive.position.toFixed(2));
  await advance(page, 5);
  const t2 = await state();
  check('…and arrives at the rows', t2.dive.position > 1.99 && !t2.dive.moving, t2.dive.position.toFixed(2));

  // lens mode's sway: a drag on empty space turns the camera a little, it springs back on release
  const rest = (await state()).camera;
  await page.mouse.move(w * 0.25, h * 0.35);
  await frame(page);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(w * 0.25 + i * 25, h * 0.35 - i * 4);
    await frame(page);
  }
  await advance(page, 0.3);
  const sw = await state();
  const moved = Math.hypot(...sw.camera.map((c, i) => c - rest[i]));
  check(
    'a drag on empty space sways the camera a few degrees (held)',
    sw.dive.sway.held && Math.abs(sw.dive.sway.yaw) > 0.03 && Math.abs(sw.dive.sway.yaw) <= 0.1 && moved > 0,
    `yaw ${sw.dive.sway.yaw.toFixed(3)}, pitch ${sw.dive.sway.pitch.toFixed(3)}`,
  );
  check('…the dive stays where it is', Math.abs(sw.dive.position - 2) < 1e-6);
  await page.mouse.up();
  await advance(page, 1.6);
  const sb = await state();
  const off = Math.hypot(...sb.camera.map((c, i) => c - rest[i]));
  check('…and springs back on release', Math.abs(sb.dive.sway.yaw) < 1e-3 && off < 0.02, `off ${off.toFixed(4)}`);

  await advance(page, 0.5);
  // «де ми»: the platform's floor ladder lights the floor on screen, by its plain name in the prologue
  check(
    'floor ladder: «ряди кульок» lit',
    (await page.evaluate(() => document.querySelector('[data-ui="floor-ladder"] .fl-row.on')?.textContent)) ===
      'ряди кульок',
  );
  const d3 = await state();
  check('2 s on the rows', d3.deep > 1.99 && d3.dive.dwell >= 2, `deep ${d3.deep.toFixed(2)}`);
  await sheetTab(page, 'text');
  check('takeaway shown', await takeaway());
  check('no depth slider in the panel', !(await page.evaluate(() => !!document.querySelector('[data-ui="ctl-depth"]'))));
}
