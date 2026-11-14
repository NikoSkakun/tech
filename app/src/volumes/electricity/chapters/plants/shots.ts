/**
 * Shared looks of the chapter. Steps 4–6 turn the hub into a «studio»: the sky preset is `dusk` (the env kind
 * stays `sky`: presets blend only within one kind), pulled toward a deep indigo with a soft teal-blue rim, so the
 * glowing rigs carry the frame and the archipelago recedes.
 */
import type { EnvOverrides } from '@/style';
import { col } from '@/style';

export const STUDIO_TUNE: EnvOverrides = {
  top: 'bg.void',
  mid: col('bg.indigo').lerp(col('bg.violet'), 0.4),
  bottom: 'bg.deep',
  horizonWidth: 0.2,
  sunGlow: 0.2,
  clouds: 0.25,
  silhouettes: 0.4,
  silhouetteColor: col('bg.indigo').lerp(col('violet'), 0.2),
  harmony: 0.12,
  harmonyColor: 'violet',
  gradeTintAmount: 0.1,
  rimColor: 'sky',
  rimIntensity: 0.9,
  fogColor: col('bg.indigo').lerp(col('violet'), 0.3),
  stars: 0.5,
};
