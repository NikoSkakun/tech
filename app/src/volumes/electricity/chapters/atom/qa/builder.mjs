/* global process */
// Screenshot scenario: step `atom-builder`; $PRESET = preset id; $N = neutron slider fraction afterwards.
import { advance, click, slide } from './helpers.mjs';

export default async (page) => {
  if (process.env.PRESET) await click(page, `preset-${process.env.PRESET}`);
  if (process.env.N) await slide(page, 'nn', Number(process.env.N));
  await advance(page, Number(process.env.T ?? 2));
};
