/**
 * Instancing utilities: turn one built model into many placed copies for the cost of the model's own draw
 * calls (towers along a line, houses of a village, PV tables of a solar farm).
 */
import { Color, Group, InstancedMesh, Matrix4, type Mesh } from 'three';
import { col } from '@/style';
import { placementMatrix, type KitModel, type Placement } from './builder';

/**
 * Instanced copies of a *static* model. The returned group replaces the model in the scene (do not add
 * `model.group` as well); animated parts are frozen in their current pose.
 */
export function instanced(model: KitModel, placements: readonly Placement[]): Group {
  const group = new Group();
  group.name = `${model.group.name}×${placements.length}`;
  model.group.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(model.group.matrixWorld).invert();
  const rel = new Matrix4();
  const m = new Matrix4();
  const p = new Matrix4();
  const c = new Color();
  const tinted = placements.some((pl) => pl.tint !== undefined);
  model.group.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    rel.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const im = new InstancedMesh(mesh.geometry, mesh.material, placements.length);
    im.name = mesh.name;
    placements.forEach((pl, i) => {
      im.setMatrixAt(i, m.multiplyMatrices(placementMatrix(pl, p), rel));
      if (tinted) im.setColorAt(i, col(pl.tint ?? 'white', c));
    });
    im.castShadow = mesh.castShadow;
    im.receiveShadow = mesh.receiveShadow;
    im.renderOrder = mesh.renderOrder;
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}
