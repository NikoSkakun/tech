#!/usr/bin/env node
// Library-of-volumes check (DECISIONS §58, docs/VOLUMES.md): drives the real pointer / keyboard against the
// dev-only demo volume `_demo` next to volume 1 and asserts what makes the project a library:
//
//   1. landing        one published volume in the main flow → no library level: `#/` opens the default volume's
//                     home (its lobby while it has no chapters), with one button per aside volume (DECISIONS §60);
//                     with FRESH_START (engine/store.ts) it opens straight on the first step and the home is
//                     opened through its button. The checks below follow the mode the build runs in.
//   1b. aside         each aside button opens that volume on its home screen; its way back returns to `#/`
//   2. library        the library screen lists the listed volumes (not the sandbox pseudo-volume)
//   3. enter          a volume card opens that volume (first visit: its home); its map uses its own axis
//   4. chrome         inside the demo volume the header names the volume and the library button is there;
//                     inside volume 1 neither exists (a single published volume looks like a stand-alone course)
//   5. cross-volume   a «Див. також» link of the demo volume lands on a step of volume 1
//   6. progress       progress is counted per volume (full chapter ids), each volume remembers its last step
//   7. glossary       volume scope vs. whole library
//   8. legacy links   `#/atom/quarks`, `#/_sandbox-ui/controls`, `#/electricity`, `#/electricity/atom`
//   9. migration      a v1 localStorage record becomes v2 progress of the legacy volume (library.json)
//  10. production     without `?debug` the dev volumes do not exist and none of their code is requested
//                     (asserted only against a production build: pass --base of a `vite preview` / static server)
//
//   node tools/qa/library-check.mjs [--port 5215 | --base http://localhost:8080/] [--out <dir>] [--size WxH]
//
// Screenshots: <out>/library/NN-*.jpg and the contact sheet <out>/library/sheet.jpg.
import { execFileSync } from 'node:child_process';
import { appUrl, baseUrl, ensureDir, launch, openApp, outRoot, parseArgs, parseSize, screenshot } from './lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const [width, height] = parseSize(args.size);
const out = ensureDir(`${outRoot(args)}/library`);
const failures = [];
const shots = [];
let n = 0;

function check(ok, name, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const { browser, page, requests } = await launch({ width, height });
const ev = (fn, arg) => page.evaluate(fn, arg);
const pos = () => ev(() => window.__app.position());
const address = async () => {
  const p = await pos();
  return `${p.volumeId}/${p.chapterId}/${p.stepId}`;
};
const hash = () => ev(() => window.location.hash);
const settle = async (frames = 90) => {
  await ev(() => window.__app.settled());
  await ev((f) => window.__app.step(1 / 60, f), frames);
};
const shot = async (name) => {
  await settle();
  shots.push(await screenshot(page, `${out}/${String(++n).padStart(2, '0')}-${name}.jpg`));
};
const names = () => ev(() => window.__ui.names());
/** Where the app is: `lobby:<volume>` while a volume is shown by its home screen alone, else the step address. */
const where = async () => {
  const lobby = await ev(() => window.__app.lobby());
  return lobby ? `lobby:${lobby}` : address();
};
const click = async (name) => {
  const r = await ev((x) => window.__ui.locate(x), name);
  if (!r) throw new Error(`no visible HUD node '${name}'`);
  await page.mouse.click(r.x, r.y);
  await settle(30);
};
const waitOverlay = (name) => page.waitForFunction((x) => window.__ui?.overlay() === x, name, { timeout: 20000 });
let loads = 0;
/** Full page load of a route (the counter makes every URL new: a changed hash alone would not reload). */
const open = async (route, extra = {}) => {
  await openApp(page, appUrl(base, { route, freeze: 2, extra: { n: String(++loads), ...extra } }));
  await settle(10);
};

try {
  console.log(`library-check @ ${base} ${width}x${height}`);
  // 1. landing ------------------------------------------------------------------------------------------
  await open('');
  await page.waitForFunction(() => window.__app.engine?.store !== undefined, null, { timeout: 20000 });
  const fresh = await ev(() => window.__app.engine.store.freshStart === true);
  console.log(`  mode: ${fresh ? 'fresh start (no landing home, progress not saved)' : 'resume'}`);
  /** The home screen a landing opens by itself; in fresh-start mode the step is on screen and home is opened by hand. */
  const landingHome = async (what) => {
    if (!fresh) return waitOverlay('home');
    await settle(10);
    check((await ev(() => window.__ui.overlay())) === null, `${what}: fresh start — straight on the step, no home in front`, await where());
    await ev(() => window.__ui.open('home'));
    await waitOverlay('home');
    await settle(30); // its buttons are laid out as it opens
  };
  await landingHome('landing');
  const volumes = await ev(() => window.__app.listVolumes());
  const def = volumes.find((v) => v.role === 'default').id;
  // the owner of pre-library links and data: volume 1 (`electricity`), wherever the front door is
  const legacy = volumes.find((v) => v.legacy).id;
  const aside = volumes.filter((v) => v.role === 'aside' && v.status === 'published').map((v) => v.id);
  const roles = volumes.map((v) => `${v.id}:${v.status}${v.role ? `:${v.role}` : ''}`).join(' ');
  check(volumes.filter((v) => v.status === 'published' && v.role !== 'aside').length === 1, 'exactly one published volume in the main flow', roles);
  check((await ev(() => window.__ui.overlay())) === 'home', 'landing: `#/` opens the default volume on its home screen (library level skipped)', await where());
  const landed = (await ev(() => window.__app.lobby())) ?? (await pos()).volumeId;
  check(landed === def, 'landing: the front door is the default volume', await where());
  check(!(await names()).includes('home-library'), 'landing: no library button on the home screen of the only main-flow volume');
  for (const id of aside) check((await names()).includes(`home-aside-${id}`), `landing: the secondary button to the aside volume ${id}`);
  await shot('landing-home');

  // 1b. aside volumes: in through their button, back to the front door ---------------------------------
  for (const id of aside) {
    await click(`home-aside-${id}`);
    await page.waitForFunction((v) => window.__app.position().volumeId === v && window.__app.lobby() === null && window.__ui.overlay() === 'home', id, { timeout: 30000 });
    await settle();
    check((await names()).includes('home-back'), `aside: ${id} opens on its home screen, with the way back`, await where());
    check((await hash()).startsWith(`#/${id}/`), `aside: the address is a full route of ${id}`, await hash());
    check(!(await names()).includes('home-library'), `aside: no library button inside ${id}`);
    await shot(`aside-${id}-home`);
    await click('home-back');
    await page.waitForFunction((v) => (window.__app.lobby() ?? window.__app.position().volumeId) === v && window.__ui.overlay() === 'home', def, { timeout: 30000 });
    await settle();
    check((await names()).includes(`home-aside-${id}`), 'aside: the way back returns to the home screen of the default volume', `${await where()} ${await hash()}`);
  }
  const demo = volumes.find((v) => v.id === '_demo');
  if (!demo) throw new Error('the demo volume `_demo` is not registered — run against a ?debug-capable build');

  // 2. library ------------------------------------------------------------------------------------------
  await page.keyboard.press('l');
  await waitOverlay('library');
  await settle();
  const cards = (await names()).filter((x) => x.startsWith('volume-card-'));
  check(cards.includes(`volume-card-${def}`) && cards.includes('volume-card-_demo'), 'library: lists the default and the demo volume', cards.join(' '));
  check(aside.every((id) => !cards.includes(`volume-card-${id}`)), 'library: aside volumes are not on the shelf', cards.join(' '));
  check(!cards.includes('volume-card-_dev'), 'library: the sandbox pseudo-volume is not listed');
  await shot('library');

  // 3. enter --------------------------------------------------------------------------------------------
  await click('volume-open-_demo');
  await page.waitForFunction(() => window.__app.position().volumeId === '_demo', null, { timeout: 30000 });
  await settle();
  check((await address()) === '_demo/wave/oscillation', 'enter: the card opens the first step of the demo volume', await address());
  check((await hash()) === '#/_demo/wave/oscillation', 'enter: the address is the full route', await hash());
  await landingHome('enter');
  check((await names()).includes('home-library'), 'enter: a first visit lands on the volume home, with the way back to the library');
  await shot('demo-home');
  await page.keyboard.press('m');
  await waitOverlay('map');
  await settle(200);
  const node = await ev(() => [window.__ui.mapNode('wave'), window.__ui.mapNode('antenna')]);
  check(node[0] && node[1] && node[1].y < node[0].y - 60, 'map: the demo journey is laid out on its own axis (10⁸ Hz above 10³ Hz)', JSON.stringify(node));
  await shot('demo-map');
  await ev(() => window.__ui.close());

  // 4. chrome -------------------------------------------------------------------------------------------
  await ev(() => window.__app.goto('_demo/wave/spectrum'));
  await settle();
  check((await names()).includes('sys-library'), 'chrome: inside the demo volume the library button is shown');
  await shot('demo-wave-spectrum');
  await ev(() => window.__app.goto('antenna', 'photon')); // short id: resolved in the current volume
  await settle();
  check((await address()) === '_demo/antenna/photon', 'short chapter id resolves in the current volume', await address());
  const xref = 'xref-electricity/atom/ions-photons';
  check((await names()).includes(xref), 'cross-volume: «Див. також» offers the step of volume 1', (await names()).filter((x) => x.startsWith('xref-')).join(' '));
  await shot('demo-antenna-photon-link');

  // 7. glossary (while still in the demo volume) --------------------------------------------------------
  await ev(() => window.__ui.open('glossary'));
  await settle(120);
  check((await names()).includes('glossary-scope:library'), 'glossary: the scope switch exists inside the demo volume');
  await shot('glossary-demo-volume');
  await click('glossary-scope:library');
  await settle(240);
  await shot('glossary-whole-library');
  await ev(() => window.__ui.close());

  // 5. cross-volume link --------------------------------------------------------------------------------
  await settle(30);
  await click(xref);
  await page.waitForFunction(() => window.__app.position().volumeId !== '_demo', null, { timeout: 60000 });
  await settle();
  check((await address()) === `${legacy}/atom/ions-photons`, 'cross-volume: the link lands on the step of volume 1', await address());
  const chrome = await names();
  check(!chrome.includes('sys-library'), 'chrome: inside volume 1 there is no library button');
  await shot('landed-in-volume-1');
  await ev(() => window.__ui.open('glossary'));
  await settle(120);
  check(!(await names()).includes('glossary-scope:library'), 'glossary: no scope switch inside volume 1 (no library level)');
  await ev(() => window.__ui.close());

  // 6. progress -----------------------------------------------------------------------------------------
  const state = await ev(() => {
    const s = window.__app.engine.store.get();
    return { visited: s.progress.visited, lastIn: s.lastIn, last: s.last };
  });
  check(Object.keys(state.visited).every((k) => k.split('/').length === 2), 'progress: keyed by full chapter id', Object.keys(state.visited).join(' '));
  check(state.visited['_demo/wave']?.length === 2 && state.visited['_demo/antenna']?.length === 1, 'progress: the demo volume has its own record', JSON.stringify(state.visited));
  check(state.lastIn._demo?.chapterId === 'antenna' && state.lastIn[legacy]?.chapterId === 'atom', 'progress: each volume remembers its last step', JSON.stringify(state.lastIn));
  await page.keyboard.press('l');
  await waitOverlay('library');
  await settle();
  await shot('library-progress');
  await click('volume-open-_demo');
  await page.waitForFunction(() => window.__app.position().volumeId === '_demo', null, { timeout: 30000 });
  await settle();
  check((await address()) === '_demo/antenna/photon', 'enter: returning to a volume resumes where it was left', await address());

  // 8. legacy and partial links -------------------------------------------------------------------------
  for (const [route, want, wantHash] of [
    ['atom/quarks', `${legacy}/atom/quarks`, `#/${legacy}/atom/quarks`], // a link from before the library of volumes
    ['atom', `${legacy}/atom/dive-in`, `#/${legacy}/atom/dive-in`],
    ['_sandbox-ui/controls', '_dev/_sandbox-ui/controls', '#/_dev/_sandbox-ui/controls'],
    [`${legacy}/atom`, `${legacy}/atom/dive-in`, `#/${legacy}/atom/dive-in`],
    ['_demo/antenna/dipole', '_demo/antenna/dipole', '#/_demo/antenna/dipole'],
  ]) {
    // a fresh context per link: no stored position may help the app find the target
    await page.context().clearCookies();
    await ev(() => window.localStorage.clear());
    await open(route);
    check((await address()) === want && (await hash()) === wantHash, `link #/${route} → ${wantHash}`, `${await address()} ${await hash()}`);
  }
  await ev(() => window.localStorage.clear());
  await open(legacy);
  await landingHome(`link #/${legacy}`);
  check((await pos()).volumeId === legacy, `link #/${legacy} opens the volume on its home screen`, await address());
  await ev(() => window.localStorage.clear());
  await open(def);
  await landingHome(`link #/${def}`);
  check(((await ev(() => window.__app.lobby())) ?? (await pos()).volumeId) === def, `link #/${def} opens the volume on its home screen`, `${await where()} ${await hash()}`);
  check(!(await names()).includes('sys-library') && !(await names()).includes('volume-card-_dev'), 'the sandbox pseudo-volume has no library chrome');

  // 9. migration of a v1 record -------------------------------------------------------------------------
  await ev(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'electricity:v1',
      JSON.stringify({
        v: 1,
        settings: { volume: 0.35 },
        progress: { visited: { atom: ['dive-in', 'anatomy', 'quarks'], 'plant-wind': ['overview'] } },
        last: { chapterId: 'plant-wind', stepId: 'betz' },
      }),
    );
  });
  await open('');
  const migrated = await ev(() => {
    const s = window.__app.engine.store.get();
    return { visited: s.progress.visited, last: s.last, volume: s.settings.volume, v2: window.localStorage.getItem('electricity:v2') !== null };
  });
  if (fresh) {
    check(
      migrated.volume === 0.35 && migrated.v2 && migrated.last?.volumeId === def && !migrated.visited[`${legacy}/atom`],
      'migration (fresh start): settings taken over, the old progress and position are not restored',
      JSON.stringify(migrated),
    );
  } else check(
    migrated.visited[`${legacy}/atom`]?.length === 3 && migrated.visited[`${legacy}/plant-wind`]?.includes('overview') && migrated.volume === 0.35 && migrated.v2,
    'migration: v1 progress and settings are taken over into the legacy volume',
    JSON.stringify(migrated),
  );
  // `#/` resumes the old position only while volume 1 is in the main flow; an aside volume resumes when entered
  if (fresh) check((await address()).startsWith(`${def}/`), 'migration (fresh start): `#/` opens the first step of the default volume', await address());
  else if (!aside.includes(legacy)) check((await address()) === `${legacy}/plant-wind/betz`, 'migration: the app resumes at the old last position', await address());
  else {
    check((await where()) === `lobby:${def}` || (await pos()).volumeId === def, 'migration: `#/` still opens the front door', await where());
    await open(legacy);
    check((await address()) === `${legacy}/plant-wind/betz`, 'migration: entering volume 1 resumes at the old last position', await address());
  }
  await ev(() => window.localStorage.clear());

  // 10. production: no dev volumes without ?debug ----------------------------------------------------------
  const before = requests.length;
  await openApp(page, `${base}?noaudio&q=high&freeze=2&n=prod#/_demo/wave/oscillation`);
  await settle(10);
  const prod = await ev(() => ({ volumes: window.__app.listVolumes(), pos: window.__app.position(), lobby: window.__app.lobby() }));
  const published = volumes.filter((v) => v.status === 'published').map((v) => v.id);
  check(prod.volumes.map((v) => v.id).join(' ') === published.join(' '), 'production: only the published volumes are registered', prod.volumes.map((v) => v.id).join(' '));
  check((prod.lobby ?? prod.pos.volumeId) === def, 'production: a link into a dev volume falls back to the default volume', JSON.stringify(prod));
  await page.keyboard.press('l');
  await settle(30);
  check((await ev(() => window.__ui.overlay())) !== 'library', 'production: the library key does nothing while the main flow is one volume');
  const builtAssets = requests.some((u) => /\/assets\/index-[\w-]+\.js$/.test(u));
  if (builtAssets) {
    const dev = requests.slice(before).filter((u) => /_demo|_dev|_sandbox|\/volume-[\w-]{8}\.js/.test(u));
    check(dev.length === 0, 'production: no dev-volume chunk is requested without ?debug', dev.join(' '));
  } else {
    console.log('  note production chunk check skipped: this is a dev server (run with --base against a production build)');
  }
} catch (error) {
  failures.push(`exception: ${error.message}`);
  console.error(error);
  shots.push(await screenshot(page, `${out}/error.jpg`));
} finally {
  await browser.close();
}
if (shots.length > 0) {
  const sheet = new URL('./sheet.sh', import.meta.url).pathname;
  console.log(execFileSync(sheet, [`${out}/sheet.jpg`, '--cols', '3', '--title', 'library of volumes — demo walkthrough', ...shots], { encoding: 'utf8' }).trim());
}
console.log(failures.length === 0 ? 'PASS library-check' : `FAILED library-check: ${failures.length} problem(s)\n  ${failures.join('\n  ')}`);
process.exit(failures.length === 0 ? 0 : 1);
