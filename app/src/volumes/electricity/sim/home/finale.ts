/**
 * home §Ж (step 11) — final flight from the plant to the kettle.
 * Ж.1 electrons in 2,5 mm² copper: v_d,rms = I/(n·e·A), oscillation amplitude X = √2·I/(n·e·A·ω).
 * Ж.2 energy chain per 1 kWh at the kettle: losses transmission 2,5 %, distribution 5 %, home wiring 0,5 % →
 *     1/(0,975·0,95·0,995) = 1,085 kWh at the plant; primary = 1,085/η_plant; ~0,85 kWh ends in the water.
 * Ж.3 current for 2 kW on each link: three-phase I = P/(√3·U_L), single-phase I = P/U.
 * Ж.4 signal time 500 km/(0,95·c) ≈ 1,75 ms.
 */
export const ELECTRON = { nPerM3: 8.5e28, chargeC: 1.602e-19, areaM2: 2.5e-6, omega: 2 * Math.PI * 50 } as const;

export function driftVelocityRmsMps(currentA: number): number {
  return currentA / (ELECTRON.nPerM3 * ELECTRON.chargeC * ELECTRON.areaM2);
}

export function oscillationAmplitudeM(currentA: number): number {
  return (Math.SQRT2 * currentA) / (ELECTRON.nPerM3 * ELECTRON.chargeC * ELECTRON.areaM2 * ELECTRON.omega);
}

export const CHAIN_LOSSES = { transmission: 0.025, distribution: 0.05, wiring: 0.005 } as const;
export const WATER_SHARE = 0.85;

export type FinaleSource = 'nuclear' | 'coal' | 'ccgt' | 'hydro' | 'wind';
/** η of the plant (wind: C_p = 0,45 — energy of the wind through the rotor, not a fuel). */
export const SOURCE_EFFICIENCY: Readonly<Record<FinaleSource, number>> = { nuclear: 0.33, coal: 0.38, ccgt: 0.58, hydro: 0.9, wind: 0.45 };

export function plantOutputPerKettleKWh(): number {
  const l = CHAIN_LOSSES;
  return 1 / ((1 - l.transmission) * (1 - l.distribution) * (1 - l.wiring));
}

export interface EnergyChain {
  primaryKWh: number;
  plantLossKWh: number;
  plantOutKWh: number;
  transmissionLossKWh: number;
  distributionLossKWh: number;
  wiringLossKWh: number;
  kettleKWh: 1;
  waterKWh: number;
}

/** Sankey bands for 1 kWh delivered to the kettle. */
export function energyChain(source: FinaleSource): EnergyChain {
  const out = plantOutputPerKettleKWh();
  const primary = out / SOURCE_EFFICIENCY[source];
  const afterT = out * (1 - CHAIN_LOSSES.transmission);
  const afterD = afterT * (1 - CHAIN_LOSSES.distribution);
  return {
    primaryKWh: primary,
    plantLossKWh: primary - out,
    plantOutKWh: out,
    transmissionLossKWh: out - afterT,
    distributionLossKWh: afterT - afterD,
    wiringLossKWh: afterD - 1,
    kettleKWh: 1,
    waterKWh: WATER_SHARE,
  };
}

/** Current carrying 2 kW (or `powerW`) on a link of line voltage `voltageV`. */
export function linkCurrentA(voltageV: number, threePhase: boolean, powerW = 2000): number {
  return threePhase ? powerW / (Math.sqrt(3) * voltageV) : powerW / voltageV;
}

export const FINALE_LINKS = [
  { voltageV: 750e3, threePhase: true },
  { voltageV: 330e3, threePhase: true },
  { voltageV: 110e3, threePhase: true },
  { voltageV: 10e3, threePhase: true },
  { voltageV: 400, threePhase: true },
  { voltageV: 230, threePhase: false },
] as const;

export function signalDelayS(distanceKm = 500, velocityFactor = 0.95): number {
  return (distanceKm * 1000) / (velocityFactor * 299792458);
}
