/**
 * Content ids of the document's hotspots, per step (`id` = slug of the hotspot's international name in the
 * generated content). Steps bind markers with `hot(anchor, HOTSPOTS.step.key)`; the card takes its display
 * title and text from the content. `__tests__/manifest.test.ts` fails when the document gains, loses or
 * renames a hotspot.
 */
export const HOTSPOTS = {
  overview: { hrsg: 'hrsg', peaker: 'peaker', engines: 'engine-hall', gasStation: 'gas-station' },
  'natural-gas': { odorant: 'odorant', booster: 'gas-booster-compressor' },
  'gas-turbine': { igv: 'inlet-guide-vanes', bleed: 'bleed-air', starter: 'starter' },
  'brayton-sim': { ts: 't-s-diagram' },
  'hot-section': { holes: 'cooling-holes', crystal: 'single-crystal' },
  'combined-cycle': { drum: 'drum', bypass: 'bypass-stack', acc: 'acc' },
  flexibility: { stress: 'thermal-stress' },
  'gas-engines': { turbo: 'turbocharger', container: 'container-unit' },
  'emissions-hydrogen': { flare: 'flare', h2flame: 'hydrogen-flame' },
  role: { bridge: 'bridge-fuel' },
} as const;
