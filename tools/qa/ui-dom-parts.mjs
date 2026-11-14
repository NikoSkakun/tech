// Interface checks of ui-check for the DOM renderer and the motion rule (D8, docs/HUD_DOM.md §12, §14,
// DECISIONS §59 p). Every function takes the Playwright page, `check(ok, what, detail)` and `frames(n)`.

/** Full-screen layer containers of the WebGL HUD (`hud/shell.ts`): named, always "shown", draw nothing. */
const GL_LAYERS = ['root', 'chrome', 'annotations', 'popups', 'modal'];

/** Named HUD elements on screen that the WebGL HUD draws (no `[data-ui]` element of that name in #kd-hud). */
export async function webglNames(page) {
  return page.evaluate(
    (layers) =>
      (window.__ui?.names?.() ?? []).filter(
        (n) => !layers.includes(n) && !document.querySelector(`#kd-hud [data-ui="${CSS.escape(n)}"]`),
      ),
    GL_LAYERS,
  );
}

/**
 * Track of a slider control in CSS px: under `dom` the `<input type=range>` inside `[data-ui=name]` (or the
 * element itself); null when the control is a WebGL node (the caller keeps its WebGL geometry).
 */
export async function domSliderTrack(page, name) {
  return page.evaluate((n) => {
    const el = document.querySelector(`#kd-hud [data-ui="${CSS.escape(n)}"]`);
    const input = el?.matches('input[type=range]') ? el : el?.querySelector('input[type=range]');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { x0: r.left, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }, name);
}

/** Description of the focused element: `tag[@dom]:name`. */
export function activeElement(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return 'none';
    return `${a.tagName.toLowerCase()}${a.closest('#kd-hud') ? '@dom' : ''}:${a.getAttribute('data-ui') ?? a.getAttribute('aria-label') ?? a.id ?? ''}`;
  });
}

/**
 * DOM-only keyboard and text checks (HUD_DOM §14): Tab from the canvas reaches a control of the DOM interface;
 * a modal opened from a focused button closes with Esc and gives the focus back; the step text can be selected
 * with a mouse drag (it is real text, D0 probe).
 */
export async function domKeyboardChecks(page, { check, frames }) {
  const settle = async () => {
    await page.evaluate(() => window.__app.settled());
    await frames(30);
  };
  // first, before Tab scrolls the step text: drag across its first line (the text is scrolled to the top)
  const text = await page.evaluate(() => {
    const el = document.querySelector('#kd-hud [data-ui="step-text"]');
    if (el) el.scrollTop = 0;
    const line = el?.querySelector('.page:not([hidden])') ?? el;
    const r = line?.getBoundingClientRect();
    return r && r.width > 0 ? { x: r.left, y: r.top, w: r.width } : null;
  });
  if (!text) check(false, 'dom: step text is selectable', 'no DOM step text');
  else {
    await page.mouse.move(text.x + 2, text.y + 10);
    await page.mouse.down();
    await page.mouse.move(text.x + text.w - 4, text.y + 12, { steps: 8 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '');
    check(selected.trim().length >= 10, 'dom: step text is selectable with a mouse drag', `«${selected.slice(0, 40)}»`);
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
  }

  await page.evaluate(() => document.querySelector('canvas')?.focus());
  const onCanvas = await activeElement(page);
  await page.keyboard.press('Tab');
  const first = await activeElement(page);
  check(onCanvas.startsWith('canvas') && first.includes('@dom'), 'dom: Tab from the canvas reaches the first DOM control', `${onCanvas} → ${first}`);
  const walk = [first];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    walk.push(await activeElement(page));
  }
  check(new Set(walk).size >= 5 && walk.every((a) => a.includes('@dom')), 'dom: Tab walks the DOM controls', walk.join(' → '));

  const button = await page.$('#kd-hud [data-ui="nav-next"]');
  if (!button) check(false, 'dom: Esc restores the focus', 'no DOM «Далі» button (navigator not on the DOM)');
  else {
    await button.focus();
    await page.keyboard.press('KeyM');
    await settle();
    const opened = await page.evaluate(() => window.__ui.overlay());
    await page.keyboard.press('Escape');
    await settle();
    await frames(40);
    const back = await activeElement(page);
    const closed = await page.evaluate(() => window.__ui.overlay());
    check(opened === 'map' && closed === null && back.includes('nav-next'), 'dom: Esc closes the map and gives the focus back to «Далі»', `${opened} → ${closed}, focus ${back}`);
  }
}

/** CSS-px boxes of every named interface element on screen (`__ui.names()` + `locate`, both renderers). */
function boxes(page) {
  return page.evaluate(() => {
    const out = {};
    for (const n of window.__ui.names()) out[n] = window.__ui.locate(n);
    return out;
  });
}

/**
 * Motion rule (DECISIONS §59 p): the interface is flat and never follows the pointer. Moves the mouse (no
 * button) over a `cols × rows` grid of the viewport and back; at every point the box of each named element
 * must equal its box with the pointer parked in the corner, within `tol` CSS px. Exempt: the element(s) under
 * the pointer (hover feedback of a control may scale it) and names present only on one side (tooltips).
 */
export async function pointerSweep(page, { check, frames, tag, cols = 6, rows = 4, tol = 0.5 }) {
  const vp = page.viewportSize();
  await page.mouse.move(1, 1);
  await frames(20);
  const ref = await boxes(page);
  const moved = new Map();
  const points = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) points.push([((i + 0.5) / cols) * vp.width, ((j + 0.5) / rows) * vp.height]);
  points.push([1, 1]);
  for (const [x, y] of points) {
    await page.mouse.move(x, y, { steps: 6 });
    await frames(12);
    const now = await boxes(page);
    for (const [name, a] of Object.entries(ref)) {
      const b = now[name];
      if (!a || !b) continue;
      const under = (r) => Math.abs(x - r.x) <= r.w / 2 + 6 && Math.abs(y - r.y) <= r.h / 2 + 6;
      if (under(a) || under(b)) continue;
      const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
      if (d > tol && !moved.has(name)) moved.set(name, `${name} ${d.toFixed(1)} px @${Math.round(x)},${Math.round(y)}`);
    }
  }
  const compared = Object.keys(ref).length;
  check(moved.size === 0 && compared > 0, `${tag}: interface does not move with the pointer (${compared} elements, ${points.length} points)`, [...moved.values()].slice(0, 5).join('; '));
}
