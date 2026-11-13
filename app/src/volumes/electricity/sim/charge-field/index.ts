/** `charge-field` chapter simulation models (S1-sim). See README.md. */
export * from './coulomb';
export * from './field-sandbox';
export * from './moving-charge';
export * from './potential';
export * from './conductor';
export * from './static';
export * from './capacitor';
export * from './discharge';
export { electricField, electricPotential, type Vec3, type PointCharge, type Streamline } from '../core/S1-sim/field';
export { siPrefix } from '../core/S1-sim/format';
