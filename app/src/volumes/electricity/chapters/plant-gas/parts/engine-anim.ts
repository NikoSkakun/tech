/**
 * Moving parts of the hero gas engine: crankshaft, the near bank's pistons and connecting rods (instanced),
 * combustion flashes (`orange`) with the spark (`yellow`) at the start of each power stroke, and the
 * turbocharger. Four-stroke cycle = 720° of crank: phase 0…¼ intake, ¼…½ compression, ½…¾ spark + power,
 * ¾…1 exhaust. `crankAngle` is integrated from `rpm`; «Такт за тактом» steps it by 180° with a tween.
 */
import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { G } from '@/kit';
import { K } from '@/style';
import { ENGINE_GEO, bankAxis, cylinderX, type EngineModel } from './engine';

export type Stroke = 'intake' | 'compression' | 'power' | 'exhaust';
export const STROKES: readonly Stroke[] = ['intake', 'compression', 'power', 'exhaust'];

export interface EngineAnim {
  group: Group;
  /** Crank angle, rad (free to set: the step-by-step mode tweens it). */
  crankAngle: number;
  /** Crank speed, rad/s on screen (0 = held). */
  speed: number;
  /** Cylinder 0's current stroke. */
  stroke(): Stroke;
  /** Combustion glow 0…1 of cylinder 0 (for its callout). */
  flash0(): number;
  update(dt: number): void;
}

/** Firing phase of cylinder i (evenly spread over the 720° cycle). */
const phaseOf = (i: number): number => ((i * 7) % ENGINE_GEO.cylinders) / ENGINE_GEO.cylinders;

export function animateEngine(engine: EngineModel): EngineAnim {
  const g = ENGINE_GEO;
  const n = g.cylinders;
  const group = new Group();
  const pistons = new InstancedMesh(G.cyl(g.bore, 0.3, { seg: 18, bevel: 0.03 }), K.metal({ color: 'mist' }), n);
  const rods = new InstancedMesh(G.box(0.08, 1, 0.1), K.metal({ color: 'steel' }), n);
  const fire = new InstancedMesh(G.sphere(g.bore * 0.95, 14), K.glow({ color: 'orange', intensity: 1.8, whiten: 0.2 }), n);
  const spark = new InstancedMesh(G.sphere(0.07, 8), K.glow({ color: 'yellow', intensity: 2.2, whiten: 0, keepHue: true }), n);
  for (const m of [pistons, rods, fire, spark]) m.frustumCulled = false;
  group.add(pistons, rods, fire, spark);
  const crank = engine.model.part('crank');
  const turbo = engine.model.part('turbo');
  const ax = bankAxis(true);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const s = new Vector3();
  const pin = new Vector3();
  const piston = new Vector3();
  const dir = new Vector3();
  const mid = new Vector3();
  const flashes = new Float32Array(n);
  const anim: EngineAnim = {
    group,
    crankAngle: 0,
    speed: 6,
    stroke() {
      const p = (((anim.crankAngle / (4 * Math.PI) + phaseOf(0)) % 1) + 1) % 1;
      return STROKES[Math.min(3, Math.floor(p * 4))] as Stroke;
    },
    flash0: () => flashes[0] ?? 0,
    update(dt) {
      anim.crankAngle += anim.speed * dt;
      crank.rotation.x = anim.crankAngle;
      turbo.rotation.x += dt * (4 + anim.speed * 3);
      for (let i = 0; i < n; i++) {
        const cyc = (((anim.crankAngle / (4 * Math.PI) + phaseOf(i)) % 1) + 1) % 1;
        const th = cyc * 4 * Math.PI; // crank angle of this cylinder from its TDC (intake start)
        // slider-crank: crank pin on a circle around the axis, piston on the cylinder axis
        const x = cylinderX(i);
        const perp = new Vector3(0, -ax.z, ax.y);
        pin.set(x, g.crankY, 0).addScaledVector(ax, g.crank * Math.cos(th)).addScaledVector(perp, g.crank * Math.sin(th));
        const along = g.crank * Math.cos(th) + Math.sqrt(g.rod * g.rod - (g.crank * Math.sin(th)) ** 2);
        piston.set(x, g.crankY, 0).addScaledVector(ax, along);
        q.setFromUnitVectors(up, ax);
        pistons.setMatrixAt(i, m.compose(piston, q, s.set(1, 1, 1)));
        dir.subVectors(piston, pin);
        mid.addVectors(piston, pin).multiplyScalar(0.5);
        q.setFromUnitVectors(up, dir.clone().normalize());
        rods.setMatrixAt(i, m.compose(mid, q, s.set(1, dir.length(), 1)));
        // flash: from the spark (phase ½) fading through the first part of the power stroke
        const f = cyc >= 0.5 && cyc < 0.62 ? 1 - (cyc - 0.5) / 0.12 : 0;
        flashes[i] = f;
        const top = new Vector3(x, g.crankY, 0).addScaledVector(ax, along + 0.32 + 0.2 * (1 - f));
        fire.setMatrixAt(i, m.compose(top, q.identity(), s.setScalar(Math.max(0.001, f))));
        const plug = new Vector3(x, g.crankY, 0).addScaledVector(ax, g.rod + g.crank + 0.05 + g.linerLength - 0.05);
        spark.setMatrixAt(i, m.compose(plug, q, s.setScalar(cyc >= 0.49 && cyc < 0.54 ? 1 : 0.001)));
      }
      for (const mm of [pistons, rods, fire, spark]) mm.instanceMatrix.needsUpdate = true;
    },
  };
  anim.update(0);
  return anim;
}

/** Attach the animated parts next to the engine model (same parent, same frame). */
export function mountEngine(parent: Object3D, engine: EngineModel, anim: EngineAnim): void {
  parent.add(engine.model.group, anim.group);
}
