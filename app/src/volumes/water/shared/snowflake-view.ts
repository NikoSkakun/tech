/**
 * A snow crystal as it grows (`sim/snowflake.ts`): one hexagonal prism per frozen cell, instanced. `moment`
 * (0 … 1) shows the crystal at that moment of its growth — cells pop in as the moment passes them and shrink away
 * when it goes back, so a slider scrubs the growth both ways.
 */
import { Color, CylinderGeometry, Group, InstancedMesh, Object3D } from 'three';
import { col, K } from '@/style';
import type { Snowflake } from '../sim/snowflake';

export interface SnowflakeView {
  readonly group: Group;
  /** Replace the crystal (another weather). */
  set(flake: Snowflake): void;
  /** Show the crystal at `moment` of its growth, 0 … 1. */
  show(moment: number): void;
}

/** `size`: the width of a fully grown crystal, world units; `capacity`: most cells a crystal may have. */
export function createSnowflakeView(size: number, capacity = 9000): SnowflakeView {
  const group = new Group();
  group.name = 'snowflake';
  const material = K.toon({ color: 'white', gloss: 0.7, rim: 0.6, emissive: 'sky', emissiveIntensity: 0.35 });
  // a unit hexagonal prism, flat side toward +z after the rotation below
  const cell = new CylinderGeometry(1, 1, 1, 6);
  cell.rotateX(Math.PI / 2);
  const mesh = new InstancedMesh(cell, material, capacity);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  group.add(mesh);
  const dummy = new Object3D();
  const centre = col('white');
  const tip = col('sky').lerp(col('white'), 0.35);
  const tint = new Color();
  let flake: Snowflake | null = null;
  let pitch = 0;
  let shown = -1;
  const view: SnowflakeView = {
    group,
    set(next) {
      flake = next;
      pitch = size / (2 * next.radius + 1);
      mesh.count = Math.min(capacity, next.count);
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, tint.lerpColors(centre, tip, next.at[i]!));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      shown = -1;
      view.show(0);
    },
    show(moment) {
      if (!flake || Math.abs(moment - shown) < 1e-4) return;
      shown = moment;
      // the seed is there from the start; a cell takes 3 % of the growth to pop in
      const m = 0.02 + 0.98 * moment;
      for (let i = 0; i < mesh.count; i++) {
        const k = Math.min(1, Math.max(0, (m - flake.at[i]!) / 0.03));
        const s = pitch * 0.6 * (k * (2 - k));
        dummy.position.set((flake.q[i]! + flake.r[i]! / 2) * pitch, flake.r[i]! * 0.866 * pitch, 0);
        // thicker toward the centre, like a real crystal
        dummy.scale.set(s, s, pitch * (1.2 + 2.4 * (1 - flake.at[i]!)) * (k > 0 ? 1 : 0));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  return view;
}
