/* global process */
// Screenshot scenario: step `models`; $TAB = index of the orbital tab (0…5) switches to the quantum model;
// $LEVEL = Bohr level 1…3; $ORIENT = orientation tab.
import { advance, pickTab, slide } from './helpers.mjs';

export default async (page) => {
  if (process.env.LEVEL) await slide(page, 'level', (Number(process.env.LEVEL) - 1) / 2);
  if (process.env.TAB) await pickTab(page, 0, Number(process.env.TAB) + 1, 7); // item 0 is «Бор»
  if (process.env.ORIENT) await pickTab(page, 1, Number(process.env.ORIENT), 3);
  await advance(page, Number(process.env.SETTLE ?? 7));
};
