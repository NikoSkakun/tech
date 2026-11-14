#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `plants` (run on lenovo; dev server or production preview):
//
//   QA_PORT=5249 node app/src/volumes/electricity/chapters/plants/qa/interaction.mjs [--size 1280x720] [--only rankine]
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
  await page.evaluate((s) => window.__app.goto('plants', s, { instant: true }), step);
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
const offscreen = async (step) => {
  const list = await page.evaluate(() => window.__ui.offscreen?.() ?? []);
  check(list.length === 0, `${step}: controls outside the viewport: ${JSON.stringify(list).slice(0, 160)}`);
};

const steps = {
  intro: async () => {
    check((await probe()).selected === null, 'intro opens with no island selected');
    await click3d('isl-wind', 40);
    let a = await probe();
    check(a.selected === 'wind' && a.built === true, `a click selects the wind island (${a.selected})`);
    // plant-coal is built since main 2026-11-14; «Майбутнє» is the island least likely to get its chapter soon
    await click3d('isl-future', 40);
    a = await probe();
    check(a.selected === 'future' && a.built === false, `future selected, its chapter not built (${a.selected}, ${a.built})`);
    await press('open1', 40);
    const pos = await page.evaluate(() => window.__app.position());
    check(pos.chapterId === 'plants', `«Відкрити розділ» is quiet for a chapter not built yet (${pos.chapterId})`);
  },
  'turbine-generator': async () => {
    const want = { steam: 3000, gas: 3000, water: 75, wind: 12, none: 0 };
    for (const [m, rpm] of Object.entries(want)) {
      await clickUi(`ctl-drive2:${m}`, 60);
      const a = await probe();
      check(a.mode === m && near(a.rpm, rpm, 0.5), `drive ${m}: ${rpm} rpm (${a.mode}, ${a.rpm})`);
    }
    const a = await probe();
    check(a.electrons === 1 && a.phases === 0, `no rotation: electrons run, phases stop (${a.electrons}, ${a.phases})`);
    await clickUi('ctl-drive2:steam', 30);
    const a0 = (await probe()).angle;
    await frames(30);
    check((await probe()).angle > a0 + 0.5, 'the steam drive turns the shaft');
  },
  'energy-chains': async () => {
    check(near((await probe()).grid, 42.6, 0.01), 'coal delivers 42,6 of 100');
    await clickUi('ctl-type3:hydro', 60);
    check(near((await probe()).grid, 89, 0.01), 'hydro delivers 89');
    await clickUi('ctl-type3:solarPv', 60);
    check(near((await probe()).grid, 19, 0.01), 'solar panels deliver 19');
    await clickUi('ctl-loss3', 30);
    const a = await probe();
    check(a.loss === true && a.lossGlow > 0.1, `«Показати втрати» lights the loss branches (${a.lossGlow})`);
  },
  'heat-engine': async () => {
    check(near((await probe()).eta, 0.6528, 0.001), '600 / 30 °C: η_C = 65,3 %');
    await set('th4', 1600);
    check(near((await probe()).eta, 0.8382, 0.001), '1600 °C: η_C = 83,8 %');
    await set('tc4', 60);
    check((await probe()).eta < 0.8382, 'warmer cold side lowers the limit');
    await press('pre4nuclear', 40);
    const a = await probe();
    check(a.th === 280 && a.tc === 30 && a.preset === 'nuclear' && near(a.eta, 0.452, 0.001), `«АЕС» sets 280 / 30 °C (${a.th}, ${a.tc}, ${a.eta})`);
    for (const id of ['coalSub', 'coalUsc', 'ccgt']) {
      await press(`pre4${id}`, 20);
      check((await probe()).preset === id, `preset ${id}`);
    }
  },
  rankine: async () => {
    check(near((await probe()).eta, 0.3521, 1e-4), 'saturated steam: 35 %');
    await clickUi('ctl-sh5', 20);
    check(near((await probe()).eta, 0.3882, 1e-4), 'superheat: 39 %');
    await clickUi('ctl-rh5', 20);
    let a = await probe();
    check(near(a.eta, 0.4087, 1e-4) && near(a.moisture, 0.0807, 1e-4), 'reheat: 41 %, 8 % moisture');
    await clickUi('ctl-nocond5', 30);
    a = await probe();
    check(!a.condenser && near(a.eta, 0.3001, 1e-4), `no condenser: 30 % (${a.eta})`);
    await press('step5', 120);
    a = await probe();
    check(a.stepping && a.leg === 'pump' && a.u >= 1, `«Крок за кроком» runs the hero through the pump (${a.leg}, ${a.u})`);
    await press('step5', 300);
    a = await probe();
    check(a.leg === 'boiler' && a.u >= 1, `second press: boiler (${a.leg})`);
  },
  brayton: async () => {
    check(near((await probe()).etaIdeal, 0.5751, 1e-3), 'r = 20: ideal 57,5 %');
    await set('r6', 10);
    check(near((await probe()).etaIdeal, 0.4821, 1e-3), 'r = 10: ideal 48,2 %');
    await set('r6', 20);
    const e0 = (await probe()).eta;
    await clickUi('ctl-hrsg6', 80);
    const a = await probe();
    check(a.hrsg && a.hrsgShown && a.eta > e0 + 0.12, `heat-recovery boiler: ${e0} → ${a.eta}`);
  },
  'steam-island': async () => {
    for (const s of ['nuclear', 'hrsg', 'csp', 'geothermal', 'biomass', 'coal']) {
      await clickUi(`ctl-src7:${s}`, 70);
      const a = await probe();
      check(a.source === s && a.shown.includes(s), `source ${s} docks (${a.shown})`);
    }
    for (const c of ['river', 'air', 'tower']) {
      await clickUi(`ctl-cool7:${c}`, 30);
      check((await probe()).cooling === c, `cooling ${c}`);
    }
  },
  metrics: async () => {
    await set('p8', 1000);
    await set('cf8', 35);
    check(near((await probe()).W, 3.066, 0.001), '1000 MW at 35 % → 3,07 TWh');
    await clickUi('ctl-type8:solar', 30);
    let a = await probe();
    check(a.type === 'solar' && near(a.CF, 0.14, 1e-6), `solar preset: CF 14 % (${a.CF})`);
    await press('year8', 120);
    a = await probe();
    check(a.run > 1 && a.odo[0] > a.odo[1] && a.odo[1] > a.odo[2], `«рік» runs the odometers, nuclear ahead (${a.odo})`);
    await clickUi('ctl-cost8', 30);
    check((await probe()).cost === true, 'cost / CO₂ charts open');
  },
  flexibility: async () => {
    let a = await probe();
    check(a.mode === 'jump' && a.finished[5] !== null, 'deep link shows the finished race (hydro finished)');
    await press('black9', 120);
    a = await probe();
    check(a.mode === 'blackout' && a.pct[0] < 1, `blackout: coal at 0 (${a.pct[0]})`);
    await frames(240);
    a = await probe();
    check(a.pct[5] > 20 && a.pct[0] < 1, `hydro restarts, coal stays dark (${a.pct[5]}, ${a.pct[0]})`);
    await press('night9', 360);
    a = await probe();
    check(a.mode === 'night' && a.pct[9] > 5, `night → morning: the sun rises (${a.pct[9]})`);
    await press('jump9', 60);
    check((await probe()).mode === 'jump', 'demand jump restarts the race');
  },
  mix: async () => {
    await clickUi('ctl-w10:2015', 90);
    let a = await probe();
    check(a.world === 'world2015' && a.blendW === 1, `world 2015 (${a.world})`);
    await clickUi('ctl-u10:2021', 90);
    a = await probe();
    check(a.ua === 'ua2021', `Ukraine 2021 (${a.ua})`);
  },
  gallery: async () => {
    const rims = (await probe()).rims;
    check(rims.includes('wind') && !rims.includes('future'), `a glowing rim marks built chapters only (${rims})`);
    await clickUi('ctl-cmp11', 40);
    check((await probe()).compare === true, '«Порівняти» opens the table');
    await clickUi('ctl-sort11:lcoeUsd', 30);
    check((await probe()).rows[0] === 'windOnshore' || (await probe()).rows.length === 15, 'sort by LCOE');
    await clickUi('ctl-low11', 30);
    const a = await probe();
    check(a.rows.length < 15 && !a.rows.includes('coal'), `low-carbon filter (${a.rows.length})`);
    await clickUi('ctl-disp11', 30);
    check(!(await probe()).rows.includes('windOnshore'), 'dispatchable filter drops wind');
    await clickUi('ctl-cmp11', 30);
    await click3d('gal-wind', 30);
    // loading the next chapter is asynchronous (chunk + build): wait for the engine to switch
    await page.waitForFunction(() => window.__app.position().chapterId !== 'plants', null, { timeout: 20000 }).catch(() => {});
    const pos = await page.evaluate(() => window.__app.position());
    check(pos.chapterId === 'plant-wind', `a click on the wind island opens its chapter (${pos.chapterId})`);
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'plants/intro', freeze: 3 }));
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
console.log(failures.length ? `FAILED: ${failures.length} of ${checks} checks` : `PASS: ${checks} checks (${width}x${height})`);
process.exit(failures.length ? 1 : 0);
