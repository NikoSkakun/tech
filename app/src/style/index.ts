/**
 * `@/style` — the visual language as code (STYLE_GUIDE): palette tokens, K materials, environment presets,
 * motion presets. Always use these; never hard-code colours or easings in chapter code.
 */
export * from './palette';
export * from './motion';
export * from './materials';
export {
  Environment,
  LOOK_SCALE,
  type EnvironmentOptions,
  type SetEnvOptions,
  type ShadowSetup,
} from './env/environment';
export {
  envPreset,
  envKind,
  type EnvKind,
  type EnvOverrides,
  type EnvParams,
  type EnvPresetName,
} from './env/presets';
