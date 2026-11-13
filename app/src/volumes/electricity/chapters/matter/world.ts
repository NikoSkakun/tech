/**
 * Shared world of the chapter: the small floating podium-disc every set hovers over («кристал-трансформер над
 * подіумом»), with a slowly turning ring of crystal motes under it. Units: 1 unit ≈ 0,15 nm in the copper
 * close-ups (unit cell a = 0,3615 nm → `LATTICE.a` units); the podium has a radius of 3.4, its top is y = 0.
 */
import { Group, Mesh, OctahedronGeometry, type Object3D, type ShaderMaterial, type Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder } from '@/kit';
import { K } from '@/style';

export const PODIUM_R = 3.4;
/** Height of the centre of the hero above the podium top. */
export const HERO_Y = 2.4;

export interface Podium {
  group: Group;
  update(t: number): void;
}

export function createPodium(ctx: ChapterContext): Podium {
  const group = new Group();
  group.name = 'podium';
  const b = new Builder('podium');
  // stepped disc: dark base, indigo body, a thin glowing teal rim, a glassy inlay on top
  b.cyl(PODIUM_R * 0.82, 0.5, { seg: 72, c: ['bg.void', 'bg.deep'], at: [0, -0.95, 0] });
  b.cyl(PODIUM_R, 0.42, { seg: 96, c: ['bg.deep', 'bg.indigo'], at: [0, -0.45, 0] });
  b.ring(PODIUM_R - 0.05, 0.045, { seg: 128, slot: 'glow', c: 'teal', at: [0, -0.04, 0] });
  b.cyl(PODIUM_R * 0.9, 0.05, { seg: 96, c: 'bg.indigo', at: [0, -0.04, 0] });
  for (const r of [0.62, 0.78])
    b.ring(PODIUM_R * r, 0.016, { seg: 128, slot: 'glow', c: 'teal.dark', at: [0, 0.012, 0] });
  // eight small studs around the rim (third level of detail)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    b.cyl(0.09, 0.07, {
      seg: 20,
      slot: 'glow',
      c: 'cyan',
      at: [Math.cos(a) * (PODIUM_R - 0.32), 0, Math.sin(a) * (PODIUM_R - 0.32)],
    });
  }
  const podium = b.build();
  // the wide top is seen at grazing angles: the default rim would wash it out to the `sky` rim colour
  const toon = podium.mats.get('toon') as ShaderMaterial;
  (toon.uniforms.uRim!.value as Vector3).x = 0.12;
  group.add(podium.group);

  // "кристалічні" motes: a slow ring of tiny octahedra under the podium edge
  const motes = new Group();
  const oct = new OctahedronGeometry(0.07, 0);
  const mat = K.toon({ color: 'sky', emissive: 'sky', emissiveIntensity: 0.5, flatShading: true });
  const count = ctx.quality.count(28, 10);
  for (let i = 0; i < count; i++) {
    const m = new Mesh(oct, mat);
    const a = (i / count) * Math.PI * 2;
    const r = PODIUM_R + 0.5 + ctx.random.next() * 1.4;
    m.position.set(Math.cos(a) * r, -1.2 + ctx.random.next() * 1.6, Math.sin(a) * r);
    m.scale.setScalar(0.5 + ctx.random.next());
    motes.add(m);
  }
  group.add(motes);
  return {
    group,
    update(t) {
      motes.rotation.y = t * 0.03;
      motes.children.forEach((m: Object3D, i) => {
        m.rotation.set(t * 0.4 + i, t * 0.3 + i * 2, 0);
      });
    },
  };
}
