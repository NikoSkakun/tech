/* global process, window */
// Screenshot scenario: step `nucleus`; $MODE = drag (pull the proton $PULL px right and hold) | burst.
import { advance, click, project } from './helpers.mjs';

export default async (page) => {
  const mode = process.env.MODE ?? '';
  if (mode === 'drag') {
    const p = await project(page, ...(await page.evaluate(() => window.__atomQa['nucleus.hero']())));
    await page.mouse.move(p.x, p.y);
    await advance(page, 0.2);
    await page.mouse.down();
    await page.mouse.move(p.x + Number(process.env.PULL ?? 90), p.y - 30, { steps: 10 });
    await advance(page, 1);
    if (process.env.RELEASE) {
      await page.mouse.up();
      await advance(page, Number(process.env.RELEASE));
    }
    return;
  }
  if (mode === 'burst') {
    await click(page, 'removeNeutrons');
    await advance(page, Number(process.env.T ?? 1.2));
    return;
  }
  await advance(page, 2);
};
