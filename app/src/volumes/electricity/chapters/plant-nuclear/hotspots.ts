/**
 * Content ids of the document's hotspots, per step (`id` = slug of the hotspot's international name in the
 * generated content). Steps bind markers with `hot(anchor, HOTSPOTS.fuel.plenum)`; the card takes its title
 * and text from the content. `__tests__/manifest.test.ts` fails when the document gains, loses or renames one.
 */
export const HOTSPOTS = {
  overview: { ponds: 'spray-ponds', diesels: 'diesel-generators', dry: 'dry-storage' },
  fission: { u238: 'u-238', antineutrino: 'antineutrino' },
  'chain-reaction': { generation: 'neutron-generation-time' },
  control: { b4c: 'b-c', feedback: 'negative-feedback' },
  fuel: { grid: 'spacer-grid', plenum: 'plenum', guides: 'guide-tubes' },
  reactor: { specimens: 'surveillance-specimens', incore: 'in-core-instrumentation' },
  'primary-loop': { sg: 'horizontal-steam-generator', valves: 'loop-isolation-valves' },
  'reactor-sim': { supervisor: 'shift-supervisor' },
  safety: { accumulator: 'hydro-accumulator', recombiners: 'hydrogen-recombiners', nsc: 'new-safe-confinement' },
  'reactor-types': { void: 'positive-void-coefficient' },
  'fuel-cycle': { centrifuge: 'centrifuge', onkalo: 'onkalo' },
  'role-ukraine': { znpp: 'znpp-status' },
} as const;
