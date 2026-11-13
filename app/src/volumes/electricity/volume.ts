/**
 * Volume 1 — electricity. Identity, journey order and groups are data (`volume.json`, shared with the document
 * pipeline and the build); this file adds what needs code: the journey axis and its formatter, map hints,
 * the default environment and the development fixtures.
 */
import { fmtScale } from '@/content';
import { defineVolume } from '@/engine/api';
import identity from './volume.json';

export default defineVolume(identity, {
  journey: {
    // The axis is the scale of things: log₁₀ of the characteristic size in metres, 10⁻¹⁸ m (quarks) … 10⁶ m
    // (the continental grid). A chapter's `axisValue` is that exponent; the map draws 10⁻¹⁰ m at height 0.
    axis: {
      min: -18,
      max: 6,
      origin: -10,
      tick: 1,
      majorEvery: 4,
      format: (exp) => fmtScale(exp),
      // moving up in scale zooms the camera out
      ascending: 'out',
    },
    emblems: { micro: 'micro', em: 'em', plants: 'plants', grid: 'grid', home: 'home', labs: 'labs' },
  },
  glossary: { scope: 'volume' },
  theme: { sky: 'day', mood: 'diorama' },
  fixtures: {
    journey: () => import('./fixtures/journey').then((m) => m.JOURNEY_FIXTURE),
    glossary: () => import('./fixtures/glossary').then((m) => m.GLOSSARY_FIXTURE),
  },
});
