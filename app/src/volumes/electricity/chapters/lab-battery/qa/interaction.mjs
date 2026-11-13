#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `lab-battery` (run on lenovo, dev server up):
//
//   QA_PORT=5223 node app/src/volumes/electricity/chapters/lab-battery/qa/interaction.mjs [--size 1280x720] [--only safety]
//
// Every control of every step is used at least once and an *observable* change is asserted through
// `window.__lab.probe()` (state the step module exposes: simulation outputs, scene amounts, world points).
// Controls are driven the way a user would where the HUD lets a test find them — real pointer clicks on dock
// sliders / toggles / buttons (`__ui.locate('ctl-<id>')`) and on 3D objects (`__app.project`) — and through
// `__lab.drive / press` for segmented controls and board widgets (they have no locatable node name).
// The clock is frozen (`?freeze`), so `frames(n)` advances exactly n simulated frames: the test is deterministic.
import { appErrors, appUrl, baseUrl, launch, openApp, parseArgs, parseSize } from '../../../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const failures = [];
let checks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) failures.push(message);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const probe = () => page.evaluate(() => window.__lab.probe());
const value = (id) => page.evaluate((i) => window.__lab.value(i), id);
const drive = async (id, v, n = 30) => {
  await page.evaluate(([i, x]) => window.__lab.drive(i, x), [id, v]);
  await frames(n);
};
const press = async (id, n = 30) => {
  await page.evaluate((i) => window.__lab.press(i), id);
  await frames(n);
};
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto('lab-battery', s, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await frames(20);
};
/** Real pointer click on a named HUD node; `fx`, `fy` pick a point inside its box (0…1). */
const clickUi = async (name, fx = 0.5, fy = 0.5, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), name);
  if (!r) return check(false, `HUD node '${name}' not found`);
  await page.mouse.click(r.x + (fx - 0.5) * r.w, r.y + (fy - 0.5) * r.h);
  await frames(n);
};
/** Real pointer click / drag on a world point. */
const screenOf = (p) => page.evaluate(([x, y, z]) => window.__app.project(x, y, z), p);
const click3d = async (point, n = 30) => {
  const s = await screenOf(point);
  await page.mouse.move(s.x, s.y);
  await frames(2);
  await page.mouse.click(s.x, s.y);
  await frames(n);
};
const drag3d = async (point, dx, dy, n = 20) => {
  const s = await screenOf(point);
  await page.mouse.move(s.x, s.y);
  await frames(2);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) {
    await page.mouse.move(s.x + (dx * k) / 6, s.y + (dy * k) / 6);
    await frames(1);
  }
  await page.mouse.up();
  await frames(n);
};

const steps = {
  'what-is-battery': async () => {
    const a = await probe();
    check(near(a.emfV, 1.1, 0.005), `Zn–Cu should give 1,10 V, got ${a.emfV}`);
    await click3d(a.rungLi); // pointer: a rung of the ladder
    const b = await probe();
    check(b.pair.includes('Li') && near(b.emfV, 3.38, 0.005), `click on Li: expected Li–Cu 3,38 V, got ${b.pair} ${b.emfV}`);
    await click3d(a.rungAg);
    check((await probe()).pair === 'Li-Ag', 'click on Ag: the older choice (Cu) should be replaced');
    await drive('mode1', 'charge');
    check((await probe()).charging === true, 'mode «Заряд» should reverse the cell');
  },
  'cell-anatomy': async () => {
    await clickUi('ctl-unroll', 0.85, 0.72, 240); // pointer: dock slider
    check((await value('unroll')) > 50, `slider click should set «Розмотати» > 50 %, got ${await value('unroll')}`);
    check((await probe()).unrolled > 0.5, 'the roll should unroll with the slider');
    await drive('format2', '4680', 60);
    const b = await probe();
    check(b.sx > 2 && (await value('unroll')) === 0, `4680 should widen the hero and rewind the roll (sx ${b.sx})`);
    check(near(b.wh, 86.4, 0.1), `4680 energy should be 86,4 Wh, got ${b.wh}`);
    await clickUi('ctl-capCut', 0.5, 0.5, 90); // pointer: dock button
    const c = await probe();
    check(c.cap > 0.9 && c.format === '21700', `«Розріз кришки» should open the header of the 21700 (cap ${c.cap}, ${c.format})`);
  },
  intercalation: async () => {
    const a = await probe();
    await frames(120);
    const b = await probe();
    check(b.soc > a.soc && b.current > 0, 'charging: SOC should rise');
    await drive('mode3', 'pause', 10);
    const c = await probe();
    await frames(60);
    check((await probe()).soc === c.soc, 'pause: SOC should hold');
    await drive('current3', 2, 5);
    await drive('mode3', 'discharge', 60);
    const d = await probe();
    check(d.soc < c.soc && d.current === -2, `discharge at 2 C: SOC should fall (current ${d.current})`);
    await clickUi('ctl-cold3', 0.1, 0.5, 20); // pointer: dock toggle
    const e = await probe();
    check(e.plating === true && (await value('current3')) === 3, '«Швидко на морозі» should force 3 C and plating');
  },
  'why-lithium': async () => {
    const a = await probe();
    check(near(a.lead, 125, 1) && near(a.nmc, 20, 0.5), `5 kWh: lead 125 kg, NMC 20 kg (got ${a.lead}, ${a.nmc})`);
    await drive('energy4', 10, 120);
    check(near((await probe()).lead, 250, 3), '10 kWh of lead-acid should weigh 250 kg');
    await clickUi('ctl-usable4', 0.1, 0.5, 120); // pointer: dock toggle
    const c = await probe();
    check((await value('usable4')) === true && near(c.lead, 500, 6) && near(c.lfp, 69.4, 1), `«корисні»: 500 kg / 69,4 kg (got ${c.lead}, ${c.lfp})`);
  },
  chemistries: async () => {
    const a = await probe();
    await click3d(a.pedestalLTO); // pointer: a pedestal
    check((await probe()).current === 'LTO', 'click on the LTO pedestal should select LTO');
    await drive('compare5', true);
    check((await probe()).shown.includes('+'), '«Порівняти дві» should show two polygons');
    await drive('task5', 'bus');
    check((await probe()).verdict === 'good', 'LTO for the city bus should be «добре»');
    await drive('chem5', 'LCO');
    check((await probe()).verdict === 'bad', 'LCO for the city bus should be «погано»');
  },
  'voltage-capacity': async () => {
    await frames(60);
    const a = await probe();
    check(a.ah > 0 && a.runs.includes('21700-NMC@0.5'), `entering the step should start a 0,5 C run (${a.runs})`);
    await drive('current6', 2.5, 5);
    await drive('cell6', 'LFP-100', 5);
    await drive('temp6', -20, 30);
    await drive('ocv6', true, 5);
    await press('run6', 120);
    const b = await probe();
    check(b.runs === 'LFP-100@2.5' && b.over === true, `2,5 C on LFP-100 should run with the over-current chip (${b.runs}, ${b.over})`);
    check(b.temperature === -20 && b.ocv === true && b.volts < 3.2, `cold chamber and OCV toggle (T ${b.temperature}, U ${b.volts})`);
  },
  charging: async () => {
    await drive('cell7', 'LFP-100', 10);
    await clickUi('ctl-umaxLfp7', 0.97, 0.72, 10); // pointer: the voltage-limit slider (re-declared for LFP)
    await drive('temp7', -5, 5);
    await drive('cc7', 1, 5);
    await press('run7', 200);
    const b = await probe();
    check(b.cell === 'LFP-100' && b.cRate === 1 && b.uMax > 3.65, `LFP charge at 1 C above the limit (${b.cell}, ${b.cRate}, ${b.uMax})`);
    check(b.over === true && b.plating === 'red' && b.soc > 5, `overcharge + plating warnings, SOC rising (${b.over}, ${b.plating}, ${b.soc})`);
    await drive('cell7', '21700-NMC', 10);
    await drive('umaxNmc7', 4.1, 5);
    await drive('temp7', 25, 5);
    await press('run7', 600);
    const c = await probe();
    check(c.cell === '21700-NMC' && c.over === false && c.plating === 'none' && near(c.soc, 91.8, 1), `NMC to 4,10 V should end near 91,8 % (got ${c.soc})`);
  },
  pack: async () => {
    check((await probe()).verdict === 'ok', '16S2P LFP-100 should fit ЛІ-6');
    await drive('series8', 15);
    check((await probe()).verdict === 'partial', '15S LFP should be «partial»');
    await drive('series8', 17);
    check((await probe()).verdict === 'over', '17S LFP should be over-voltage');
    await drive('cell8', '18650-NMC', 5);
    await drive('series8', 10);
    await drive('parallel8', 4);
    check((await probe()).verdict === 'under', '10S NMC should be under-voltage');
    await press('preset8-ev');
    const e = await probe();
    check(e.blocks === true && e.s === 96 && e.p === 74, 'EV preset: 96S74P drawn as blocks');
    await press('preset8-home5', 60);
    const h = await probe();
    check(h.verdict === 'ok' && h.home > 0.9 && h.cell === 'LFP-100', 'home preset: ok verdict and the cabinet appears');
  },
  bms: async () => {
    const a = await probe();
    await drag3d(a.glass3, 0, -60); // pointer: drag a level glass upward
    const b = await probe();
    check(Number(b.soc.split(',')[3]) > Number(a.soc.split(',')[3]) + 5, 'dragging a glass up should raise that cell');
    await press('unbalance9', 5);
    const c = await probe();
    check(c.soc !== b.soc, '«Розбалансувати» should spread the cells');
    await drive('weak9', 80, 5);
    check((await probe()).usable < c.usable, 'a weaker cell № 7 should cut the usable capacity');
    await drive('link9', 'none', 5);
    await press('charge9', 5);
    check((await probe()).mode === 'charge', '«Заряд» should start a run');
    await frames(700);
    const d = await probe();
    check(d.stop === 'bms-emergency' && d.trip === true, `blind charge should end in an emergency cut-off (${d.stop})`);
    await press('discharge9', 1300); // ≈ 2,7 h of model time at 50 A: enough to empty the weakest cell
    check((await probe()).stop === 'cell-empty', 'discharge should stop on the emptiest cell');
    await drive('balancing9', 'active', 120);
    const e = await probe();
    check(e.hours > d.hours, 'active balancing should run in model time');
  },
  degradation: async () => {
    const a = await probe();
    await drive('temp10', 45);
    const b = await probe();
    check(b.yours < a.yours - 0.05, 'heat should age the right cell faster');
    for (const [id, v] of [['cycles10', 700], ['dod10', 100], ['soc10', 100]]) await drive(id, v, 5);
    const c = await probe();
    check(c.yours < b.yours && c.out === true, 'hard cycling should leave the model range');
    await drive('chem10', 'NMC');
    check((await probe()).reference < a.reference, 'NMC should age faster than LFP in the reference scenario');
    await press('habitCare10');
    check((await value('temp10')) === 20 && (await value('soc10')) === 50, '«Дбайливо» should set 20 °C and mean SOC 50 %');
    await press('habitHot10');
    check((await value('temp10')) === 35 && (await value('soc10')) === 95, '«Тримати на 100 % у спеці» should set 35 °C / 95 %');
  },
  safety: async () => {
    await drive('oven11', 200, 5);
    await press('start11', 900); // 15 s × 30 = 450 model s: NMC runs away at 410 s, LFP only vents
    const a = await probe();
    check(a.nmcRunaway === true && a.lfpRunaway === false && a.nmc > 500, `oven 200 °C: NMC runaway, LFP not (${a.nmc}, ${a.lfp})`);
    await drive('scenario11', 'nail', 5);
    await press('start11', 720);
    const b = await probe();
    check(b.scenario === 'nail' && b.nmcRunaway === true && b.lfpRunaway === false, 'nail at SOC 80 %: NMC runaway, LFP smokes');
    await drive('scenario11', 'overcharge', 5);
    await press('start11', 90);
    check((await probe()).bmsCut === true, 'overcharge with BMS: the BMS cuts the charge');
    await drive('bms11', false, 5);
    await press('start11', 900); // 15 s × 300 = 4500 model s: NMC at 4297 s
    const c = await probe();
    check(c.nmcRunaway === true && c.lfpRunaway === false, 'overcharge without BMS: NMC first');
    await drive('scenario11', 'propagation', 5);
    await drive('barrier11', true, 5);
    await press('start11', 400);
    check((await probe()).rowNmc === 'true,false,false,false', 'aerogel barriers should stop the propagation');
    await drive('barrier11', false, 5);
    await press('start11', 400);
    check((await probe()).rowNmc === 'true,true,true,true', 'without barriers the whole NMC row should go');
  },
  'scale-and-future': async () => {
    await clickUi('ctl-scale12', 0.9, 0.72, 240); // pointer: dock slider
    check((await probe()).pos > 6, '«Масштаб» should move the ribbon to the big storage end');
    await drive('year12', 2010);
    check(near((await probe()).cost, 14740, 1), '10 kWh in 2010 should cost 14 740 $');
    await drive('page12', 'calc');
    await drive('power12', 1);
    const c = await probe();
    check(c.page === 'calc' && near(c.hours, 8.55, 0.01), `10 kWh, 90 %, 1 kW → 8,55 h (got ${c.hours})`);
    await drive('energy12', 5);
    await drive('dod12', 100);
    check(near((await probe()).hours, 4.75, 0.01), '5 kWh, 100 %, 1 kW → 4,75 h');
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'lab-battery/what-is-battery', freeze: 3 }));
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
console.log(failures.length ? `FAILED: ${failures.length} of ${checks} checks` : `PASS: ${checks} checks`);
process.exit(failures.length ? 1 : 0);
