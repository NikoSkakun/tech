/**
 * Uniforms shared (by reference) by every `K.*` material: engine time and the scene-level style parameters
 * that three.js lights cannot express (rim light). The render pipeline writes the active light rig's values
 * here right before it renders a scene, so the world and the HUD layer can use different rigs.
 */
import { Color, Vector3, type IUniform } from 'three';

export interface KGlobalUniforms {
  /** Engine clock time in seconds (drives every animated shader). */
  uKTime: IUniform<number>;
  /** Rim light colour × intensity (linear). */
  uKRimColor: IUniform<Color>;
  /** Direction *towards* the rim light, world space, normalised. */
  uKRimDir: IUniform<Vector3>;
  /** `env.lookScale` of the scene being rendered (1 unless `setScale(…, { adaptFrom })`; M3). */
  uKLookScale: IUniform<number>;
  [name: string]: IUniform;
}

export const kGlobals: KGlobalUniforms = {
  uKTime: { value: 0 },
  uKRimColor: { value: new Color(0.25, 0.3, 0.6) },
  uKRimDir: { value: new Vector3(-0.5, 0.4, -0.75).normalize() },
  uKLookScale: { value: 1 },
};

/** GLSL declarations matching `kGlobals`. */
export const K_GLOBALS_GLSL = /* glsl */ `
uniform float uKTime;
uniform vec3 uKRimColor;
uniform vec3 uKRimDir;
uniform float uKLookScale;
`;

/** Re-attach the shared uniform objects after a material was cloned (cloning deep-copies uniforms). */
export function linkGlobals(uniforms: Record<string, IUniform>): void {
  for (const key of Object.keys(kGlobals)) uniforms[key] = kGlobals[key]!;
}
