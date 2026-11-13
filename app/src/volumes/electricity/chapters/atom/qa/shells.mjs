/* global process, window */
// Screenshot scenario: step `shells`; $MODE = hover (Fe tile) | group | ladder.
import { advance, click, project } from './helpers.mjs';

export default async (page) => {
  const mode = process.env.MODE ?? '';
  if (mode === 'hover') {
    const p = await project(page, ...(await page.evaluate(() => window.__atomQa['shells.tile']())));
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  if (mode === 'group') await click(page, 'group11');
  if (mode === 'ladder') await click(page, 'filling', 0.08);
  await advance(page, Number(process.env.SETTLE ?? 2.5));
};
