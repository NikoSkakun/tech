// «Почати з нуля» end to end, in real time by default (the clock runs, nothing frozen): note the first visit of
// the start address, walk into a later step, reset, and check the reload lands exactly where a first visit does —
// same address, the volume's title screen open, progress empty, query flags kept, no app errors.
//   node tools/qa/reset-check.mjs [--port 5295 | --base URL] [--hud dom|gl] [--touch] [--freeze]
//                                 [--from circuit/wire] [--out DIR]
// `--hud dom` resets through the system bar (touch: the «Меню»), `--hud gl` through the settings overlay's
// press-twice «Почати з нуля». `--freeze` runs the same flow on the frozen clock (`?freeze=1`, stepped by hand).
import { launch, openApp, baseUrl, parseArgs, screenshot, ensureDir, QA_ROOT } from './lib.mjs';

const args = parseArgs();
const touch = !!args.touch;
const freeze = !!args.freeze;
const hud = args.hud === 'gl' ? 'gl' : 'dom';
const from = args.from ?? 'circuit/wire';
const [width, height] = touch ? [390, 844] : [1280, 720];
const base = baseUrl({ port: 5295, ...args });
const out = args.out ?? `${QA_ROOT}/reset-check/${hud}-${touch ? 'touch' : 'mouse'}-${freeze ? 'frozen' : 'live'}`;
ensureDir(out);
const query = `?hud=${hud}&noaudio${freeze ? '&freeze=1' : ''}`;
console.log(`reset-check: ${base}${query} — ${hud}, ${touch ? 'touch' : 'mouse'}, ${freeze ? 'frozen clock' : 'real time'}`);

const fails = [];
const check = (ok, what, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(what);
};
const { browser, page } = await launch({ width, height, touch, dpr: touch ? 2 : 1 });
/** Let `s` seconds of app time pass: stepped on the frozen clock, waited out in real time. */
const settle = (s) =>
  freeze
    ? page.evaluate((n) => window.__app.step(1 / 60, n), Math.round(s * 60))
    : page.waitForTimeout(Math.round(s * 1000));
const state = () =>
  page.evaluate(() => {
    const saved = localStorage.getItem('electricity:v2');
    return {
      hash: location.hash,
      search: location.search,
      overlay: window.__ui.overlay(),
      visited: Object.keys(window.__app.engine.store.get().progress.visited).length,
      savedVisited: saved ? Object.keys(JSON.parse(saved).progress?.visited ?? {}).length : 0,
      errors: window.__app.errors(),
    };
  });
const ready = async () => {
  await page.waitForFunction(() => typeof window.__app === 'object');
  await page.evaluate(() => window.__app.ready);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await settle(2);
};
/** A press the way the reader does it: touch taps on phones, the mouse elsewhere. */
const press = async (x, y) => {
  if (touch) return page.touchscreen.tap(x, y);
  await page.mouse.move(x, y);
  await settle(0.1);
  await page.mouse.down();
  await settle(0.1);
  await page.mouse.up();
};
const pressLocator = async (sel) => {
  const b = await page.locator(sel).boundingBox();
  if (!b) throw new Error(`not visible: ${sel}`);
  await press(b.x + b.width / 2, b.y + b.height / 2);
};
/** A node of the WebGL interface, by name (`__ui.locate`: centre in CSS pixels). */
const pressNode = async (name) => {
  // a node below a scrolling panel's fold (settings on a phone): scroll it into view first, as a reader would
  for (let i = 0; i < 12; i++) {
    const at = await page.evaluate((n) => window.__ui.locate(n), name);
    if (!at || (at.y > 40 && at.y < height - 40)) break;
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, at.y > height / 2 ? 300 : -300);
    await settle(0.4);
  }
  const b = await page.evaluate((n) => window.__ui.locate(n), name);
  if (!b) throw new Error(`no WebGL node: ${name}`);
  await press(b.x, b.y);
};
/** Open the confirmation and confirm, the reader's way in each interface; resolves once the page reloaded. */
const reset = async () => {
  if (hud === 'dom') {
    await pressLocator(touch ? '[data-ui="sys-menu"]' : '[data-ui="sys-reset"]');
    await settle(0.6);
    if (touch) {
      await pressLocator('[data-ui="menu-reset"]');
      await settle(0.6);
    }
    check((await state()).overlay === 'reset', 'the button opens the confirmation');
    await screenshot(page, `${out}/02-confirm.jpg`, 85);
  } else {
    // phones: the settings sit in the «Меню»
    if (touch) {
      await pressNode('sys-menu');
      await settle(1);
      await pressNode('menu-settings');
    } else await pressNode('sys-settings');
    await settle(1);
    check((await state()).overlay === 'settings', 'settings open');
    await pressNode('settings-wipe'); // first press arms it
    await settle(0.3);
    await screenshot(page, `${out}/02-armed.jpg`, 85);
  }
  const reloaded = page.waitForEvent('load', { timeout: 30000 });
  if (hud === 'dom') await pressLocator('[data-ui="reset-confirm"]');
  else await pressNode('settings-wipe');
  await reloaded;
  await ready();
};

try {
  // a first visit of the bare address: where it lands and what it shows
  await openApp(page, `${base}${query}`);
  await ready();
  const fresh = await state();
  console.log(`  first visit: ${fresh.hash}, overlay ${fresh.overlay}`);
  check(fresh.overlay === 'home', 'a first visit opens the title screen', String(fresh.overlay));
  await screenshot(page, `${out}/00-fresh.jpg`, 85);
  // the reader walks on: a later chapter, progress recorded (the reset must not come back here)
  await page.evaluate((a) => window.__app.goto(a), from);
  await page.evaluate(() => window.__ui.close()); // past the title screen
  await settle(3);
  const before = await state();
  check(before.visited > 0 && before.hash !== fresh.hash, 'progress recorded, away from the start', `${before.hash}, ${before.visited} visited`);
  await screenshot(page, `${out}/01-before.jpg`, 85);

  await reset();
  // real time: give the running app a while to write the address, as a reader would wait
  await settle(3);
  const after = await state();
  console.log(`  after reset: ${after.hash}${after.search}, overlay ${after.overlay}`);
  check(after.hash === fresh.hash, 'reloaded at the beginning (same address as a first visit)', `${after.hash} vs ${fresh.hash}`);
  check(after.overlay === 'home', 'the title screen is open, as on a first visit', String(after.overlay));
  check(after.search === fresh.search, 'query flags kept', after.search);
  check(after.visited === 0 && after.savedVisited === 0, 'progress empty (store and saved)', `${after.visited}/${after.savedVisited}`);
  check(after.errors.length === 0, 'no app errors', JSON.stringify(after.errors).slice(0, 200));
  await screenshot(page, `${out}/03-after.jpg`, 85);
} catch (e) {
  check(false, 'flow ran', e.message);
} finally {
  await browser.close();
}
console.log(fails.length ? `FAIL (${fails.length})` : 'PASS');
process.exit(fails.length ? 1 : 0);
