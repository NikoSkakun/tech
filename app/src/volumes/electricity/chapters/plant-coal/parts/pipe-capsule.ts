/**
 * Step 5 hero: a section of boiler tube as a big transparent capsule with flanged steel ends. What is inside
 * follows the state point of the step: below the critical pressure and at the saturation temperature two phases
 * boil (`blue` water below a `white` surface, bubbles, steam above); above it only superheated steam (white +
 * `pink` puffs); above 22,064 MPa one single fluid without a surface whose tint runs `blue` → `white`+`pink` with
 * temperature (document, step 5). `set(state)` is a pure mapping of (phase, tint) to the visuals.
 */
import { Group, Mesh, CylinderGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createBubbles, createHotSteam, type ParticleSystem } from '@/fx';
import { Builder } from '@/kit';
import { K, col, type KGlassMaterial } from '@/style';

export type Phase = 'boiling' | 'steam' | 'fluid';

export interface PipeCapsule {
  group: Group;
  /** Anchors (world): the wall flange (alloy), the fluid (critical point), the surface. */
  points: { wall: Vector3; fluid: Vector3 };
  /** Phase and temperature share 0 (300 °C) … 1 (720 °C). */
  set(phase: Phase, heat: number): void;
}

const R = 9;
const LEN = 30;

export function buildPipeCapsule(ctx: ChapterContext, at: Vector3): PipeCapsule {
  const group = new Group();
  group.position.copy(at);
  const shell = new Mesh(new CylinderGeometry(R, R, LEN, 48, 1, true), K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.55 }));
  shell.rotation.z = Math.PI / 2;
  shell.renderOrder = 4;
  group.add(shell);
  const ends = new Builder('pipe-ends');
  for (const s of [-1, 1]) {
    ends.cyl(R + 1.6, 2.4, { seg: 48, axis: 'x', slot: 'metal', c: ['steel', 'mist'], at: [s > 0 ? LEN / 2 - 1 : -LEN / 2 - 1.4, 0, 0] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ends.cyl(0.5, 3.2, { seg: 8, axis: 'x', slot: 'metal', c: 'slate', at: [s * (LEN / 2) - 1.6, Math.cos(a) * (R + 0.8), Math.sin(a) * (R + 0.8)] });
    }
  }
  group.add(ends.build().group);
  // water (lower half), its white surface, and the single-phase fluid that fills the whole tube
  const water = new Mesh(new CylinderGeometry(R * 0.96, R * 0.96, LEN - 1, 40, 1, false, Math.PI / 2, Math.PI), K.glass({ color: 'blue', opacity: 0.55, edgeOpacity: 0.7 }));
  water.rotation.z = Math.PI / 2;
  water.renderOrder = 2;
  const surface = new Mesh(new CylinderGeometry(0.15, 0.15, LEN - 1, 6), K.glow({ color: 'white', intensity: 1.2 }));
  surface.rotation.z = Math.PI / 2;
  surface.scale.set(1, 1, R * 12);
  const fluidMat = K.glass({ color: 'blue', opacity: 0.4, edgeOpacity: 0.7 }) as KGlassMaterial;
  const fluid = new Mesh(new CylinderGeometry(R * 0.95, R * 0.95, LEN - 1, 40), fluidMat);
  fluid.rotation.z = Math.PI / 2;
  fluid.renderOrder = 2;
  group.add(water, surface, fluid);
  const bubbles: ParticleSystem = createBubbles(ctx, { size: [LEN - 4, R * 0.9, R * 1.4], radius: 0.5, rise: 3 });
  bubbles.position.set(0, -R * 0.5, 0);
  const steam: ParticleSystem = createHotSteam(ctx, { radius: 2.6, height: 3.5, axis: [1, 0, 0], count: ctx.quality.count(40, 16) });
  steam.position.set(-LEN / 2 + 4, R * 0.3, 0);
  group.add(bubbles, steam);
  const blue = col('blue');
  const hot = col('white').lerp(col('pink'), 0.35);
  return {
    group,
    points: { wall: at.clone().add(new Vector3(LEN / 2 - 0.5, R + 1.6, 0)), fluid: at.clone().add(new Vector3(-4, 0, 0)) },
    set(phase, heat) {
      water.visible = surface.visible = phase === 'boiling';
      bubbles.setEmitting(phase === 'boiling');
      steam.setEmitting(phase !== 'fluid');
      steam.position.y = phase === 'boiling' ? R * 0.45 : 0;
      fluid.visible = phase === 'fluid';
      fluidMat.color.copy(blue).lerp(hot, Math.max(0, Math.min(1, heat)));
    },
  };
}
