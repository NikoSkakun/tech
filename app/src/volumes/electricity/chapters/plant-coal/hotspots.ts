/**
 * Content ids of the document's hotspots, per step (`id` = slug of the hotspot's international name in the
 * generated content). Steps bind markers with `hot(anchor, HOTSPOTS.boiler.burner)`; the card takes its
 * display title and text (and, later, the simple reading level's text) from the content by that id.
 * `__tests__/manifest.test.ts` fails when the document gains, loses or renames a hotspot.
 */
export const HOTSPOTS = {
  overview: { stack: 'stack', tower: 'cooling-tower', boiler: 'boiler-house', hall: 'turbine-hall', yard: 'switchyard' },
  coal: { seam: 'coal-seam' },
  'coal-to-dust': { dumper: 'car-dumper', stacker: 'stacker-reclaimer', classifier: 'classifier' },
  boiler: { burner: 'burner', soot: 'soot-blowers', hopper: 'bottom-ash-hopper' },
  'steam-params': { critical: 'critical-point', alloy: 'alloy' },
  turbine: { turning: 'turning-gear', valves: 'stop-and-control-valves', hydrogen: 'hydrogen-cooling' },
  feedwater: { vacuum: 'vacuum-pump-ejector', treatment: 'water-treatment' },
  'flue-gas': { rapping: 'rapping', stack: 'stack', gypsum: 'gypsum' },
  'ash-co2': { pond: 'ash-pond', storage: 'storage-formation' },
  'chp-flex': { exchanger: 'heat-exchanger', accumulator: 'heat-accumulator' },
  'role-ukraine': { marker: 'map-marker' },
} as const;
