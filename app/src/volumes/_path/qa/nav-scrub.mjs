#!/usr/bin/env node
/* global console, window, document, getComputedStyle */
// _path sandbox QA (UI_API §3.3, §3.4): the navigator held back until the goal (_sandbox-path/core) and the scrub slider (_sandbox-flow/drift).
//   node app/src/volumes/_path/qa/nav-scrub.mjs --port 5282 [--size 1280x720]
import {
  launch,
  openApp,
  parseArgs,
  baseUrl,
  ensureDir,
  screenshot,
  parseSize,
  QA_ROOT,
} from '../../../../../tools/qa/lib.mjs';

const args = parseArgs();
const base = baseUrl(args);
const out = ensureDir(String(args.out ?? `${QA_ROOT}/_path-nav-scrub`));
const [w, hh] = parseSize(args.size, [1280, 720]);
const fails = [];
const check = (ok, what, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? `  [${detail}]` : ''}`);
  if (!ok) fails.push(what);
};
const { browser, page } = await launch({ width: w, height: hh });
const ev = (fn, a) => page.evaluate(fn, a);
const step = (s) => ev((x) => window.__app.step(1 / 30, Math.round(x * 30)), s);
const navState = () =>
  ev(() => {
    const n = document.querySelector('[data-ui="navigator"]');
    return {
      held: window.__ui.navHidden(),
      inert: n.inert,
      opacity: getComputedStyle(n).opacity,
      vis: getComputedStyle(n).visibility,
    };
  });
try {
  await openApp(page, `${base}?debug&overlay=0&noaudio&q=high&hud=dom&freeze=2#/_path/_sandbox-path/core`);
  await page.waitForFunction(() => window.__app.position()?.stepId === 'core', null, { timeout: 30000 });
  await step(1);
  let s = await navState();
  check(
    s.held && s.inert && s.vis === 'hidden',
    'deep link: navigator held back (inert, hidden)',
    JSON.stringify(s),
  );
  await shot('1-held');
  await page.click('[data-ui="path-opening"] button');
  await page.keyboard.press('ArrowRight');
  await step(1);
  check((await ev(() => window.__app.position().stepId)) === 'core', 'ArrowRight does nothing while held');
  await ev(() => window.__ui.press('core-do-0'));
  await step(0.5);
  check((await navState()).held, 'still held after one of two actions');
  await ev(() => window.__ui.press('core-do-1'));
  await step(0.2);
  s = await navState();
  check(!s.held && !s.inert && s.vis !== 'hidden', 'goal reached: navigator revealed', JSON.stringify(s));
  await step(1);
  check((await navState()).opacity === '1', 'fade-in completes on the engine clock');
  await shot('2-revealed');
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowRight');
  await step(1.5);
  check((await ev(() => window.__app.position().stepId)) === 'sheath', 'ArrowRight goes on once revealed');

  await ev(() => window.__app.goto('_path/_sandbox-flow', 'drift'));
  await step(1.5);
  if (await ev(() => !!document.querySelector('[data-ui="path-opening"] button')))
    await page.click('[data-ui="path-opening"] button');
  const box = await ev(() => {
    const r = document.querySelector('[data-ui="ctl-drift-scrub"] input').getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, w: r.width };
  });
  await page.mouse.click(box.x + box.w * 0.95, box.y); // a click on the track: a jump, the scene eases there
  await step(0.1);
  const fill = () =>
    ev(() =>
      parseFloat(
        getComputedStyle(document.querySelector('[data-ui="ctl-drift-scrub"] .dk-track')).getPropertyValue(
          '--c',
        ) || '0',
      ),
    );
  const thumb = () =>
    ev(() =>
      parseFloat(
        getComputedStyle(document.querySelector('[data-ui="ctl-drift-scrub"] .dk-track')).getPropertyValue(
          '--t',
        ) || '0',
      ),
    );
  const early = await fill();
  check(
    (await thumb()) > 0.9 && early < 0.6,
    'click: the thumb at the target, the fill still on its way',
    `t ${await thumb()} c ${early}`,
  );
  await shot('3-easing');
  // grabbed mid-glide (UI_API §3.3): the scene does not jump to the hand, it eases on and then follows the drag
  const tb = await ev(() => {
    const r = document.querySelector('[data-ui="ctl-drift-scrub"] input').getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, w: r.width };
  });
  const before = await fill();
  await page.mouse.move(tb.x + tb.w * (await thumb()), tb.y);
  await page.mouse.down();
  await page.mouse.move(tb.x + tb.w * 0.85, tb.y, { steps: 4 });
  await step(1 / 30);
  const grabbed = await fill();
  check(
    grabbed - before < 0.15,
    'grabbed mid-glide: no jump to the hand',
    `fill ${before.toFixed(3)} → ${grabbed.toFixed(3)}`,
  );
  await step(2);
  check(Math.abs((await fill()) - (await thumb())) < 0.03, '…it catches up with the hand');
  await page.mouse.move(tb.x + tb.w * 0.97, tb.y, { steps: 4 });
  await step(0.05);
  check(Math.abs((await fill()) - (await thumb())) < 0.03, '…and then follows the drag directly');
  await page.mouse.up();
  await step(2);
  check((await fill()) > 0.9, 'the fill reaches the target');
  // a drag: the scene follows the thumb directly
  const b2 = await ev(() => {
    const r = document.querySelector('[data-ui="ctl-drift-scrub"] input').getBoundingClientRect();
    return { x: r.x, y: r.y + r.height / 2, w: r.width };
  });
  console.log('  track before / now:', JSON.stringify(box), JSON.stringify(b2));
  Object.assign(box, b2);
  await page.mouse.move(box.x + box.w * 0.6, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w * 0.3, box.y, { steps: 8 });
  await step(0.05);
  const [t, c] = [await thumb(), await fill()];
  check(t < 0.4 && Math.abs(t - c) < 0.05, 'drag: the fill follows the thumb', `t ${t} c ${c}`);
  await page.mouse.up();
  await shot('4-drag');
  const errors = await ev(() => window.__app.errors());
  check(
    errors.length === 0,
    'no console errors',
    errors
      .map((e) => e.message)
      .join(' | ')
      .slice(0, 200),
  );
} catch (e) {
  check(false, `crashed: ${e.message}`);
} finally {
  await browser.close();
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS _path nav-scrub');
async function shot(name) {
  console.log('  ' + (await screenshot(page, `${out}/${w}x${hh}-${name}.jpg`)));
}
