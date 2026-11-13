/**
 * `plant-wind` simulation models (M1–M6). Power curve, Weibull AEP and shear live in `sim/core/S3-sim/wind.ts`.
 */
export * from '../core/S3-sim/wind';
export * from './rotor';
export * from './wake';
export * from './dynamics';
export * from './year';

/** Step 2 rotor silhouettes, m (year/label for the chips). */
export const ROTOR_SILHOUETTES = [
  { diameterM: 20, label: '1980-ті' },
  { diameterM: 82, label: '2005' },
  { diameterM: 170, label: 'сьогодні на суші' },
  { diameterM: 236, label: 'серійна морська 15 MW' },
  { diameterM: 310, label: 'рекордний прототип 26 MW, 2025' },
] as const;

/** Step 5 «Шлях енергії»: drivetrain efficiency chain used by M4 (η_dt = 0.93). */
export const DRIVETRAIN_EFFICIENCY = {
  gearbox: 0.98,
  generator: 0.98,
  converter: 0.98,
  transformer: 0.99,
} as const;
