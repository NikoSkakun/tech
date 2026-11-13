/**
 * Outline — the affordance / selection highlight for 3D objects (STYLE_GUIDE §2.2: interactive = `cyan`
 * outline + glow, selected = `yellow`). Inverted-hull technique: a twin of each mesh is drawn with back faces
 * only, pushed outward along the normals by a constant number of *pixels*, so the line has the same weight
 * at any distance. Works for smooth-shaded meshes (hard-edged boxes get small gaps at their corners).
 */
import { BackSide, type Color, Mesh, ShaderMaterial, Vector2, Vector4, type Object3D, type WebGLRenderer } from 'three';
import { col, kGlobals, SEMANTIC, type ColorLike } from '@/style';

export interface OutlineOptions {
  /** Default `cyan` (interactive affordance). */
  color?: ColorLike;
  /** Line width in px-equivalent at 1080p. Default 3. */
  width?: number;
  /** Brightness (> 1 blooms into a soft glow). Default 1.5. */
  intensity?: number;
  /** Depth of the idle pulse 0…1. Default 0.35. */
  pulse?: number;
}

/** Outline of an object's meshes. `amount` 0…1 is tweenable (hover: 0 → 1 in 120 ms). */
export class Outline {
  readonly material: ShaderMaterial;
  private readonly hulls: Mesh[] = [];

  constructor(target: Object3D, o: OutlineOptions = {}) {
    const material = new ShaderMaterial({
      name: 'fx.outline',
      uniforms: {
        uKTime: kGlobals.uKTime,
        uColor: { value: col(o.color ?? SEMANTIC.affordance) },
        uLine: { value: new Vector4(o.width ?? 3, o.intensity ?? 1.5, o.pulse ?? 0.35, 1) },
        uViewport: { value: new Vector2(1920, 1080) },
      },
      vertexShader: /* glsl */ `
        uniform vec4 uLine; // width px @1080p, intensity, pulse, amount
        uniform vec2 uViewport;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          vec3 n = normalize( normalMatrix * normal );
          vec2 dir = normalize( ( projectionMatrix * vec4( n, 0.0 ) ).xy + 1e-6 );
          // constant on-screen width: offset in clip space, scaled with the viewport like HUD units
          float px = uLine.x * uViewport.y / 1080.0 * uLine.w;
          clip.xy += dir * ( 2.0 * px / uViewport ) * clip.w;
          gl_Position = clip;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uKTime;
        uniform vec3 uColor;
        uniform vec4 uLine;
        void main() {
          float pulse = 1.0 - uLine.z * ( 0.5 + 0.5 * sin( uKTime * 3.2 ) );
          gl_FragColor = vec4( uColor * ( uLine.y * pulse ), 1.0 );
        }`,
      side: BackSide,
    });
    this.material = material;
    const meshes: Mesh[] = [];
    target.traverse((obj) => {
      const m = obj as Mesh;
      if (m.isMesh && m.geometry.getAttribute('normal')) meshes.push(m);
    });
    for (const mesh of meshes) {
      const hull = new Mesh(mesh.geometry, material);
      hull.name = 'outline';
      hull.onBeforeRender = (renderer: WebGLRenderer) => {
        const target = renderer.getRenderTarget();
        if (target) (material.uniforms.uViewport!.value as Vector2).set(target.width, target.height);
        else renderer.getDrawingBufferSize(material.uniforms.uViewport!.value as Vector2);
      };
      mesh.add(hull);
      this.hulls.push(hull);
    }
    this.amount = 1;
  }

  /** 0 = hidden … 1 = full width (tweenable). */
  get amount(): number {
    return (this.material.uniforms.uLine!.value as Vector4).w;
  }
  set amount(v: number) {
    (this.material.uniforms.uLine!.value as Vector4).w = v;
    for (const h of this.hulls) h.visible = v > 0.01;
  }

  get color(): Color {
    return this.material.uniforms.uColor!.value as Color;
  }

  /** Switch between the affordance colour and the selection colour. */
  setSelected(selected: boolean): this {
    col(selected ? SEMANTIC.selected : SEMANTIC.affordance, this.color);
    return this;
  }

  /** Remove the hull meshes (geometry is shared with the target, only the material is owned). */
  dispose(): void {
    for (const h of this.hulls) h.removeFromParent();
    this.material.dispose();
  }
}

export function createOutline(target: Object3D, o: OutlineOptions = {}): Outline {
  return new Outline(target, o);
}
