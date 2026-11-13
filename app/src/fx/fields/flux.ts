/**
 * FluxSurface — magnetic (or electric) flux through a flat surface, in the textbook notation: a grid of
 * ⊙ (field coming out of the face you look at) and ⊗ (going in), whose density of ink and the tint of the
 * surface grow with |Φ| = |B·A·cos θ|. Seen from the other side the symbols swap automatically.
 */
import { type Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3, Vector4 } from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';
import { FX_COMMON } from '../core/glsl';

export interface FluxSurfaceOptions {
  /** `rect` (size = [width, height]) or `disc` (size[0] = diameter). Default `rect`. */
  shape?: 'rect' | 'disc';
  size?: readonly [number, number];
  /** Field colour. Default `magenta` (B). Use `amber` for electric flux. */
  color?: ColorLike;
  /** Symbols per unit length. Default 2.2. */
  density?: number;
  /** Field magnitude that gives full strength. Default 1. */
  reference?: number;
}

const VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uShape; // half width, half height, disc (1) / rect (0), symbols per unit
uniform vec4 uFlux;  // signed normalised flux −1…1, fade, unused, unused
varying vec2 vP;
${FX_COMMON}
void main() {
  vec2 h = uShape.xy;
  float sd = uShape.z > 0.5 ? length( vP ) - h.x : max( abs( vP.x ) - h.x, abs( vP.y ) - h.y );
  float aa = fwidth( sd );
  float inside = 1.0 - smoothstep( - aa, aa, sd );
  if ( inside < 0.01 ) discard;
  float flux = uFlux.x * ( gl_FrontFacing ? 1.0 : -1.0 );
  float amount = saturate( abs( flux ) );
  // symbol grid
  vec2 g = vP * uShape.w;
  vec2 cell = fract( g ) - 0.5;
  float r = length( cell );
  float w = fwidth( g.x ) * 1.2;
  float ring = 1.0 - smoothstep( 0.0, w, abs( r - 0.3 ) - 0.035 );
  float dotMark = 1.0 - smoothstep( 0.075, 0.075 + w, r );
  float crossMark = 1.0 - smoothstep( 0.0, w, min( abs( cell.x - cell.y ), abs( cell.x + cell.y ) ) * 0.7071 - 0.035 );
  crossMark *= 1.0 - smoothstep( 0.27, 0.27 + w, r );
  float symbol = max( ring, flux > 0.0 ? dotMark : crossMark );
  // symbols pop in from the centre outward as the flux grows; a slow pulse keeps the surface alive
  float pulse = 0.85 + 0.15 * sin( uKTime * 2.0 - length( vP ) * 2.5 );
  float border = 1.0 - smoothstep( 0.0, aa * 2.0 + 0.012, abs( sd + 0.02 ) - 0.012 );
  float fill = 0.08 + 0.3 * amount;
  float ink = symbol * smoothstep( 0.02, 0.25, amount ) * pulse;
  float alpha = saturate( fill + ink * 0.9 + border * 0.8 ) * inside * uFlux.y;
  vec3 color = uColor * ( 0.7 + 1.1 * ink * amount + 0.7 * border );
  gl_FragColor = vec4( color * alpha, alpha );
}
`;

const _n = new Vector3();

/** Flux surface. Create through `createFluxSurface()`; the surface lies in the object's local XY plane. */
export class FluxSurface extends Mesh<PlaneGeometry, ShaderMaterial> {
  private readonly reference: number;
  private readonly areaValue: number;

  constructor(o: FluxSurfaceOptions = {}) {
    const size = o.size ?? [2, 2];
    const disc = o.shape === 'disc';
    const w = size[0];
    const h = disc ? size[0] : size[1];
    const material = new ShaderMaterial({
      name: 'fx.flux',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uColor: { value: col(o.color ?? SEMANTIC.fieldB) },
        uShape: { value: new Vector4(w / 2, h / 2, disc ? 1 : 0, o.density ?? 2.2) },
        uFlux: { value: new Vector4(0, 1, 0, 0) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      premultipliedAlpha: true,
      side: DoubleSide,
    });
    super(new PlaneGeometry(w * 1.04, h * 1.04), material);
    this.name = 'flux-surface';
    this.reference = o.reference ?? 1;
    this.areaValue = disc ? (Math.PI * w * w) / 4 : w * h;
  }

  /** Area of the surface in local units². */
  get area(): number {
    return this.areaValue;
  }

  /**
   * Set the field at the surface (world-space vector). Returns the flux Φ = B·A·cos θ in field units × local
   * area, where θ is the angle between the field and the surface normal (local +Z in world space).
   */
  setField(field: Vector3): number {
    _n.set(0, 0, 1).transformDirection(this.matrixWorld);
    const normal = field.dot(_n);
    this.flux = normal / this.reference;
    return normal * this.areaValue;
  }

  /** Signed normalised flux −1…1 (tweenable) when you do not want `setField`. */
  get flux(): number {
    return (this.material.uniforms.uFlux!.value as Vector4).x;
  }
  set flux(v: number) {
    (this.material.uniforms.uFlux!.value as Vector4).x = Math.max(-1, Math.min(1, v));
  }

  get fade(): number {
    return (this.material.uniforms.uFlux!.value as Vector4).y;
  }
  set fade(v: number) {
    (this.material.uniforms.uFlux!.value as Vector4).y = v;
  }

  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }
}

export function createFluxSurface(o: FluxSurfaceOptions = {}): FluxSurface {
  return new FluxSurface(o);
}
