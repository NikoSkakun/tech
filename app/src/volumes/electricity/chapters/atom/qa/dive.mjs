/* global process, console */
// Screenshot scenario: turn the scale wheel to stop $STOP (0…4) and let the camera arrive.
import { advance, slide, value } from './helpers.mjs';

export default async (page) => {
  const stop = Number(process.env.STOP ?? 0);
  if (stop > 0) await slide(page, 'wheel', stop / 4);
  await advance(page, Number(process.env.SETTLE ?? 5));
  console.log('wheel =', await value(page, 'wheel'));
};
