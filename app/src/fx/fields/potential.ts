/**
 * PotentialSurface — a scalar field over a horizontal patch drawn as a height map ("potential landscape":
 * hills at positive charges, wells at negative ones), coloured with the voltage ramp (`blue` → `pink` →
 * `coral`) and engraved with equipotential contour lines.
 */
import { BufferAttribute, type Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from 'three';
import { col, kGlobals } from '@/style';
import { FX_COMMON } from '../core/glsl';
import type { ScalarField } from './sources';

export interface PotentialSurfaceOptions {
  /** Side length of the square patch, units. Default 6. */
  size?: number;
  /** Grid cells per side. Default 72. */
  resolution?: number;
  /** Potential that maps to the ends of the colour ramp and to ±`height`. Default 2. */
  range?: number;
  /** Maximum displacement, units. Default 1.2. */
  height?: number;
  /** Contour lines per unit of (normalised) potential. Default 8. */
  contours?: number;
  /** Opacity of the sheet. Default 0.92. */
  opacity?: number;
}

const VERTEX = /* glsl */ `
attribute float aPhi;
uniform vec4 uShape; // height, size, unused, unused
varying float vPhi;
varying vec3 vNormal;
varying vec2 vXZ;
void main() {
  // soft saturation: peaks near charges are rounded off instead of being clipped flat
  float h = aPhi / ( 1.0 + abs( aPhi ) * 0.55 ) * 1.55;
  vec3 p = vec3( position.x, h * uShape.x, position.z );
  vPhi = aPhi;
  vXZ = position.xz / uShape.y;
  vNormal = normalize( normalMatrix * normal );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uLow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec4 uLook; // contours per unit, opacity, fade, unused
varying float vPhi;
varying vec3 vNormal;
varying vec2 vXZ;
${FX_COMMON}
void main() {
  float t = saturate( vPhi * 0.5 + 0.5 );
  vec3 base = t < 0.5 ? mix( uLow, uMid, t * 2.0 ) : mix( uMid, uHigh, t * 2.0 - 1.0 );
  // two-band cel shading from a fixed view-space key (the sheet is a diagram, not a solid object)
  vec3 n = normalize( gl_FrontFacing ? vNormal : - vNormal );
  float band = smoothstep( 0.1, 0.3, dot( n, normalize( vec3( -0.35, 0.8, 0.5 ) ) ) );
  vec3 color = base * mix( 0.62, 1.0, band );
  // equipotential contours, anti-aliased in screen space; every line breathes slightly outward
  float c = vPhi * uLook.x;
  float w = fwidth( c );
  float line = 1.0 - smoothstep( 0.0, w * 1.6, abs( fract( c - 0.5 ) - 0.5 ) );
  color = mix( color, mix( base, vec3( 1.0 ), 0.75 ) * 1.25, line * 0.85 );
  // round patch with a soft rim
  float r = length( vXZ ) * 2.0;
  float mask = 1.0 - smoothstep( 0.86, 1.0, r );
  if ( mask < 0.01 ) discard;
  gl_FragColor = vec4( color, mask * uLook.y * uLook.z );
}
`;

/** Potential landscape. Create through `createPotentialSurface()`, then `sample(fn)` whenever sources move. */
export class PotentialSurface extends Mesh<PlaneGeometry, ShaderMaterial> {
  private readonly phi: BufferAttribute;
  private readonly range: number;
  private readonly heightScale: number;
  private readonly n: number;
  private readonly size: number;

  constructor(o: PotentialSurfaceOptions = {}) {
    const size = o.size ?? 6;
    const n = o.resolution ?? 72;
    const geometry = new PlaneGeometry(size, size, n, n).rotateX(-Math.PI / 2);
    const material = new ShaderMaterial({
      name: 'fx.potential',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uShape: { value: new Vector4(o.height ?? 1.2, size, 0, 0) },
        uLow: { value: col('blue') },
        uMid: { value: col('pink') },
        uHigh: { value: col('coral') },
        uLook: { value: new Vector4(o.contours ?? 8, o.opacity ?? 0.92, 1, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      side: DoubleSide,
    });
    super(geometry, material);
    this.name = 'potential-surface';
    this.frustumCulled = false;
    this.n = n;
    this.size = size;
    this.range = o.range ?? 2;
    this.heightScale = o.height ?? 1.2;
    this.phi = new BufferAttribute(new Float32Array((n + 1) * (n + 1)), 1);
    geometry.setAttribute('aPhi', this.phi);
  }

  /** Evaluate `potential` on the grid (local XZ plane, y = 0) and rebuild heights + normals. */
  sample(potential: ScalarField): void {
    const n = this.n + 1;
    const pos = this.geometry.getAttribute('position');
    const nor = this.geometry.getAttribute('normal');
    const p = new Vector3();
    for (let i = 0; i < n * n; i++) {
      p.set(pos.getX(i), 0, pos.getZ(i));
      this.phi.setX(i, potential(p) / this.range);
    }
    // normals of the displaced sheet by central differences of the same soft-saturated height
    const h = (i: number): number => {
      const a = this.phi.getX(i);
      return (a / (1 + Math.abs(a) * 0.55)) * 1.55 * this.heightScale;
    };
    const cell = this.size / this.n;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        const dx = (h(z * n + Math.min(x + 1, n - 1)) - h(z * n + Math.max(x - 1, 0))) / (2 * cell);
        const dz = (h(Math.min(z + 1, n - 1) * n + x) - h(Math.max(z - 1, 0) * n + x)) / (2 * cell);
        p.set(-dx, 1, -dz).normalize();
        nor.setXYZ(i, p.x, p.y, p.z);
      }
    }
    this.phi.needsUpdate = true;
    nor.needsUpdate = true;
  }

  /** Height of the sheet (local y) for a potential value — to park markers on the surface. */
  heightAt(potential: number): number {
    const a = potential / this.range;
    return (a / (1 + Math.abs(a) * 0.55)) * 1.55 * this.heightScale;
  }

  get fade(): number {
    return (this.material.uniforms.uLook!.value as Vector4).z;
  }
  set fade(v: number) {
    (this.material.uniforms.uLook!.value as Vector4).z = v;
  }
  /** Ramp colours (low, mid, high) — live. */
  get ramp(): [Color, Color, Color] {
    const u = this.material.uniforms;
    return [u.uLow!.value as Color, u.uMid!.value as Color, u.uHigh!.value as Color];
  }
}

export function createPotentialSurface(o: PotentialSurfaceOptions = {}): PotentialSurface {
  return new PotentialSurface(o);
}
