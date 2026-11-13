/**
 * «Куди зникає 100 % світла?» (step 2): a chunky 3D pie of where sunlight ends up in an ideal silicon cell.
 * Shares are the document's rounded estimate for the Shockley–Queisser limit (step `pv-effect`, «Інтерактив»):
 * not absorbed ≈ 19 %, thermalisation ≈ 33 %, other fundamental losses ≈ 15 %, useful ≈ 33 %.
 */
import { CylinderGeometry, Group, Mesh, type Object3D } from 'three';
import { K, type ColorToken } from '@/style';
import type { L } from '../labels';

export const LIGHT_LOSSES: readonly { label: keyof typeof L; share: number; color: ColorToken }[] = [
  { label: 'lossUseful', share: 33, color: 'green' },
  { label: 'lossHeat', share: 33, color: 'orange' },
  { label: 'lossPassed', share: 19, color: 'steel' },
  { label: 'lossOther', share: 15, color: 'violet' },
];

export interface LossPie {
  group: Group;
  /** One anchor per wedge (same order as `LIGHT_LOSSES`), at its outer edge. */
  anchors: Object3D[];
  update(t: number): void;
}

export function createLossPie(radius = 1.1): LossPie {
  const group = new Group();
  group.name = 'loss-pie';
  const anchors: Object3D[] = [];
  const wedges: Mesh[] = [];
  let start = 0;
  for (const part of LIGHT_LOSSES) {
    const sweep = (part.share / 100) * Math.PI * 2;
    const useful = part.label === 'lossUseful';
    const h = useful ? 0.5 : 0.34;
    const wedge = new Mesh(new CylinderGeometry(radius, radius, h, 48, 1, false, start + 0.02, sweep - 0.04), K.toon({ color: part.color, gloss: 0.4, rim: 0.8 }));
    const mid = start + sweep / 2;
    // CylinderGeometry measures theta from +Z toward +X; the useful wedge is pulled out a little
    const out = useful ? 0.16 : 0.03;
    wedge.position.set(Math.sin(mid) * out, h / 2, Math.cos(mid) * out);
    wedge.castShadow = true;
    wedge.material.side = 2; // the radial cut faces are open: show the inside instead of a hole
    const anchor = new Group();
    anchor.position.set(Math.sin(mid) * radius * 0.7, h + 0.05, Math.cos(mid) * radius * 0.7);
    group.add(wedge, anchor);
    wedges.push(wedge);
    anchors.push(anchor);
    start += sweep;
  }
  return {
    group,
    anchors,
    update(t) {
      group.rotation.y = Math.sin(t * 0.3) * 0.25 - 0.5;
    },
  };
}
