/**
 * Streamlines around the specimen section of step 4, in the section's own frame (chord along +X, suction
 * side toward +Y). A qualitative drawing (the chapter shows «спрощена модель»): lines arrive at the angle of
 * attack, are turned along the chord and leave with a downwash; over the suction side the dashes run faster
 * (lower pressure). From the stall angle on, the lines near the upper surface separate: they stop following
 * it, wobble as vortices and turn `red`. One mesh, dashes animated in the shader on the engine clock.
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, NormalBlending, ShaderMaterial } from 'three';
import { col, kGlobals } from '@/style';
import { CHORD } from './section';

const OFFSETS = [-4.6, -2.9, -1.6, -0.65, 0.65, 1.6, 2.9, 4.6];
const POINTS = 72;
const S0 = -0.3 * CHORD - 7;
const S1 = 0.7 * CHORD + 9;
const HALF_WIDTH = 0.075;

export interface Streamlines {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  /** Rebuild the lines for an angle of attack (degrees) and its lift coefficient. */
  shape(alphaDeg: number, cl: number): void;
}

const VERTEX = /* glsl */ `
attribute float aPhase;
attribute float aSep;
attribute float aAlong;
uniform float uKTime;
varying float vPhase;
varying float vSep;
varying float vAlong;
void main() {
  vec3 p = position;
  // separated flow: growing vortex wobble that drifts downstream
  p.y += sin( aSep * 1.25 - uKTime * 4.2 + aPhase * 0.3 ) * min( aSep * 0.16, 1.1 );
  vPhase = aPhase;
  vSep = clamp( aSep * 0.45, 0.0, 1.0 );
  vAlong = aAlong;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uKTime;
uniform vec3 uColor;
uniform vec3 uStall;
varying float vPhase;
varying float vSep;
varying float vAlong;
void main() {
  float ph = fract( vPhase * 0.36 - uKTime * 1.5 );
  float dash = smoothstep( 0.0, 0.1, ph ) * smoothstep( 0.72, 0.5, ph );
  float ends = smoothstep( 0.0, 0.08, vAlong ) * smoothstep( 1.0, 0.9, vAlong );
  float a = ( 0.16 + 0.62 * dash ) * ends;
  gl_FragColor = vec4( mix( uColor, uStall, vSep ), a );
}`;

export function buildStreamlines(): Streamlines {
  const lines = OFFSETS.length;
  const count = lines * POINTS * 2;
  const geometry = new BufferGeometry();
  const pos = new BufferAttribute(new Float32Array(count * 3), 3);
  const phase = new BufferAttribute(new Float32Array(count), 1);
  const sep = new BufferAttribute(new Float32Array(count), 1);
  const along = new BufferAttribute(new Float32Array(count), 1);
  const index: number[] = [];
  for (let l = 0; l < lines; l++)
    for (let i = 0; i < POINTS - 1; i++) {
      const a = (l * POINTS + i) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  geometry.setAttribute('position', pos);
  geometry.setAttribute('aPhase', phase);
  geometry.setAttribute('aSep', sep);
  geometry.setAttribute('aAlong', along);
  geometry.setIndex(index);
  const material = new ShaderMaterial({
    name: 'plant-wind.streamlines',
    uniforms: { uKTime: kGlobals.uKTime, uColor: { value: col('white') }, uStall: { value: col('red') } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'streamlines';
  mesh.frustumCulled = false;
  mesh.position.z = -1.2; // just behind the cut face, in front of the rest of the slice
  mesh.renderOrder = 4;
  mesh.raycast = () => undefined;

  const le = -0.3 * CHORD;
  const te = 0.7 * CHORD;
  const sm = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  /** Half thickness and camber of the section at chord station s (0 outside the chord), toy metres. */
  const body = (s: number): { t: number; c: number } => {
    const x = (s - le) / CHORD;
    if (x <= 0 || x >= 1) return { t: 0, c: 0 };
    const t = 5 * 0.18 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const c = x < 0.4 ? (0.04 / 0.16) * (0.8 * x - x * x) : (0.04 / 0.36) * (0.2 + 0.8 * x - x * x);
    return { t: t * CHORD, c: c * CHORD };
  };
  return {
    mesh,
    shape(alphaDeg, cl) {
      const tanA = Math.tan((alphaDeg * Math.PI) / 180);
      const stall = Math.min(1, Math.max(0, (alphaDeg - 13) / 9));
      const sepAt = te - stall * 0.82 * CHORD; // the separation point walks forward as the stall deepens
      OFFSETS.forEach((n0, l) => {
        const upper = n0 > 0;
        const near = Math.exp(-Math.abs(n0) / 2.6);
        let ph = l * 1.7;
        let px = 0;
        let py = 0;
        for (let i = 0; i < POINTS; i++) {
          const s = S0 + ((S1 - S0) * i) / (POINTS - 1);
          const b = body(s);
          // arrive at α, run along the chord, leave with half the angle (downwash)
          let n = n0 + (s < le ? tanA * (s - le) : s > te ? tanA * 0.5 * (s - te) : 0);
          n += (upper ? 1 : -1) * b.t * Math.exp(-Math.abs(n0) / 3.2) + b.c * near;
          const lifted = upper ? Math.max(0, s - sepAt) * stall * near * 1.6 : 0;
          n += lifted * tanA * 0.9;
          // local speed: faster over the suction side, slower under the section, slow in separated flow
          const bump = sm(le - 2, le + 1.5, s) * (1 - sm(te - 1, te + 4, s));
          const q = lifted > 0 ? 0.4 : 1 + (upper ? 0.5 : -0.18) * cl * bump * near;
          const dx = i ? s - px : 0;
          const dy = i ? n - py : 0;
          const len = Math.hypot(dx, dy) || 1;
          ph += i ? len / Math.max(0.3, q) : 0;
          const k = (l * POINTS + i) * 2;
          const nx = i ? -dy / len : 0;
          const ny = i ? dx / len : 1;
          pos.setXYZ(k, s + nx * HALF_WIDTH, n + ny * HALF_WIDTH, 0);
          pos.setXYZ(k + 1, s - nx * HALF_WIDTH, n - ny * HALF_WIDTH, 0);
          for (const j of [k, k + 1]) {
            phase.setX(j, ph);
            sep.setX(j, lifted > 0 ? Math.max(0, s - sepAt) : 0);
            along.setX(j, i / (POINTS - 1));
          }
          px = s;
          py = n;
        }
      });
      pos.needsUpdate = phase.needsUpdate = sep.needsUpdate = along.needsUpdate = true;
    },
  };
}
