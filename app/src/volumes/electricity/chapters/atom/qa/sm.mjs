/* global process, window */
// Screenshot scenario: step `standard-model`; $TAB = interaction tab 0…3; $MODE = ordinary | pick (the t quark).
import { advance, click, pickTab, project } from './helpers.mjs';

export default async (page) => {
  if (process.env.TAB) await pickTab(page, 0, Number(process.env.TAB), 4);
  if (process.env.MODE === 'ordinary') await click(page, 'ordinary', 0.08);
  if (process.env.MODE === 'pick') {
    const p = await project(page, ...(await page.evaluate(() => window.__atomQa['sm.token']())));
    await page.mouse.click(p.x, p.y);
  }
  await advance(page, Number(process.env.T ?? 2));
};
