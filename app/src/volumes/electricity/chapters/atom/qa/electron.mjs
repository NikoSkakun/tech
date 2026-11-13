/* global process */
// Screenshot scenario: step `electron`; $ADD = "1000,100,100" clicks the scoops; $MODE = charge toggles the comparison.
import { advance, click } from './helpers.mjs';

export default async (page) => {
  for (const n of (process.env.ADD ?? '').split(',').filter(Boolean)) {
    await click(page, `add${n}`);
    await advance(page, 0.5);
  }
  if (process.env.MODE === 'charge') await click(page, 'compare', 0.08);
  await advance(page, Number(process.env.SETTLE ?? 3));
};
