#!/usr/bin/env node
/* global process, console, window */
// Interaction test of chapter `atom` (run on lenovo, dev server up):
//
//   QA_PORT=5221 node app/src/volumes/electricity/chapters/atom/qa/interactions.mjs [--size 1280x720]
//
// Every control of every step is exercised at least once with real pointer input, and an observable change is
// asserted: the control's value (`__ui.value`) or a chapter probe (`window.__atomQa`, see chapter.ts
// `qaProbe`). Runs on the frozen engine clock (`?freeze`), so it is deterministic. Exit code 1 on any failure
// or any console error / warning.
import {
  appErrors,
  appUrl,
  baseUrl,
  launch,
  openApp,
  parseArgs,
  parseSize,
} from '../../../../../../../tools/qa/lib.mjs';
import { advance, click, pickTab, project, slide, value } from './helpers.mjs';

const args = parseArgs();
const [width, height] = parseSize(args.size, [1280, 720]);
const { browser, page } = await launch({ width, height });
const results = [];
let step = '';

const probe = (name) => page.evaluate((n) => window.__atomQa[n](), name);
const point = async (name) => project(page, ...(await probe(name)));
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
/** Press at one world point and drag to another (projected to the screen, so it works at any window size). */
const dragWorld = async (from, to, hold = 0.6) => {
  const a = await project(page, ...from);
  const b = await project(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down(); // at once: moving targets (orbiting quarks) do not wait
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await advance(page, hold);
};
/** The point `distance` world units farther from `centre` than `p` (in the screen plane). */
const outward = (p, centre, distance) => {
  const v = [p[0] - centre[0], p[1] - centre[1]];
  const n = Math.hypot(...v) || 1;
  return [p[0] + (v[0] / n) * distance, p[1] + (v[1] / n) * distance, p[2]];
};
/** Centre of the nucleus in step `nucleus` (its stage pose) and of the nucleon in step `quarks`. */
const NUCLEUS = [-1.9, -0.4, 0];
const NUCLEON = [0, 0, 0];

const steps = {
  async 'dive-in'() {
    await slide(page, 'wheel', 1);
    await advance(page, 6);
    check('wheel slider → last stop', (await value(page, 'wheel')) === 4, await value(page, 'wheel'));
    check(
      'camera arrived at the atom (p = 4)',
      Math.abs((await probe('dive.p')) - 4) < 0.01,
      await probe('dive.p'),
    );
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
    check('«Справжні пропорції» toggle', (await value(page, 'trueScale')) === true);
    await pickTab(page, 0, 1, 2);
    await advance(page, 2);
    check(
      'analogy tabs → ball / city',
      (await value(page, 'analogy')) === 'ball',
      await value(page, 'analogy'),
    );
  },
  async nucleus() {
    const hero = await probe('nucleus.hero');
    await dragWorld(hero, outward(hero, NUCLEUS, 1.2));
    const r = await probe('nucleus.r');
    check('dragging the proton increases r', r > 1.15, r.toFixed(2));
    await page.mouse.up();
    await advance(page, 1.5);
    check(
      'released inside the crossover → springs back',
      (await probe('nucleus.r')) < 1.1 && (await probe('nucleus.mode')) === 'idle',
    );
    const again = await probe('nucleus.hero');
    await dragWorld(again, outward(again, NUCLEUS, 6.5));
    const far = await probe('nucleus.r');
    await page.mouse.up();
    await advance(page, 0.3);
    check(
      'released beyond 4,45 fm → flies away',
      far > 4.45 && (await probe('nucleus.mode')) === 'fly',
      far.toFixed(2),
    );
    await advance(page, 4);
    check('nucleus restores itself', (await probe('nucleus.mode')) === 'idle');
    await click(page, 'removeNeutrons');
    await advance(page, 0.6);
    check('«Прибрати нейтрони» bursts the nucleus', (await probe('nucleus.mode')) === 'burst');
    await advance(page, 4);
  },
  async quarks() {
    await pickTab(page, 0, 1, 2);
    check(
      '«Протон | Нейтрон» → neutron',
      (await value(page, 'hadron')) === 'neutron',
      await value(page, 'hadron'),
    );
    const quark = await probe('quarks.quark0');
    await dragWorld(quark, outward(quark, NUCLEON, 2), 0.3);
    const e = await probe('quarks.energy');
    check('dragging a quark stores string energy', e > 0.1, `${e.toFixed(2)} GeV`);
    await page.mouse.up();
    await advance(page, 1.5);
    const before = await probe('quarks.breaks');
    const quarkAgain = await probe('quarks.quark0');
    await dragWorld(quarkAgain, outward(quarkAgain, NUCLEON, 6), 0.3);
    await page.mouse.up();
    await advance(page, 1);
    check('pulled past 1,2 fm → the string breaks (pion)', (await probe('quarks.breaks')) === before + 1);
  },
  async electron() {
    await click(page, 'add1000');
    await click(page, 'add100');
    await click(page, 'add1');
    check('scoops +1000, +100, +1', (await probe('electron.count')) === 1101, await probe('electron.count'));
    await click(page, 'resetPan');
    check('«Скинути»', (await probe('electron.count')) === 0);
    await click(page, 'add1000');
    for (let i = 0; i < 8; i++) await click(page, 'add100');
    for (let i = 0; i < 36; i++) await click(page, 'add1');
    await advance(page, 6);
    const angle = await probe('electron.angle');
    check(
      '1836 electrons level the balance',
      (await probe('electron.count')) === 1836 && Math.abs(angle) < 0.02,
      angle.toFixed(3),
    );
    await click(page, 'compare', 0.08);
    check('«Порівняти заряди» toggle', (await value(page, 'compare')) === true);
  },
  async models() {
    await slide(page, 'level', 1);
    await advance(page, 1);
    check('level slider → n = 3', (await probe('models.n')) === 3, await probe('models.n'));
    await pickTab(page, 0, 3, 7); // «2p» (item 0 is «Бор»)
    await advance(page, 2);
    check(
      'model / orbital tabs → quantum 2p',
      String(await probe('models.orbital')).startsWith('2p'),
      await probe('models.orbital'),
    );
    await pickTab(page, 1, 0, 3);
    check(
      'orientation tabs → 2p_x',
      (await probe('models.orbital')) === '2p_x',
      await probe('models.orbital'),
    );
    const before = await probe('models.points');
    await slide(page, 'samples', 1);
    await advance(page, 3);
    const after = await probe('models.points');
    check(
      '«Вимірювань» slider → more dots',
      (await value(page, 'samples')) > 15000 && after > before + 2000,
      `${await value(page, 'samples')}: ${before} → ${after}`,
    );
  },
  async shells() {
    const tile = await point('shells.tile');
    await page.mouse.move(tile.x, tile.y, { steps: 5 });
    await advance(page, 1);
    check(
      'hovering the Fe tile rebuilds the atom',
      (await probe('shells.z')) === 26,
      await probe('shells.z'),
    );
    await click(page, 'group11');
    await advance(page, 1.5);
    check('«Група 11» → Cu, Ag, Au', (await probe('shells.group')) > 0.9);
    await click(page, 'toCopper');
    await advance(page, 1.5);
    check(
      '«До міді» → single copper atom',
      (await probe('shells.group')) < 0.1 && (await probe('shells.z')) === 29,
    );
    await click(page, 'filling', 0.08);
    await advance(page, 3);
    check('«Показати порядок заповнення» toggle', (await value(page, 'filling')) === true);
  },
  async 'ions-photons'() {
    await click(page, 'fire');
    await advance(page, 0.9);
    check(
      '10,2 eV photon is absorbed → n = 2',
      (await probe('photons.level')) === 2,
      await probe('photons.level'),
    );
    await advance(page, 2);
    check(
      'atom decays and marks the spectrum',
      (await probe('photons.level')) === 1 && (await probe('photons.lines')) >= 1,
    );
    await click(page, 'clearSpectrum');
    check('«Очистити спектр»', (await probe('photons.lines')) === 0);
    await slide(page, 'photonE', 0.95);
    check('energy slider', (await value(page, 'photonE')) > 13.6, await value(page, 'photonE'));
    await click(page, 'fire');
    await advance(page, 0.9);
    check('photon above 13,6 eV ionises the atom', (await probe('photons.level')) === 0);
    await advance(page, 4);
    const shots = await probe('photons.shots');
    await click(page, 'volley');
    check('«Залп ×10»', (await probe('photons.shots')) === shots + 10);
    await advance(page, 5);
    const gun = await point('photons.gun');
    await page.mouse.click(gun.x, gun.y);
    check('clicking the gun fires', (await probe('photons.shots')) === shots + 11);
    await advance(page, 4);
  },
  async 'atom-builder'() {
    await click(page, 'preset-copper63');
    check(
      'preset «Мідь-63»',
      (await probe('builder.symbol')) === 'Cu' && (await probe('builder.status')) === 'stable',
      await probe('builder.symbol'),
    );
    for (const key of ['hydrogen', 'helium4', 'carbon12', 'iron56']) await click(page, `preset-${key}`);
    check(
      'presets H, He-4, C-12, Fe-56',
      (await probe('builder.symbol')) === 'Fe',
      await probe('builder.symbol'),
    );
    await slide(page, 'nn', 1);
    check(
      'neutron slider → unbound nucleus',
      (await value(page, 'nn')) >= 38 && (await probe('builder.status')) === 'unbound',
      `${await value(page, 'nn')} ${await probe('builder.status')}`,
    );
    await slide(page, 'np', 0.2);
    await slide(page, 'ne', 0.1);
    check(
      'proton and electron sliders → an ion',
      String(await probe('builder.symbol')).endsWith('⁺'),
      await probe('builder.symbol'),
    );
    await click(page, 'preset-copperIon');
    check('preset «Cu⁺»', (await probe('builder.symbol')) === 'Cu⁺', await probe('builder.symbol'));
    const n = await value(page, 'nn');
    const basket = await point('builder.basket');
    await page.mouse.click(basket.x, basket.y);
    await advance(page, 1);
    check(
      'clicking the neutron basket adds one',
      (await value(page, 'nn')) === n + 1,
      await value(page, 'nn'),
    );
  },
  async 'standard-model'() {
    const token = await point('sm.token');
    await page.mouse.click(token.x, token.y);
    await advance(page, 0.5);
    check(
      'tapping the t-quark token opens its card',
      (await probe('sm.selected')) === 'top',
      await probe('sm.selected'),
    );
    await click(page, 'ordinary', 0.08);
    await advance(page, 1);
    check('«Звичайна речовина» dims 12 tokens', (await probe('sm.dimmed')) === 12, await probe('sm.dimmed'));
    for (const [i, id] of ['strong', 'electromagnetic', 'weak', 'gravity'].entries()) {
      await pickTab(page, 0, i, 4);
      await advance(page, 0.6);
      check(
        `interaction tab → ${id}`,
        (await value(page, 'interaction')) === id,
        await value(page, 'interaction'),
      );
    }
    await click(page, 'bridge');
    check('«Далі: Заряд і поле →» launches the photon', (await probe('sm.leaving')) === true);
    await advance(page, 2);
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
