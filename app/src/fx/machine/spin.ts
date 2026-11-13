/**
 * Spin — rotates a rotor at a real speed and, when individual blades can no longer be followed, swaps them
 * for a stylised blur disc (a translucent ring with soft blade ghosts that drift slowly, like the
 * stroboscopic effect). No real motion blur is needed and nothing ever strobes harshly.
 */
import { CircleGeometry, type Color, DoubleSide, Mesh, type Object3D, ShaderMaterial, Vector4 } from 'three';
import { col, kGlobals, type ColorLike } from '@/style';
import { FX_COMMON } from '../core/glsl';
import type { Updatable } from '../core/tick';

export interface SpinOptions {
  /** Local axis of rotation of the target. Default `z`. */
  axis?: 'x' | 'y' | 'z';
  /** Speed in revolutions per minute (tweenable through `.rpm`). Default 0. */
  rpm?: number;
  /** Outer / inner radius of the blur disc, units (0 outer = no disc). */
  radius?: number;
  innerRadius?: number;
  /** Number of blades (ghost lobes in the disc). Default 3. */
  blades?: number;
  /** Disc colour (the blade colour). Default `mist`. */
  color?: ColorLike;
  /** rpm at which the blur starts / is complete. Defaults 90 / 400. */
  blurStart?: number;
  blurFull?: number;
  /** Materials (anything with `fade`) of the blades: dissolved as the disc takes over. */
  fade?: readonly { fade: number }[];
  /** Largest on-screen rotation per frame once blurred, radians (keeps wheels from "running backwards"). */
  maxStep?: number;
}

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec4 uDisc; // inner radius (0…1), blades, blur 0…1, ghost angle
varying vec2 vQ;
${FX_COMMON}
void main() {
  float r = length( vQ );
  if ( r > 1.0 || r < uDisc.x ) discard;
  float ang = atan( vQ.y, vQ.x );
  // ghost blades: soft lobes, wider toward the rim, slowly creeping round
  float lobes = 0.5 + 0.5 * cos( ( ang - uDisc.w ) * uDisc.y );
  float body = 0.3 + 0.22 * lobes * lobes * smoothstep( 0.0, 0.5, r );
  float aa = fwidth( r ) * 1.5;
  float edge = smoothstep( uDisc.x, uDisc.x + aa + 0.02, r ) * ( 1.0 - smoothstep( 1.0 - aa - 0.03, 1.0, r ) );
  float alpha = body * edge * uDisc.z;
  gl_FragColor = vec4( uColor * alpha, alpha );
}
`;

/** Spin controller. Call `update(dt, t)` from the chapter (or add it to an `FxSet`). */
export class Spin implements Updatable {
  /** Revolutions per minute (tweenable; sign = direction). */
  rpm: number;
  /** Accumulated angle, radians. */
  angle = 0;
  /** The blur disc (added next to the target; null when no `radius` was given). */
  readonly disc: Mesh<CircleGeometry, ShaderMaterial> | null = null;
  private readonly axis: 'x' | 'y' | 'z';
  private readonly o: SpinOptions;
  private shown = 0;

  constructor(
    private readonly target: Object3D,
    o: SpinOptions = {},
  ) {
    this.o = o;
    this.axis = o.axis ?? 'z';
    this.rpm = o.rpm ?? 0;
    if (o.radius && o.radius > 0) {
      const material = new ShaderMaterial({
        name: 'fx.spin-blur',
        uniforms: {
          uKTime: kGlobals.uKTime,
          uColor: { value: col(o.color ?? 'mist') },
          uDisc: { value: new Vector4((o.innerRadius ?? 0) / o.radius, o.blades ?? 3, 0, 0) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vQ;
          void main() {
            vQ = uv * 2.0 - 1.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        premultipliedAlpha: true,
        side: DoubleSide,
      });
      const disc = new Mesh(new CircleGeometry(o.radius, 64), material);
      disc.name = 'spin-blur';
      disc.visible = false;
      // the disc lives in the target's parent so that it does not spin with the rotor
      disc.position.copy(target.position);
      disc.quaternion.copy(target.quaternion);
      if (this.axis === 'x') disc.rotateY(Math.PI / 2);
      else if (this.axis === 'y') disc.rotateX(-Math.PI / 2);
      (target.parent ?? target).add(disc);
      this.disc = disc;
    }
  }

  /** 0…1: how much of the rotor is currently shown as blur. */
  get blur(): number {
    return this.shown;
  }

  /** Blur disc colour. */
  get color(): Color | null {
    return this.disc ? (this.disc.material.uniforms.uColor!.value as Color) : null;
  }

  update(dt: number): void {
    const omega = (this.rpm / 60) * Math.PI * 2; // rad/s
    const start = this.o.blurStart ?? 90;
    const full = this.o.blurFull ?? 400;
    const k = Math.min(Math.max((Math.abs(this.rpm) - start) / (full - start), 0), 1);
    this.shown = k * k * (3 - 2 * k);
    // once blurred, cap the visible step per frame: the solid remnant turns calmly instead of strobing
    const maxStep = this.o.maxStep ?? 0.35;
    const step = omega * dt;
    const visible = this.shown > 0 ? Math.sign(step) * Math.min(Math.abs(step), maxStep + (1 - this.shown) * 10) : step;
    this.angle += visible;
    this.target.rotation[this.axis] = this.angle;
    for (const f of this.o.fade ?? []) f.fade = 1 - this.shown;
    if (this.disc) {
      const u = this.disc.material.uniforms.uDisc!.value as Vector4;
      u.z = this.shown;
      u.w += dt * 0.7 * Math.sign(this.rpm || 1);
      this.disc.visible = this.shown > 0.01;
    }
  }
}

export function createSpin(target: Object3D, o: SpinOptions = {}): Spin {
  return new Spin(target, o);
}
