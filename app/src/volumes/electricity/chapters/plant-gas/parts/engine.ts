/**
 * Hero gas engine (step 8): a 20-cylinder V engine (two banks of 10 at ±25° from vertical) with its generator,
 * turbocharger and heat-recovery exchangers. The near bank is drawn as glass liners so the pistons, rods and
 * combustion flashes show; the far bank is solid. Crank axis along X at `CRANK_Y`; turbocharger at −X,
 * generator at +X. Metres (engine ≈ 8 m, set ≈ 14 m). Moving pieces are animated by `engine-anim.ts`.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';

export const ENGINE_GEO = {
  crankY: 1.6,
  cylinders: 10,
  pitch: 0.62,
  x0: -2.8,
  /** Bank angle from vertical, rad. */
  bank: 0.44,
  /** Crank radius and rod length, m (stroke 0.4 m). */
  crank: 0.2,
  rod: 0.82,
  bore: 0.21,
  linerLength: 1.3,
} as const;

/** Unit vector along the axis of a cylinder of the near (+Z) or far (−Z) bank. */
export function bankAxis(near: boolean, out = new Vector3()): Vector3 {
  const a = ENGINE_GEO.bank;
  return out.set(0, Math.cos(a), near ? Math.sin(a) : -Math.sin(a));
}

export function cylinderX(i: number): number {
  return ENGINE_GEO.x0 + i * ENGINE_GEO.pitch;
}

export interface EngineModel {
  model: KitModel;
  /** Local anchors: turbo, generator, spark (cylinder 0), heat (exhaust-gas boiler outlet). */
  at: Record<'turbo' | 'generator' | 'spark' | 'heat' | 'container', Vector3>;
}

export function buildEngineModel(): EngineModel {
  const G0 = ENGINE_GEO;
  const b = new Builder('gas-engine');
  const block = col('teal').lerp(col('slate'), 0.35);
  const yc = G0.crankY;
  // bed frame and crankcase
  b.box(14, 0.5, 4.6, { r: 0.12, slot: 'metal', c: ['slate', 'steel'], at: [0.6, 0, 0] });
  b.box(7.4, 1.25, 2.4, { r: 0.3, c: [block.clone().multiplyScalar(0.8), block], at: [0, 0.5, 0] });
  const ax = new Vector3();
  const len = G0.linerLength;
  for (const near of [true, false]) {
    bankAxis(near, ax);
    const rot: [number, number, number] = [near ? G0.bank : -G0.bank, 0, 0];
    for (let i = 0; i < G0.cylinders; i++) {
      const x = cylinderX(i);
      const base = new Vector3(x, yc, 0).addScaledVector(ax, G0.rod - G0.crank + 0.05);
      if (near) {
        // cut-open liner: only its back half, so the piston, rod and flame are in plain view
        b.lathe([[G0.bore + 0.03, 0], [G0.bore + 0.08, 0], [G0.bore + 0.08, len], [G0.bore + 0.03, len], [G0.bore + 0.03, 0]], { seg: 20, phiStart: Math.PI / 2, phiLength: Math.PI, slot: 'gloss', c: [block.clone().multiplyScalar(0.7), block], at: [base.x, base.y, base.z], rot });
      } else {
        b.cyl(G0.bore + 0.07, len, { seg: 16, c: [block.clone().multiplyScalar(0.85), block], at: [base.x, base.y, base.z], rot, bevel: 0.04 });
      }
      const head = base.clone().addScaledVector(ax, len);
      b.box(0.56, 0.42, 0.62, { r: 0.08, c: ['slate', 'steel'], at: [head.x, head.y, head.z], rot });
      const plug = head.clone().addScaledVector(ax, 0.44);
      b.cyl(0.05, 0.22, { seg: 8, slot: 'gloss', c: 'yellow', at: [plug.x, plug.y, plug.z], rot });
    }
    // bank girder joining the cylinders, intake manifold on the outer side (`sky`)
    const mid = new Vector3(0.0, yc, 0).addScaledVector(ax, G0.rod + 0.2);
    b.box(6.6, 0.3, 0.3, { r: 0.08, c: block, at: [-0.0, mid.y, mid.z], rot, mid: true });
    if (!near) {
      const inl = new Vector3(0, yc, 0).addScaledVector(ax, G0.rod + len * 0.75).add(new Vector3(0, 0, -0.55));
      b.cyl(0.2, 6.6, { axis: 'x', seg: 14, slot: 'gloss', c: 'sky', at: [-3.3, inl.y, inl.z] });
    }
  }
  // exhaust manifold in the V (`coral`), running to the turbocharger
  b.cyl(0.24, 7.0, { axis: 'x', seg: 16, slot: 'gloss', c: ['coral.dark', 'coral'], at: [-4.0, yc + G0.rod + len + 0.25, 0] });
  // turbocharger at −X: turbine housing (hot) + compressor housing (cool) on one shaft
  const tx = -5.0;
  const ty = yc + G0.rod + len + 0.25;
  b.ring(0.48, 0.2, { axis: 'x', seg: 28, tubeSeg: 10, slot: 'gloss', c: 'orange', at: [tx, ty, 0] });
  b.ring(0.5, 0.2, { axis: 'x', seg: 28, tubeSeg: 10, slot: 'gloss', c: 'sky', at: [tx - 0.9, ty, 0] });
  const turbo = b.part('turbo', { at: [tx - 0.45, ty, 0] });
  for (const [dx, c] of [[0.45, 'orange'], [-0.45, 'sky']] as const)
    for (let k = 0; k < 8; k++) turbo.box(0.06, 0.34, 0.16, { r: 0, slot: 'metal', c, at: [dx, 0, 0], rot: [(k * Math.PI) / 4, 0.4, 0], mid: true });
  turbo.cyl(0.06, 1.2, { axis: 'x', seg: 8, slot: 'metal', c: 'mist', at: [-0.6, 0, 0] });
  // exhaust-gas boiler (heat recovery) after the turbine, jacket-water exchanger under it
  b.box(1.6, 2.4, 1.8, { r: 0.2, c: ['orange.dark', 'orange'], at: [-6.3, ty - 0.6, 0] });
  b.box(1.4, 1.2, 1.4, { r: 0.15, c: ['blue', 'sky'], at: [-6.3, 0.5, 0] });
  // crankshaft (part) and the generator at +X
  const crank = b.part('crank', { at: [0, yc, 0] });
  crank.cyl(0.14, 9.2, { axis: 'x', seg: 14, slot: 'metal', c: 'mist', at: [-4.1, 0, 0] });
  for (let i = 0; i < G0.cylinders; i++) crank.box(0.12, 0.5, 0.36, { r: 0.04, slot: 'metal', c: 'steel.light', at: [cylinderX(i), -0.08, 0], mid: true });
  b.cyl(1.25, 3.4, { axis: 'x', seg: 32, slot: 'gloss', c: ['teal.dark', 'teal'], at: [4.4, yc + 0.2, 0], bevel: 0.2 });
  b.box(1.4, 1.0, 1.0, { r: 0.12, c: 'slate', at: [6.0, yc + 1.2, 0] });
  for (const [k, c] of [[-0.3, 'yellow'], [0, 'green'], [0.3, 'red']] as const) b.cyl(0.06, 0.4, { seg: 8, slot: 'gloss', c, at: [6.0 + k, yc + 2.2, 0] });
  const model = b.build();
  return {
    model,
    at: {
      turbo: new Vector3(tx - 0.45, ty + 0.6, 0),
      generator: new Vector3(4.4 + 1.7, yc + 1.5, 0.8),
      spark: new Vector3(cylinderX(0), yc, 0).addScaledVector(bankAxis(true), G0.rod + len + 0.6),
      heat: new Vector3(-6.3, ty + 1.8, 0),
      container: new Vector3(0, 0, 0),
    },
  };
}
