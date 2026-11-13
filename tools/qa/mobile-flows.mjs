// Flows of mobile-check (F5): the sheet's own gestures, travelling by touch (next / back, journey map) and
// rotating the device without a reload.
import { settle } from './mobile-parts.mjs';

const sheetState = (page) => page.evaluate(() => window.__ui.sheet());
const position = (page) => page.evaluate(() => window.__app.position());

/** Drag the bottom sheet to every snap height (portrait) or collapse and reopen the side sheet (landscape). */
export async function sheetGestures(page, t, { where, fail }) {
  const s = await sheetState(page);
  if (!s) return fail(`${where}: no touch sheet`);
  const vp = page.viewportSize();
  if (s.shell === 'sheet') {
    const grip = await page.evaluate(() => window.__ui.locate('sheet-grip'));
    if (!grip) return fail(`${where}: the sheet has no grip on screen`);
    // down to peek: the scene gets the screen
    await t.drag([grip.x, grip.y], [grip.x, vp.height - 40], { steps: 10, hold: 150 });
    await settle(page);
    if ((await sheetState(page)).snap !== 'peek') fail(`${where}: dragging the grip down did not collapse the sheet to peek`);
    const insetPeek = await page.evaluate(() => window.__app.engine.hud.insetFractions().bottom);
    if (insetPeek > 0.34) fail(`${where}: at peek the sheet still takes ${Math.round(insetPeek * 100)} % of the height from the scene`);
    // a tap on the grip opens it again, a drag to the top makes it full
    await t.tapNode('sheet-grip');
    await settle(page);
    if ((await sheetState(page)).snap !== 'half') fail(`${where}: a tap on the grip did not reopen the sheet`);
    const g2 = await page.evaluate(() => window.__ui.locate('sheet-grip'));
    await t.drag([g2.x, g2.y], [g2.x, 70], { steps: 10, hold: 150 });
    await settle(page);
    if ((await sheetState(page)).snap !== 'full') fail(`${where}: dragging the grip up did not open the sheet fully`);
    const g3 = await page.evaluate(() => window.__ui.locate('sheet-grip'));
    await t.drag([g3.x, g3.y], [g3.x, vp.height * 0.52], { steps: 10, hold: 150 });
    await settle(page);
    if ((await sheetState(page)).snap !== 'half') fail(`${where}: dragging the full sheet down did not return it to half`);
    return;
  }
  // landscape: the side grip collapses the sheet; the scene gets the width back
  const open = await page.evaluate(() => window.__app.engine.hud.insetFractions().right);
  await t.tapNode('sheet-side-grip');
  await settle(page);
  const closed = await page.evaluate(() => window.__app.engine.hud.insetFractions().right);
  if (!(closed < open * 0.5)) fail(`${where}: tapping the side grip did not collapse the side sheet (inset ${open.toFixed(2)} → ${closed.toFixed(2)})`);
  await t.tapNode('sheet-side-grip');
  await settle(page);
  if ((await sheetState(page)).snap === 'peek') fail(`${where}: the side sheet did not reopen`);
}

/** Long press on a named button: its tooltip shows and the button is not activated. */
export async function longPress(page, t, { where, fail }) {
  const box = await page.evaluate(() => window.__ui.locate('sys-map'));
  if (!box) return fail(`${where}: no map button on screen`);
  await t.longPress(box.x, box.y, 750);
  await settle(page, 20);
  const r = await page.evaluate(() => ({ tip: window.__ui.locate('tooltip') !== null, overlay: window.__ui.overlay() }));
  if (!r.tip) fail(`${where}: a long press on the map button did not show its tooltip`);
  if (r.overlay !== null) fail(`${where}: a long press activated the button (overlay '${r.overlay}')`);
  await settle(page, 180); // the tooltip leaves by itself
}

/** «Далі» and back by touch, then the journey map: open it, pick `other`, jump to its first step, return. */
export async function travel(page, t, { where, chapter, other, fail, note }) {
  const start = await position(page);
  const steps = chapter.steps.map((s) => s.id);
  if (steps.length > 1) {
    const at = steps.indexOf(start.stepId);
    const forward = at < steps.length - 1;
    await t.tapNode(forward ? 'nav-next' : 'nav-prev');
    await page.evaluate(() => window.__app.settled());
    const moved = await position(page);
    const want = steps[at + (forward ? 1 : -1)];
    if (moved.stepId !== want) fail(`${where}: «${forward ? 'Далі' : 'назад'}» by touch → '${moved.stepId}', expected '${want}'`);
    await t.tapNode(forward ? 'nav-prev' : 'nav-next');
    await page.evaluate(() => window.__app.settled());
    if ((await position(page)).stepId !== start.stepId) fail(`${where}: the way back by touch did not return to '${start.stepId}'`);
  }
  await settle(page, 20);
  await t.tapNode('sys-map');
  await settle(page, 60);
  if ((await page.evaluate(() => window.__ui.overlay())) !== 'map') return fail(`${where}: the map button did not open the journey map`);
  if (!other) {
    note(`${where}: no other chapter in this volume — map jump not tested`);
  } else {
    // the overview of a long journey scrolls on a phone: show it, then travel along the path with the finger
    // until the chapter's platform is on screen
    await t.tapNode('map-overview');
    await settle(page, 70);
    const vp = page.viewportSize();
    const onScreen = (n) => n && n.x > 30 && n.x < vp.width - 30 && n.y > 110 && n.y < vp.height - 60;
    let node = await page.evaluate((id) => window.__ui.mapNode(id), other.id);
    for (let i = 0; i < 12 && node && !onScreen(node); i++) {
      const dir = node.x < vp.width / 2 ? 1 : -1;
      const y = vp.height * 0.86;
      await t.drag([vp.width / 2, y], [vp.width / 2 + dir * vp.width * 0.4, y], { steps: 8, hold: 100 });
      await settle(page, 50);
      node = await page.evaluate((id) => window.__ui.mapNode(id), other.id);
    }
    if (!node) fail(`${where}: chapter '${other.id}' has no node on the map`);
    else if (!onScreen(node)) fail(`${where}: could not bring '${other.id}' on screen by dragging the map (x ${Math.round(node.x)}, y ${Math.round(node.y)})`);
    else {
      await t.tap(node.x, node.y);
      await settle(page, 60);
      const row = `map-step-${other.steps[0].id}`;
      if (!(await page.evaluate((n) => window.__ui.locate(n) !== null, row))) fail(`${where}: tapping '${other.id}' on the map did not open its card`);
      else {
        await t.tapNode(row);
        await page.evaluate(() => window.__app.settled());
        await settle(page, 30);
        const p = await position(page);
        if (p.chapterId !== other.id) fail(`${where}: the map jump landed on '${p.chapterId}/${p.stepId}', expected '${other.id}'`);
        if ((await page.evaluate(() => window.__ui.overlay())) !== null) fail(`${where}: the map stayed open after the jump`);
      }
    }
  }
  if ((await page.evaluate(() => window.__ui.overlay())) !== null) {
    await t.tapNode('map-close');
    await settle(page, 40);
  }
  await page.evaluate(([c, s]) => window.__app.goto(c, s, { instant: true }), [`${start.volumeId}/${start.chapterId}`, start.stepId]);
  await page.evaluate(() => window.__app.settled());
  await settle(page, 30);
}

/** Rotate the device and back without a reload: same step, the other shell, the sheet still there. */
export async function rotation(page, { where, profile, fail }) {
  const before = await position(page);
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await settle(page, 40);
  const turned = await page.evaluate(() => ({ p: window.__app.position(), d: window.__app.device(), s: window.__ui.sheet(), off: window.__ui.offscreen().map((n) => n.name) }));
  const wantShell = profile.shell === 'sheet' ? 'side' : 'sheet';
  if (turned.p.stepId !== before.stepId || turned.p.chapterId !== before.chapterId) fail(`${where}: rotation changed the position to ${turned.p.chapterId}/${turned.p.stepId}`);
  if (!turned.s || turned.s.shell !== wantShell) fail(`${where}: after rotation the shell is '${turned.s?.shell}', expected '${wantShell}'`);
  if (turned.off.length) fail(`${where}: after rotation ${turned.off.length} control(s) are off screen: ${turned.off.slice(0, 3).join(', ')}`);
  await page.setViewportSize(vp);
  await settle(page, 40);
  const back = await page.evaluate(() => ({ p: window.__app.position(), s: window.__ui.sheet() }));
  if (back.p.stepId !== before.stepId) fail(`${where}: rotating back changed the step to '${back.p.stepId}'`);
  if (!back.s || back.s.shell !== profile.shell) fail(`${where}: rotating back did not restore the '${profile.shell}' shell`);
}

/**
 * The library level by touch (only where the app shows it: more than one volume, or a listed dev volume such
 * as `_demo`): menu → «Бібліотека» → the library screen → open another volume; and the glossary's scope switch.
 */
export async function libraryLevel(page, t, { where, fail, note, layout }) {
  const start = await position(page);
  const overlay = () => page.evaluate(() => window.__ui.overlay());
  const has = (name) => page.evaluate((n) => window.__ui.locate(n) !== null, name);
  await t.tapNode('sys-menu');
  await settle(page, 40);
  if ((await overlay()) !== 'menu') return fail(`${where}: the menu button did not open the menu`);
  await layout(`${where} [menu]`);
  if (!(await has('menu-library'))) {
    note(`${where}: single volume — no library level to test`);
    await page.evaluate(() => window.__ui.close());
    await settle(page, 30);
    return;
  }
  // glossary: the scope switch widens the list to the whole library
  await t.tapNode('menu-glossary');
  await page.waitForTimeout(600); // the terms load asynchronously
  await settle(page, 50);
  if ((await overlay()) !== 'glossary') fail(`${where}: «Глосарій» in the menu did not open the glossary`);
  else if (!(await has('glossary-scope:library'))) fail(`${where}: the glossary has no scope switch at the library level`);
  else {
    await t.tapNode('glossary-scope:library');
    await page.waitForTimeout(600);
    await settle(page, 50);
    if ((await overlay()) !== 'glossary') fail(`${where}: switching the glossary scope closed the glossary`);
    await layout(`${where} [glossary, library scope]`);
  }
  await page.evaluate(() => window.__ui.close());
  await settle(page, 30);
  // the library screen
  await t.tapNode('sys-menu');
  await settle(page, 40);
  await t.tapNode('menu-library');
  await page.waitForTimeout(400);
  await settle(page, 70);
  if ((await overlay()) !== 'library') return fail(`${where}: «Бібліотека» in the menu did not open the library screen`);
  await layout(`${where} [library]`);
  const others = await page.evaluate((cur) => window.__app.listVolumes().filter((v) => v.listed && v.id !== cur).map((v) => v.id), start.volumeId);
  const target = others.find(Boolean);
  if (!target || !(await has(`volume-open-${target}`))) fail(`${where}: no other volume card to open on the library screen`);
  else {
    // on a short screen the card's button is below the fold of the shelf: scroll it into view with the finger
    const vp = page.viewportSize();
    const hiddenNow = () =>
      page.evaluate((n) => {
        const b = window.__ui.locate(n);
        const cut = window.__ui.offscreen({ clipped: true }).some((o) => o.name === n);
        return cut || !b || b.y + b.h / 2 > window.innerHeight - 4;
      }, `volume-open-${target}`);
    for (let i = 0; i < 5 && (await hiddenNow()); i++) {
      await t.drag([vp.width / 2, vp.height * 0.8], [vp.width / 2, vp.height * 0.45], { steps: 8, hold: 150 });
      await settle(page, 40);
    }
    if (await hiddenNow()) fail(`${where}: could not scroll the «${target}» card's button into view`);
    await t.tapNode(`volume-open-${target}`);
    await page.evaluate(() => window.__app.settled());
    await settle(page, 60);
    const p = await position(page);
    if (p.volumeId !== target) fail(`${where}: opening volume '${target}' by touch landed in '${p.volumeId}'`);
  }
  await page.evaluate(() => window.__ui.close());
  await page.evaluate(([c, s]) => window.__app.goto(c, s, { instant: true }), [`${start.volumeId}/${start.chapterId}`, start.stepId]);
  await page.evaluate(() => window.__app.settled());
  if ((await overlay()) !== null) await page.evaluate(() => window.__ui.close());
  await settle(page, 40);
}
