#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `lab-inverter` (run on lenovo; dev server or production preview):
//
//   QA_PORT=5244 node app/src/volumes/electricity/chapters/lab-inverter/qa/interaction.mjs [--size 1280x720] [--only pwm]
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
  await page.evaluate((s) => window.__app.goto('lab-inverter', s, { instant: true }), step);
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
  'why-inverter': async () => {
    const a = await probe();
    check(
      a.open > 0.95 && a.xray < 0.05,
      `the cover should be lifted and the view solid (open ${a.open}, xray ${a.xray})`,
    );
    await clickUi('ctl-xray1', 90); // pointer: dock toggle
    check((await probe()).xray > 0.9, '«Рентген» should leave only the current paths');
    await clickUi('ctl-xray1', 90);
    check((await probe()).xray < 0.1, '«Рентген» off should bring the parts back');
  },
  switches: async () => {
    const a = await probe();
    check(
      a.mode === 'tap' && near(a.pLoss, 1700, 1),
      `«Кран» 230 V, 10 A should burn 1700 W, got ${a.pLoss}`,
    );
    await clickUi('ctl-mode2:switch'); // pointer: segmented item
    const b = await probe();
    check(b.mode === 'switch' && near(b.pLoss, 16, 0.1), `«Ключ» at 20 kHz should lose 16 W, got ${b.pLoss}`);
    await set('f2', 100);
    check(near((await probe()).pLoss, 48, 0.5), '100 kHz should raise the switching loss (8 + 40 W)');
    await set('u2', 100);
    await set('i2', 20);
    check(near((await probe()).pOut, 2000, 1), 'P_out should follow U·I (100 V · 20 A)');
    await press('gate2', 60); // pointer: dock button
    const c = await probe();
    check(c.gateOn === false && c.gate < 0.05, `«Затвор» should close the channel (gate ${c.gate})`);
    await press('gate2', 20);
    check((await probe()).gateOn === true, '«Затвор» again should re-open it');
  },
  'h-bridge': async () => {
    const a = await probe(); // the step opens with S1 and S4 on
    check(
      a.polarity === '+U' && near(a.u, 325, 0.5) && near(a.i, 12.29, 0.1),
      `S1+S4 should give +U and 12,3 A (${a.polarity}, ${a.u}, ${a.i})`,
    );
    check(a.loop === 'S1+S4', `the current should run through S1 and S4, got «${a.loop}»`);
    await click3d('key-S1'); // pointer: keys on the 3D board
    await click3d('key-S4');
    check((await probe()).polarity === 'open', 'all keys off: the load is disconnected');
    await clickUi('ctl-s3'); // pointer: dock toggles
    await clickUi('ctl-s2', 40);
    const b = await probe();
    check(b.polarity === '-U' && b.i < -12, `S3+S2 should give −U (${b.polarity}, ${b.i})`);
    await clickUi('ctl-s3');
    await clickUi('ctl-s4', 40);
    check((await probe()).polarity === '0', 'S2+S4 should short the load: 0');
    await clickUi('ctl-s1', 20); // S1 with S2 on: the same leg
    const c = await probe();
    check(
      c.fault === false && c.keys[0] === '0',
      `protection should refuse S1 while S2 is on (keys ${c.keys})`,
    );
    await clickUi('ctl-prot3:off');
    await clickUi('ctl-s1', 6);
    check((await probe()).fault === true, 'without protection S1+S2 is a shoot-through');
    await frames(120);
    const d = await probe();
    check(
      d.fault === false && d.keys === '0000',
      `after 1,5 s the burnt keys are replaced and off (keys ${d.keys})`,
    );
    await clickUi('ctl-load3:motor');
    await set('dead3', 4, 5);
    await press('auto3', 5);
    let diodes = 0;
    let dead = 0;
    let plus = 0;
    let minus = 0;
    for (let k = 0; k < 60; k++) {
      await frames(8);
      const s = await probe();
      diodes += s.diodes > 0 ? 1 : 0;
      dead += s.dead ? 1 : 0;
      plus += s.u > 300 ? 1 : 0;
      minus += s.u < -300 ? 1 : 0;
    }
    check(plus > 5 && minus > 5, `«Автомат 50 Hz» should alternate +U and −U (${plus} / ${minus} samples)`);
    check(
      dead > 0 && diodes > 0,
      `with an RL load the diodes should carry the current in the dead time (${dead} dead, ${diodes} diode samples)`,
    );
    await press('auto3', 10);
    check((await probe()).auto === false, '«Автомат 50 Hz» again returns to manual');
  },
  pwm: async () => {
    const a = await probe();
    check(
      a.kind === 'spwm_uni' && near(a.thd, 0.757, 0.01) && near(a.u1, 229, 1.5),
      `unipolar PWM, m_a 0,81: THD ≈ 75,7 %, U₁ ≈ 229 V (${a.thd}, ${a.u1})`,
    );
    check(
      a.magnified === true && a.chart === true,
      'at 20 kHz the scope uses the 2 ms magnifier; the board chart exists',
    );
    await clickUi('ctl-wave4:square');
    const b = await probe();
    check(
      near(b.thd, 0.4834, 0.003) && near(b.u1, 292.6, 0.5),
      `square: THD 48,3 %, U₁ 292,6 V (${b.thd}, ${b.u1})`,
    );
    await clickUi('ctl-wave4:quasi');
    check(near((await probe()).thd, 0.3108, 0.003), 'modified sine, 120° pulse: THD 31,1 %');
    await set('width4', 134);
    check(near((await probe()).thd, 0.29, 0.003), '134° pulse: THD ≈ 29,0 % (the minimum)');
    await clickUi('ctl-wave4:spwm_bi');
    check(near((await probe()).thd, 1.43, 0.02), 'bipolar PWM: THD ≈ 143 %');
    await set('fc4', 1);
    const c = await probe();
    check(c.fc === 1000 && c.magnified === false, `1 kHz carrier: whole period on the scope (fc ${c.fc})`);
    await set('ma4', 0.5);
    check(near((await probe()).u1, 141.4, 1), 'm_a = 0,5 halves the fundamental: 141 V');
    const t0 = (await probe()).now;
    await frames(60);
    check((await probe()).now !== t0, 'the scope window keeps moving');
  },
  'lc-filter': async () => {
    // the form, carrier and m_a are shared with step 4: bring them to the document's reference case
    await clickUi('ctl-wave5:spwm_uni');
    await set('fc4', 20);
    await set('ma4', 0.81);
    const a = await probe();
    check(
      near(a.f0, 1299, 2) && a.thdAfter < 0.006 && near(a.u1After, 229.3, 1.5),
      `1,5 mH + 10 μF: f₀ 1299 Hz, THD after ≈ 0,4 % (${a.f0}, ${a.thdAfter}, ${a.u1After})`,
    );
    await set('l5', 0.5);
    await set('c5', 5);
    const b = await probe();
    check(
      near(b.f0, 3183, 5) && b.warning === 'too-small',
      `0,5 mH + 5 μF: f₀ 3183 Hz → «фільтр замалий» (${b.f0}, ${b.warning})`,
    );
    await set('l5', 5);
    await set('c5', 50);
    check(
      (await probe()).warning === 'oversized',
      '5 mH + 50 μF: resonance near 50 Hz → «фільтр зайвий і важкий»',
    );
    await set('l5', 1.5);
    await set('c5', 10);
    await set('dead5', 2);
    const c = await probe();
    check(near(c.thdAfter, 0.0765, 0.006), `2 μs of dead time: THD after ≈ 7,6 % (${c.thdAfter})`);
    await clickUi('ctl-comp5');
    check((await probe()).thdAfter < 0.006, 'compensation removes the dead-time error');
    await set('load5', 0);
    check((await probe()).load === 0, 'load slider reaches no-load');
    await set('load5', 2);
    await clickUi('ctl-wave5:square'); // pointer: segmented control on the board
    const d = await probe();
    check(
      d.kind === 'square' && near(d.thdAfter, 0.53, 0.06),
      `a filter does not rescue the square wave (THD after ${d.thdAfter})`,
    );
    await clickUi('ctl-wave5:spwm_uni');
  },
  'dc-link': async () => {
    const h = await probe();
    check(near(h.duty, 0.375, 0.001), '250 V → D = 0,375');
    check(h.hero === 'pv' && !h.lfShown, `panels: the boost stage is the hero (${h.hero})`);
    await set('uin6', 150);
    check(near((await probe()).duty, 0.625, 0.001), '150 V → D = 0,625');
    await set('uin6', 420);
    check((await probe()).duty === 0, '≥ 400 V: the boost stage rests (D = 0)');
    await clickUi('ctl-src6:bat');
    await set('load6', 0.6);
    const a = await probe();
    check(
      a.src === 'bat' && near(a.eta, 0.9049, 0.001) && a.batSpeed > 0,
      `battery → output at 600 W: η 90,5 % (${a.eta})`,
    );
    check(a.hero === 'bat', `battery: the camera moves to the battery converter (${a.hero})`);
    await clickUi('ctl-dir6:charge');
    const b = await probe();
    check(b.charging === true && b.batSpeed < 0, 'charging reverses the flow to the battery');
    await clickUi('ctl-arch6:lf', 90);
    const c = await probe();
    check(
      c.arch === 'lf' && c.hero === 'lf' && c.lfShown,
      `low-frequency architecture: the 48 V bridge → 50 Hz toroid chain appears (${c.hero}, ${c.lfShown})`,
    );
    await clickUi('ctl-arch6:hf', 90);
    check(!(await probe()).lfShown, 'back to the high-frequency inverter: the chain goes away');
  },
  'mppt-controller': async () => {
    await frames(600);
    const a = await probe();
    check(
      near(a.duty, 0.504, 0.012) && near(a.p, 2639, 12),
      `auto MPPT at STC: D ≈ 0,504, P ≈ 2639 W (${a.duty}, ${a.p})`,
    );
    await clickUi('ctl-auto7');
    await set('d7', 0.6, 30);
    const b = await probe();
    check(
      near(b.vPv, 160, 0.5) && b.p < a.p - 300,
      `manual D = 0,6 → 160 V on the string, below the peak (${b.vPv} V, ${b.p} W)`,
    );
    await set('g7', 500);
    check((await probe()).mpp < 1500, 'half the irradiance → a lower hill');
    await set('t7', 60);
    await set('g7', 1000);
    check((await probe()).mpp < 2400, 'hot modules lose power');
    await set('t7', 25);
    await clickUi('ctl-morning7', 300);
    const c = await probe();
    check(
      c.mode === 'two' && c.climbers === 2 && c.loss >= 0 && c.stack > 2,
      `«Ранок» puts two climbers on two stacked hills (${c.mode}, ${c.climbers}, ${c.stack})`,
    );
    await clickUi('ctl-single7', 200);
    const d = await probe();
    check(
      d.mode === 'shared' && d.climbers === 1,
      'one MPPT on both strings: one climber on the summed curve',
    );
    await clickUi('ctl-morning7', 30);
    await clickUi('ctl-auto7', 10);
    await clickUi('ctl-clip7', 900);
    const e = await probe();
    check(
      e.mode === 'clipping' && e.p <= 6000.5 && e.p > 5700,
      `«Обрізання»: the output stays at the 6 kW ceiling (${e.p})`,
    );
  },
  'grid-tie': async () => {
    const a = await probe();
    check(
      a.inSync === false && near(a.df, 0.4, 0.001),
      `50,40 Hz against the grid: no synchronism (Δf ${a.df})`,
    );
    await press('relay8', 20); // closing out of sync: a current surge
    const b = await probe();
    check(
      b.closed === true && b.soft === false && b.inrush > 50,
      `closing out of sync should give a surge (${b.inrush} A)`,
    );
    await frames(40);
    const b2 = await probe();
    check(
      b2.breaker === true && b2.closed === false,
      'the surge trips the protection: the relay opens again',
    );
    await press('again8', 20);
    await set('f8', 50.05);
    await set('phi8', 5, 10);
    check((await probe()).inSync === true, 'manual: Δf 0,05 Hz and Δφ 5° are within the limits');
    await set('f8', 50.4);
    await set('phi8', 90, 10);
    await press('pll8', 200);
    const c = await probe();
    check(
      c.pll === true && c.inSync === true && Math.abs(c.dphi) < 2,
      `the PLL should pull the phase in (Δφ ${c.dphi})`,
    );
    await press('relay8', 30);
    const d = await probe();
    check(d.closed === true && d.soft === true, 'in synchronism the relay closes softly');
    await set('p8', 6);
    check(near((await probe()).delta, 6.14, 0.1), 'P = 6 kW → δ ≈ 6,1°');
    await set('p8', 3);
    await set('q8', 1.14);
    check(near((await probe()).uInv, 235, 0.3), 'P = 3 kW, Q ≈ 1,14 kvar → U_inv ≈ 235 V');
    await set('p8', 6);
    await set('q8', 3);
    check((await probe()).qLimited === true, '√(P² + Q²) > 6 kVA: Q is limited');
    await press('grid8', 60);
    check((await probe()).trip === null, 'right after the grid is lost the inverter still drifts (island)');
    await frames(420);
    const e = await probe();
    check(
      near(e.trip, 0.6, 0.02) && e.closed === false && e.safe === true && e.powered === false,
      `anti-islanding trips in ≈ 0,6 s; grid-following: the house is dark (${e.trip}, ${e.powered})`,
    );
    await press('grid8', 20);
    const g = await probe();
    check(
      g.grid === true && g.waitS > 50 && g.closed === false,
      `grid back: ≈ 1 min of watching first (${g.waitS})`,
    );
    await frames(420);
    const h = await probe();
    check(
      h.waitS === 0 && h.closed === true && h.soft === true,
      'after the minute the inverter reconnects in sync',
    );
    await press('again8', 20);
    await clickUi('ctl-ctl8:forming');
    await press('pll8', 200);
    await press('relay8', 30);
    await press('grid8', 480);
    const f = await probe();
    check(
      f.forming === true && f.powered === true && f.safe === true,
      'grid-forming: after the trip the island keeps the house powered',
    );
  },
  'inverter-types': async () => {
    const a = await probe();
    check(
      a.type === 'hybrid' && a.lit === true && a.litCount === 5,
      `with the grid every house has light (${a.litCount})`,
    );
    await clickUi('ctl-grid9');
    check((await probe()).litCount === 2, 'blackout: only the off-grid and the hybrid houses stay lit');
    await click3d('exhibit-string', 90); // pointer: an exhibit on the shelf
    const b = await probe();
    check(
      b.type === 'string' && b.lit === false && b.running === false && b.front > 1,
      `the string inverter is silent in a blackout and steps forward (${b.front})`,
    );
    check(
      b.diagram === 'one-line-string' && b.relayOpen === true,
      `its one-line diagram floats over it, grid relay open (${b.diagram}, ${b.relayOpen})`,
    );
    await clickUi('ctl-type9:offgrid', 60);
    await clickUi('ctl-sun9');
    const c = await probe();
    check(
      c.type === 'offgrid' && c.sun === false && c.lit === true,
      'off-grid at night: the battery keeps the light on',
    );
    await press('compare9', 40);
    check((await probe()).compare === true, '«Порівняти» opens the comparison table');
    const board = await page.evaluate(() => window.__ui.locate('ctl-table9'));
    check(board !== null, 'the comparison table is on the board');
  },
  ups: async () => {
    check(near((await probe()).holdMs, 22.4, 0.1), '300 W → hold-up 22,4 ms');
    await clickUi('ctl-xray10', 10);
    check((await probe()).xray === true, '«Рентген» shows the inside of the three UPS classes');
    await clickUi('ctl-xray10', 10);
    check((await probe()).xray === false, '«Рентген» off: the scopes come back');
    await press('mains10', 300);
    const a = await probe();
    check(
      a.mains === false && a.alive === '111' && a.sources === 'battery,battery,battery',
      `8 ms < 22 ms: all three PCs survive (${a.alive})`,
    );
    await press('mains10', 60);
    await set('tr10', 30);
    await press('mains10', 500);
    const b = await probe();
    check(
      b.survives === '011' && b.transferMs.startsWith('30'),
      `30 ms > 22 ms: the PC on the offline UPS resets (${b.survives})`,
    );
    await press('mains10', 400);
    check((await probe()).alive === '111', 'with the mains back every PC runs again');
    await set('load10', 100);
    check(near((await probe()).holdMs, 67.1, 0.1), '100 W → hold-up 67,1 ms');
    await press('sag10', 200);
    const c = await probe();
    check(
      c.sag === true && c.sources === 'battery,avr,grid',
      `sag to 190 V: battery / AVR / unaffected (${c.sources})`,
    );
  },
  'three-phase-and-scale': async () => {
    await set('f11', 25);
    const a = await probe();
    check(a.rpm === 750 && near(a.powerW, 1375, 1), `25 Hz → 750 rpm and 1,4 kW (${a.rpm}, ${a.powerW})`);
    const s0 = a.spin;
    await frames(30);
    check((await probe()).spin > s0, 'the pump keeps turning');
    const expected = { 2: 0.4834, 3: 0.3108, 5: 0.176, 9: 0.0936, 21: 0.039, 101: 0.008 };
    for (const [n, thd] of Object.entries(expected)) {
      await clickUi(`ctl-levels11:${n}`, 10);
      const p = await probe();
      check(p.levels === Number(n) && near(p.thd, thd, 0.003), `${n} levels → THD ${thd} (got ${p.thd})`);
    }
  },
  choosing: async () => {
    // pointer: kettle, microwave, fridge from the tray (let each hop land: a toy in flight crosses the others)
    await click3d('toy-3', 40);
    await click3d('toy-4', 40);
    await click3d('toy-0', 4);
    const a = await probe();
    check(
      a.count === 3 && a.pRunW === 3350 && near(a.pW, 3950, 1),
      `kettle + microwave + fridge starting: 3950 W now, 3350 W running (${a.pW}, ${a.pRunW})`,
    );
    await frames(60);
    const b = await probe();
    check(near(b.pW, 3350, 1) && b.status === 'ok', 'after the start-up surge the load settles at 3350 W');
    await click3d('start-0', 3); // pointer: the fridge's own «Пуск» key over it
    check(near((await probe()).pW, 3950, 1), "the fridge's own «Пуск» key starts the fridge again (3950 W)");
    await frames(60);
    await press('start12', 3);
    check((await probe()).pW > 3900, '«Пуск» starts the motors again (surge)');
    await click3d('toy-4', 20); // microwave and fridge back to the tray, then 3 kettles + the pump
    await click3d('toy-0', 20);
    await click3d('toy-10', 40);
    await click3d('toy-11', 40);
    await click3d('toy-1', 3);
    const c = await probe();
    check(
      c.pRunW === 7000 && c.status === 'overload-timer',
      `3 kettles + pump: 7 kW running, the 10 s timer runs (${c.pRunW}, ${c.status})`,
    );
    await frames(640);
    const d = await probe();
    check(
      d.status === 'tripped' && d.trip === 'overload-10s',
      `10 s above the rating → trip (${d.status}, ${d.trip})`,
    );
    await press('clear12', 400);
    const e = await probe();
    check(e.count === 0 && e.status === 'ok', 'cleared: the inverter restarts after 5 s');
    await click3d('toy-9', 30); // gas boiler and the pump on a modified sine
    await click3d('toy-1', 60);
    await clickUi('ctl-sine12:mod', 20);
    const f = await probe();
    check(
      f.modified === true && f.verdicts.includes('fault') && f.verdicts.includes('warn'),
      `modified sine: boiler fault, pump warning (${f.verdicts})`,
    );
    // drag and drop: the laptop from the tray onto the platform, then back onto the tray
    await drag3d('toy-5', 'platform');
    check(
      (await probe()).onPlatform.split(',').includes('laptop'),
      'dragged onto the platform: the laptop is on',
    );
    await drag3d('toy-5', 'toy-7');
    check(
      !(await probe()).onPlatform.split(',').includes('laptop'),
      'dragged back to the tray: the laptop is off',
    );
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'lab-inverter/why-inverter', freeze: 3 }));
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
