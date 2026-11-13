/**
 * Instanced wind farm whose rotors keep spinning (M3): `instanced()` freezes animated parts, so a farm of
 * N turbines would otherwise cost N × (turbine draw calls). Here the turbine template is split into three
 * instanced layers — static (foundation + tower), nacelle (yaw), rotor (yaw + spin) — so the whole fleet costs
 * the template's draw calls once, with per-instance yaw, rotor phase and speed. Units: metres.
 */
import { Group, InstancedMesh, Matrix4, Vector3, type Mesh, type Object3D } from 'three';
import { placementMatrix, type Placement } from '../core/builder';
import { windTurbine, type WindTurbineOptions } from './wind';

export interface FleetTurbine extends Placement {
  /** Nacelle yaw (radians around Y, in the placement's frame). Default 0 (facing +Z). */
  yaw?: number;
  /** Initial rotor angle (radians). Default: spread by index so the rotors do not turn in lockstep. */
  phase?: number;
  /** Rotor speed in rad/s (12 rpm ≈ 1.26). Default 1.26. */
  speed?: number;
}

export interface WindFleet {
  /** Add this to the scene (do not add a turbine model as well). */
  readonly group: Group;
  readonly count: number;
  /** Live per-turbine state: change `yaw` / `speed` freely (applied by the next `update`). */
  readonly turbines: Required<Pick<FleetTurbine, 'yaw' | 'phase' | 'speed'>>[];
  readonly hubHeight: number;
  readonly rotorRadius: number;
  /** Triangles of one turbine template (the fleet draws it `count` times). */
  readonly triangles: number;
  /** Advance the rotors (engine-clock seconds) and re-upload the yaw / rotor matrices. */
  update(dt: number, t?: number): void;
  /** Hub position of turbine `i` in the fleet group's space. */
  hubOf(i: number, out?: Vector3): Vector3;
  dispose(): void;
}

type Layer = 'static' | 'nacelle' | 'rotor';

export interface WindFleetOptions extends WindTurbineOptions {
  /** Blade pitch of the whole fleet (radians). Default 0. */
  pitch?: number;
}

/** Fleet of `placements.length` turbines built from one `windTurbine(options)` template (interior off by default). */
export function windFleet(placements: readonly FleetTurbine[], options: WindFleetOptions = {}): WindFleet {
  const template = windTurbine({ interior: false, ...options });
  template.setPitch(options.pitch ?? 0);
  const nacelle = template.part('nacelle');
  const rotor = template.part('rotor');
  template.group.updateMatrixWorld(true);
  const inv = {
    static: new Matrix4().copy(template.group.matrixWorld).invert(),
    nacelle: new Matrix4().copy(nacelle.matrixWorld).invert(),
    rotor: new Matrix4().copy(rotor.matrixWorld).invert(),
  };
  // nacelle frame in model space at yaw 0, rotor frame in nacelle space at angle 0
  const n0 = new Matrix4().makeTranslation(nacelle.position.x, nacelle.position.y, nacelle.position.z);
  const n0Inverse = n0.clone().invert();
  const r0 = new Matrix4().makeTranslation(rotor.position.x, rotor.position.y, rotor.position.z);
  const layerOf = (o: Object3D): Layer => {
    for (let p: Object3D | null = o; p; p = p.parent) {
      if (p === rotor) return 'rotor';
      if (p === nacelle) return 'nacelle';
    }
    return 'static';
  };
  const group = new Group();
  group.name = `wind-fleet×${placements.length}`;
  const layers: Record<Layer, { mesh: InstancedMesh; rel: Matrix4 }[]> = { static: [], nacelle: [], rotor: [] };
  template.group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const layer = layerOf(mesh);
    const rel = new Matrix4().multiplyMatrices(inv[layer], mesh.matrixWorld);
    const im = new InstancedMesh(mesh.geometry, mesh.material, placements.length);
    im.name = `${mesh.name}@${layer}`;
    im.castShadow = mesh.castShadow;
    im.receiveShadow = mesh.receiveShadow;
    im.renderOrder = mesh.renderOrder;
    im.frustumCulled = false; // instances spread far beyond the template's bounds
    layers[layer].push({ mesh: im, rel });
    group.add(im);
  });
  const turbines = placements.map((p, i) => ({
    yaw: p.yaw ?? 0,
    phase: p.phase ?? i * 2.399, // golden angle: no two neighbours in step
    speed: p.speed ?? 1.26,
  }));
  const place = placements.map((p) => placementMatrix(p));
  const m = new Matrix4();
  const yawM = new Matrix4();
  const spin = new Matrix4();
  const nacelleM = new Matrix4();
  const write = (layer: Layer, i: number, frame: Matrix4): void => {
    for (const { mesh, rel } of layers[layer]) mesh.setMatrixAt(i, m.multiplyMatrices(frame, rel));
  };
  for (let i = 0; i < placements.length; i++) write('static', i, place[i]!);
  for (const { mesh } of layers.static) mesh.instanceMatrix.needsUpdate = true;

  const update = (dt: number): void => {
    for (let i = 0; i < turbines.length; i++) {
      const tb = turbines[i]!;
      tb.phase -= tb.speed * dt; // same sense as windTurbine.update
      nacelleM.multiplyMatrices(place[i]!, n0).multiply(yawM.makeRotationY(tb.yaw));
      write('nacelle', i, nacelleM);
      write('rotor', i, nacelleM.multiply(r0).multiply(spin.makeRotationZ(tb.phase)));
    }
    for (const l of ['nacelle', 'rotor'] as const) for (const { mesh } of layers[l]) mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return {
    group,
    count: placements.length,
    turbines,
    hubHeight: template.hubHeight,
    rotorRadius: template.rotorRadius,
    triangles: template.triangles,
    update,
    hubOf(i, out = new Vector3()) {
      // hub in template model space (yaw 0) → nacelle frame → yaw → model space → placement
      return template
        .anchorLocal('hub', out)
        .applyMatrix4(n0Inverse)
        .applyMatrix4(yawM.makeRotationY(turbines[i]!.yaw))
        .applyMatrix4(n0)
        .applyMatrix4(place[i]!);
    },
    dispose() {
      for (const l of Object.values(layers)) for (const { mesh } of l) mesh.dispose();
      template.group.traverse((o) => (o as Mesh).geometry?.dispose());
      for (const mat of template.mats.list()) mat.dispose();
    },
  };
}
