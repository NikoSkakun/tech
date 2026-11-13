/**
 * Behaviour of the five inverter types of step 9 for «мережа є / немає» × «сонце є / немає» — who feeds whom
 * and whether the house has light. Logic of the chapter document (step 9 panel text), not a physical model:
 * a grid-tie inverter (string, micro, central) must stop without the grid (anti-islanding, step 8); an
 * off-grid one never touches the grid; a hybrid one opens its backup relay and forms an island. The battery
 * is assumed charged. No three.js.
 */
export const INVERTER_TYPES = ['offgrid', 'string', 'micro', 'central', 'hybrid'] as const;
export type InverterType = (typeof INVERTER_TYPES)[number];

/** A flow on one link of the exhibit: 0 = idle, +1 = forward (as named), −1 = reverse. */
export interface TypeFlows {
  /** PV → inverter. */
  pv: number;
  /** Inverter → house (for `central`: grid → house). */
  house: number;
  /** Inverter → grid (export); −1 = grid → inverter / house (import). */
  grid: number;
  /** Battery → inverter (discharge); −1 = charge. */
  bat: number;
  houseLit: boolean;
  /** The inverter itself is running. */
  running: boolean;
}

export function typeFlows(type: InverterType, grid: boolean, sun: boolean): TypeFlows {
  switch (type) {
    case 'offgrid':
      // no grid connection at all: the sun feeds the house and tops the battery up, at night the battery works
      return { pv: sun ? 1 : 0, house: 1, grid: 0, bat: sun ? -1 : 1, houseLit: true, running: true };
    case 'string':
    case 'micro':
      if (!grid) return { pv: 0, house: 0, grid: 0, bat: 0, houseLit: false, running: false };
      return {
        pv: sun ? 1 : 0,
        house: sun ? 1 : 0,
        grid: sun ? 1 : -1,
        bat: 0,
        houseLit: true,
        running: sun,
      };
    case 'central':
      // a solar plant on the grid: the house is just a consumer down the line
      if (!grid) return { pv: 0, house: 0, grid: 0, bat: 0, houseLit: false, running: false };
      return { pv: sun ? 1 : 0, house: 1, grid: sun ? 1 : 0, bat: 0, houseLit: true, running: sun };
    case 'hybrid':
      if (grid)
        return {
          pv: sun ? 1 : 0,
          house: 1,
          grid: sun ? 1 : -1,
          bat: sun ? -1 : 0,
          houseLit: true,
          running: true,
        };
      // blackout: the backup relay cuts the street off, the inverter forms the island
      return { pv: sun ? 1 : 0, house: 1, grid: 0, bat: sun ? -1 : 1, houseLit: true, running: true };
  }
}

/** Comparison table of the «Порівняти» button: battery, works in a blackout, exports, shading, relative price. */
export const TYPE_FACTS: Record<
  InverterType,
  { battery: boolean; blackout: boolean; exports: boolean; shadeLocal: boolean; price: 1 | 2 | 3 }
> = {
  offgrid: { battery: true, blackout: true, exports: false, shadeLocal: false, price: 2 },
  string: { battery: false, blackout: false, exports: true, shadeLocal: false, price: 1 },
  micro: { battery: false, blackout: false, exports: true, shadeLocal: true, price: 2 },
  central: { battery: false, blackout: false, exports: true, shadeLocal: false, price: 1 },
  hybrid: { battery: true, blackout: true, exports: true, shadeLocal: false, price: 3 },
};
