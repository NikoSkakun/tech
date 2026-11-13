#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `current` (run on lenovo; dev server or production preview up):
//
//   QA_PORT=5242 node app/src/volumes/electricity/chapters/current/qa/interaction.mjs [--size 1280x720] [--only ohm]
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
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const read = (name) => page.evaluate((k) => window.__app.read(k), name);
const locate3d = (name) => page.evaluate((k) => window.__app.locate(k), name);
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto('current', s, { instant: true }), step);
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
  const b = typeof to === 'string' ? await locate3d(to) : a && { x: a.x + to[0], y: a.y + to[1] };
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
  current: async () => {
    let s = await read('current');
    check(
      near(s.amps, 0.3, 1e-9) && near(s.perSecond / 1e18, 1.87, 0.01),
      `0,3 A → 1,87×10¹⁸ e⁻/s (got ${s.perSecond})`,
    );
    check(s.passed > 0, 'the counter should run');
    await set('i1', 1);
    check(near((await read('current')).perSecond / 1e18, 6.24, 0.01), '1 A → 6,24×10¹⁸ e⁻/s');
    await clickUi('ctl-i1', null, 0.9, 0.72, 60); // pointer: dock slider far right
    s = await read('current');
    check(
      s.amps > 5 && s.lab === true,
      `slider right → large current from the lab supply (got ${s.amps} A, lab ${s.lab})`,
    );
    await toggle('arrows1');
    check((await read('current')).arrows === false, 'the electron arrow should hide');
    const before = (await read('current')).lens;
    await drag3d('lens1', [260, 40]);
    const after = (await read('current')).lens;
    check(
      before[0] !== after[0] || Math.abs(before[1] - after[1]) > 0.02,
      `the lens should slide along the wire (${before} → ${after})`,
    );
    await noOffscreen('current');
  },
  drift: async () => {
    await set('i2', 1);
    let s = await read('drift');
    check(
      near(s.driftMmS, 0.0735, 0.0005) && near(s.electronTimeS, 40800, 300) && near(s.signalNs, 14.3, 0.3),
      `1 A, 1 mm² → 0,074 mm/s, 11,3 h, 14 ns (got ${JSON.stringify(s)})`,
    );
    await seg('a2', '6');
    check(near((await read('drift')).driftMmS, 0.0735 / 6, 0.0005), '6 mm² → six times slower drift');
    await clickUi('ctl-i2', null, 0.9, 0.72);
    check((await read('drift')).driftMmS > 0.1, 'more current → faster drift');
    check((await read('drift')).lit === false, 'lamp is dark before the switch closes');
    await click3d('switch2', 120); // pointer: the knife switch itself
    s = await read('drift');
    check(
      s.front === 1 && s.lit === true && s.snailUm > 0,
      `the front arrives and the lamp lights (${JSON.stringify(s)})`,
    );
    await toggle('balls2', 150);
    s = await read('drift');
    check(s.analogy === true && s.pushes >= 1, `ball analogy pushes balls through (${s.pushes})`);
    await toggle('sw2', 20);
    check((await read('drift')).lit === false, 'opening the switch stops everything');
    await noOffscreen('drift');
  },
  'source-emf': async () => {
    let s = await read('source-emf');
    check(
      near(s.currentA, 0.0625, 1e-4) && near(s.powerW, 0.094, 0.001),
      `1,5 V → 62,5 mA, 94 mW (got ${s.currentA})`,
    );
    await set('emf3', 12);
    s = await read('source-emf');
    check(
      near(s.currentA, 0.5, 1e-6) && near(s.powerW, 6, 1e-6) && s.lab === true,
      '12 V → 0,5 A, 6 W from the lab supply',
    );
    check(s.a1 === s.a2 && s.a1.length > 0, `both ammeters agree (${s.a1} / ${s.a2})`);
    await clickUi('ctl-emf3', null, 0.3, 0.72);
    check((await read('source-emf')).emf < 12, 'the EMF slider follows the pointer');
    await toggle('water3', 120);
    s = await read('source-emf');
    check(s.analogy === true && s.flow > 0, 'water analogy on: water flows');
    await set('emf3', 0);
    check((await read('source-emf')).flow === 0, 'no pump force → no flow');
    await noOffscreen('source-emf');
  },
  ohm: async () => {
    let s = await read('ohm');
    check(
      near(s.resistanceOhm, 11.0, 0.01) && near(s.currentA, 0.182, 0.001),
      `nichrome 1 m × 0,1 mm² at 2 V → 11,0 Ω, 0,182 A (got ${s.resistanceOhm}, ${s.currentA})`,
    );
    const p0 = s.points;
    await press('rec4');
    check((await read('ohm')).points === p0 + 1, '«Записати точку» adds a point');
    for (const u of [4, 6, 8]) await set('u4', u, 6);
    check((await read('ohm')).points >= p0 + 3, 'moving U records points automatically');
    await clickUi('ctl-u4', null, 0.5, 0.72);
    check(near((await read('ohm')).voltageV, 6, 1.5), 'the U slider follows the pointer');
    await set('u4', 2);
    await seg('mat4', 'Cu');
    s = await read('ohm');
    check(
      s.constantCurrent === true && near(s.currentA, 3, 1e-6) && near(s.voltageV, 0.504, 0.002),
      `copper → current limit 3 A at 0,504 V (got ${s.currentA} A, ${s.voltageV} V)`,
    );
    await set('len4', 10);
    await set('area4', 0.01);
    check(near((await read('ohm')).resistanceOhm, 16.8, 0.05), 'Cu 10 m × 0,01 mm² → 16,8 Ω');
    const a0 = (await read('ohm')).ammeter;
    await press('swap4', 90);
    s = await read('ohm');
    check(s.side === 1 && s.ammeter === a0, `ammeter after the sample reads the same (${a0} → ${s.ammeter})`);
    await seg('kind4', 'lamp', 60);
    await set('u4', 6);
    s = await read('ohm');
    check(
      s.lampMode === true && near(s.resistanceOhm, 21.7, 0.1) && near(s.currentA, 0.276, 0.002),
      `lamp at 6 V → 21,7 Ω, 0,276 A (got ${s.resistanceOhm})`,
    );
    await press('clr4');
    check((await read('ohm')).points === 0, '«Очистити графік» removes the points');
    await noOffscreen('ohm');
  },
  circuit: async () => {
    check((await read('circuit')).lampCurrentA === 0, 'open circuit: no current');
    await click3d('switch5', 40); // pointer: the knife switch
    let s = await read('circuit');
    check(
      near(s.lampCurrentA, 0.288, 0.002) && near(s.lampV, 1.44, 0.01),
      `closed: 0,288 A, 1,44 V on the lamp (got ${s.lampCurrentA})`,
    );
    await drag3d('switch5', 'seat5:2', 80); // pointer: carry the switch to the place after the lamp
    s = await read('circuit');
    check(
      s.place === 2 && near(s.lampCurrentA, 0.288, 0.002), // still closed: a drag is not a tap
      `dragging the switch after the lamp: same current (got place ${s.place}, ${s.lampCurrentA} A)`,
    );
    await seg('pos5', '1', 80); // the dock alternative
    s = await read('circuit');
    check(s.place === 1 && near(s.lampCurrentA, 0.288, 0.002), 'the switch before the lamp: same current');
    await drag3d('jumper5', 'drop5:lamp', 50); // pointer: carry the jumper onto the lamp
    s = await read('circuit');
    check(s.jumper === 'lamp', `the jumper snaps onto the lamp (got ${s.jumper})`);
    check(
      s.fuseBlown === true && s.batteryCurrentA < 0.01,
      'short through the fuse: it blows and the current stops',
    );
    await seg('jumper5', 'none');
    await press('new5');
    check((await read('circuit')).fuseBlown === false, '«Новий запобіжник» restores the fuse');
    await toggle('fuse5');
    await seg('jumper5', 'lamp', 150);
    s = await read('circuit');
    check(
      s.installed === false &&
        s.batteryShorted === true &&
        near(s.batteryCurrentA, 7.14, 0.05) &&
        s.batteryTemperatureC > 30,
      `no fuse: 7,14 A and the cell heats (got ${s.batteryCurrentA} A, ${s.batteryTemperatureC} °C)`,
    );
    await seg('jumper5', 'none');
    await toggle('fuse5');
    await seg('jumper5', 'battery', 60);
    s = await read('circuit');
    check(
      s.fuseBlown === false && s.batteryShorted === true,
      'jumper on the battery bypasses the fuse: it stays whole, the cell is shorted',
    );
    await toggle('sw5', 20);
    await noOffscreen('circuit');
  },
  power: async () => {
    let s = await read('power');
    check(s.totalW === 10 && near(s.currentA, 10 / 230, 1e-4), 'only the LED lamp: 10 W');
    await click3d('appliance6:kettle'); // pointer: the kettle itself
    check((await read('power')).totalW === 2010, 'clicking the kettle switches it on (2010 W)');
    await set('time6', 0.5);
    await toggle('on6:led');
    s = await read('power');
    check(
      near(s.energyKWh, 1.0, 1e-6) && near(s.energyMJ, 3.6, 1e-6),
      `kettle for 30 min = 1,000 kWh = 3,6 MJ (got ${s.energyKWh})`,
    );
    await press('boil6', 720);
    s = await read('power');
    check(
      near(s.boiledKWh, 0.116, 0.001) && near(s.tempC, 100, 0.01),
      `boiling 1 L adds 0,116 kWh (got ${s.boiledKWh}, ${s.tempC} °C)`,
    );
    for (const id of ['led', 'charger', 'laptop', 'tv', 'microwave', 'heater']) await toggle(`on6:${id}`, 6);
    s = await read('power');
    check(
      s.totalW === 5395 && near(s.currentA, 23.46, 0.01) && s.breakerWouldTrip === true,
      `everything on: 5395 W, 23,5 A (got ${s.totalW} W)`,
    );
    await clickUi('ctl-time6', null, 0.95, 0.72);
    check((await read('power')).energyKWh > 20, 'the time slider follows the pointer');
    await noOffscreen('power');
  },
  'series-parallel': async () => {
    const part = async (id) => (await read('builder')).parts.find((p) => p.id === id);
    /** Real pointer tap on a part (at its body) or on a grid node. */
    const tapPart = async (id, n = 20) => {
      const p = await part(id);
      const s = await page.evaluate(([x, y, z]) => window.__app.project(x, y + 0.1, z), p.mid);
      await page.mouse.click(s.x, s.y);
      await frames(n);
    };
    const tapNode = (node) => click3d(`node7:${node}`, 12);
    await seg('preset7', 'mixed');
    let s = await read('builder');
    const r = Object.fromEntries(s.parts.map((p) => [p.id, p]));
    check(
      near(r.R1.amps, 3, 1e-4) &&
        near(r.R1.volts, 6, 1e-4) &&
        near(r.R2.amps, 1, 1e-4) &&
        near(r.R3.amps, 2, 1e-4),
      `mixed: 3 A, 6 V on 2 Ω, branches 1 A / 2 A (got ${r.R1.amps}, ${r.R2.amps}, ${r.R3.amps})`,
    );
    check(s.kcl < 1e-6, `KCL residual of the solver is zero (got ${s.kcl})`);
    await press('walk7', 420);
    s = await read('builder');
    check(
      s.kvl.includes('+12') && s.kvl.endsWith('= 0') && !s.walking,
      `«Обійти контур» sums to zero (got "${s.kvl}")`,
    );
    await seg('preset7', 'divider');
    check(
      near((await part('R1')).volts, 8, 1e-4) && near((await part('R2')).volts, 4, 1e-4),
      'divider: 8 V + 4 V',
    );
    await seg('tool7', 'hand');
    await tapPart('R2'); // pointer: select the 2 Ω resistor, then change it with the slider that appears
    check((await read('builder')).selected === 'R2', 'tapping a resistor selects it');
    await set('r7', 4);
    check(near((await part('R2')).volts, 6, 1e-4), '4 Ω + 4 Ω divide 12 V in halves');
    await tapPart('V1');
    await set('emf7', 6);
    check(near((await part('R1')).volts, 3, 1e-4), 'halving the EMF halves every voltage');
    await seg('preset7', 'garland');
    check(near((await part('L1')).amps, 0.5, 1e-4), 'garland: two lamps in series, 0,5 A');
    await tapPart('S1');
    check(
      (await part('S1')).closed === false && near((await part('L1')).amps, 0, 1e-9),
      'tapping the switch opens the circuit',
    );
    await tapPart('S1');
    await tapPart('L1'); // «перегоріти»
    check(
      (await part('L1')).burnt === true && near((await part('L2')).amps, 0, 1e-9),
      'one burnt lamp darkens the whole series chain',
    );
    await press('repair7');
    check(
      (await part('L1')).burnt === false && near((await part('L2')).amps, 0.5, 1e-4),
      '«Полагодити лампи» restores them',
    );
    // build a circuit by hand: clear, source, lamp and two wires → 12 V on one 6 V lamp burns it
    await press('clear7');
    check((await read('builder')).parts.length === 0, '«Очистити стіл» empties the table');
    for (const [tool, a, b] of [
      ['source', '1,0', '1,2'],
      ['wire', '1,0', '3,0'],
      ['lamp', '3,0', '3,2'],
      ['wire', '3,2', '1,2'],
    ]) {
      await seg('tool7', tool, 10);
      await tapNode(a);
      await tapNode(b);
    }
    s = await read('builder');
    check(
      s.parts.length === 4 && s.parts.some((p) => p.kind === 'lamp' && p.burnt),
      `hand-built 12 V on one lamp: it burns (${s.parts.map((p) => p.id + (p.burnt ? '✗' : '')).join(' ')})`,
    );
    // replace the lamp by a plain wire: short circuit, the source trips
    await seg('tool7', 'erase', 10);
    await tapPart('L1');
    await seg('tool7', 'wire', 10);
    await tapNode('3,0');
    await tapNode('3,2');
    s = await read('builder');
    check(
      s.short === true && s.parts.some((p) => p.tripped),
      'a loop of plain wire is a short circuit: the source trips',
    );
    await seg('tool7', 'erase', 10);
    await tapPart('W3');
    await press('reset7');
    check(
      (await read('builder')).short === false,
      'removing the wire and re-arming the source clears the alarm',
    );
    await seg('tool7', 'ammeter', 10);
    await tapNode('3,0');
    await tapNode('3,2');
    check(
      (await read('builder')).parts.some((p) => p.kind === 'ammeter'),
      'an ammeter can be placed',
    );
    await seg('tool7', 'hand', 10);
    // primary way (script): carry parts from the tray and drop them between two neighbouring nodes
    const dropOn = async (kind, a, b) => {
      const [t, p, q] = await Promise.all([`tray7:${kind}`, `node7:${a}`, `node7:${b}`].map(locate3d));
      await drag3d(`tray7:${kind}`, [(p.x + q.x) / 2 - t.x, (p.y + q.y) / 2 - t.y]);
    };
    await press('clear7');
    for (const [kind, a, b] of [
      ['source', '1,1', '1,2'],
      ['resistor', '1,1', '2,1'],
      ['wire', '2,1', '2,2'],
      ['wire', '2,2', '1,2'],
    ])
      await dropOn(kind, a, b);
    s = await read('builder');
    const res = s.parts.find((p) => p.kind === 'resistor');
    const src = s.parts.find((p) => p.kind === 'source');
    check(
      s.parts.length === 4 && res && src && res.amps > 0 && near(res.amps, src.emfV / res.ohm, 1e-4),
      `tray drag: source + resistor + 2 wires carry I = ℰ/R (got ${s.parts.map((p) => p.id).join(' ')}, ${res?.amps} A)`,
    );
    // drag a placed part off the board: it is removed
    {
      const m = await page.evaluate(([x, y, z]) => window.__app.project(x, y + 0.1, z), res.mid);
      const out = await locate3d('tray7:lamp');
      await page.mouse.move(m.x, m.y);
      await frames(2);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) {
        await page.mouse.move(m.x + ((out.x - m.x) * k) / 8, m.y + ((out.y - m.y) * k) / 8);
        await frames(2);
      }
      await page.mouse.up();
      await frames(20);
      s = await read('builder');
      check(
        s.parts.length === 3 && !s.parts.some((p) => p.kind === 'resistor'),
        `dragging the resistor off the board removes it (got ${s.parts.map((p) => p.id).join(' ')})`,
      );
    }
    await seg('preset7', 'series');
    await noOffscreen('series-parallel');
  },
  losses: async () => {
    let s = await read('losses');
    check(
      near(s.currentA, 10.07, 0.01) && near(s.loadW, 7.3, 0.1) && near(s.efficiency, 0.06, 0.001),
      `12 V: 10,07 A, 7,3 W arrive, η 6 % (got ${s.currentA}, ${s.loadW})`,
    );
    check(s.night < 0.2, 'the cottage stays dark at 12 V');
    await seg('u8', '230');
    s = await read('losses');
    check(
      near(s.loadW, 1841, 1) && near(s.lossW, 78, 0.5) && s.night > 0.9,
      `230 V: 1841 W arrive, 78 W lost (got ${s.loadW}, ${s.lossW})`,
    );
    await seg('a8', '2.5');
    check(near((await read('losses')).lossW, 48, 0.5), '2,5 mm²: 48 W lost');
    const ohm = (await read('losses')).lineOhm;
    await set('len8', 100);
    s = await read('losses');
    check(
      near(s.lineOhm, 2 * ohm, 1e-6) && s.rows === 9,
      `twice the length → twice the line resistance, longer cord on the table (rows ${s.rows})`,
    );
    await clickUi('ctl-len8', null, 0.08, 0.72);
    check((await read('losses')).rows < 9, 'the length slider follows the pointer');
    await seg('u8', '1000');
    check((await read('losses')).efficiency > 0.99, '1000 V: almost nothing is lost');
    await noOffscreen('losses');
  },
  measure: async () => {
    const value = async () => (await read('measure')).display;
    await seg('place9', 'battery', 40);
    let d = await value();
    check(
      d.kind === 'value' && near(d.value, 1.58, 0.005),
      `voltmeter on the fresh cell, no load: 1,58 V (got ${JSON.stringify(d)})`,
    );
    await click3d('switch9', 40); // pointer: the knife switch
    d = await value();
    check(near(d.value, 1.52, 0.005), `under load: 1,52 V (got ${d.value})`);
    await seg('mode9', 'ma', 10);
    let s = await read('measure');
    check(
      s.fuseBlown === true && s.display.kind === 'FUSE',
      'mA input across the battery: the meter fuse blows',
    );
    await seg('place9', 'link', 40);
    await press('fuse9');
    s = await read('measure');
    check(
      s.fuseBlown === false && near(s.display.value, 0.277, 0.001) && s.text.includes('277'),
      `in series, mA range: 277 mA (got ${s.text})`,
    );
    check(near(s.r, 0.217, 0.01), `the calculator works out r ≈ 0,2 Ω from U₀, U, I (got ${s.r})`);
    await seg('mode9', 'a10', 40);
    check(near((await value()).value, 0.303, 0.001), '10 A range in series: 0,303 A');
    await seg('place9', 'battery', 40);
    s = await read('measure');
    check(
      s.short === true && near(s.display.value, 7.52, 0.02),
      `10 A range across the cell is a short circuit: 7,52 A (got ${s.display.value})`,
    );
    await seg('mode9', 'ohm', 10);
    await seg('place9', 'lamp', 40);
    check((await value()).kind === 'error', 'ohmmeter on a live circuit: error');
    await toggle('sw9', 30);
    d = await value();
    check(
      d.kind === 'value' && near(d.value, 5, 0.01),
      `ohmmeter on the dead circuit: 5,0 Ω (got ${JSON.stringify(d)})`,
    );
    await seg('place9', 'switch', 40);
    check((await value()).kind === 'OL', 'open switch: OL');
    await seg('mode9', 'vac', 10);
    await seg('place9', 'battery', 40);
    check(near((await value()).value, 0, 1e-6), 'V~ on a battery shows 0');
    await seg('mode9', 'vdc', 10);
    await seg('bat9', 'flat', 10);
    await toggle('sw9', 30);
    check(near((await value()).value, 0.82, 0.005), 'flat cell under load: 0,82 V');
    await seg('mode9', 'off', 10);
    check((await value()).kind === 'off', 'OFF: blank display');
    await seg('mode9', 'vdc', 10);
    await seg('place9', 'park', 60);
    await drag3d('probe9:red', 'term9:La', 50); // pointer: carry the probes to the lamp by hand
    await drag3d('probe9:black', 'term9:Lb', 50);
    s = await read('measure');
    check(
      s.red === 'La' && s.black === 'Lb' && s.display.kind === 'value',
      `dragged probes snap to the lamp terminals (red ${s.red}, black ${s.black})`,
    );
    await noOffscreen('measure');
  },
  'dc-ac': async () => {
    let s = await read('dc-ac');
    check(
      s.mode === 'dc' && near(s.trace[0], 0.75, 1e-6) && near(s.trace[2], 0.75, 1e-6),
      'DC: a level line at 1,5 V',
    );
    await seg('mode10', 'ac', 60);
    s = await read('dc-ac');
    // a 40 ms screen holds two 50 Hz periods: the trace must reach close to ±325 V on the ±350 V scale
    const swing = s.traceSpan[1] - s.traceSpan[0];
    check(
      s.mode === 'ac' && swing > 1.7 && s.acAmp > 0,
      `AC: the trace swings ±325 V (span ${s.traceSpan.map((x) => x.toFixed(2))})`,
    );
    await set('sweep10', 100);
    check((await read('dc-ac')).sweepMs === 100, 'sweep of 100 ms per screen');
    await clickUi('ctl-sweep10', null, 0.1, 0.72);
    check((await read('dc-ac')).sweepMs < 40, 'the sweep slider follows the pointer');
    await toggle('on10', 240);
    s = await read('dc-ac');
    check(
      s.on === true && near(s.needleDeg, 78.7, 1),
      `5 A northward: the needle settles ≈ 79° to the west (got ${s.needleDeg})`,
    );
    await seg('dir10', 'south', 240);
    check(
      near((await read('dc-ac')).needleDeg, -78.7, 1),
      'reversed current: the needle swings to the other side',
    );
    await toggle('on10', 240);
    check(near((await read('dc-ac')).needleDeg, 0, 1), 'current off: the needle returns to north');
    await press('next10', 30); // the bridge: opens `magnetism` when it is built, else a toast
    const pos = await page.evaluate(() => window.__app.position());
    check(
      pos.chapterId === 'current' || pos.chapterId === 'magnetism',
      'the bridge button leaves the app in a valid place',
    );
    await noOffscreen('dc-ac');
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'current/current', freeze: 3 }));
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
