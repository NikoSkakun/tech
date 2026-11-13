#!/usr/bin/env node
/* global process, console, window */
// Interaction test of chapter `atom` (run on lenovo; dev server or production preview up):
//
//   node app/src/volumes/electricity/chapters/atom/qa/interactions.mjs --port 5251 [--size 1920x1080]
//        [--only nucleus,quarks]
//
// Every control of every step is exercised at least once with real pointer input, and an observable change is
// asserted: the control's value (`__ui.value`) or the chapter's published state (`__app.read`, see the
// `ctx.qa.expose` call of each step). Only production hooks are used (helpers.mjs), positions are CSS px from
// `__ui.locate` / `__app.locate`, so the same script passes at 1280×720, 1920×1080 and 3840×2160, on the dev
// server and on a production build. Runs on the frozen engine clock (`?freeze`): deterministic.
// Exit code 1 on any failure or any console error / warning.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';
import {
  advance,
  at,
  click,
  clickProbe,
  dragProbe,
  hold,
  locate,
  pick,
  read,
  slide,
  value,
} from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const results = [];
let step = '';

const check = (what, ok, detail = '') => {
  results.push({ step, what, ok: Boolean(ok), detail: String(detail) });
  console.log(
    `${ok ? '  ok  ' : '  FAIL'} ${step.padEnd(15)} ${what}${detail === '' ? '' : `  [${detail}]`}`,
  );
};
const enter = async (id) => {
  step = id;
  await page.evaluate((s) => window.__app.goto('atom', s, { instant: true }), id);
  await advance(page, 1);
};
/** Unit vector on the screen from the probe `from` toward the probe / point `to` (CSS px). */
const away = async (from, centre) => {
  const a = await at(page, from);
  const c = typeof centre === 'string' ? await at(page, centre) : centre;
  const n = Math.hypot(a.x - c.x, a.y - c.y) || 1;
  return [(a.x - c.x) / n, (a.y - c.y) / n];
};

const steps = {
  async 'dive-in'() {
    await slide(page, 'wheel', 1);
    await advance(page, 6);
    check('wheel slider → last stop', (await value(page, 'wheel')) === 4, await value(page, 'wheel'));
    const dive = await read(page, 'dive');
    check('camera arrived at the atom (p = 4)', Math.abs(dive.p - 4) < 0.01, dive.p);
    await page.mouse.move(width * 0.35, height * 0.5);
    await page.mouse.wheel(0, -200);
    await advance(page, 4);
    check(
      'mouse wheel turns the scale wheel back',
      (await value(page, 'wheel')) === 3,
      await value(page, 'wheel'),
    );
  },

  async anatomy() {
    await click(page, 'trueScale', 0.08);
    await advance(page, 2);
    check('«Справжні пропорції» toggle', (await value(page, 'trueScale')) === true);
    check('nucleus shrinks to its real size', (await read(page, 'anatomy')).real > 0.95);
    await pick(page, 'analogy', 'ball');
    await advance(page, 2);
    check(
      'analogy tabs → ball / city',
      (await value(page, 'analogy')) === 'ball',
      await value(page, 'analogy'),
    );
  },

  async nucleus() {
    // pull the highlighted proton a little way out, straight away from the centre of the cluster
    let [ux, uy] = await away('nucleus.hero', await at(page, 'nucleus.centre'));
    let release = await dragProbe(page, 'nucleus.hero', ux * 0.12, uy * 0.12);
    const near = await read(page, 'nucleus');
    check('dragging the proton increases r', near.r > 1.15, near.r.toFixed(2));
    const readouts = await Promise.all(['r', 'strongN', 'coulombN'].map((id) => locate(page, id)));
    check('distance and both force readouts are on screen', readouts.length === 3);
    await release(1.5);
    const back = await read(page, 'nucleus');
    check(
      'released inside the crossover → springs back',
      back.r < 1.1 && back.mode === 'idle',
      back.r.toFixed(2),
    );
    [ux, uy] = await away('nucleus.hero', await at(page, 'nucleus.centre'));
    release = await dragProbe(page, 'nucleus.hero', ux * 0.6, uy * 0.6);
    const far = (await read(page, 'nucleus')).r;
    await release(0.3);
    check(
      'released beyond 4,45 fm → flies away',
      far > 4.45 && (await read(page, 'nucleus')).mode === 'fly',
      far.toFixed(2),
    );
    await advance(page, 4);
    check('nucleus restores itself', (await read(page, 'nucleus')).mode === 'idle');
    await click(page, 'removeNeutrons');
    await advance(page, 0.6);
    check('«Прибрати нейтрони» bursts the nucleus', (await read(page, 'nucleus')).mode === 'burst');
    await advance(page, 4);
  },

  async quarks() {
    await pick(page, 'hadron', 'neutron');
    await advance(page, 1);
    check(
      '«Протон | Нейтрон» → neutron',
      (await value(page, 'hadron')) === 'neutron',
      await value(page, 'hadron'),
    );
    check('one u quark turns into d', (await read(page, 'quarks')).neutron > 0.95);
    // outward = away from the centre of the glass sphere (the screen centre of the nucleon probe)
    const centre = await at(page, 'quarks.centre');
    let [ux, uy] = await away('quarks.quark0', centre);
    let release = await dragProbe(page, 'quarks.quark0', ux * 0.14, uy * 0.14, { settle: 0.3 });
    const energy = (await read(page, 'quarks')).energy;
    check('dragging a quark stores string energy', energy > 0.1, `${energy.toFixed(2)} GeV`);
    await release(1.5);
    const before = (await read(page, 'quarks')).breaks;
    [ux, uy] = await away('quarks.quark0', centre);
    release = await dragProbe(page, 'quarks.quark0', ux * 0.5, uy * 0.5, { settle: 0.3 });
    await release(1);
    check(
      'pulled past 1,2 fm → the string breaks (pion)',
      (await read(page, 'quarks')).breaks === before + 1,
    );
  },

  async electron() {
    await click(page, 'add1000');
    await click(page, 'add100');
    await click(page, 'add1');
    const poured = (await read(page, 'electron')).count;
    check('scoops +1000, +100, +1', poured === 1101, poured);
    await clickProbe(page, 'electron.scoop');
    check('a tap on the middle scoop pours 100', (await read(page, 'electron')).count === 1201);
    await click(page, 'resetPan');
    check('«Скинути»', (await read(page, 'electron')).count === 0);
    await click(page, 'add1000');
    for (let i = 0; i < 8; i++) await click(page, 'add100');
    for (let i = 0; i < 36; i++) await click(page, 'add1');
    await advance(page, 6);
    const pan = await read(page, 'electron');
    check(
      '1836 electrons level the balance',
      pan.count === 1836 && Math.abs(pan.angle) < 0.02,
      pan.angle.toFixed(3),
    );
    await click(page, 'compare', 0.08);
    await advance(page, 1);
    check('«Порівняти заряди» toggle', (await value(page, 'compare')) === true);
    check('charge balance is on stage', (await read(page, 'electron')).charge > 0.95);
  },

  async models() {
    await slide(page, 'level', 1);
    await advance(page, 1);
    check('level slider → n = 3', (await read(page, 'models')).n === 3, (await read(page, 'models')).n);
    await pick(page, 'model', 'quantum');
    await advance(page, 2);
    check('«Бор | Квантова» → quantum', (await read(page, 'models')).quantum > 0.95);
    await pick(page, 'orbital', '2p');
    await advance(page, 1);
    const p = await read(page, 'models');
    check('orbital tabs → 2p (shell n = 2)', p.orbital === '2p_z' && p.n === 2, `${p.orbital}, n = ${p.n}`);
    await pick(page, 'orientP', 'x');
    check('orientation tabs → 2p_x', (await read(page, 'models')).orbital === '2p_x');
    await pick(page, 'orbital', '3d');
    await advance(page, 1);
    await pick(page, 'orientD', 'z2');
    const d = await read(page, 'models');
    check(
      '3d tabs → 3d_z2 with a nodal cone',
      d.orbital === '3d_z2' && d.node?.kind === 'surface',
      d.orbital,
    );
    const before = d.points;
    await slide(page, 'samples', 1);
    await advance(page, 3);
    const after = (await read(page, 'models')).points;
    check(
      '«Вимірювань» slider → more dots',
      (await value(page, 'samples')) > 15000 && after > before + 2000,
      `${await value(page, 'samples')}: ${before} → ${after}`,
    );
  },

  async shells() {
    const tile = await at(page, 'shells.tile');
    await page.mouse.move(tile.x, tile.y, { steps: 5 });
    await advance(page, 1);
    check(
      'hovering the Fe tile rebuilds the atom',
      (await read(page, 'shells')).z === 26,
      (await read(page, 'shells')).z,
    );
    await page.mouse.click(tile.x, tile.y);
    await advance(page, 0.5);
    check('a tap on the tile selects it too (touch)', (await read(page, 'shells')).z === 26);
    await click(page, 'group11');
    await advance(page, 1.5);
    check('«Група 11» → Cu, Ag, Au', (await read(page, 'shells')).group > 0.9);
    await click(page, 'toCopper');
    await advance(page, 1.5);
    const cu = await read(page, 'shells');
    check('«До міді» → single copper atom', cu.z === 29 && cu.group < 0.1, cu.z);
    await click(page, 'filling', 0.08);
    await advance(page, 4);
    check(
      '«Показати порядок заповнення» toggle',
      (await value(page, 'filling')) === true && (await read(page, 'shells')).ladder,
    );
  },

  async 'ions-photons'() {
    await click(page, 'fire');
    await advance(page, 0.9);
    check('10,2 eV photon is absorbed → n = 2', (await read(page, 'photons')).level === 2);
    await advance(page, 2);
    const decayed = await read(page, 'photons');
    check('atom decays and marks the spectrum', decayed.level === 1 && decayed.lines >= 1);
    await click(page, 'clearSpectrum');
    check('«Очистити спектр»', (await read(page, 'photons')).lines === 0);
    await slide(page, 'photonE', 0.95);
    check('energy slider', (await value(page, 'photonE')) > 13.6, await value(page, 'photonE'));
    await click(page, 'fire');
    await advance(page, 0.9);
    check('photon above 13,6 eV ionises the atom', (await read(page, 'photons')).level === 0);
    await advance(page, 4);
    const shots = (await read(page, 'photons')).shots;
    await click(page, 'volley');
    check('«Залп ×10»', (await read(page, 'photons')).shots === shots + 10);
    await advance(page, 5);
    await clickProbe(page, 'photons.gun');
    check('a tap on the gun fires', (await read(page, 'photons')).shots === shots + 11);
    await advance(page, 4);
  },

  async 'atom-builder'() {
    const builder = () => read(page, 'builder');
    await click(page, 'preset-copper63');
    let b = await builder();
    check('preset «Мідь-63»', b.symbol === 'Cu' && b.status === 'stable' && b.np === 29, b.symbol);
    for (const key of ['hydrogen', 'helium4', 'carbon12', 'iron56']) await click(page, `preset-${key}`);
    check('presets H, He-4, C-12, Fe-56', (await builder()).symbol === 'Fe', (await builder()).symbol);
    await pick(page, 'nn', 'plus');
    check('«+» adds one neutron', (await builder()).nn === 31, (await builder()).nn);
    await pick(page, 'nn', 'minus');
    await pick(page, 'nn', 'minus');
    check('«−» removes neutrons', (await builder()).nn === 29, (await builder()).nn);
    // held for 0,4 s + 1 s: the auto-repeat (8 per second) adds about eight more
    await hold(page, 'ctl-nn:plus', 1.4);
    b = await builder();
    check('holding «+» auto-repeats (8 per second)', b.nn >= 36 && b.nn <= 40, b.nn);
    await hold(page, 'ctl-nn:plus', 2.5);
    b = await builder();
    check(
      'the count stops at the model limit (40) → unbound nucleus',
      b.nn === 40 && b.status === 'unbound',
      b.status,
    );
    await pick(page, 'ne', 'minus');
    check(
      'one electron less → a cation',
      String((await builder()).symbol).endsWith('⁺'),
      (await builder()).symbol,
    );
    await pick(page, 'np', 'plus');
    check('one proton more → the next element', (await builder()).np === 27, (await builder()).symbol);
    await click(page, 'preset-copperIon');
    check('preset «Cu⁺»', (await builder()).symbol === 'Cu⁺', (await builder()).symbol);
    const n = (await builder()).nn;
    await clickProbe(page, 'builder.basket');
    await advance(page, 1);
    check('a tap on the neutron basket adds one', (await builder()).nn === n + 1, (await builder()).nn);
  },

  async 'standard-model'() {
    const sm = () => read(page, 'sm');
    await clickProbe(page, 'sm.token.top');
    await advance(page, 0.5);
    check(
      'a tap on the t-quark token opens its card',
      (await sm()).selected === 'top',
      (await sm()).selected,
    );
    await clickProbe(page, 'sm.token.electron');
    await advance(page, 0.5);
    check(
      'a tap on another token moves the card',
      (await sm()).selected === 'electron',
      (await sm()).selected,
    );
    await clickProbe(page, 'sm.token.electron');
    await advance(page, 0.5);
    check('a second tap closes the card', (await sm()).selected === '');
    await clickProbe(page, 'sm.token.top');
    await advance(page, 0.5);
    await clickProbe(page, 'sm.card');
    await advance(page, 0.5);
    check('a tap on the card closes it as well', (await sm()).selected === '');
    await click(page, 'ordinary', 0.08);
    await advance(page, 1);
    check('«Звичайна речовина» dims 12 tokens', (await sm()).dimmed === 12, (await sm()).dimmed);
    for (const id of ['strong', 'electromagnetic', 'weak', 'gravity']) {
      await pick(page, 'interaction', id);
      await advance(page, 0.6);
      check(
        `interaction tab → ${id}`,
        (await value(page, 'interaction')) === id && (await sm()).interaction === id,
      );
    }
    await click(page, 'bridge');
    check('«Далі: Заряд і поле →» launches the photon', (await sm()).leaving === true);
    await advance(page, 2);
    await page.evaluate(() => window.__app.settled());
    const pos = await page.evaluate(() => window.__app.position());
    check('the photon lands in chapter charge-field', pos?.chapterId === 'charge-field', JSON.stringify(pos));
    // back, so the reachability check that follows each step still looks at this step's controls
    await enter('standard-model');
  },
};

let failed = true;
try {
  await openApp(page, appUrl(baseUrl(args), { route: 'atom/dive-in', q: 'high', freeze: 1 }));
  const only = typeof args.only === 'string' ? args.only.split(',') : null;
  for (const [id, run] of Object.entries(steps)) {
    if (only && !only.includes(id)) continue;
    await enter(id);
    try {
      await run();
      const offscreen = await page.evaluate(() => window.__ui.offscreen());
      check('every control is reachable on screen', offscreen.length === 0, offscreen.slice(0, 3).join(', '));
    } catch (e) {
      check('scenario ran to the end', false, e.message.split('\n')[0]);
    } finally {
      await page.mouse.up();
    }
  }
  const errors = await appErrors(page);
  step = 'console';
  check(
    'no console errors or warnings',
    errors.length === 0,
    errors
      .slice(0, 3)
      .map((e) => e.message.slice(0, 160))
      .join(' | '),
  );
  failed = results.some((r) => !r.ok);
  console.log(
    `${failed ? 'FAIL' : 'PASS'} atom interactions — ${results.filter((r) => r.ok).length}/${results.length} checks at ${width}x${height}`,
  );
} catch (e) {
  console.error(`interaction test crashed: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
