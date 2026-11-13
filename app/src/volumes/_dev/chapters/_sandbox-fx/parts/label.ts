/**
 * Sandbox-local world-anchored label: a dot on the subject, a hair-thin leader line and billboard text, all
 * with a constant on-screen size and drawn on the overlay layer (crisp regardless of depth of field).
 * (The real callout widget belongs to `@/ui3d`.)
 */
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { toOverlay } from '@/engine/api';
import { col, type ColorLike } from '@/style';
import { Text3D } from '@/text';

export interface LabelOptions {
  /** Offset of the text from the anchor, world units. */
  offset: [number, number, number];
  color?: ColorLike;
  /** Text size in px-equivalent units. Default 20. */
  size?: number;
  /**
   * `side` (default): text starts beside the line end, on the side the offset points to.
   * `center`: text is centred on the line end — for labels whose group rotates (e.g. with an orbiting object).
   */
  anchor?: 'side' | 'center';
}

/** A straight line with constant pixel width (expanded in screen space by the vertex shader). */
class LeaderLine extends Mesh<BufferGeometry, ShaderMaterial> {
  constructor(from: Vector3, to: Vector3, color: Color, widthPx: number) {
    const geometry = new BufferGeometry();
    // four vertices: (end 0|1, side −1|+1)
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('aEnd', new BufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
    geometry.setAttribute('aSide', new BufferAttribute(new Float32Array([-1, 1, -1, 1]), 1));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    super(
      geometry,
      new ShaderMaterial({
        uniforms: {
          uFrom: { value: from.clone() },
          uTo: { value: to.clone() },
          uColor: { value: color },
          uWidth: { value: widthPx },
          uViewport: { value: new Vector2(1280, 720) },
          uFade: { value: 1 },
        },
        vertexShader: /* glsl */ `
          attribute float aEnd;
          attribute float aSide;
          uniform vec3 uFrom;
          uniform vec3 uTo;
          uniform float uWidth;
          uniform vec2 uViewport;
          varying float vSide;
          void main() {
            vec4 a = projectionMatrix * modelViewMatrix * vec4( uFrom, 1.0 );
            vec4 b = projectionMatrix * modelViewMatrix * vec4( uTo, 1.0 );
            vec2 dir = normalize( ( b.xy / b.w - a.xy / a.w ) * uViewport );
            vec2 normal = vec2( -dir.y, dir.x );
            vec4 p = mix( a, b, aEnd );
            // half-width + 1 px on each side so the fragment shader can antialias the edges
            float halfPx = uWidth * 0.5 + 1.0;
            p.xy += normal * aSide * halfPx * 2.0 / uViewport * p.w;
            vSide = aSide * halfPx; // signed distance from the centre line in px
            gl_Position = p;
          }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec3 uColor;
          uniform float uFade;
          uniform float uWidth;
          varying float vSide;
          void main() {
            float a = clamp( uWidth * 0.5 + 0.5 - abs( vSide ), 0.0, 1.0 );
            gl_FragColor = vec4( uColor, a * 0.9 * uFade );
          }`,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide, // the quad's winding depends on the line's screen direction
      }),
    );
    this.frustumCulled = false;
  }

  /** Dissolve factor used by `ctx.stage` actors with `appear: 'fade'`. */
  get fade(): number {
    return this.material.uniforms.uFade!.value as number;
  }
  set fade(v: number) {
    this.material.uniforms.uFade!.value = v;
  }

  override onBeforeRender(renderer: WebGLRenderer): void {
    renderer.getSize(this.material.uniforms.uViewport!.value as Vector2);
  }
}

/** Returns a group whose origin is the anchor point. Add it to (or under) the labelled object. */
export function createLabel(text: string, opts: LabelOptions): Group {
  const group = new Group();
  group.name = `label:${text}`;
  const color = opts.color ?? 'white';
  const end = new Vector3(...opts.offset);
  const size = opts.size ?? 20;
  const dot = new Text3D('●', {
    font: 'body',
    size: 11,
    color,
    anchorX: 'center',
    anchorY: 'middle',
    billboard: true,
    screenSpace: true,
    depthTest: false,
    depthWrite: false,
    rich: false,
  });
  const line = new LeaderLine(new Vector3(), end.clone().multiplyScalar(0.94), col(color), 1.5);
  const label = new Text3D(text, {
    font: 'bodyBold',
    size,
    color,
    anchorX: opts.anchor === 'center' ? 'center' : end.x >= 0 ? 'left' : 'right',
    anchorY: 'middle',
    billboard: true,
    screenSpace: true,
    depthTest: false,
    depthWrite: false,
    halo: { radius: 0.12, color: 'bg.void', opacity: 0.6 },
  });
  label.position.copy(end).multiplyScalar(opts.anchor === 'center' ? 1.22 : 1.03);
  line.renderOrder = 1;
  dot.renderOrder = 2;
  label.renderOrder = 3;
  group.add(line, dot, label);
  return toOverlay(group);
}
