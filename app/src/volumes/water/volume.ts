/**
 * The mini-volume «Вода · Від склянки до молекули»: from a glass of water with an ice cube down to one molecule
 * and back — why the same substance is ice, liquid and vapour. Identity, layers and the whole planned journey are
 * data (`volume.json`, from docs/volumes/water/PATH.md); chapters are written in the path format
 * (docs/PATH_FORMAT.md). Chapters that are planned but not built stand on the map as planned.
 */
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the floor of the scene (docs/volumes/water/VISUAL.md §3): one molecule 0, the crowd of molecules
    // 1, a drop 2, the table 3 — equal steps on the map, named on the ruler (`axis.floors`). Going up zooms out.
    axis: {
      min: 0,
      max: 3,
      origin: 0,
      tick: 1,
      majorEvery: 1,
      format: (v) => identity.axis.floors.find((f) => f.value === v)?.label ?? '',
      ascending: 'out',
    },
    layout: { dx: 210, dy: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'studio', mood: 'studio' },
});
