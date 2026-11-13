/* global process, window */
// Screenshot scenario: step `quarks`; $MODE = neutron | pull (drag quark 0 by $PULL px and hold) | snap.
import { advance, pickTab, project } from './helpers.mjs';

export default async (page) => {
  const mode = process.env.MODE ?? '';
  if (mode === 'neutron') await pickTab(page, 0, 1, 2);
  if (mode === 'pull' || mode === 'snap') {
    const p = await project(page, ...(await page.evaluate(() => window.__atomQa['quarks.quark0']())));
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const pull = mode === 'snap' ? 360 : Number(process.env.PULL ?? 110);
    await page.mouse.move(p.x - pull * 0.8, p.y - pull * 0.6, { steps: 12 });
    if (mode === 'snap') await page.mouse.up();
    await advance(page, mode === 'snap' ? 0.9 : 0.4);
    return;
  }
  await advance(page, 1.5);
};
