/**
 * Content ids of the document's hotspots, per step (`id` = slug of the hotspot's international name in the
 * generated content). Steps bind markers with `{ anchor, content: HOTSPOTS.blade.leadingEdge }`; the card
 * takes its display title and text from the content. `__tests__/manifest.test.ts` fails when the document
 * gains, loses or renames a hotspot.
 */
export const HOTSPOTS = {
  overview: { turbine: 'wind-turbine', substation: 'substation', offshore: 'offshore-wind-farm' },
  'wind-power': { anemometer: 'anemometer' },
  betz: { tube: 'stream-tube' },
  blade: { leadingEdge: 'leading-edge-protection', lightning: 'lightning-receptor' },
  nacelle: {
    hub: 'hub-spinner',
    pitch: 'pitch-drive',
    shaft: 'main-shaft-bearing',
    gearbox: 'gearbox',
    brake: 'mechanical-brake',
    generator: 'generator',
    converter: 'power-converter',
    yaw: 'yaw-drive-ring',
    sensors: 'wind-sensors-anemometer-wind-vane',
    cooling: 'cooling',
  },
  drivetrain: { dcLink: 'dc-link', slipRings: 'slip-rings' },
  'power-curve': { light: 'aviation-light' },
  'wind-farm': { transformer: 'substation-transformer', cable: 'underground-cable' },
  'capacity-factor': { lidar: 'lidar' },
  offshore: { transition: 'transition-piece', scour: 'scour-protection', hvdc: 'hvdc-platform', mooring: 'mooring-lines' },
  role: { repowering: 'repowering', radar: 'bird-radar' },
} as const;
