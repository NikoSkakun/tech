/**
 * Cutaway — an animated section through a machine: a world-space clipping plane removes one side, and the
 * cut is closed with solid "caps" in a cap colour with engineering-style hatching.
 *
 * The engine renders without a stencil buffer, so caps use the back-face technique: every clipped mesh gets
 * a twin drawn with back faces only, in a flat unlit cap colour. Wherever the eye looks *into* the cut solid,
 * the nearest surface is a back face → the cap colour appears exactly on the cross-section. This is correct
 * for closed (watertight) meshes, including shells with wall thickness. The hatch pattern is evaluated on
 * the true cutting plane (ray ∩ plane), so it stays flat and still while the parts behind are curved.
 */
import {
  BackSide,
  Color,
  InstancedMesh,
  Mesh,
  Plane,
  ShaderMaterial,
  Vector3,
  Vector4,
  type Material,
  type Object3D,
} from 'three';
import { col, type ColorLike } from '@/style';

export interface CutawayOptions {
  /** Direction pointing toward the side that is REMOVED (world space). Default +X. */
  normal?: readonly [number, number, number];
  /** Position of the cut along `normal`, world units (tweenable through `.offset`). Default 0. */
  offset?: number;
  /** Cap colour. Default `coral.dark`. */
  capColor?: ColorLike;
  /** Hatch lines per unit (0 = plain caps). Default 9. */
  hatch?: number;
}

const CAP_VERTEX = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vWorld;
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vec4 w = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    w = instanceMatrix * w;
  #endif
  vWorld = ( modelMatrix * w ).xyz;
}
`;

const CAP_FRAGMENT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uCap;
uniform vec3 uCapDark;
uniform vec4 uPlane;  // world plane: xyz normal (toward the removed side), w offset
uniform float uHatch;
varying vec3 vWorld;
void main() {
  #include <clipping_planes_fragment>
  // where the view ray crosses the cutting plane
  vec3 dir = normalize( vWorld - cameraPosition );
  float denom = dot( dir, uPlane.xyz );
  float tHit = abs( denom ) > 1e-5 ? ( uPlane.w - dot( cameraPosition, uPlane.xyz ) ) / denom : 0.0;
  vec3 hit = cameraPosition + dir * tHit;
  vec3 color = uCap;
  if ( uHatch > 0.0 ) {
    // 45° hatch in the plane's own 2D frame
    vec3 n = uPlane.xyz;
    vec3 a = normalize( cross( n, abs( n.y ) < 0.9 ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 ) ) );
    vec3 b = cross( n, a );
    float s = ( dot( hit, a ) + dot( hit, b ) ) * uHatch * 0.7071;
    float w = fwidth( s );
    float line = 1.0 - smoothstep( 0.12, 0.12 + w, abs( fract( s ) - 0.5 ) );
    // far away the hatch would alias: fade it into the average tone
    color = mix( uCap, uCapDark, line * ( 1.0 - smoothstep( 0.25, 0.6, w ) ) * 0.8 );
  }
  gl_FragColor = vec4( color, 1.0 );
}
`;

/** A cutting plane with caps. `apply()` it to the machine's root; tween `offset` to sweep the cut. */
export class Cutaway {
  /** The world-space clipping plane (three clips where `distanceToPoint < 0`). */
  readonly plane = new Plane();
  readonly capMaterial: ShaderMaterial;
  private readonly normal = new Vector3();
  private position = 0;
  private readonly targets: { material: Material; planes: Plane[] | null }[] = [];
  private readonly caps: Mesh[] = [];
  private on = true;

  constructor(o: CutawayOptions = {}) {
    const cap = col(o.capColor ?? 'coral.dark');
    this.capMaterial = new ShaderMaterial({
      name: 'fx.cutaway.cap',
      uniforms: {
        uCap: { value: cap },
        uCapDark: { value: cap.clone().lerp(new Color(0.03, 0.02, 0.12), 0.45) },
        uPlane: { value: new Vector4(1, 0, 0, 0) },
        uHatch: { value: o.hatch ?? 9 },
      },
      vertexShader: CAP_VERTEX,
      fragmentShader: CAP_FRAGMENT,
      side: BackSide,
      clipping: true,
      clippingPlanes: [this.plane],
    });
    this.setNormal(...(o.normal ?? [1, 0, 0]));
    this.offset = o.offset ?? 0;
  }

  /** Clip every mesh under `root` (their materials are modified in place) and add the caps. */
  apply(root: Object3D, opts: { caps?: boolean } = {}): this {
    const meshes: Mesh[] = [];
    root.traverse((o) => {
      if ((o as Mesh).isMesh && !this.caps.includes(o as Mesh)) meshes.push(o as Mesh);
    });
    for (const mesh of meshes) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        if (this.targets.some((t) => t.material === material)) continue;
        this.targets.push({ material, planes: material.clippingPlanes });
        material.clippingPlanes = [...(material.clippingPlanes ?? []), this.plane];
        material.clipShadows = true;
      }
      if (opts.caps === false) continue;
      const src = mesh as InstancedMesh;
      const cap = src.isInstancedMesh ? new InstancedMesh(mesh.geometry, this.capMaterial, src.count) : new Mesh(mesh.geometry, this.capMaterial);
      if (src.isInstancedMesh) (cap as InstancedMesh).instanceMatrix = src.instanceMatrix;
      cap.name = 'cutaway-cap';
      cap.frustumCulled = mesh.frustumCulled;
      mesh.add(cap);
      this.caps.push(cap);
    }
    return this;
  }

  /** Direction toward the removed side (world space). */
  setNormal(x: number, y: number, z: number): this {
    this.normal.set(x, y, z).normalize();
    this.sync();
    return this;
  }

  /** Position of the cut along the normal, world units (tweenable). */
  get offset(): number {
    return this.position;
  }
  set offset(v: number) {
    this.position = v;
    this.sync();
  }

  /** Switch the section off (whole machine) or on without removing anything. */
  get enabled(): boolean {
    return this.on;
  }
  set enabled(v: boolean) {
    this.on = v;
    this.sync();
    for (const cap of this.caps) cap.visible = v;
  }

  private sync(): void {
    // kept side: normal·p < offset  ⇔  (−normal)·p + offset > 0; "off" parks the plane far away
    this.plane.normal.copy(this.normal).negate();
    this.plane.constant = this.on ? this.position : 1e6;
    (this.capMaterial.uniforms.uPlane!.value as Vector4).set(this.normal.x, this.normal.y, this.normal.z, this.position);
  }

  /** Remove the clipping from the materials again and drop the caps (their geometry is shared, not owned). */
  dispose(): void {
    for (const t of this.targets) t.material.clippingPlanes = t.planes;
    for (const cap of this.caps) cap.removeFromParent();
    this.capMaterial.dispose();
  }
}

export function createCutaway(o: CutawayOptions = {}): Cutaway {
  return new Cutaway(o);
}
