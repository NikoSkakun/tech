/**
 * Sandbox-local effects for the micro look-dev scene: probability cloud, orbit trail, photon wave packet.
 * (Production chapters get these from `@/fx`; they are kept here so the sandbox depends on the engine only.)
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  TorusGeometry,
} from 'three';
import type { Rng } from '@/engine/api';
import { col, kGlobals, type ColorLike } from '@/style';

/* ------------------------------------------------------------------------------------ probability cloud */

export interface Cloud {
  points: Points<BufferGeometry, ShaderMaterial>;
  /** 0…1 visibility (tweenable). */
  amount: number;
  /** Device-pixel scale of the dots — update on resize: 0.5 · viewportHeightPx · P11. */
  pixelScale: number;
}

/** Soft dots distributed like an s/p electron cloud (denser near two radial shells), slowly swirling. */
export function createCloud(
  rng: Rng,
  count: number,
  radius: number,
  inner: ColorLike,
  outer: ColorLike,
): Cloud {
  const position = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // radial distribution: two shells with gaussian spread — reads as "probability density"
    const shell = rng.next() < 0.42 ? 0.42 : 0.82;
    const r = Math.max(0.12, shell + rng.gauss() * 0.11) * radius;
    const [x, y, z] = rng.onSphere();
    position.set([x * r, y * r * 0.92, z * r], i * 3);
    seed.set([rng.next(), rng.range(0.6, 1.6), rng.next()], i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 3));
  const material = new ShaderMaterial({
    uniforms: {
      uKTime: kGlobals.uKTime,
      uAmount: { value: 1 },
      uPixelScale: { value: 600 },
      uRadius: { value: radius },
      uInner: { value: col(inner) },
      uOuter: { value: col(outer) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uKTime;
      uniform float uAmount;
      uniform float uPixelScale;
      uniform float uRadius;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      varying vec4 vColor;
      void main() {
        // differential rotation around Y: inner dots orbit faster, like a swirling cloud
        float r = length( position );
        float a = uKTime * 0.22 * aSeed.y * ( 0.6 + 0.9 * ( 1.0 - r / uRadius ) ) + aSeed.x * 6.2831;
        float c = cos( a ), s = sin( a );
        vec3 p = vec3( position.x * c - position.z * s, position.y + sin( uKTime * 0.5 + aSeed.z * 20.0 ) * 0.05, position.x * s + position.z * c );
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.55 + 0.45 * sin( uKTime * ( 1.0 + aSeed.y ) + aSeed.z * 50.0 );
        float size = mix( 0.045, 0.11, aSeed.z ) * ( 0.7 + 0.5 * twinkle );
        gl_PointSize = max( size * uPixelScale / max( -mv.z, 1e-3 ), 1.0 ) * step( 0.001, uAmount );
        vColor = vec4( mix( uInner, uOuter, smoothstep( 0.3, 0.95, r / uRadius ) ), twinkle * uAmount );
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec4 vColor;
      void main() {
        float d = length( gl_PointCoord - 0.5 ) * 2.0;
        float a = smoothstep( 1.0, 0.1, d );
        gl_FragColor = vec4( vColor.rgb * a * a * vColor.a * 0.9, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'electron-cloud';
  return {
    points,
    get amount() {
      return material.uniforms.uAmount!.value as number;
    },
    set amount(v: number) {
      material.uniforms.uAmount!.value = v;
      points.visible = v > 0.002;
    },
    get pixelScale() {
      return material.uniforms.uPixelScale!.value as number;
    },
    set pixelScale(v: number) {
      material.uniforms.uPixelScale!.value = v;
    },
  };
}

/* ------------------------------------------------------------------------------------------ orbit trail */

export interface Trail {
  mesh: Mesh<TorusGeometry, ShaderMaterial>;
  /** Angle (radians) of the electron on the ring — the head of the trail. */
  head: number;
  /** Overall brightness (tweenable). */
  strength: number;
}

/**
 * A ring whose brightness fades behind a moving head — the electron's trail along its orbit. The ring lies in
 * the XY plane (TorusGeometry convention); orient the parent group to tilt the orbit.
 */
export function createTrail(radius: number, thickness: number, color: ColorLike, length = 0.4): Trail {
  const material = new ShaderMaterial({
    uniforms: {
      uColor: { value: col(color) },
      uHead: { value: 0 },
      uLength: { value: length },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform float uHead;
      uniform float uLength;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        // distance behind the head along the ring, 0…1
        float behind = fract( uHead - vUv.x );
        float tail = smoothstep( uLength, 0.0, behind );
        float faint = 0.07;
        gl_FragColor = vec4( uColor * ( tail * tail * 2.6 + faint ) * uStrength, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(new TorusGeometry(radius, thickness, 8, 220), material);
  mesh.name = 'orbit-trail';
  return {
    mesh,
    get head() {
      return (material.uniforms.uHead!.value as number) * Math.PI * 2;
    },
    set head(angle: number) {
      material.uniforms.uHead!.value = (((angle / (Math.PI * 2)) % 1) + 1) % 1;
    },
    get strength() {
      return material.uniforms.uStrength!.value as number;
    },
    set strength(v: number) {
      material.uniforms.uStrength!.value = v;
    },
  };
}

/* ----------------------------------------------------------------------------------------------- photon */

export interface Photon {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  /** 0…1 life of the wave packet (0 = just emitted, 1 = gone). */
  life: number;
}

/** A short wavy ribbon — the stylised photon (STYLE_GUIDE §2.2: `yellow` → white, wavy). Travels along +X. */
export function createPhoton(color: ColorLike = 'yellow'): Photon {
  const c = col(color);
  const material = new ShaderMaterial({
    uniforms: {
      uKTime: kGlobals.uKTime,
      uColor: { value: c },
      uCore: { value: c.clone().lerp(new Color(1, 1, 1), 0.7) },
      uLife: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uKTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float envelope = sin( uv.x * 3.14159265 );
        p.y += sin( uv.x * 24.0 - uKTime * 16.0 ) * 0.17 * envelope;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uColor;
      uniform vec3 uCore;
      uniform float uLife;
      varying vec2 vUv;
      void main() {
        float across = 1.0 - abs( vUv.y - 0.5 ) * 2.0;
        float envelope = sin( vUv.x * 3.14159265 );
        float fade = smoothstep( 1.0, 0.75, uLife ) * smoothstep( 0.0, 0.08, uLife );
        float a = smoothstep( 0.0, 0.9, across ) * envelope * fade;
        gl_FragColor = vec4( mix( uColor, uCore, across * across ) * a * 3.2, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(new PlaneGeometry(2.0, 0.09, 96, 1), material);
  mesh.name = 'photon';
  mesh.visible = false;
  return {
    mesh,
    get life() {
      return material.uniforms.uLife!.value as number;
    },
    set life(v: number) {
      material.uniforms.uLife!.value = v;
      mesh.visible = v > 0.001 && v < 0.999;
    },
  };
}
