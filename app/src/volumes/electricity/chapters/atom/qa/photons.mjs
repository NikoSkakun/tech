/* global process, console */
// Screenshot scenario: step `ions-photons`; $E = slider fraction (0…1) of 0,5…16 eV; $FIRE = fire | volley; $T = wait.
import { advance, click, slide, value } from './helpers.mjs';

export default async (page) => {
  if (process.env.E) await slide(page, 'photonE', Number(process.env.E));
  console.log('E =', await value(page, 'photonE'));
  if (process.env.FIRE) await click(page, process.env.FIRE);
  await advance(page, Number(process.env.T ?? 1));
};
