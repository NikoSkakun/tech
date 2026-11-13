/**
 * Dev-only pseudo-volume: the `_sandbox-*` chapters of the platform agents (engine, kit, fx, ui). Registered
 * only with `?debug`, never listed on the library screen; open a sandbox by its address
 * (`#/_dev/_sandbox-ui/controls`, or the short `#/_sandbox-ui/controls`) or from the debug overlay.
 */
import { fmtScale } from '@/content';
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    axis: {
      min: -12,
      max: 4,
      origin: -4,
      tick: 1,
      majorEvery: 4,
      format: (exp) => fmtScale(exp),
      ascending: 'out',
    },
    emblems: { micro: 'micro', em: 'em', plants: 'plants', labs: 'labs' },
  },
  theme: { sky: 'studio', mood: 'studio' },
});
