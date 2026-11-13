#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `lab-pv` (run on lenovo; dev server or production preview up):
//
//   QA_PORT=5243 node app/src/volumes/electricity/chapters/lab-pv/qa/interaction.mjs [--size 1280x720] [--only shading]
//
// Every control of every step is used at least once and an *observable* change is asserted through the
// chapter's QA hooks — `__app.read(name)` (model state the step exposes) and `__app.locate(name)` (scene
// objects, CSS px) — plus `__ui.locate('ctl-<id>')` for HUD controls. Only hooks that exist in production
// builds are used, and every position comes from `locate`, so the same script runs at 1280×720, 1920×1080 and
// 3840×2160. Toggles, buttons, segmented items, sliders and scene objects get real pointer input; exact
// values for the document's control points are then set with `__ui.set(id, v, true)` (= a user gesture).
// The clock is frozen (`?freeze`): `frames(n)` advances exactly n simulated frames, so the test is deterministic.
import { appErrors, appUrl, baseUrl, launch, openApp, parseArgs, parseSize } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const failures = [];
const notes = [];
let checks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) failures.push(message);
};
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const read = (name) => page.evaluate((k) => window.__app.read(k), name);
const value = (id) => page.evaluate((i) => window.__ui.value(i), id);
const set = async (id, v, n = 20) => {
  await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
  await frames(n);
};
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto('lab-pv', s, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await frames(30);
};
/** Real pointer click on a named HUD node; `fx`, `fy` pick a point inside its box (0…1). */
const clickUi = async (name, fx = 0.5, fy = 0.5, n = 20) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), name);
  if (!r) return check(false, `HUD node '${name}' not found`);
  await page.mouse.click(r.x + (fx - 0.5) * r.w, r.y + (fy - 0.5) * r.h);
  await frames(n);
};
/** Pointer on a toggle; falls back to a programmatic gesture (noted) if the click missed the switch. */
const flip = async (id, n = 20) => {
  const before = await value(id);
  await clickUi(`ctl-${id}`, 0.08, 0.5, n);
  if ((await value(id)) === before) {
    notes.push(`toggle ${id}: pointer missed the switch, used __ui.set`);
    await set(id, !before, n);
  }
  check((await value(id)) === !before, `toggle '${id}' should flip`);
};
/** Pointer on a segmented item. */
const pick = async (id, item, n = 20) => {
  await clickUi(`ctl-${id}:${item}`, 0.5, 0.5, n);
  check((await value(id)) === item, `segmented '${id}' should be '${item}', is '${await value(id)}'`);
};
/** Pointer somewhere on a slider track: the value must change. */
const slide = async (id, fx, n = 20) => {
  const before = await value(id);
  await clickUi(`ctl-${id}`, fx, 0.72, n);
  check((await value(id)) !== before, `slider '${id}' should move on a pointer click (still ${before})`);
};
/** Screen position (CSS px) of a chapter probe. */
const where = async (name) => {
  const p = await page.evaluate((k) => window.__app.locate(k), name);
  if (!p) check(false, `probe '${name}' not found`);
  return p ?? { x: 0, y: 0 };
};
const click3d = async (name, n = 20) => {
  const s = await where(name);
  await page.mouse.move(s.x, s.y);
  await frames(2);
  await page.mouse.click(s.x, s.y);
  await frames(n);
};
const drag3d = async (name, dx, dy, n = 20, to = null) => {
  const s = await where(name);
  const e = to ? await where(to) : { x: s.x + dx, y: s.y + dy };
  await page.mouse.move(s.x, s.y);
  await frames(2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(s.x + ((e.x - s.x) * k) / 8, s.y + ((e.y - s.y) * k) / 8);
    await frames(1);
  }
  await page.mouse.up();
  await frames(n);
};
const reachable = async (step) => {
  const off = await page.evaluate(() => window.__ui.offscreen());
  check(off.length === 0, `${step}: controls outside the viewport: ${JSON.stringify(off).slice(0, 160)}`);
};

const steps = {
  sunlight: async () => {
    const a = await read('sun1');
    check(near(a.airMass, 1.5, 0.01) && near(a.beamHorizontalWm2, 567, 2), `41,8° → AM 1,50 and 567 W/m² (got ${a.airMass}, ${a.beamHorizontalWm2})`);
    await slide('sun1', 0.2);
    check((await read('sun1')).airMass > 2, 'a low Sun should mean a long path through the air');
    await set('sun1', 90);
    const z = await read('sun1');
    check(near(z.airMass, 1, 0.005) && near(z.dniWm2, 953, 2), `zenith → AM 1,00 and ≈ 953 W/m² (got ${z.dniWm2})`);
    await click3d('bar1-0'); // pointer: the ultraviolet bar of the spectrum
    check((await read('sun1')).nm === 350, 'the pipette should take the 350 nm band');
    await click3d('bar1-7');
    check((await read('sun1')).nm === 1050, 'the pipette should take the 1050 nm band');
    check((await read('sun1')).focus === 'spectrum', 'a pick should bring the spectrum to the front');
    await slide('sun1', 0.6, 30);
    check((await read('sun1')).focus === 'air', 'moving the Sun should bring the air column back');
  },
  'pv-effect': async () => {
    check(near((await read('pv2')).usefulFraction, 0.5, 0.01), '550 nm → half of the photon energy is useful');
    await slide('lambda2', 0.75);
    await set('lambda2', 1200);
    const ir = await read('pv2');
    check(ir.absorbed === false && ir.usefulFraction === 0, 'a 1200 nm photon must pass through silicon');
    await set('lambda2', 400);
    check(near((await read('pv2')).usefulFraction, 0.36, 0.01), '400 nm → 36 % useful');
    await pick('field2', 'off');
    check((await read('pv2')).field === false, 'the built-in field should be off');
    await pick('field2', 'on');
    await clickUi('ctl-pie2');
    check((await read('pv2')).pie === true, 'the loss pie should appear');
  },
  cell: async () => {
    await pick('tech3', 'topcon');
    const t = await read('cell3');
    check(t.tech === 'topcon' && t.layers.length === 6, 'TOPCon has six layers in the cut');
    await click3d('tile3-bc'); // pointer: a miniature of the evolution strip
    const bc = await read('cell3');
    check(bc.tech === 'bc' && !bc.layers.includes('grid'), 'the back-contact cell has no front grid');
    await slide('explode3', 0.95);
    check((await read('cell3')).explode > 0.8, 'the layers should slide apart');
    await clickUi('ctl-micro3', 0.5, 0.5, 120);
    check((await read('cell3')).micro === true, 'the texture microscope should open');
  },
  module: async () => {
    // «Збери модуль» by hand: 6 in a row → drag bricks into a second row until it is 3 × 2
    await drag3d('brick4-5', 0, height * 0.12, 40);
    let c = (await read('module4')).circuit;
    check(c.series === 5 && c.parallel === 1 && c.loose === 1, `a brick dragged off the chain → 5 in series + 1 loose (got ${JSON.stringify(c)})`);
    check(near((await read('module4')).bricks.voltageV, 3.5, 1e-6), 'five bricks in series → 3,5 V');
    await drag3d('brick4-4', 0, 0, 40, 'brick4-5');
    await drag3d('brick4-3', 0, 0, 40, 'brick4-5');
    c = (await read('module4')).circuit;
    const b = (await read('module4')).bricks;
    check(c.series === 3 && c.parallel === 2 && near(b.voltageV, 2.1, 1e-6) && near(b.currentA, 14, 1e-6), `dragged to 3 × 2 → 2,1 V, 14 A (got ${JSON.stringify(c)}, ${b.voltageV} V)`);
    check((await value('bricks4')) === 's3p2', 'a hand-made 3 × 2 lights its preset button');
    await pick('bricks4', 'p6');
    const p = (await read('module4')).bricks;
    check(near(p.voltageV, 0.7, 1e-6) && near(p.currentA, 42, 1e-6), `6 in parallel → 0,7 V, 42 A (got ${p.voltageV}, ${p.currentA})`);
    await pick('bricks4', 's3p2');
    check(near((await read('module4')).bricks.voltageV, 2.1, 1e-6), '3 in series × 2 → 2,1 V');
    await drag3d('module4', 110, 0, 60); // pointer: turn the module
    check(Math.abs((await read('module4')).yaw) > 0.5, 'dragging should turn the module');
    await slide('explode4', 0.9, 40);
    check((await read('module4')).explode > 0.7, 'the laminate should come apart');
    await set('explode4', 0);
    await flip('sections4');
    check((await read('module4')).sections === true, 'the three diode sections should be outlined');
    await flip('back4', 150);
    check(Math.abs((await read('module4')).yaw) > 2.6, 'the module should show its back');
  },
  'iv-curve': async () => {
    const a = await read('bench5');
    check(near(a.v, 38.4, 0.1) && near(a.i, 3.84, 0.02), `10 Ω → 38,4 V, 3,84 A (got ${a.v}, ${a.i})`);
    await set('r5', 2.484);
    check(near((await read('bench5')).p, 439.9, 0.6), 'R = 2,484 Ω is the maximum power point: 439,9 W');
    await set('r5', 1);
    check(near((await read('bench5')).p, 193, 1.5), 'R = 1 Ω → 193 W');
    await drag3d('knob5', 90, 0); // pointer: the rheostat knob in the scene
    check((await read('bench5')).r > 1.5, 'dragging the knob should raise the resistance');
    await slide('r5', 0.3);
    await flip('line5');
    await clickUi('ctl-game5-start', 0.5, 0.5, 30);
    check((await read('bench5')).left > 18, 'the 20 s game should be running');
    await set('r5', 2.5, 60);
    await frames(1260);
    const g = await read('bench5');
    check(g.left === 0 && g.best > 430, `the game should end with the record kept (best ${g.best})`);
  },
  'light-and-heat': async () => {
    await set('g6', 200);
    check(near((await read('bench6')).p, 86.2, 0.6), '200 W/m², 25 °C → 86,2 W');
    await slide('g6', 0.6);
    await set('g6', 1000);
    await set('tc6', -10);
    const cold = await read('bench6');
    check(near(cold.p, 485.7, 1.5) && near(cold.voc, 42.85, 0.1), `−10 °C → 485,7 W, V_oc 42,85 V (got ${cold.p}, ${cold.voc})`);
    await slide('tc6', 0.9);
    await pick('mode6', 'nmot');
    await set('ta6', 20);
    await set('g6', 800);
    check(near((await read('bench6')).p, 331.4, 1.5), 'NMOT conditions (800 W/m², 20 °C air) → 331,4 W');
    await slide('ta6', 0.2);
    await clickUi('ctl-p6-july', 0.5, 0.5, 40);
    const july = await read('bench6');
    check(near(july.tc, 64.25, 0.1) && near(july.p, 387.7, 2), `July noon → cell 64 °C, ≈ 388 W (got ${july.tc}, ${july.p})`);
    await clickUi('ctl-p6-cloud', 0.5, 0.5, 40);
    check((await read('bench6')).g === 150, 'overcast preset → 150 W/m²');
    await clickUi('ctl-p6-frost', 0.5, 0.5, 40);
    check((await read('bench6')).voc > 40, 'frosty morning → V_oc above 40 V');
    await clickUi('ctl-p6-stc', 0.5, 0.5, 40);
    check(near((await read('bench6')).p, 439.9, 0.6), 'STC preset → 439,9 W');
  },
  shading: async () => {
    await click3d('cell7-0'); // pointer: paint one half-cell
    const one = await read('shade7');
    check(one.shaded === 1 && near(one.p, 287.9, 0.6) && one.diodes[0] === true, `one shaded half-cell → 287,9 W, diode 1 open (got ${one.p})`);
    check(one.maxima === 2 && one.hot[0]?.colour === 'orange', 'the curve should have two humps and an orange hot spot');
    await flip('bypass7');
    check(near((await read('shade7')).p, 243.0, 0.6), 'the same shade without diodes → 243,0 W');
    await pick('op7', 'short');
    const sc = await read('shade7');
    check(near(sc.op.v, 0, 0.01) && sc.hot[0]?.colour === 'red', 'short circuit without diodes → red hot spot');
    await pick('op7', 'mpp');
    await flip('bypass7');
    await drag3d('cell7-40', 0, 0, 20, 'cell7-70'); // pointer: paint a stroke across the cells
    check((await read('shade7')).shaded > 3, 'a stroke should shade several cells');
    await clickUi('ctl-clear7');
    check((await read('shade7')).shaded === 0, '«Прибрати всю тінь» should clear the module');
    for (const kind of ['leaf', 'stripe', 'snow', 'bird']) {
      await flip(`sh-${kind}`);
      check((await read('shade7')).shaded > 0, `the ${kind} silhouette should shade cells`);
      if (kind === 'leaf') {
        const before = JSON.stringify((await read('shade7')).sectionG);
        await drag3d('shape7-leaf', -140, 60); // pointer: drag the leaf over other cells
        check(JSON.stringify((await read('shade7')).sectionG) !== before, 'dragging the leaf should change the section currents');
      }
      await flip(`sh-${kind}`);
    }
    await click3d('cell7-0');
    await pick('scope7', 'string', 90);
    const str = await read('shade7');
    check(str.modules === 10 && str.p > 3000, `a string of ten should give kilowatts (got ${str.p})`);
    await flip('opt7');
    check((await read('shade7')).optimised > 4100, 'optimisers: losses only in the shaded module');
    await flip('opt7');
    await pick('scope7', 'module', 90);
  },
  orientation: async () => {
    await set('tilt8', 37);
    await set('az8', 0);
    check(near((await read('orient8')).specificYield, 1114, 0.5), '37° south → 1114 kWh/kWp');
    await set('az8', 180);
    check(near((await read('orient8')).specificYield, 547, 0.5), '37° north → 547 kWh/kWp');
    await slide('tilt8', 0.05);
    await slide('az8', 0.75);
    await set('tilt8', 30);
    await set('az8', 0);
    await drag3d('module8', 60, -40); // pointer: turn the test module
    const d = await read('orient8');
    check(d.azimuth !== 0 && d.tilt !== 30, `dragging the module should change azimuth and tilt (${d.azimuth}, ${d.tilt})`);
    await pick('day8', 'december21');
    check((await read('orient8')).day === 'december21', 'the December arc should be chosen');
    await flip('cities8-on');
    await set('tilt8', 50);
    await flip('snow8', 240);
    check((await read('orient8')).snow > 0.9, 'at 50° the snow should slide off');
    await clickUi('ctl-heat8', 0.3, 0.45, 30); // pointer: pick a point on the yield map
    const h = await read('orient8');
    check(h.azimuth < 0, `picking the left half of the map should give an eastern azimuth (got ${h.azimuth})`);
  },
  array: async () => {
    const a = await read('array9');
    check(a.a.n === 6 && near(a.a.check.vocColdV, 263.0, 0.1) && near(a.a.check.vmpHotV, 170.7, 0.1), '6 modules → 263,0 V cold V_oc, 170,7 V hot V_mp');
    await click3d('mod9-6'); // pointer: B → not connected
    check((await read('array9')).b.n === 5, 'tapping a module of string B should disconnect it');
    await click3d('mod9-6'); // → A
    check((await read('array9')).a.n === 7, 'tapping again should move it to string A');
    for (const i of [7, 8, 9, 10, 11]) {
      await click3d(`mod9-${i}`, 6);
      await click3d(`mod9-${i}`, 6);
    }
    const twelve = await read('array9');
    check(twelve.a.n === 12 && twelve.a.check.warnings.includes('overvoltage'), '12 modules in one string exceed 500 V in the frost');
    await clickUi('ctl-reset9');
    check((await read('array9')).a.n === 6, 'the reset should restore 2 × 6');
    await slide('tmin9', 0.1);
    check((await read('array9')).a.check.vocColdV > 264, 'a colder design temperature raises V_oc');
    await slide('tmax9', 0.95);
    check((await read('array9')).a.check.vmpHotV < 170, 'a hotter design temperature lowers V_mp');
    await flip('par9');
    check((await read('array9')).a.check.severity === 'red', 'two strings on one input exceed its current limits');
    await flip('par9');
    await clickUi('ctl-frost9', 0.5, 0.5, 300);
    const f = await read('array9');
    check(f.frost > 4 && f.vocNow > 230, `the frosty sunrise should drive V_oc up (got ${f.vocNow})`);
  },
  mppt: async () => {
    await frames(600);
    const m = await read('mppt10');
    check(m.v > 32.4 && m.v < 33.7 && m.p > 438, `P&O should settle around the MPP (got ${m.v} V, ${m.p} W)`);
    await slide('dv10', 0.8);
    await slide('hz10', 0.8);
    await set('dv10', 0.5);
    await clickUi('ctl-cloud10', 0.5, 0.5, 110);
    const c = await read('mppt10');
    check(c.cloud === true && c.g < 700, `the cloud should dim the light (G = ${c.g})`);
    await frames(300);
    await flip('shade10', 600);
    const s = await read('mppt10');
    check(near(s.pMpp, 287.9, 1) && s.v > 34, `partial shading: P&O sticks to the lower hump (v = ${s.v})`);
    await clickUi('ctl-scan10', 0.5, 0.5, 30);
    check((await read('mppt10')).scanning === true, 'the global scan should start');
    await frames(400);
    const g = await read('mppt10');
    check(g.v > 20.5 && g.v < 22.6 && g.p > 280, `the scan should jump to the higher hump (got ${g.v} V, ${g.p} W)`);
    await flip('fixed10', 30);
    check(near((await read('mppt10')).v, 30, 1e-6), 'fixed 30 V without MPPT');
    await flip('fixed10', 30);
    await flip('run10', 60);
    const paused = (await read('mppt10')).iterations;
    await frames(120);
    check((await read('mppt10')).iterations === paused, 'paused: the tracker should stop stepping');
  },
  lifecycle: async () => {
    await set('year11', 25);
    const l = await read('life11');
    check(near(l.energy, 26235, 2) && near(l.power, 0.894, 0.001), `25 years TOPCon → 26 235 kWh, 89,4 % (got ${l.energy})`);
    await slide('year11', 0.98);
    check((await read('life11')).year >= 28, 'the age slider should reach the end of the ribbon');
    await pick('tech11', 'perc');
    check((await read('life11')).power < 0.85, 'PERC ages faster');
    await flip('apart11', 60);
    check((await read('life11')).apart === true, 'the module should come apart into raw materials');
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'lab-pv/sunlight', freeze: 3 }));
  for (const [step, run] of Object.entries(steps)) {
    if (typeof args.only === 'string' && args.only !== step) continue;
    const before = failures.length;
    await goto(step);
    await reachable(step);
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
for (const n of notes) console.log(`  · ${n}`);
for (const f of failures) console.log(`  ✗ ${f}`);
console.log(failures.length ? `FAILED: ${failures.length} of ${checks} checks (${width}×${height})` : `PASS: ${checks} checks (${width}×${height})`);
process.exit(failures.length ? 1 : 0);
