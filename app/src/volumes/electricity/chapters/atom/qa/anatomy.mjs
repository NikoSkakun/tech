/* global process */
// Screenshot scenario: step `anatomy` with «Справжні пропорції» on ($MODE = pea | ball) or off (default).
import { advance, click, pickTab } from './helpers.mjs';

export default async (page) => {
  const mode = process.env.MODE ?? '';
  if (mode === 'pea') await click(page, 'trueScale', 0.08);
  if (mode === 'ball') await pickTab(page, 0, 1, 2);
  await advance(page, 4);
};
