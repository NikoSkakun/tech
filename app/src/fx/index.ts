/**
 * `@/fx` — the shared vocabulary of motion and energy (owner: F3-fx). See `docs/FX_API.md`.
 *
 * Every effect follows the STYLE_GUIDE semantic colour code, runs on the engine clock, loops seamlessly and
 * is released by the chapter's disposables tracker when it lives under `ctx.root`.
 */
export { plugin } from './plugin';
export { FxSet, fxTime, onTick, type TickFn, type Updatable } from './core/tick';
export * from './core/env';
export * from './core/color';
export * from './particles/emitters';
export * from './particles/system';
export { createTrail, Trail, type TrailOptions } from './particles/trail';
export { createProbabilityCloud, ProbabilityCloud, type CloudOptions } from './particles/cloud';
export * from './characters';
export * from './flow';
export * from './conductors';
export { RibbonLines, type RibbonLine, type RibbonOptions } from './core/ribbon';
export * from './fields';
export * from './drama';
export * from './thermal';
export * from './machine';
export * from './signals';
