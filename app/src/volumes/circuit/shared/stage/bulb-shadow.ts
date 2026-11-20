/**
 * The shadow the filament's supports throw in the lamp's own light (owner 2026-11-20): a glowing coil is an
 * extended, very bright source and the supports are thin wires right next to it, so at full brightness their
 * shadow washes out; as the lamp dims it shows a little.
 *
 * Cheap trick: the lamp is a point light, so its shadow map is drawn with the caster's `customDistanceMaterial`
 * (directional lights — the moon — use `customDepthMaterial` and are untouched). This distance material discards
 * a stable, object-space hashed share of the fragments above `fromY` (the supports inside the globe; the base
 * below keeps its full shadow). The soft shadow filter averages the holes, so the kept share reads as the
 * shadow's strength. One extra program, no extra pass.
 */
import { MeshDistanceMaterial } from 'three';

export interface FilamentShadow {
  /** Put on the caster as `customDistanceMaterial`. */
  material: MeshDistanceMaterial;
  /** Set the lamp's glow 0…1 (0 cold … 1 fresh battery); the shadow's strength follows it. */
  setGlow(glow: number): void;
  /** Current strength 0…1 of the supports' shadow (share of the casting surface kept). */
  readonly strength: number;
}

/** Strength of the supports' shadow at glow `g`: ~3 % at full brightness, up to ~half of a real one when dim. */
export function supportShadow(g: number): number {
  const dim = 1 - Math.min(Math.max(g, 0), 1);
  return 0.03 + 0.5 * dim ** 1.6;
}

export function createFilamentShadow(fromY: number): FilamentShadow {
  const keep = { value: supportShadow(1) };
  const material = new MeshDistanceMaterial();
  material.name = 'bulb:support-shadow';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uKeep = keep;
    shader.uniforms.uFromY = { value: fromY };
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vWorldPosition;', 'varying vec3 vWorldPosition;\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvLocal = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'varying vec3 vWorldPosition;',
        'varying vec3 vWorldPosition;\nvarying vec3 vLocal;\nuniform float uKeep;\nuniform float uFromY;',
      )
      .replace(
        'vec4 diffuseColor = vec4( 1.0 );',
        // hash of a fine object-space cell: stable while the lamp moves (no crawling holes)
        'if ( vLocal.y > uFromY && rand( floor( vLocal.xy * 900.0 ) + floor( vLocal.z * 900.0 ) * 0.173 ) >= uKeep ) discard;\n\tvec4 diffuseColor = vec4( 1.0 );',
      );
  };
  material.customProgramCacheKey = () => 'bulb-support-shadow';
  return {
    material,
    setGlow(glow) {
      keep.value = supportShadow(glow);
    },
    get strength() {
      return keep.value;
    },
  };
}
