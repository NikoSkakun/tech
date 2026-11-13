/**
 * Step 3 «трубка течії»: the stream tube of the actuator disc. Its end radii and speeds are exactly the
 * simulation's (`actuatorDisk(a)`: D₁ = D·√(1−a), D₂ = D·√((1−a)/(1−2a)), v·(1−a) at the rotor, v·(1−2a)
 * far behind); between them the speed follows a smooth tanh profile and the radius follows from continuity
 * A(x)·u(x) = const. Air parcels are advected on the CPU: fast before the rotor, slow and spread out behind.
 * `block` (0…1) is preset (б): a solid disc — the air stalls in front of it and slips around the rim.
 * Local frame: +X downwind, origin at the rotor centre.
 */
import { BufferAttribute, BufferGeometry, CircleGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createOrbs } from '@/fx';
import type { ActuatorDisk } from '@electricity/sim/plant-wind';
import { K, col } from '@/style';

const NX = 44;
const NT = 48;

export interface StreamTube {
  group: Group;
  readonly upstream: number;
  readonly downstream: number;
  /** Tube radius at local x for the current disc state. */
  radiusAt(x: number): number;
  /** Apply a disc state (rebuilds the shell). */
  set(disk: ActuatorDisk): void;
  /** 0 = actuator disc, 1 = solid wall (preset «гальмує повністю»). */
  block: number;
  /** Free-stream speed, toy metres per second. */
  speed: number;
  update(dt: number): void;
}

export function buildStreamTube(ctx: ChapterContext, R: number, upstream = 46, downstream = 92): StreamTube {
  const group = new Group();
  group.name = 'stream-tube';
  let disk: ActuatorDisk | null = null;
  const w = R * 0.75; // length scale of the transition around the rotor
  const blend = (x: number): number => (1 + Math.tanh(x / w)) / 2;
  /** Local speed as a fraction of the free stream. */
  const u = (x: number): number => (disk ? 1 + (disk.vWakeRel - 1) * blend(x) : 1);
  const radiusAt = (x: number): number => (disk ? R * Math.sqrt(disk.vRotorRel / u(x)) : R);

  const shell = (x0: number, x1: number, color: 'sky' | 'slate'): { mesh: Mesh; refresh(): void } => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array((NX + 1) * (NT + 1) * 3), 3);
    const idx: number[] = [];
    for (let i = 0; i < NX; i++)
      for (let j = 0; j < NT; j++) {
        const a = i * (NT + 1) + j;
        idx.push(a, a + NT + 1, a + 1, a + 1, a + NT + 1, a + NT + 2);
      }
    g.setAttribute('position', pos);
    g.setIndex(idx);
    const material = K.toon({ color, opacity: 0.26, highlight: 0, rim: 0.8, side: DoubleSide });
    material.depthWrite = false;
    const mesh = new Mesh(g, material);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    return {
      mesh,
      refresh() {
        for (let i = 0; i <= NX; i++) {
          const x = x0 + ((x1 - x0) * i) / NX;
          const r = radiusAt(x);
          for (let j = 0; j <= NT; j++) {
            const th = (j / NT) * Math.PI * 2;
            pos.setXYZ(i * (NT + 1) + j, x, Math.cos(th) * r, Math.sin(th) * r);
          }
        }
        pos.needsUpdate = true;
        g.computeVertexNormals();
      },
    };
  };
  const front = shell(-upstream, 0, 'sky');
  const back = shell(0, downstream, 'slate');
  // the «wall» of preset (б)
  const wallMat = K.toon({ color: col('slate').lerp(col('ink'), 0.3), side: DoubleSide });
  const wall = new Mesh(new CircleGeometry(R, 64).rotateY(Math.PI / 2), wallMat);
  wall.position.x = -1.2;
  // hoops along the tube make its widening readable from the side
  const HOOPS = 10;
  const hoopMat = K.glow({ color: col('sky').lerp(col('white'), 0.6), intensity: 0.95, whiten: 0 });
  const hoops = new InstancedMesh(new TorusGeometry(1, 0.006, 6, 72).rotateY(Math.PI / 2), hoopMat, HOOPS);
  hoops.frustumCulled = false;
  const placeHoops = (): void => {
    const m = new Matrix4();
    const q = new Quaternion();
    for (let i = 0; i < HOOPS; i++) {
      const x = -upstream + ((upstream + downstream) * i) / (HOOPS - 1);
      const r = radiusAt(x);
      hoops.setMatrixAt(i, m.compose(new Vector3(x, 0, 0), q, new Vector3(r, r, r)));
    }
    hoops.instanceMatrix.needsUpdate = true;
  };
  group.add(front.mesh, back.mesh, wall, hoops);

  const rng = ctx.random.fork('tube');
  const n = ctx.quality.count(230, 100);
  const fast = createOrbs({ kind: 'blob', count: n, radius: 0.62, color: 'white', shade: 'sky' });
  const slow = createOrbs({ kind: 'blob', count: n, radius: 0.62, color: 'steel', shade: 'slate' });
  group.add(fast, slow);
  const span = upstream + downstream;
  const parcels = Array.from({ length: n }, () => ({ x: -upstream + rng.next() * span, rho: Math.sqrt(rng.next()) * 0.96, th: rng.range(0, Math.PI * 2), s: rng.range(0.7, 1.25) }));
  const sm = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const tube: StreamTube = {
    group,
    upstream,
    downstream,
    radiusAt,
    block: 0,
    speed: 3,
    set(d) {
      disk = d;
      front.refresh();
      back.refresh();
      placeHoops();
    },
    update(dt) {
      const b = tube.block;
      wallMat.fade = b;
      wall.visible = b > 0.01;
      (front.mesh.material as typeof wallMat).fade = (back.mesh.material as typeof wallMat).fade = 1 - 0.85 * b;
      hoopMat.fade = 1 - b;
      for (let i = 0; i < n; i++) {
        const p = parcels[i]!;
        // in front of a wall the air piles up (slows), then accelerates around the rim
        const stall = b * Math.exp(-((p.x + 6) ** 2) / (w * w));
        p.x += tube.speed * (u(p.x) * (1 - b) + b * (1 - 0.75 * stall)) * dt;
        if (p.x > downstream) p.x -= span;
        const around = b * sm(-R * 1.6, -2, p.x);
        const r = p.rho * radiusAt(p.x) * (1 - around) + around * R * (1.06 + 0.5 * p.rho);
        const edge = Math.min(1, (p.x + upstream) / 6, (downstream - p.x) / 6);
        const y = Math.cos(p.th) * r;
        const z = Math.sin(p.th) * r;
        const behind = p.x > 0 && b < 0.5; // air that slipped around a wall was never slowed
        fast.setPosition(i, p.x, y, z, behind ? 0 : p.s * edge);
        slow.setPosition(i, p.x, y, z, behind ? p.s * edge : 0);
      }
      fast.commit();
      slow.commit();
    },
  };
  return tube;
}
