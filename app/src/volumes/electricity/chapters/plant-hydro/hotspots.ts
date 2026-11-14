/**
 * Content ids of all hotspots of the document, per step (`{#id}` in the script, `steps[].hotspots[].id` in the
 * export). Steps bind markers with `hot(anchor, HOTSPOTS.dams.grout)` (`steps/hot.ts`) — always by id, never
 * by index or name (brief, «Wave 2», C7). `__tests__/manifest.test.ts` fails when the document gains, loses or
 * renames one.
 */
export const HOTSPOTS = {
  overview: {
    dam: 'dam',
    spillway: 'spillway',
    powerhouse: 'powerhouse',
    upper: 'upper-reservoir',
    fish: 'fish-ladder',
  },
  'water-energy': { netHead: 'net-head' },
  dams: { grout: 'grout-curtain', gallery: 'inspection-gallery' },
  'water-path': { stayVanes: 'stay-vanes', headCover: 'head-cover' },
  turbines: { deflector: 'deflector', servo: 'kaplan-blade-servo' },
  'generator-governor': { excitation: 'excitation', brakes: 'brake-jacks' },
  'reservoir-environment': { fish: 'fish-ladder', flushing: 'sediment-flushing' },
  'pumped-storage': { reversal: 'reversal', variableSpeed: 'variable-speed-unit' },
  'role-ukraine': { kakhovka: 'kakhovka' },
} as const;
