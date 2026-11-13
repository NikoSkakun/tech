/**
 * A fleet of identical small turbines drawn with instancing: every turbine has its own position, yaw and rotor
 * angle (the kit's `instanced()` freezes moving parts, and a farm needs each rotor to turn at its own speed).
 * The template is assembled from the kit's own turbine pieces (`addTurbineFoundation`, `addTurbineTower`,
 * `bladeGeometry`) without the drive train, so it matches the hero's look at a third of the triangles.
 */
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Mesh } from 'three';
import { col, type ColorLike } from '@/style';
import { Builder, addTurbineFoundation, addTurbineTower, bandGeometry, bladeGeometry, type KitModel } from '@/kit';

export interface FleetOptions {
  count: number;
  hubHeight: number;
  rotorDiameter: number;
  chunk?: number;
  /**
   * `onshore` gravity base (default) · `monopile` with a yellow transition piece (`depth` = water depth) ·
   * `none`: the tower starts at `towerBase` (jacket and floating turbines bring their own base).
   */
  foundation?: 'onshore' | 'monopile' | 'none';
  depth?: number;
  towerBase?: number;
  accent?: ColorLike;
  castShadow?: boolean;
  /**
   * Uniform size factor: the template is built `1 / scale` larger and every instance is scaled down, so
   * fixed-size kit details (monopile transition piece, ladders, platform) shrink with a toy-sized turbine.
   */
  scale?: number;
}

const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const _m = new Matrix4();
const _qYaw = new Quaternion();
const _qSpin = new Quaternion();
const _qNone = new Quaternion();
const _top = new Vector3();
const _hub = new Vector3();

function template(o: FleetOptions): KitModel {
  const inv = 1 / (o.scale ?? 1);
  const H = o.hubHeight * inv;
  const R = (o.rotorDiameter / 2) * inv;
  const chunk = o.chunk ?? 1.6;
  const k = R / 55;
  const accent = col(o.accent ?? 'teal');
  const white = col('white');
  const rb = 0.024 * H * chunk;
  const rt = 0.014 * H * chunk;
  const b = new Builder('fleet-turbine');
  const y0 = o.foundation === 'none' ? (o.towerBase ?? 0) * inv : addTurbineFoundation(b, rb, o.foundation === 'monopile', (o.depth ?? 12) * inv);
  addTurbineTower(b, y0, H - 2.2 * k, rb, rt, chunk, accent);
  const nac = b.part('nacelle', { at: [0, H, 0] });
  nac.cyl(rt * 1.15, 1.0 * k, { seg: 14, slot: 'gloss', c: 'steel', at: [0, -2.4 * k, 0] });
  nac.box(4.2 * k, 4.0 * k, 11.2 * k, { r: 0.9 * k, seg: 3, slot: 'gloss', c: [col('mist'), white], at: [0, -1.9 * k, -1.2 * k] });
  nac.sphere(0.34 * k, { seg: 8, slot: 'glow', c: 'red', at: [-0.8 * k, 2.3 * k, -5.6 * k] });
  const rotor = nac.part('rotor', { at: [0, 0, 4.6 * k] });
  // hub profile of the kit turbine (spinner along +Z)
  rotor.lathe(
    [[0, 0], [1.9 * k, 0], [2.0 * k, 0.8 * k], [1.7 * k, 2.4 * k], [0.9 * k, 3.7 * k], [0.25 * k, 4.2 * k], [0, 4.25 * k]],
    { axis: 'z', seg: 16, slot: 'gloss', c: [col('mist'), white], at: [0, 0, -1.2 * k], crease: 70 },
  );
  const bo = { tipRadius: R, rootRadius: 1.7 * k, chunk, sections: 12 };
  const stripe = col('red');
  const blade = bandGeometry(bladeGeometry(bo), (_x, y) => (y - bo.rootRadius) / (R - bo.rootRadius), [[0.8, white], [0.9, stripe]], white);
  for (let i = 0; i < 3; i++) rotor.add(blade, { slot: 'gloss', rot: [0, 0, (i * Math.PI * 2) / 3] });
  return b.build();
}

export class Fleet {
  readonly group = new Group();
  readonly count: number;
  readonly hubHeight: number;
  readonly model: KitModel;
  /** Rotor angles, radians (integrate `speed·dt` yourself, then `commit`). */
  readonly angle: Float32Array;
  readonly yaw: Float32Array;
  private readonly pos: Vector3[];
  private readonly layers: { mesh: InstancedMesh; level: 0 | 1 | 2 }[] = [];
  private readonly rotorZ: number;
  private readonly scale = new Vector3(1, 1, 1);

  constructor(o: FleetOptions) {
    this.count = o.count;
    this.hubHeight = o.hubHeight;
    this.angle = new Float32Array(o.count);
    this.yaw = new Float32Array(o.count);
    this.pos = Array.from({ length: o.count }, () => new Vector3());
    this.model = template(o);
    this.scale.setScalar(o.scale ?? 1);
    this.rotorZ = this.model.part('rotor').position.z * (o.scale ?? 1);
    const nacelle = this.model.part('nacelle');
    const rotor = this.model.part('rotor');
    this.group.name = `fleet×${o.count}`;
    this.model.group.updateMatrixWorld(true);
    this.model.group.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const level = mesh.parent === rotor ? 2 : mesh.parent === nacelle ? 1 : 0;
      const im = new InstancedMesh(mesh.geometry, mesh.material, o.count);
      im.castShadow = (o.castShadow ?? true) && mesh.castShadow;
      im.receiveShadow = false;
      im.frustumCulled = false; // instances are spread over the whole island
      this.layers.push({ mesh: im, level });
      this.group.add(im);
    });
  }

  /** Set the base position (and optionally the yaw) of turbine `i`. */
  place(i: number, x: number, y: number, z: number, yaw = this.yaw[i]!): void {
    this.pos[i]!.set(x, y, z);
    this.yaw[i] = yaw;
  }

  /** World position of turbine `i`'s hub. */
  hub(i: number, out = new Vector3()): Vector3 {
    const p = this.pos[i]!;
    const yaw = this.yaw[i]!;
    return out.set(p.x + Math.sin(yaw) * this.rotorZ, p.y + this.hubHeight, p.z + Math.cos(yaw) * this.rotorZ);
  }

  /** Write all instance matrices (call after `place` / angle changes; cheap: 3 matrices per turbine). */
  commit(): void {
    for (let i = 0; i < this.count; i++) {
      const base = this.pos[i]!;
      _qYaw.setFromAxisAngle(Y, this.yaw[i]!);
      _top.set(base.x, base.y + this.hubHeight, base.z);
      // rotor: on the yawed axis, spinning about it (the kit convention: clockwise seen from upwind)
      _hub.set(0, 0, this.rotorZ).applyQuaternion(_qYaw).add(_top);
      _qSpin.setFromAxisAngle(Z, -this.angle[i]!).premultiply(_qYaw);
      for (const l of this.layers) {
        if (l.level === 0) _m.compose(base, _qNone, this.scale);
        else if (l.level === 1) _m.compose(_top, _qYaw, this.scale);
        else _m.compose(_hub, _qSpin, this.scale);
        l.mesh.setMatrixAt(i, _m);
      }
    }
    for (const l of this.layers) l.mesh.instanceMatrix.needsUpdate = true;
  }
}
