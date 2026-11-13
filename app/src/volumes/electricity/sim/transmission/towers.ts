/**
 * transmission step 2 table «Опора за класом напруги» and step 1 currents.
 * Typical transfer chip for 110–750 kV = surge-impedance (natural) power U²/Z_c; 10 and 35 kV — typical power/range.
 */
import { threePhaseCurrentA } from '@electricity/sim/core/S2-sim/voltageDrop';

export interface VoltageClass {
  kV: number;
  heightM: number;
  phaseSpacingM: number;
  /** Insulator discs and string length [m] (null = pin insulators). */
  discs: number | null;
  stringM: number | null;
  conductorsPerPhase: number;
  shieldWires: number;
  /** Surge impedance [Ω] (null for 10/35 kV). */
  zcOhm: number | null;
}

export const VOLTAGE_CLASSES: readonly VoltageClass[] = [
  { kV: 10, heightM: 10, phaseSpacingM: 1, discs: null, stringM: null, conductorsPerPhase: 1, shieldWires: 0, zcOhm: null },
  { kV: 35, heightM: 15, phaseSpacingM: 3, discs: 3, stringM: 0.5, conductorsPerPhase: 1, shieldWires: 0, zcOhm: null },
  { kV: 110, heightM: 30, phaseSpacingM: 4, discs: 8, stringM: 1.2, conductorsPerPhase: 1, shieldWires: 1, zcOhm: 400 },
  { kV: 150, heightM: 32, phaseSpacingM: 5, discs: 10, stringM: 1.5, conductorsPerPhase: 1, shieldWires: 1, zcOhm: 400 },
  { kV: 220, heightM: 35, phaseSpacingM: 7, discs: 14, stringM: 2.2, conductorsPerPhase: 1, shieldWires: 1, zcOhm: 380 },
  { kV: 330, heightM: 32, phaseSpacingM: 8.5, discs: 20, stringM: 3, conductorsPerPhase: 2, shieldWires: 2, zcOhm: 300 },
  { kV: 400, heightM: 34, phaseSpacingM: 10, discs: 23, stringM: 3.5, conductorsPerPhase: 2, shieldWires: 2, zcOhm: 290 },
  { kV: 500, heightM: 30, phaseSpacingM: 12, discs: 27, stringM: 4.5, conductorsPerPhase: 3, shieldWires: 2, zcOhm: 280 },
  { kV: 750, heightM: 38, phaseSpacingM: 18, discs: 40, stringM: 7.5, conductorsPerPhase: 5, shieldWires: 2, zcOhm: 250 },
];

/** Natural (surge-impedance) power [MW] = U²/Z_c (U in kV, Z_c in Ω). */
export function naturalPowerMW(kV: number, zcOhm: number): number {
  return (kV * kV) / zcOhm;
}

/** Step 1: generator (24 kV) and line (750 kV) currents for the unit power, cos φ = 0,9. */
export function plantExitCurrents(powerMW: number): { generatorKA: number; lineA: number } {
  return {
    generatorKA: threePhaseCurrentA(powerMW * 1e6, 24e3, 0.9) / 1000,
    lineA: threePhaseCurrentA(powerMW * 1e6, 750e3, 0.9),
  };
}
