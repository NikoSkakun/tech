#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `magnetism` (run on lenovo; dev server or production preview up):
//
//   QA_PORT=5246 node app/src/volumes/electricity/chapters/magnetism/qa/interaction.mjs [--size 1280x720] [--only lenz]
//
// Every control of every step is used at least once and an *observable* change is asserted through the
// chapter's QA hooks (`ctx.qa.expose` → `__app.read(name)`, `ctx.qa.probe` → `__app.locate(name)`), which exist
// in production builds too. HUD controls are operated with real pointer clicks where `__ui.locate('ctl-…')`
// finds them inside the viewport (and through `__ui.set / press` with notification otherwise: exact slider
// values, controls scrolled out of a short dock); 3D objects with real pointer clicks and drags at probe
// positions. The clock is frozen (`?freeze`): `frames(n)` advances exactly n simulated frames.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const failures = [];
let checks = 0;
let pointerClicks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) failures.push(message);
};
const PX = height / 720;
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const read = (name) => page.evaluate((k) => window.__app.read(k), name);
const locate3d = (name) => page.evaluate((k) => window.__app.locate(k), name);
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto("magnetism", s, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await frames(30);
};
/** Set a control exactly like a user gesture (onChange runs). */
const set = async (id, v, n = 30) => {
  await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
  await frames(n);
};
/** Real pointer click on a named HUD node when it is reachable; else the scripted equivalent. */
const clickUi = async (name, fallback, fx = 0.5, fy = 0.5, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), name);
  // reachable = the click point lies inside the visible part of the dock, its action row or the board
  const regions = await page.evaluate(() =>
    ['dock-scroll', 'dock-actions', 'board'].map((k) => window.__ui.locate(k)),
  );
  const x = r ? r.x + (fx - 0.5) * r.w : -1;
  const y = r ? r.y + (fy - 0.5) * r.h : -1;
  const inside = regions.some((q) => q && Math.abs(x - q.x) < q.w / 2 - 2 && Math.abs(y - q.y) < q.h / 2 - 2);
  if (r && inside && x > 2 && y > 2 && x < width - 2 && y < height - 2) {
    await page.mouse.click(x, y);
    pointerClicks++;
  } else if (fallback) await page.evaluate(fallback.fn, fallback.arg);
  else check(false, `HUD node '${name}' is not reachable`);
  await frames(n);
};
const toggle = (id, n = 30) =>
  clickUi(`ctl-${id}`, { fn: (i) => window.__ui.set(i, !window.__ui.value(i), true), arg: id }, 0.12, 0.5, n);
const seg = (id, item, n = 30) =>
  clickUi(`ctl-${id}:${item}`, { fn: ([i, x]) => window.__ui.set(i, x, true), arg: [id, item] }, 0.5, 0.5, n);
const press = (id, n = 30) => clickUi(`ctl-${id}`, { fn: (i) => window.__ui.press(i), arg: id }, 0.5, 0.5, n);
/** Real pointer click on a probe (3D object). */
const click3d = async (name, n = 30) => {
  const p = await locate3d(name);
  if (!p) return check(false, `probe '${name}' not found`);
  await page.mouse.move(p.x, p.y);
  await frames(2);
  await page.mouse.click(p.x, p.y);
  await frames(n);
};
/** Real pointer drag from one probe to another probe (or by a pixel offset). */
const drag3d = async (from, to, n = 40) => {
  const a = await locate3d(from);
  // pixel offsets are written for 1280×720 and scale with the viewport (same world distance at any size)
  const b = typeof to === 'string' ? await locate3d(to) : a && { x: a.x + to[0] * PX, y: a.y + to[1] * PX };
  if (!a || !b) return check(false, `probe '${from}' / '${to}' not found`);
  await page.mouse.move(a.x, a.y);
  await frames(2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(a.x + ((b.x - a.x) * k) / 8, a.y + ((b.y - a.y) * k) / 8);
    await frames(2);
  }
  await page.mouse.up();
  await frames(n);
};
const noOffscreen = async (step) => {
  const off = await page.evaluate(() => window.__ui.offscreen());
  check(off.length === 0, `${step}: controls outside the viewport: ${JSON.stringify(off).slice(0, 160)}`);
};

const steps = {
  'magnet-field': async () => {
    let s = await read('magnet-field');
    check(s.magnets === 2 && !s.cut, 'two magnets at the start');
    await drag3d('magnetB1', [-90, -70]);
    s = await read('magnet-field');
    check(Math.hypot(s.b[0] - 0.2, s.b[1] + 0.11) > 0.01, `magnet B follows the drag (got ${s.b})`);
    const a0 = s.bAngle;
    await press('flip1', 60);
    check(near((await read('magnet-field')).bAngle - a0, Math.PI, 0.01), 'flip turns magnet B by 180°');
    await toggle('peek1', 60);
    check((await read('magnet-field')).peek > 0.95, 'peek makes the bodies glass');
    await press('cut1', 60);
    s = await read('magnet-field');
    check(s.cut && s.magnets === 3, 'cut: the centre magnet becomes two');
    await press('glue1', 30);
    check(!(await read('magnet-field')).cut, 'glue: one magnet again');
    await noOffscreen('magnet-field');
  },
  domains: async () => {
    await set('h2', 35, 10);
    let s = await read('domains');
    check(near(s.magnetization, 0.5, 0.06), `h = +0,35 → M ≈ 0,5 (got ${s.magnetization})`);
    await set('h2', 100, 10);
    await set('h2', 0, 10);
    s = await read('domains');
    check(near(s.magnetization, 0.7, 0.06), `back to 0 → remanence ≈ 0,7 (got ${s.magnetization})`);
    check(s.trail > 2, 'the hysteresis chart records the path');
    await clickUi('ctl-t2', { fn: () => window.__ui.set('t2', 900, true) }, 0.97, 0.72, 20);
    s = await read('domains');
    check(s.aboveCurie && near(s.magnetization, 0, 0.01), `above the Curie point M = 0 (T ${s.temperatureC})`);
    await noOffscreen('domains');
  },
  oersted: async () => {
    let s = await read('oersted');
    check(near(s.fieldMicroT, 80, 0.5) && !s.memory, `8 A at 2 cm → 80 μT (got ${s.fieldMicroT})`);
    await set('i3', 5, 10);
    await set('r3', 2, 120);
    s = await read('oersted');
    check(near(s.alphaDeg, 68.2, 0.2) && near(s.probeHeadingDeg, 90 + 68.2, 3), `5 A, 2 cm → α ≈ 68° (got ${s.alphaDeg}, needle ${s.probeHeadingDeg})`);
    await set('i3', -10, 120);
    check((await read('oersted')).alphaDeg < 0, 'reversed current deflects the other way');
    const r0 = (await read('oersted')).rM;
    await drag3d('probe3', [0, -45]);
    check((await read('oersted')).rM > r0, 'dragging the probe along the rail moves it north');
    await noOffscreen('oersted');
  },
  solenoid: async () => {
    let s = await read('solenoid');
    check(near(s.fieldT, 0.00628, 0.0002) && s.clips === 0, `1 A, 500 turns, no core → 6,3 mT (got ${s.fieldT})`);
    await toggle('core4', 90);
    s = await read('solenoid');
    check(near(s.fieldT, 1.049, 0.01) && s.clips === 17, `core in → 1,05 T, 17 clips (got ${s.fieldT}, ${s.clips})`);
    await set('i4', 2, 120);
    s = await read('solenoid');
    check(near(s.fieldT, 1.467, 0.01) && s.lifted > 25, `2 A → 1,47 T, more clips (got ${s.fieldT}, ${s.lifted})`);
    await set('n4', 100, 10);
    check((await read('solenoid')).fieldT < 1.2, 'fewer turns → weaker field');
    await press('pol4', 20);
    check((await read('solenoid')).reversed === true, 'polarity button swaps N and S');
    await drag3d('rod4', [160, 0]);
    check((await read('solenoid')).insert < 0.5, 'dragging the rod out pulls the core');
    await noOffscreen('solenoid');
  },
  lorentz: async () => {
    let s = await read('lorentz');
    check(near(s.radiusCm, 3.37, 0.02) && s.closed, `1 mT, 100 V → r ≈ 3,4 cm, closed circle (got ${s.radiusCm})`);
    await set('b5', 0.3, 10);
    check(!(await read('lorentz')).closed, 'weak field: the arc hits the glass');
    await set('u5', 300, 10);
    await set('b5', 2, 10);
    check(near((await read('lorentz')).radiusCm, 2.92, 0.02), '300 V, 2 mT → r ≈ 2,9 cm');
    await seg('q5', 'proton', 10);
    s = await read('lorentz');
    check(s.turn === -1 && s.radiusCm > 100, 'protons: other sense, nearly straight');
    await seg('part5', 'b', 60);
    await set('i5', 5, 150);
    check(near((await read('lorentz')).betaDeg, 37.4, 1), `5 A → β ≈ 37° (got ${(await read('lorentz')).betaDeg})`);
    await toggle('flip5', 150);
    check((await read('lorentz')).betaDeg < -30, 'magnet turned over → the swing goes the other way');
    await noOffscreen('lorentz');
  },
  'dc-motor': async () => {
    await frames(300);
    let s = await read('dc-motor');
    check(near(s.rpm, 4209, 120) && near(s.currentA, 0.44, 0.05), `6 V, 0,005 N·m → ≈ 4200 rpm, 0,44 A (got ${s.rpm}, ${s.currentA})`);
    await set('load6', 0.02, 300);
    s = await read('dc-motor');
    check(s.rpm < 2600 && s.currentA > 1.5, `more load → slower, more current (got ${s.rpm}, ${s.currentA})`);
    await toggle('jam6', 60);
    s = await read('dc-motor');
    check(s.stalled && near(s.currentA, 3, 0.05), `jammed → I = U/R = 3 A (got ${s.currentA})`);
    await toggle('jam6', 10);
    await toggle('slow6', 10);
    check((await read('dc-motor')).slow, 'slow-motion toggle');
    await set('u6', 9, 10);
    await seg('out6', 'rings', 400);
    s = await read('dc-motor');
    check(s.mode === 'rings' && Math.abs(s.rpm) < 600, `slip rings: the frame only rocks (got ${s.rpm} rpm)`);
    await noOffscreen('dc-motor');
  },
  induction: async () => {
    await press('auto7', 2);
    let peak = 0;
    for (let k = 0; k < 30; k++) {
      await frames(1);
      peak = Math.max(peak, Math.abs((await read('induction')).emfV));
    }
    check(peak > 0.45 && peak < 0.7, `auto drop, 200 turns → peaks ≈ 0,6 V (got ${peak})`);
    await set('n7', 1000, 120);
    await seg('grade7', 'ferrite', 10);
    check((await read('induction')).turns === 1000, 'turns slider');
    const m0 = (await read('induction')).moment;
    check(m0 < 0.3, `ferrite magnet is weaker (m = ${m0})`);
    const z0 = (await read('induction')).zRel;
    await drag3d('magnet7', [0, -150], 4);
    let s = await read('induction');
    check(s.zRel > z0 + 0.02, `dragging the magnet up moves it (z ${z0} → ${s.zRel})`);
    await seg('move7', 'coil', 30);
    const zc = (await read('induction')).zRel;
    await drag3d('coil7', [0, 90], 4);
    s = await read('induction');
    check(Math.abs(s.zRel - zc) > 0.01, 'in coil mode the coil moves instead (relative motion)');
    await noOffscreen('induction');
  },
  lenz: async () => {
    await click3d('cuMagnet8', 30);
    check((await read('lenz')).distances[2] > 0, 'clicking a magnet releases it');
    await press('all8', 60);
    let s = await read('lenz');
    check(near(s.times[0], 0.452, 0.01) && Number.isNaN(s.times[2] ?? NaN) === false ? true : near(s.times[0], 0.452, 0.01), `PVC: 0,45 s (got ${s.times[0]})`);
    check(near(s.transit[1], 4.24, 0.03) && near(s.transit[2], 6.68, 0.03), 'Al 4,24 s, Cu 6,68 s');
    await toggle('slot8', 10);
    check(near((await read('lenz')).transit[2], 1.73, 0.03), 'slotted copper: 1,73 s');
    await press('stick8', 20);
    check((await read('lenz')).loose !== null, 'the magnet put on the copper tube falls');
    const p = await locate3d('ringMagnet8');
    await page.mouse.move(p.x, p.y);
    await frames(2);
    await page.mouse.down();
    let swing = 0;
    const trace = [];
    for (let k = 1; k <= 10; k++) {
      await page.mouse.move(p.x - 12 * k * PX, p.y);
      await frames(2);
      const r = await read('lenz');
      trace.push(r.swingDeg.toFixed(1));
      swing = Math.max(swing, Math.abs(r.swingDeg));
    }
    if (process.env.QA_TRACE) console.log(trace.join(' '));
    await page.mouse.up();
    check(swing > 2, `the solid ring swings away from the approaching magnet (${swing}°)`);
    await seg('ring8', 'cut', 30);
    await drag3d('ringMagnet8', [100, 0], 4);
    check(Math.abs((await read('lenz')).swingDeg) < 1, 'the cut ring does not react');
    await noOffscreen('lenz');
  },
  inductance: async () => {
    let s = await read('inductance');
    check(near(s.i1A, 1.2, 0.01) && near(s.i2A, 1.2, 0.02), `S1 on, settled: 1,2 A in both branches (got ${s.i1A}, ${s.i2A})`);
    await press('break9', 3);
    s = await read('inductance');
    check(!s.s2Closed && near(s.breakEmfDisplayV, 1200, 5), `S2 broken in 1 ms → 1200 V (got ${s.breakEmfDisplayV})`);
    await press('join9', 60);
    check((await read('inductance')).s2Closed, 'S2 reconnected');
    await seg('s19', 'off', 3);
    s = await read('inductance');
    check(s.i1A < 0 && s.i2A > 0, `S1 off: L1's current reverses (got ${s.i1A}, ${s.i2A})`);
    await toggle('core9', 10);
    check(near((await read('inductance')).inductanceH, 0.005, 1e-6), 'no core → 5 mH');
    await set('dt9', 10, 10);
    await click3d('s1-9', 60);
    check((await read('inductance')).s1On, 'clicking S1 in the scene switches it on');
    await noOffscreen('inductance');
  },
  maxwell: async () => {
    await seg('eq10', '3', 30);
    check((await read('maxwell')).eq === 3, 'equation 4 illustration');
    await seg('view10', 'wave', 90);
    check((await read('maxwell')).band === 'visible', 'default 5×10¹⁴ Hz is visible light');
    await set('f10', 1e8, 10);
    let s = await read('maxwell');
    check(s.band === 'radio' && near(s.wavelengthM, 3, 0.01), `100 MHz → radio, 3 m (got ${s.wavelengthM})`);
    await seg('view10', 'energy', 90);
    await set('u10', 24, 5);
    await set('r10', 1, 5);
    check(near((await read('maxwell')).powerW, 576, 1), '24 V, 1 Ω → 576 W');
    await seg('show10', 'electrons', 10);
    check((await read('maxwell')).show === 'electrons', 'show only the electrons');
    await noOffscreen('maxwell');
  },
  'to-generator': async () => {
    await frames(180);
    let s = await read('to-generator');
    check(near(Math.abs(s.speedRpm), 120, 3) && near(s.emfMaxV, 6.28, 0.1), `steady 120 rpm → ℰmax 6,3 V (got ${s.speedRpm}, ${s.emfMaxV})`);
    await seg('out11', 'commutator', 10);
    let neg = 0;
    for (let k = 0; k < 20; k++) {
      await frames(3);
      if ((await read('to-generator')).emfV < -0.01) neg++;
    }
    check(neg === 0, 'with the commutator the output never goes negative');
    await toggle('steady11', 10);
    // grab the crank's hub on the axle, then circle around it
    const c = await locate3d('crank11');
    check(Boolean(c), 'crank probe');
    await page.mouse.move(c.x, c.y);
    await frames(2);
    await page.mouse.down();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      await page.mouse.move(c.x + Math.cos(a) * 60 * PX, c.y - Math.sin(a) * 60 * PX);
      await frames(2);
    }
    await page.mouse.up();
    s = await read('to-generator');
    check(Math.abs(s.speedRpm) > 5, `cranking turns the frame (got ${s.speedRpm} rpm)`);
    await press('next11', 90);
    const pos = await page.evaluate(() => window.__app.position());
    check(['magnetism', 'generator-ac'].includes(pos.chapterId), 'the bridge leaves the app in a valid place');
    await noOffscreen('to-generator');
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'magnetism/magnet-field', freeze: 3 }));
  for (const [step, run] of Object.entries(steps)) {
    if (typeof args.only === 'string' && args.only !== step) continue;
    const before = failures.length;
    await goto(step);
    await run();
    console.log(`${failures.length === before ? 'ok  ' : 'FAIL'} ${step}`);
  }
  const errors = await appErrors(page);
  for (const e of errors) failures.push(`console ${e.level}: ${e.message.slice(0, 200)}`);
} catch (e) {
  failures.push(`exception: ${e.stack ?? e}`);
} finally {
  await browser.close();
}
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(`${width}x${height}: ${pointerClicks} real pointer clicks on HUD controls`);
console.log(failures.length ? `FAILED: ${failures.length} of ${checks} checks` : `PASS: ${checks} checks`);
process.exit(failures.length ? 1 : 0);
