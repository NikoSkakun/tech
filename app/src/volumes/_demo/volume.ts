/**
 * Dev-only demo volume «Радіохвилі»: two placeholder chapters with ANOTHER journey axis (frequency instead of
 * scale), their own documents, glossary and generated content. It exists so that the library always has a
 * second volume to test with — library screen, entering a volume, links between volumes, independent
 * progress, glossary scope, a journey map with another axis. Registered only with `?debug` (docs/VOLUMES.md).
 */
import { NBSP, superscript } from '@/content';
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is frequency: log₁₀ of the frequency in hertz, 10⁰ … 10¹² Hz, with 10⁴ Hz at map height 0.
    axis: {
      min: 0,
      max: 12,
      origin: 4,
      tick: 1,
      majorEvery: 3,
      format: (exp) => `10${superscript(exp)}${NBSP}Hz`,
      // a higher frequency is a shorter wave: moving up the axis zooms the camera in
      ascending: 'in',
    },
    emblems: { basics: 'em', devices: 'grid' },
    // two chapters only: spread them wider and make a decade taller than on the electricity map
    layout: { dx: 300, dy: 44, dz: 70 },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'studio', mood: 'studio' },
});
