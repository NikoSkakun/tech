#!/usr/bin/env node
/* global process, console, window */
// Interaction test of `transformer` (run on lenovo; dev server or production preview):
//
//   QA_PORT=5248 node app/src/volumes/electricity/chapters/transformer/qa/interaction.mjs [--size 1280x720] [--only types]
//
// Every control of every step is used at least once and an observable change is asserted through the step probe
// `__app.read('step')`. Only production hooks: `__app.locate / read / step / goto / position`, `__ui.locate / set /
// press / offscreen`. Positions come from `locate` in CSS px, so one script serves 720p, 1080p and 4K. Toggles,
// segmented items, buttons and 3D objects get real pointer clicks (a 3D drag spins the gallery turntable); sliders
// are set through `__ui.set(id, value, true)` (= a user gesture with an exact value). The clock is frozen, so
// `frames(n)` advances exactly n simulated frames.
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
const near = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;
const frames = (n) => page.evaluate((k) => window.__app.step(1 / 60, k), n);
const probe = () => page.evaluate(() => window.__app.read('step'));
const set = async (id, v, n = 20) => {
  await page.evaluate(([i, x]) => window.__ui.set(i, x, true), [id, v]);
  await frames(n);
};
const goto = async (step) => {
  await page.evaluate((s) => window.__app.goto('transformer', s, { instant: true }), step);
  await page.evaluate(() => window.__app.settled());
  await frames(30);
};
const inView = (r) => r && r.x >= 0 && r.y >= 0 && r.x <= width && r.y <= height;
/** Real pointer click on a HUD node (`ctl-<id>` or `ctl-<id>:<item>`). */
const clickUi = async (name, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), name);
  if (!inView(r)) return check(false, `HUD node '${name}' missing or outside the viewport`);
  await page.mouse.move(r.x, r.y);
  await frames(2);
  await page.mouse.click(r.x, r.y);
  await frames(n);
};
const press = async (id, n = 30) => {
  const r = await page.evaluate((k) => window.__ui.locate(k), `ctl-${id}`);
  if (inView(r)) return clickUi(`ctl-${id}`, n);
  await page.evaluate((i) => window.__ui.press(i), id);
  await frames(n);
};
const click3d = async (name, n = 30) => {
  const p = await page.evaluate((k) => window.__app.locate(k), name);
  if (!p || !p.visible) return check(false, `scene probe '${name}' not visible`);
  await page.mouse.move(p.x, p.y);
  await frames(2);
  await page.mouse.click(p.x, p.y);
  await frames(n);
};
const drag3d = async (from, to) => {
  const a = await page.evaluate((k) => window.__app.locate(k), from);
  const b = await page.evaluate((k) => window.__app.locate(k), to);
  if (!a?.visible || !b?.visible) return check(false, `drag: probe '${from}' or '${to}' not visible`);
  await page.mouse.move(a.x, a.y);
  await frames(2);
  await page.mouse.down();
  await frames(2);
  for (let k = 1; k <= 14; k++) {
    await page.mouse.move(a.x + ((b.x - a.x) * k) / 14, a.y + ((b.y - a.y) * k) / 14);
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
  'mutual-induction': async () => {
    let s = await probe();
    check(s.ac && s.on && near(s.emf, 23, 0.1) && s.lamp > 0.5, `opens on AC 50 Hz with the lamp lit (${JSON.stringify(s)})`);
    await clickUi('ctl-supply1:dc', 4);
    s = await probe();
    check(!s.ac && s.emf === 0 && s.dcLevel === 1 && Math.abs(s.needle) > 0.3, `DC: no EMF, the needle kicks (${s.needle})`);
    await frames(120);
    s = await probe();
    check(Math.abs(s.needle) < 0.1 && s.lamp < 0.01 && Math.abs(s.flux) < 1e-6, `DC steady: needle at rest, lamp dark, flux frozen (${JSON.stringify(s)})`);
    await clickUi('ctl-power1', 10);
    check(!(await probe()).on, '«Живлення» off');
    await clickUi('ctl-power1', 10);
    await clickUi('ctl-supply1:ac', 10);
    await set('f1', 100);
    s = await probe();
    check(near(s.emf, 46, 0.1) && s.lamp > 1, `100 Hz doubles the EMF (${s.emf})`);
    await set('f1', 0);
    check((await probe()).emf === 0, '0 Hz behaves like DC');
  },
  'turns-ratio': async () => {
    let s = await probe();
    check(near(s.u2, 22.8, 0.05) && near(s.i1, 0.9916, 0.002), `defaults N₁ 500, N₂ 50, R 2,3 Ω (${s.u2}, ${s.i1})`);
    await set('n2', 1000, 60);
    s = await probe();
    check(s.latched && s.open && s.i2 === 0 && near(s.u2, 460, 0.5), `N₂ 1000 at 2,3 Ω trips the protection (${JSON.stringify(s)})`);
    await set('r2', 1000, 60);
    s = await probe();
    check(!s.latched && !s.open && near(s.u2, 460, 0.5), `a new R reconnects the load (${s.u2})`);
    await set('n1', 300, 30);
    check((await probe()).saturated, 'N₁ 300 saturates the core');
    await set('n1', 500);
    await set('n2', 50, 90);
    await set('r2', 2.3, 30);
    await clickUi('ctl-open2', 30);
    s = await probe();
    check(s.open && s.i2 === 0 && near(s.i1, 0.02, 0.001), `open load: I₂ = 0, I₁ = I_m (${s.i1})`);
    check(s.shownN2 > 20 && s.shownN2 < 40, `the secondary is wound back to ≈ 30 rings (${s.shownN2})`);
  },
  'why-high-voltage': async () => {
    let s = await probe();
    check(near(s.I, 524.9, 0.5) && near(s.lossW, 8.264e6, 1e4), `110 kV: 525 A, 8,26 MW (${s.I}, ${s.lossW})`);
    await set('u3', 330);
    s = await probe();
    check(s.shown === 330 && near(s.lossW, 0.918e6, 2e3), `330 kV: 0,92 MW (${s.lossW})`);
    await set('u3', 35, 120);
    s = await probe();
    check(s.impossible && s.cityNight < 0.3, `35 kV cannot carry 100 MW, the city goes dark (${s.cityNight})`);
    await set('u3', 110);
    await set('p3', 200);
    check(near((await probe()).lossW, 4 * 8.264e6, 5e4), 'doubling P quadruples the losses');
  },
  anatomy: async () => {
    let s = await probe();
    check(s.layers === '01111', `opens with the tank lifted (${s.layers})`);
    await click3d('hv-layer', 60);
    check((await probe()).layers === '01011', 'a click on the HV winding lifts it off');
    await clickUi('ctl-layer-hv', 30);
    await clickUi('ctl-layer-tank', 30);
    check((await probe()).layers === '11111', 'toggles put the HV winding and the tank back');
    await set('load4', 120, 600);
    s = await probe();
    check(s.fans && s.oilC > 70, `120 % load: fans on, hot oil (${s.oilC})`);
    await press('spark4', 220);
    s = await probe();
    check(s.tripped && s.spark > 2.8, `the internal spark trips the Buchholz protection (${s.spark})`);
    await press('reset4', 20);
    check(!(await probe()).tripped, '«Ввімкнути знову» re-energises');
  },
  'tap-changer': async () => {
    await frames(300);
    let s = await probe();
    check(s.auto && s.inBand && s.tap === -1, `115 kV, 50 %: auto settles in the corridor (${s.tap}, ${s.lv})`);
    await set('hv5', 105);
    await set('load5', 100, 900);
    s = await probe();
    check(s.tap === 5 && near(s.lv, 10.412, 0.01), `105 kV, full load: tap +5, 10,41 kV (${s.tap}, ${s.lv})`);
    await clickUi('ctl-mode5:manual', 20);
    await press('up5', 20);
    s = await probe();
    check(!s.auto && s.tap === 6, `manual ▲ (${s.tap})`);
    await press('down5', 20);
    check((await probe()).tap === 5, 'manual ▼');
  },
  'losses-efficiency': async () => {
    let s = await probe();
    check(s.gen === 'old' && near(s.eta, 0.9882, 0.0002), `old 400 kVA at 50 %: 98,82 % (${s.eta})`);
    await clickUi('ctl-gen6:modern', 20);
    check(near((await probe()).eta, 0.9937, 0.0002), 'modern at 50 %: 99,37 %');
    await set('beta6', 100);
    check(near((await probe()).eta, 0.9905, 0.0002), 'modern at 100 %: 99,05 %');
    await set('d6', 1);
    s = await probe();
    check(near(s.eddy, 3.23, 0.02) && s.sheets > 8 && s.sheets < 16, `1 mm sheets: 3,23 W/kg (${s.eddy}, ${s.sheets})`);
    await clickUi('ctl-solid6', 20);
    check((await probe()).sheets === 1, 'solid core: one block');
    await clickUi('ctl-over6', 10);
    await press('listen6', 20);
    s = await probe();
    check(s.over && s.listen > 4 && s.flips > 0, `listen with overvoltage (${s.listen}, flips ${s.flips})`);
  },
  'three-phase-groups': async () => {
    let s = await probe();
    check(s.group === 'Dyn11' && s.clock === 11, `opens on Dyn11 (${s.group})`);
    await clickUi('ctl-hv7:Y', 10);
    await clickUi('ctl-lv7:y', 10);
    check((await probe()).group === 'Yy0', 'Y / y → Yy0');
    await clickUi('ctl-lv7:yn', 10);
    await set('unb7', 100);
    s = await probe();
    check(s.group === 'Yyn0' && near(s.v[0], 209.3, 0.1), `Yyn0 at full unbalance: 209,3 V (${s.v})`);
    await clickUi('ctl-hv7:D', 10);
    check(near((await probe()).v[0], 223.1, 0.1), 'Dyn11 skews three times less: 223,1 V');
    await clickUi('ctl-lv7:d', 10);
    s = await probe();
    check(s.group === 'Dd0' && s.unb === 0, `Dd0 has no neutral: unbalance off (${s.group})`);
    await press('pulse7', 10);
    check((await probe()).pulse > 2, '«Пульс потоків»');
  },
  types: async () => {
    check((await probe()).ex === 'gsu', 'opens on the generator step-up transformer');
    await press('next8', 60);
    check((await probe()).ex === 'auto', '«Наступний» → autotransformer');
    await drag3d('turntable-a', 'turntable-b');
    check((await probe()).ex !== 'auto', 'dragging the turntable turns another exhibit to the front');
    await clickUi('ctl-ex8:ct', 60);
    await set('bus8', 1000);
    let s = await probe();
    check(s.ex === 'ct' && near(s.secA, 1, 1e-6), `CT: 1000 A → 1 A (${s.secA})`);
    await clickUi('ctl-open8', 20);
    s = await probe();
    check(s.danger && s.secA === 0, 'open secondary: danger');
    await clickUi('ctl-ex8:smps', 60);
    await set('f8', 1000);
    s = await probe();
    check(near(s.vol, 26, 0.6), `1 kHz → ≈ 26 cm³ (${s.vol})`);
    await set('f8', 100000);
    s = await probe();
    check(near(s.vol, 3, 0.01) && s.material === 'ferrite', `100 kHz → 3 cm³ of ferrite (${s.vol})`);
    await press('prev8', 30);
    await clickUi('ctl-scale8', 120);
    s = await probe();
    check(s.row && s.m > 0.9, `«Масштаб» lines them up (${s.m})`);
  },
  'voltage-ladder': async () => {
    check((await probe()).rung === '110', 'opens on 110 kV');
    await click3d('rung-750', 20);
    check((await probe()).rung === '750', 'tap on the 750 kV rung');
    await clickUi('ctl-rung9:0.4', 20);
    check((await probe()).rung === '0.4', 'dock: 0,4 kV');
    await frames(240);
    check(/1/.test((await probe()).lit), 'the pulse lights rungs on its way');
    await press('next9', 60);
    const pos = await page.evaluate(() => window.__app.position());
    check(pos.chapterId === 'transformer' || pos.chapterId === 'transmission', `«Далі» stays or opens transmission (${pos.chapterId})`);
  },
};

try {
  await openApp(page, appUrl(baseUrl(args), { route: 'transformer/mutual-induction', freeze: 3 }));
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
