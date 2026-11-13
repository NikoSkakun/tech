/**
 * Backdrop of the full-screen views (map, home): a deep-space gradient with drifting stars and a soft nebula,
 * drawn on a screen-filling quad behind everything else in the HUD scene. It hides the chapter underneath
 * (leaving a trace of it, so the map feels like a layer over the world rather than another page).
 */
import {
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  Vector4,
  type Camera,
  type Object3D,
} from 'three';
import { col, kGlobals } from '@/style';

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform float uOpacity;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec3 uGlow;
uniform float uAspect;
uniform mat4 uToMap;     // HUD scene space → map space
uniform vec3 uEye;       // HUD camera position (scene space)
uniform vec4 uGround;    // ground height (map units), fade radius, grid pitch, strength
uniform vec3 uGrid;
varying vec2 vUv;
varying vec3 vScene;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) {
  vec2 i = floor( p ); vec2 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
void main() {
  vec2 p = vec2( ( vUv.x - 0.5 ) * uAspect, vUv.y - 0.5 );
  vec3 color = mix( uBottom, uMid, smoothstep( 0.0, 0.55, vUv.y ) );
  color = mix( color, uTop, smoothstep( 0.45, 1.0, vUv.y ) );
  // nebula: two slow layers of soft noise, brighter toward the horizon band
  float n = noise( p * 2.6 + vec2( uKTime * 0.008, -uKTime * 0.005 ) );
  color += uGlow * n * n * 0.34 * smoothstep( 0.75, 0.1, abs( p.y + 0.08 ) );
  // stars: sparse cells with a twinkle
  vec2 g = p * 46.0;
  vec2 id = floor( g );
  float h = hash( id );
  vec2 c = fract( g ) - 0.5 - ( vec2( hash( id + 3.1 ), hash( id + 7.7 ) ) - 0.5 ) * 0.7;
  float star = smoothstep( 0.09, 0.0, length( c ) ) * step( 0.93, h );
  color += vec3( 0.75, 0.8, 1.0 ) * star * ( 0.45 + 0.4 * sin( uKTime * ( 0.6 + h ) + h * 40.0 ) );
  // the map's floor grid, ray-cast analytically here instead of blending one more screen-sized layer
  if ( uGround.w > 0.0 ) {
    vec3 o = ( uToMap * vec4( uEye, 1.0 ) ).xyz;
    vec3 d = ( uToMap * vec4( vScene - uEye, 0.0 ) ).xyz;
    float t = ( uGround.x - o.y ) / d.y;
    if ( t > 0.0 && abs( d.y ) > 1e-6 ) {
      vec2 hit = o.xz + d.xz * t;
      vec2 q = hit / uGround.z;
      vec2 w = fwidth( q );
      vec2 a = smoothstep( w * 1.6, vec2( 0.0 ), abs( fract( q - 0.5 ) - 0.5 ) );
      float line = max( a.x, a.y ) * smoothstep( 0.9, 0.0, max( w.x, w.y ) );
      float edge = smoothstep( 1.0, 0.25, length( hit ) / uGround.y );
      color += ( uGrid * ( 0.1 + 0.55 * line ) ) * edge * edge * uGround.w;
    }
  }
  // vignette toward the corners
  color *= 1.0 - 0.38 * dot( p, p );
  gl_FragColor = vec4( color, uOpacity );
}
`;

export class Backdrop extends Mesh<PlaneGeometry, ShaderMaterial> {
  constructor() {
    super(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vScene; void main() { vUv = uv; vScene = ( modelMatrix * vec4( position, 1.0 ) ).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
        fragmentShader: FRAGMENT,
        uniforms: {
          uKTime: kGlobals.uKTime,
          uOpacity: { value: 0 },
          uTop: { value: col('bg.void') },
          uMid: { value: col('bg.deep') },
          uBottom: { value: col('bg.indigo').multiplyScalar(0.8) },
          uGlow: { value: col('bg.plum') },
          uAspect: { value: 16 / 9 },
          uToMap: { value: new Matrix4() },
          uEye: { value: new Vector3() },
          uGround: { value: new Vector4(0, 1, 92, 0) },
          uGrid: { value: col('violet') },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.name = 'map-backdrop';
    this.renderOrder = -10;
    this.frustumCulled = false;
    this.visible = false;
  }

  /** Cover a HUD plane of `width × height` units (slightly oversized against parallax tilt). */
  resize(width: number, height: number): void {
    this.scale.set(width * 1.08, height * 1.08, 1);
    this.position.z = -4; // just behind the UI plane
    this.material.uniforms.uAspect!.value = width / height;
  }

  /**
   * Draw the map's floor grid: `content` is the group the map lives in, `height` the floor level in map
   * units, `radius` where the grid fades out; `strength` 0 turns the floor off.
   */
  setGround(content: Object3D, camera: Camera, height: number, radius: number, strength: number): void {
    const u = this.material.uniforms;
    (u.uToMap!.value as Matrix4).copy(content.matrixWorld).invert();
    (u.uEye!.value as Vector3).copy(camera.position);
    (u.uGround!.value as Vector4).set(height, radius, 92, strength);
  }

  /** 0…1; the backdrop is skipped entirely at 0. */
  get opacity(): number {
    return this.material.uniforms.uOpacity!.value as number;
  }
  set opacity(v: number) {
    this.material.uniforms.uOpacity!.value = v;
    this.visible = v > 0.002;
    // once fully open the backdrop is an opaque fill: no blending over the 4×MSAA HDR target
    const opaque = v > 0.999;
    if (this.material.transparent === opaque) {
      this.material.transparent = !opaque;
      this.material.needsUpdate = true;
    }
  }
}
