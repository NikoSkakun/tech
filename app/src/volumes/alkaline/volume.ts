/**
 * The mini-volume «Батарейка · Що в ній і як вона працює»: the ordinary AA alkaline battery of the `circuit` stand
 * opened layer by layer, down to one zinc atom, and back to the lamp it lights. Identity, layers and the whole
 * planned journey are data (`volume.json`, from docs/volumes/alkaline/PATH.md); chapters are written in the path
 * format (docs/PATH_FORMAT.md). The home scene is the stand of `circuit`, borrowed (`"borrows": ["circuit"]`).
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the floor of the scene (docs/volumes/alkaline/VOLUME.md §6): atoms 0, grains 1, the battery 2, the
    // stand 3 — equal steps on the map, named on the ruler (`axis.floors`). Going up zooms out.
    axis: {
      min: 0,
      max: 3,
      origin: 0,
      tick: 1,
      majorEvery: 1,
      format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '',
      ascending: 'out',
    },
    layout: { dx: 230, dy: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'studio', mood: 'studio' },
});
