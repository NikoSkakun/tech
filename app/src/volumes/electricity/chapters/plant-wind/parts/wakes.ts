/**
 * Step 8 farm overlay: behind every rotor a `slate` plume whose darkness is the velocity deficit of the
 * simulation itself (`wakeDeficit`, Jensen expansion with a Gaussian cross profile, evaluated per vertex in
 * real metres), deflected for steered turbines exactly as the model deflects it; and above every turbine a
 * `yellow` bar with its power in % of a free-standing turbine.
 */
import { BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, NormalBlending, Quaternion, ShaderMaterial, Vector3 } from 'three';
import { fmtPercent } from '@/content';
import { STEER_YAW_DEG, TURBINE_6MW, thrustCoefficient, turbinePowerW, wakeDeficit, type FarmResult } from '@electricity/sim/plant-wind';
import { K, col, kGlobals } from '@/style';
import type { Text3D } from '@/text';
import { FARM, flowDir } from '../layout';
import { createBadge } from './badge';
import type { Farm } from './farm';

const NX = 20;
const NY = 8;
/** Plume length drawn, in rotor diameters. */
const LENGTH_D = 13;

const VERTEX = /* glsl */ `
attribute float aAlpha;
attribute vec2 aUv;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vAlpha = aAlpha;
  vUv = aUv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uKTime;
varying float vAlpha;
varying vec2 vUv;
void main() {
  // slow streaks drifting downstream: the wake is turbulent, slower air
  float streak = 0.82 + 0.18 * sin( vUv.x * 46.0 - uKTime * 1.6 + sin( vUv.y * 9.0 ) * 2.0 );
  float a = vAlpha * uOpacity * streak;
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( uColor, a );
}`;

export interface Wakes {
  group: Group;
  /** Redraw plumes, bars and labels from a simulation result. */
  set(result: FarmResult, windFromDeg: number, k: number, vMs: number): void;
}

export function buildWakes(farm: Farm): Wakes {
  const n = FARM.rows * FARM.perRow;
  const per = (NX + 1) * (NY + 1);
  const geometry = new BufferGeometry();
  const pos = new BufferAttribute(new Float32Array(n * per * 3), 3);
  const alpha = new BufferAttribute(new Float32Array(n * per), 1);
  const uv = new BufferAttribute(new Float32Array(n * per * 2), 2);
  const index: number[] = [];
  for (let t = 0; t < n; t++)
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NY; j++) {
        const a = t * per + i * (NY + 1) + j;
        index.push(a, a + NY + 1, a + 1, a + 1, a + NY + 1, a + NY + 2);
      }
  geometry.setAttribute('position', pos);
  geometry.setAttribute('aAlpha', alpha);
  geometry.setAttribute('aUv', uv);
  geometry.setIndex(index);
  const material = new ShaderMaterial({
    name: 'plant-wind.wakes',
    uniforms: { uColor: { value: col('slate').lerp(col('bg.indigo'), 0.25) }, uOpacity: { value: 0.9 }, uKTime: kGlobals.uKTime },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
  });
  const plumes = new Mesh(geometry, material);
  plumes.frustumCulled = false;
  plumes.renderOrder = 3;
  plumes.raycast = () => undefined;
  const bars = new InstancedMesh(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), K.glow({ color: 'yellow', intensity: 1.5, whiten: 0, keepHue: true }), n);
  bars.frustumCulled = false;
  const labels: Text3D[] = Array.from({ length: n }, () => createBadge('', 'yellow', 17, 8));
  const group = new Group();
  group.name = 'farm-wakes';
  group.add(plumes, bars, ...labels);
  const hub = new Vector3();
  const m = new Matrix4();
  const q = new Quaternion();
  const dReal = TURBINE_6MW.diameterM;
  const toy = 1 / FARM.realPerToy;
  return {
    group,
    set(result, windFromDeg, k, vMs) {
      const f = flowDir(windFromDeg);
      // left of the flow (the model's positive cross-wind direction), in world XZ
      const lx = f.z;
      const lz = -f.x;
      const single = turbinePowerW(TURBINE_6MW, vMs) || 1;
      const tan = Math.tan((STEER_YAW_DEG * Math.PI) / 180);
      result.turbines.forEach((t, i) => {
        farm.fleet.hub(i, hub);
        const ct = thrustCoefficient(t.inflowMs);
        for (let a = 0; a <= NX; a++) {
          const x = ((a / NX) ** 1.25) * LENGTH_D * dReal; // real metres downstream, denser near the rotor
          const centre = t.yawed ? 0.25 * x * tan : 0;
          const half = (dReal / 2 + k * x) * 1.7;
          for (let b = 0; b <= NY; b++) {
            const y = ((b / NY) * 2 - 1) * half;
            const v = i * per + a * (NY + 1) + b;
            const cross = (centre + y) * toy;
            pos.setXYZ(v, hub.x + f.x * x * toy + lx * cross, hub.y - 0.4, hub.z + f.z * x * toy + lz * cross);
            const tail = 1 - Math.max(0, (a / NX - 0.72) / 0.28);
            alpha.setX(v, (wakeDeficit(Math.max(x, 1), y, dReal, ct, k) / 0.553) * tail * Math.min(1, a / 1.2));
            uv.setXY(v, a / NX, b / NY);
          }
        }
        // power bar and its label above the blade tips
        const share = t.powerW / single;
        const top = hub.y + FARM.rotorDiameter / 2 + 2.5;
        bars.setMatrixAt(i, m.compose(hub.clone().setY(top), q, new Vector3(1.7, Math.max(0.15, share * 9), 1.7)));
        labels[i]!.position.set(hub.x, top + share * 9 + 1.2, hub.z);
        const text = fmtPercent(share, 0);
        if (labels[i]!.text !== text) labels[i]!.text = text;
      });
      pos.needsUpdate = alpha.needsUpdate = uv.needsUpdate = true;
      bars.instanceMatrix.needsUpdate = true;
    },
  };
}
