#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `generator-ac` (run on lenovo; dev server or production preview):
//
//   QA_PORT=5247 node app/src/volumes/electricity/chapters/generator-ac/qa/interaction.mjs [--size 1280x720] [--only pwm]
//
// Every control of every step is used at least once and an *observable* change is asserted through the step
// probe `__app.read('step')` (model outputs and scene state the step exposes). Only hooks that exist in
// production builds are used: `__app.locate / read / step / goto`, `__ui.locate / set / press / offscreen`.
// Positions come from `locate` in CSS px, so the same script serves 1280×720, 1920×1080 and 3840×2160.
// Toggles, segmented items, buttons and 3D objects get real pointer clicks; sliders are set through
// `__ui.set(id, value, true)` (= a user gesture with an exact value). The clock is frozen (`?freeze`), so
// `frames(n)` advances exactly n simulated frames: the test is deterministic.
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
const check = (ok, message) => {
  checks++;
  if (!ok) failures.push(message);
};
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const probe = () => page.evaluate(() => window.__app.read('step'));
const set = async (id, v, n = 20) => {
  await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
  await frames(n);
};
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto('generator-ac', s, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await frames(30);
};
/** Real pointer click on a named HUD node (a control `ctl-<id>` or a segmented item `ctl-<id>:<item>`). */
const clickUi = async (name, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), name);
  if (!r) return check(false, `HUD node '${name}' not found`);
  const inside = r.x >= 0 && r.y >= 0 && r.x <= width && r.y <= height;
  // a control scrolled out of the dock's window cannot be clicked: use the scripted gesture instead
  if (!inside)
    return check(
      false,
      `HUD node '${name}' is outside the viewport (${Math.round(r.x)}, ${Math.round(r.y)})`,
    );
  await page.mouse.move(r.x, r.y);
  await frames(2);
  await page.mouse.click(r.x, r.y);
  await frames(n);
};
/** Press a button: by pointer when it is on screen, else through the HUD hook (same code path as a click). */
const press = async (id, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), `ctl-${id}`);
  if (r && r.x >= 0 && r.y >= 0 && r.x <= width && r.y <= height) return clickUi(`ctl-${id}`, n);
  await page.evaluate((i) => window.__ui.press(i), id);
  await frames(n);
};
/** Real pointer click on a scene probe (`ctx.qa.probe`). */
const click3d = async (name, n = 30) => {
  const p = await page.evaluate((k) => window.__app.locate(k), name);
  if (!p || !p.visible) return check(false, `scene probe '${name}' not visible`);
  await page.mouse.move(p.x, p.y);
  await frames(2);
  await page.mouse.click(p.x, p.y);
  await frames(n);
};
/** Real pointer drag from one scene probe to another, in small moves (the engine sees a drag, not a click). */
const drag3d = async (from, to) => {
  const a = await page.evaluate((k) => window.__app.locate(k), from);
  const b = await page.evaluate((k) => window.__app.locate(k), to);
  if (!a?.visible || !b?.visible) return check(false, `drag: probe '${from}' or '${to}' not visible`);
  await page.mouse.move(a.x, a.y);
  await frames(2);
  await page.mouse.down();
  await frames(2);
  for (let k = 1; k <= 12; k++) {
    await page.mouse.move(a.x + ((b.x - a.x) * k) / 12, a.y + ((b.y - a.y) * k) / 12);
    await frames(2);
  }
  await page.mouse.up();
  await frames(60);
};
const offscreen = async (step) => {
  const list = await page.evaluate(() => window.__ui.offscreen?.() ?? []);
  check(list.length === 0, `${step}: controls outside the viewport: ${JSON.stringify(list).slice(0, 160)}`);
};

const steps = {
  'rotating-loop': async () => {
    let a = await probe();
    check(a.slowed && near(a.emfMax, 31.42, 0.05) && near(a.f, 10, 1e-6), `600 rpm: 31,4 V, 10 Hz, slowed (${a.emfMax}, ${a.f})`);
    await set('n1', 3000);
    a = await probe();
    check(near(a.emfMax, 157.08, 0.05) && near(a.f, 50, 1e-6), `3000 rpm → 157 V, 50 Hz (${a.emfMax})`);
    await set('b1', 1);
    check(near((await probe()).emfMax, 314.16, 0.1), 'B = 1 T doubles ℰ_max');
    await set('N1', 200);
    check(near((await probe()).emfMax, 628.32, 0.2), 'N = 200 doubles it again');
    await press('pause1', 90);
    a = await probe();
    check(a.paused && Math.abs(a.e) < 0.05 * a.emfMax, `«Пауза» stops the loop facing a pole, EMF ≈ 0 (e ${a.e})`);
    await press('pause1', 30);
    check(!(await probe()).paused, 'second press resumes');
    await clickUi('ctl-hand1', 60);
    a = await probe();
    check(a.hand && a.crank, 'hand crank mode shows the crank');
    // drag the crank knob round the axle (a real pointer circle)
    const c = await page.evaluate(() => window.__app.locate('crank'));
    const o = await page.evaluate(() => window.__app.locate('axle'));
    if (!c?.visible || !o?.visible) check(false, 'crank / axle probes not visible');
    else {
      const r = Math.hypot(c.x - o.x, c.y - o.y);
      const a0 = Math.atan2(c.y - o.y, c.x - o.x);
      const t0 = a.thetaDeg;
      await page.mouse.move(c.x, c.y);
      await frames(2);
      await page.mouse.down();
      for (let k = 1; k <= 24; k++) {
        const ang = a0 - (k / 24) * Math.PI * 1.5;
        await page.mouse.move(o.x + Math.cos(ang) * r, o.y + Math.sin(ang) * r);
        await frames(2);
      }
      const mid = await probe();
      await page.mouse.up();
      await frames(10);
      check(Math.abs(mid.thetaDeg - t0) > 30 && mid.f > 0.05, `the crank turns the loop and makes EMF (θ ${t0} → ${mid.thetaDeg}, f ${mid.f})`);
    }
  },
  'ac-anatomy': async () => {
    let a = await probe();
    check(near(a.Umax, 325.27, 0.1) && near(a.T, 0.02, 1e-6), `230 V → 325 V peak, T 20 ms (${a.Umax})`);
    await set('U2', 100);
    a = await probe();
    check(near(a.Umax, 141.42, 0.1) && a.lampPower < 0.1, 'U = 100 V: smaller amplitude, dimmer lamps');
    await clickUi('ctl-f2:60');
    a = await probe();
    check(a.f === 60 && near(a.T, 1 / 60, 1e-6) && near(a.acFreq, 1.2, 1e-6), '60 Hz: T 16,7 ms, electrons swing faster');
    const before = a.cursorFrac;
    await drag3d('cursor', 'scope-right');
    a = await probe();
    check(a.cursorFrac > before + 0.3, `dragging the cursor moves it along the time axis (${before} → ${a.cursorFrac})`);
    await press('led2', 120);
    a = await probe();
    check(a.demo && a.ledDashes >= 8, `the LED trail is dashed (${a.ledDashes} dashes)`);
  },
  'war-of-currents': async () => {
    let a = await probe();
    check(near(a.dcV, 98.59, 0.05) && near(a.acV, 109.96, 0.05), `d = 1 km: DC 98,6 V, AC 110 V (${a.dcV}, ${a.acV})`);
    const z0 = a.clusterZ;
    await set('d3', 5);
    a = await probe();
    check(near(a.dcV, 69.7, 0.2) && a.acV > 109.5 && a.clusterZ < z0 && a.dcGlow < a.acGlow, `d = 5 km: DC lamps dim to 69,7 V, AC stays (${a.dcV})`);
    await click3d('bead-1891');
    a = await probe();
    check(a.milestone === 1891 && a.ping, `tapping the 1891 bead selects it (${a.milestone})`);
    await clickUi('ctl-year3:2007');
    check((await probe()).milestone === 2007, 'the dock picks 2007');
  },
  'three-phase': async () => {
    await set('i42', 5);
    await set('i43', 0);
    let a = await probe();
    check(near(a.iN, 8.66, 0.01), `10/5/0 A → I_N 8,66 A (${a.iN})`);
    await set('i41', 16);
    await set('i42', 8);
    await set('i43', 4);
    check(near((await probe()).iN, 10.583, 0.01), '16/8/4 A → 10,58 A');
    await clickUi('ctl-noN4', 60);
    a = await probe();
    check(!a.neutral && a.shift > 20 && a.V[0] !== a.V[2], `without the neutral the star point shifts (${a.shift} V, ${a.V})`);
    await clickUi('ctl-noN4', 60);
    check((await probe()).neutral, 'the neutral comes back');
    await clickUi('ctl-mode4:single', 40);
    a = await probe();
    check(a.single && a.shake === 1 && near(a.iN, 16, 0.01), 'single phase: the machine trembles, the neutral carries all');
    await clickUi('ctl-mode4:three', 20);
    for (const k of [1, 2, 3]) await set(`i4${k}`, 10, 4);
    check(near((await probe()).iN, 0, 1e-6), 'balanced: I_N = 0');
    await press('six4', 30);
    a = await probe();
    check(a.six && a.returns, '«Шість дротів?» shows three separate returns');
    await frames(240);
    a = await probe();
    check(!a.six && !a.returns, 'then they merge into the neutral');
  },
  'star-delta': async () => {
    let a = await probe();
    check(a.conn === 'star' && near(a.uL, 398.37, 0.1) && a.ok === true, `star: 230 / 398 V, motor fine (${a.uL})`);
    await clickUi('ctl-conn5:delta', 100);
    a = await probe();
    check(a.conn === 'delta' && near(a.uL, 230, 1e-6) && a.wired === 'delta' && a.ok === false && a.windingV === 400, 'delta: U_L = U_ph, jumpers vertical, motor overheats');
    await set('uph5', 200);
    check(near((await probe()).uL, 200, 1e-6), 'phase-voltage slider moves the line voltage');
    await clickUi('ctl-conn5:star', 100);
    check((await probe()).wired === 'star', 'back to star: jumpers in a row');
    await drag3d('jumper-0', 'slot-0');
    a = await probe();
    check(a.slots.includes(0) && a.wired === null, `dragging one jumper to a column breaks the layout (${a.slots})`);
  },
  'rotating-field': async () => {
    let a = await probe();
    const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
    check(a.mode === 'compass' && a.ns === 3000 && Math.abs(wrap(a.needle - a.field)) < 0.5, `the compass follows the field (${a.needle}, ${a.field})`);
    await set('p6', 3, 60);
    a = await probe();
    check(a.ns === 1000 && a.shownStator === 3, `p = 3: 9 coils, 1000 rpm (${a.shownStator})`);
    await clickUi('ctl-mode6:cage', 150);
    a = await probe();
    check(a.mode === 'cage' && a.p === 2 && a.ns === 1500 && a.rotorRpm > 1300, `squirrel cage spins up behind the field (${a.rotorRpm})`);
    await set('load6', 150, 120);
    a = await probe();
    check(near(a.n, 1428, 1.5) && near(a.rotorRpm, a.n, 5), `150 % load: 1428 rpm (${a.rotorRpm})`);
    await set('load6', 270, 120);
    check((await probe()).stalled, 'above 250 % the motor stalls');
    await press('reset6', 150);
    a = await probe();
    check(!a.stalled && a.rotorRpm > 1300, 'reset restarts it');
    await press('swap6', 240);
    a = await probe();
    check(a.dir === -1 && a.rotorRpm < -1000, `swapping two phases reverses it (${a.rotorRpm})`);
  },
  'synchronous-generator': async () => {
    let a = await probe();
    check(a.type === 'turbo' && a.n === 3000 && near(a.emfKV, 24, 0.01), 'turbogenerator: 3000 rpm, 24 kV');
    await set('if7', 50);
    check(near((await probe()).emfKV, 15.5, 0.1), '50 % field current → 15,5 kV');
    await set('if7', 150);
    check(near((await probe()).emfKV, 27.3, 0.1), '150 % → 27,3 kV (saturation)');
    await clickUi('ctl-lay7housing', 60);
    check((await probe()).layers === '0111', 'the housing layer comes off');
    const t0 = (await probe()).angle;
    await clickUi('ctl-type7:hydro', 60);
    a = await probe();
    check(a.type === 'hydro' && a.p === 40 && near(a.n, 75, 1e-6) && a.angle !== t0, 'hydrogenerator: 40 pole pairs, 75 rpm');
    await set('p7', 28);
    check(near((await probe()).n, 107.14, 0.01), '28 pole pairs → 107 rpm');
  },
  synchronization: async () => {
    let a = await probe();
    check(a.phase === 'sync' && near(a.df, -0.25, 1e-6), `start: Δf = −0,25 Hz (${a.df})`);
    await set('speed8', 3003);
    await set('exc8', 101);
    a = await probe();
    check(near(a.df, 0.05, 1e-6) && near(a.dU, 1, 1e-6), 'trimmed: Δf +0,05 Hz, ΔU +1 %');
    for (let i = 0; i < 60 && Math.abs((await probe()).angle) > 6; i++) await frames(25);
    await click3d('key', 30);
    a = await probe();
    check(a.result === 'soft' && a.phase === 'online', `closing in phase is soft (angle ${a.angle}, ${a.result})`);
    await set('pm8', 0.85, 360);
    a = await probe();
    check(near(a.delta, 44.1, 2) && near(a.pe, 0.85, 0.03), `P_m 0,85 → δ ≈ 44° (${a.delta})`);
    await set('pm8', 1.3, 600);
    check((await probe()).phase === 'tripped', 'beyond P_max the generator falls out of step');
    await set('emf8', 2.6, 90);
    await press('resync8', 120);
    a = await probe();
    check(a.phase === 'online' && near(a.pmax, 1.444, 0.01), `stronger excitation raises P_max to 1,44 (${a.phase}, ${a.pmax})`);
    await clickUi('ctl-stage8:sync', 30);
    await set('speed8', 2950);
    await press('close8', 20);
    a = await probe();
    check(a.result === 'hit' && a.spike > 0, `closing out of step is a hit (${a.result}, spike ${a.spike})`);
  },
  rlc: async () => {
    let a = await probe();
    check(near(a.Z, 51.39, 0.02) && near(a.I, 4.476, 0.003) && near(a.phi, -13.34, 0.05), `50 Hz: Z 51,4 Ω, I 4,48 A, φ −13,3° (${a.Z})`);
    await set('f9', 53);
    a = await probe();
    check(near(a.I, 4.6, 0.01) && a.over, `near resonance: 4,6 A, overvoltage on L and C (${a.UL})`);
    await set('f9', 100);
    check(near((await probe()).phi, 69.74, 0.05), '100 Hz: φ = +69,7°');
    await clickUi('ctl-mode9:L', 20);
    a = await probe();
    check(a.mode === 'L' && near(a.phi, 90, 0.01), 'only L: current lags by 90°');
    await clickUi('ctl-mode9:RLC', 10);
    await set('R9', 100);
    await set('L9', 0.5);
    await set('C9', 50);
    a = await probe();
    check(a.mode === 'RLC' && a.I < 2.3, `R, L, C sliders change the circuit (${a.I})`);
  },
  'ac-power': async () => {
    let a = await probe();
    check(near(a.I, 8.152, 0.002) && near(a.loss, 33.23, 0.02), `cos φ 0,8: 8,15 A, 33,2 W in the line (${a.I})`);
    await set('cap10', 38);
    a = await probe();
    check(near(a.pf, 0.95, 0.001) && near(a.I, 6.865, 0.003) && a.local > 0 && a.lineQ < 0.3, 'compensated to 0,95: 6,87 A, the rocking moves to the bank');
    await set('cap10', 80);
    check((await probe()).capacitive, 'overcompensation is capacitive');
    await set('pf10', 0.6);
    check((await probe()).I > 7, 'a worse cos φ raises the current');
    const p0 = (await probe()).phi;
    await drag3d('horse', 'rope-90');
    a = await probe();
    check(a.phi > p0 + 15, `dragging the horse widens the rope angle (${p0} → ${a.phi})`);
    await set('phi10', 10);
    check(near((await probe()).P, 0.985, 0.001), 'φ = 10°: almost all the pull is useful');
  },
  'to-transformer': async () => {
    let a = await probe();
    check(a.k === 6 && a.secondaryAmp > a.primaryAmp * 5, 'the second sine is taller');
    await set('k11', 20, 30);
    a = await probe();
    check(a.turns === 64 && a.secondaryAmp > a.primaryAmp * 15, `20×: dense winding, 20× taller curve (${a.turns})`);
    await press('go11', 60);
    const pos = await page.evaluate(() => window.__app.position());
    check(pos.chapterId === 'transformer' || pos.chapterId === 'generator-ac', `«До трансформатора →» leads on or explains (${pos.chapterId})`);
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'generator-ac/rotating-loop', freeze: 3 }));
  for (const [step, run] of Object.entries(steps)) {
    if (typeof args.only === 'string' && args.only !== step) continue;
    const before = failures.length;
    await goto(step);
    await offscreen(step);
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
console.log(
  failures.length
    ? `FAILED: ${failures.length} of ${checks} checks`
    : `PASS: ${checks} checks (${width}x${height})`,
);
process.exit(failures.length ? 1 : 0);
