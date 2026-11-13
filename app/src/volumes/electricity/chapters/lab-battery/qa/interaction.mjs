#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `lab-battery` (run on lenovo; dev server or production preview up):
//
//   QA_PORT=5252 node app/src/volumes/electricity/chapters/lab-battery/qa/interaction.mjs \
//       [--size 1280x720] [--only safety] [--shots <dir>] [--touch] [--reduced]
//
// Every control of every step is used at least once and an *observable* change is asserted through
// `__app.read('probe')` (simulation outputs and scene amounts the step exposes). Controls are driven the way a
// user would: real pointer clicks on dock / board controls and segmented items (`__ui.locate`), real clicks and
// drags on scene objects (`__app.locate`); exact slider values are set with `__ui.set(id, v, true)`, which runs
// the same listeners as a gesture. The clock is frozen (`?freeze`), so `frames(n)` advances exactly n simulated
// frames: the test is deterministic. `--shots` saves the state after each step's scenario (look-dev sheets).
import { parseArgs } from '../../../../../../../tools/qa/lib.mjs';
import { session } from './helpers.mjs';

const args = parseArgs();
const t = await session(args);
const { check, near, frames, probe, value, set, clickUi, press, pick, click3d, drag3d } = t;
/** A toggle is flipped by a click on its switch (left end of the row). */
const toggle = (id, n = 30) => clickUi(`ctl-${id}`, { fx: 0.08, n });

const steps = {
  'what-is-battery': async () => {
    const a = await probe();
    check(near(a.emfV, 1.1, 0.005), `Zn–Cu should give 1,10 V, got ${a.emfV}`);
    await click3d('rung:Li'); // pointer: tap a rung of the ladder
    const b = await probe();
    check(
      b.pair.includes('Li') && near(b.emfV, 3.38, 0.005),
      `tap on Li: expected Li–Cu 3,38 V, got ${b.pair} ${b.emfV}`,
    );
    check(b.water === true, 'lithium in water: the «Реагує з водою!» note should be on');
    await drag3d('rung:Ag', 'beaker'); // pointer: drag a puck from the ladder into the beaker
    const c = await probe();
    check(
      c.pair === 'Li-Ag' && c.dragging === false,
      `drag of Ag into the beaker: expected Li-Ag, got ${c.pair}`,
    );
    await drag3d('rung:Au', { dx: -40, dy: -30 }); // dropped beside the ladder: nothing changes
    check((await probe()).pair === 'Li-Ag', 'a puck dropped away from the beaker must not change the pair');
    await clickUi('ctl-metal1:Mg'); // pointer: the ladder's chip in the dock
    check((await probe()).pair === 'Ag-Mg', 'chip Mg: the older choice (Li) should be replaced');
    await pick('mode1', 'charge');
    check((await probe()).charging === true, 'mode «Заряд» should reverse the cell');
  },
  'cell-anatomy': async () => {
    await clickUi('ctl-unroll', { fx: 0.85, fy: 0.72, n: 240 }); // pointer: dock slider
    check(
      (await value('unroll')) > 50,
      `slider click should set «Розмотати» > 50 %, got ${await value('unroll')}`,
    );
    check((await probe()).unrolled > 0.5, 'the roll should unroll with the slider');
    await pick('format2', '4680', 60);
    const b = await probe();
    check(
      b.sx > 2 && (await value('unroll')) === 0,
      `4680 should widen the hero and rewind the roll (sx ${b.sx})`,
    );
    check(near(b.wh, 86.4, 0.1), `4680 energy should be 86,4 Wh, got ${b.wh}`);
    await pick('format2', 'prismatic', 60);
    check(
      (await probe()).format === 'prismatic',
      'tab «призматична» should swap the hero for the prismatic cell',
    );
    await press('capCut', 90); // pointer: dock button
    const c = await probe();
    check(
      c.cap > 0.9 && c.format === '21700',
      `«Розріз кришки» should open the header of the 21700 (cap ${c.cap}, ${c.format})`,
    );
  },
  intercalation: async () => {
    const a = await probe();
    await frames(120);
    const b = await probe();
    check(b.soc > a.soc && b.current > 0, 'charging: SOC should rise');
    await pick('mode3', 'pause', 10);
    const c = await probe();
    await frames(60);
    check((await probe()).soc === c.soc, 'pause: SOC should hold');
    await set('current3', 2, 5);
    await pick('mode3', 'discharge', 60);
    const d = await probe();
    check(d.soc < c.soc && d.current === -2, `discharge at 2 C: SOC should fall (current ${d.current})`);
    await toggle('cold3', 20); // pointer: dock toggle
    const e = await probe();
    check(
      e.plating === true && (await value('current3')) === 3,
      '«Швидко на морозі» should force 3 C and plating',
    );
  },
  'why-lithium': async () => {
    const a = await probe();
    check(
      near(a.lead, 125, 1) && near(a.nmc, 20, 0.5),
      `5 kWh: lead 125 kg, NMC 20 kg (got ${a.lead}, ${a.nmc})`,
    );
    await set('energy4', 10, 120);
    check(near((await probe()).lead, 250, 3), '10 kWh of lead-acid should weigh 250 kg');
    await toggle('usable4', 120);
    const c = await probe();
    check(
      (await value('usable4')) === true && near(c.lead, 500, 6) && near(c.lfp, 69.4, 1),
      `«корисні»: 500 kg / 69,4 kg (got ${c.lead}, ${c.lfp})`,
    );
  },
  chemistries: async () => {
    await click3d('pedestal:LTO'); // pointer: a pedestal
    check((await probe()).current === 'LTO', 'click on the LTO pedestal should select LTO');
    await toggle('compare5');
    const b = await probe();
    check(
      b.shown.includes('+') && b.radar === b.shown,
      `«Порівняти дві» should put two webs on the radar (${b.radar})`,
    );
    await pick('task5', 'bus');
    check((await probe()).verdict === 'good', 'LTO for the city bus should be «добре»');
    await pick('chem5', 'LCO');
    check((await probe()).verdict === 'bad', 'LCO for the city bus should be «погано»');
  },
  'voltage-capacity': async () => {
    await frames(60);
    const a = await probe();
    check(
      a.ah > 0 && a.runs.includes('21700-NMC@0.5'),
      `entering the step should start a 0,5 C run (${a.runs})`,
    );
    check(near(a.speed, 890, 30), `0,5 C run in 8 s: time lapse ≈ ×890, got ${a.speed}`);
    await set('current6', 2.5, 5);
    await pick('cell6', 'LFP-100', 5);
    await set('temp6', -20, 30);
    await toggle('ocv6', 5);
    await press('run6', 120);
    const b = await probe();
    check(
      b.runs === 'LFP-100@2.5' && b.over === true,
      `2,5 C on LFP-100 should run with the over-current note (${b.runs}, ${b.over})`,
    );
    check(
      b.temperature === -20 && b.ocv === true && b.volts < 3.2,
      `cold chamber and OCV toggle (T ${b.temperature}, U ${b.volts})`,
    );
    check(
      b.history === '1,1' && b.speed < a.speed,
      `the first run stays as a thin trace; 2,5 C is a slower time lapse (${b.history}, ×${b.speed})`,
    );
  },
  charging: async () => {
    await pick('cell7', 'LFP-100', 10);
    check(
      near(await value('umax7'), 3.65, 1e-6),
      `LFP: the limit slider should jump to 3,65 V, got ${await value('umax7')}`,
    );
    await clickUi('ctl-umax7', { fx: 0.97, fy: 0.72, n: 10 }); // pointer: the voltage-limit slider, far right
    await set('temp7', -5, 5);
    await set('cc7', 1, 5);
    await press('run7', 200);
    const b = await probe();
    check(
      b.cell === 'LFP-100' && b.cRate === 1 && b.uMax > 3.65,
      `LFP charge at 1 C above the limit (${b.cell}, ${b.cRate}, ${b.uMax})`,
    );
    check(
      b.over === true && b.plating === 'red' && b.soc > 5,
      `overcharge + plating warnings, SOC rising (${b.over}, ${b.plating}, ${b.soc})`,
    );
    await pick('cell7', '21700-NMC', 10);
    await set('umax7', 4.1, 5);
    await set('temp7', 25, 5);
    await press('run7', 600);
    const c = await probe();
    check(
      c.cell === '21700-NMC' && c.over === false && c.plating === 'none' && near(c.soc, 91.8, 1),
      `NMC to 4,10 V should end near 91,8 % (got ${c.soc})`,
    );
  },
  pack: async () => {
    check((await probe()).verdict === 'ok', '16S2P LFP-100 should fit ЛІ-6');
    await set('series8', 15);
    check((await probe()).verdict === 'partial', '15S LFP should be «partial»');
    await set('series8', 17);
    check((await probe()).verdict === 'over', '17S LFP should be over-voltage');
    await pick('cell8', '18650-NMC', 5);
    await set('series8', 10);
    await set('parallel8', 4);
    check((await probe()).verdict === 'under', '10S NMC should be under-voltage');
    await pick('preset8', 'ev');
    const e = await probe();
    check(e.blocks === true && e.s === 96 && e.p === 74, 'EV preset: 96S74P drawn as blocks');
    await pick('preset8', 'home5', 60);
    const h = await probe();
    check(
      h.verdict === 'ok' && h.home > 0.9 && h.cell === 'LFP-100',
      'home preset: ok verdict and the cabinet appears',
    );
  },
  bms: async () => {
    const a = await probe();
    await drag3d('glass:4', { dx: 0, dy: -60 }); // pointer: drag a level glass upward
    const b = await probe();
    check(
      Number(b.soc.split(',')[3]) > Number(a.soc.split(',')[3]) + 5,
      'dragging a glass up should raise that cell',
    );
    await press('unbalance9', 5);
    const c = await probe();
    check(c.soc !== b.soc, '«Розбалансувати» should spread the cells');
    await set('weak9', 80, 5);
    check((await probe()).usable < c.usable, 'a weaker cell № 7 should cut the usable capacity');
    await pick('link9', 'none', 5);
    await press('charge9', 5);
    const run = await probe();
    check(
      run.mode === 'charge' && run.speed === 450,
      `«Заряд» should start a run at ×450 (${run.mode}, ×${run.speed})`,
    );
    await frames(700);
    const d = await probe();
    check(
      d.stop === 'bms-emergency' && d.trip === true,
      `blind charge should end in an emergency cut-off (${d.stop})`,
    );
    await press('discharge9', 1300); // ≈ 2,7 h of model time at 50 A: enough to empty the weakest cell
    check((await probe()).stop === 'cell-empty', 'discharge should stop on the emptiest cell');
    await pick('balancing9', 'active', 120);
    const e = await probe();
    check(
      e.hours > d.hours && e.speed === 7200,
      `balancing at rest should run in model time at ×7200 (×${e.speed})`,
    );
  },
  degradation: async () => {
    const a = await probe();
    await set('temp10', 45);
    const b = await probe();
    check(b.yours < a.yours - 0.05, 'heat should age the right cell faster');
    for (const [id, v] of [
      ['cycles10', 700],
      ['dod10', 100],
      ['soc10', 100],
    ])
      await set(id, v, 5);
    const c = await probe();
    check(c.yours < b.yours && c.out === true, 'hard cycling should leave the model range');
    await pick('chem10', 'NMC');
    check(
      (await probe()).reference < a.reference,
      'NMC should age faster than LFP in the reference scenario',
    );
    await press('habitCare10');
    check(
      (await value('temp10')) === 20 && (await value('soc10')) === 50,
      '«Дбайливо» should set 20 °C and mean SOC 50 %',
    );
    await press('habitHot10');
    check(
      (await value('temp10')) === 35 && (await value('soc10')) === 95,
      '«Тримати на 100 % у спеці» should set 35 °C / 95 %',
    );
  },
  safety: async () => {
    const idle = await probe();
    check(
      idle.running === false && idle.speed === 30,
      `the rig should wait for «Старт» (oven: ×30), got ×${idle.speed}`,
    );
    await set('oven11', 200, 5);
    await click3d('start-button', 900); // pointer: the big button on the rig; 15 s × 30 = 450 model s
    const a = await probe();
    check(
      a.nmcRunaway === true && a.lfpRunaway === false && a.nmc > 500,
      `oven 200 °C: NMC runaway, LFP not (${a.nmc}, ${a.lfp})`,
    );
    await pick('scenario11', 'nail', 5);
    const n = await probe();
    check(
      n.running === false && n.speed === 1,
      `the nail scenario runs in real time, chip must say so (×${n.speed})`,
    );
    await press('start11', 1560); // 26 s: NMC is in runaway after 10 s, the LFP valve opens near 90 °C at ≈ 22 s
    const b = await probe();
    check(
      b.nmcRunaway === true && b.lfpRunaway === false && b.lfpVent === true,
      'nail at SOC 80 %: NMC runaway, LFP vents and smokes',
    );
    await pick('scenario11', 'overcharge', 5);
    await press('start11', 240);
    const half = await probe();
    check(
      half.bmsCut === false && half.speed === 30,
      `overcharge under BMS: ×30, not cut after 120 model s (${half.time})`,
    );
    await frames(300);
    const cut = await probe();
    check(
      cut.bmsCut === true && near(cut.time, 240, 1),
      `the BMS should cut the charge at the sim's 240 model s (${cut.time})`,
    );
    await toggle('bms11', 5);
    check((await probe()).speed === 300, 'overcharge without BMS runs at ×300 — the chip must follow');
    await press('start11', 900); // 15 s × 300 = 4500 model s: NMC at 4297 s
    const c = await probe();
    check(c.nmcRunaway === true && c.lfpRunaway === false, 'overcharge without BMS: NMC first');
    await pick('scenario11', 'propagation', 40); // its toggle fades in
    await toggle('barrier11', 5);
    await press('start11', 400);
    check(
      (await probe()).rowNmc === 'true,false,false,false',
      'aerogel barriers should stop the propagation',
    );
    await toggle('barrier11', 5);
    await press('start11', 400);
    check((await probe()).rowNmc === 'true,true,true,true', 'without barriers the whole NMC row should go');
  },
  'scale-and-future': async () => {
    check(
      (await t.page.evaluate(() => window.__ui.locate('xref-electricity/home/backup'))) !== null,
      'the «Див. також» chips should be on the panel',
    );
    await clickUi('ctl-scale12', { fx: 0.9, fy: 0.72, n: 240 }); // pointer: dock slider
    check((await probe()).pos > 6, '«Масштаб» should move the ribbon to the big storage end');
    await set('year12', 2010);
    check(near((await probe()).cost, 14740, 1), '10 kWh in 2010 should cost 14 740 $');
    await pick('page12', 'calc');
    await set('power12', 1);
    const c = await probe();
    check(c.page === 'calc' && near(c.hours, 8.55, 0.01), `10 kWh, 90 %, 1 kW → 8,55 h (got ${c.hours})`);
    await set('energy12', 5);
    await set('dod12', 100);
    check(near((await probe()).hours, 4.75, 0.01), '5 kWh, 100 %, 1 kW → 4,75 h');
  },
};

try {
  for (const [step, run] of Object.entries(steps)) {
    if (typeof args.only === 'string' && args.only !== step) continue;
    const before = t.failures.length;
    await t.goto(step);
    await run();
    if (typeof args.shots === 'string') await t.shot(`${args.shots}/${step}-${t.size}.jpg`);
    console.log(`${t.failures.length === before ? 'ok  ' : 'FAIL'} ${step}`);
  }
  for (const e of await t.errors()) t.failures.push(`console ${e.level}: ${e.message.slice(0, 200)}`);
} catch (e) {
  t.failures.push(`exception: ${e.stack ?? e}`);
} finally {
  await t.browser.close();
}
for (const f of t.failures) console.log(`  ✗ ${f}`);
console.log(
  t.failures.length
    ? `FAILED: ${t.failures.length} of ${t.count()} checks @${t.size}`
    : `PASS: ${t.count()} checks @${t.size}`,
);
process.exit(t.failures.length ? 1 : 0);
