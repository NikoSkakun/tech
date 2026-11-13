/**
 * `Dopants` of step 7 (DECISIONS §50): phosphorus (donor, `teal`, «P, 5 e⁻») and boron (acceptor, `pink`,
 * «B, 3 e⁻») atoms that take the place of silicon atoms in the planar scheme. A placed atom first stands
 * neutral; once it has given away (P) or taken (B) an electron it is a fixed ion — a «+» / «−» sticker and a
 * `coral.dark` / `cyan.dark` ring. Also the tray the user drags new dopants from.
 */
import { Group, InstancedMesh, Matrix4, Mesh, type Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

export const MAX_DOPANTS = 16;

export type DopantKind = 'P' | 'B';

export interface Dopant {
  kind: DopantKind;
  atom: number;
  /** Seconds since placed; ionised after `IONISE_S`. */
  age: number;
  ionised: boolean;
}

export interface DopantView {
  group: Group;
  tray: Group;
  /** Draggable tray atoms. */
  trayP: Mesh;
  trayB: Mesh;
  /** The atom following the pointer while dragging (null = none). */
  ghost: { kind: DopantKind; pos: Vector3 } | null;
  draw(list: readonly Dopant[], atomPos: readonly Vector3[], t: number): void;
}

export function createDopantView(trayAt: Vector3): DopantView {
  const group = new Group();
  const make = (color: 'teal' | 'pink', glyph: 'none' | 'plus' | 'minus'): Orbs =>
    createOrbs({ kind: 'ion', color, glyph, count: MAX_DOPANTS, radius: 0.2 });
  const pNeutral = make('teal', 'none');
  const pIon = make('teal', 'plus');
  const bNeutral = make('pink', 'none');
  const bIon = make('pink', 'minus');
  const ringGeo = G.ring(0.27, 0.025, 40, 8).rotateX(Math.PI / 2);
  const ringsP = new InstancedMesh(
    ringGeo,
    K.glow({ color: 'coral.dark', whiten: 0, keepHue: true, intensity: 1.3 }),
    MAX_DOPANTS,
  );
  const ringsB = new InstancedMesh(
    ringGeo,
    K.glow({ color: 'cyan.dark', whiten: 0, keepHue: true, intensity: 1.3 }),
    MAX_DOPANTS,
  );
  const ghostP = make('teal', 'none');
  const ghostB = make('pink', 'none');
  group.add(pNeutral, pIon, bNeutral, bIon, ringsP, ringsB, ghostP, ghostB);
  // tray: a rounded dish with one P and one B ready to be picked up
  const tray = new Group();
  tray.position.copy(trayAt);
  const tb = new Builder('tray');
  tb.box(1.9, 0.12, 0.8, { r: 0.06, c: ['bg.deep', 'slate'], at: [0, -0.3, 0] });
  for (const x of [-0.45, 0.45])
    tb.cyl(0.3, 0.05, { seg: 32, slot: 'glow', c: x < 0 ? 'teal.dark' : 'pink.dark', at: [x, -0.19, 0] });
  tray.add(tb.build().group);
  const trayP = new Mesh(G.sphere(0.2, 32), K.toon({ color: 'teal', gloss: 0.6, rim: 1 }));
  trayP.position.set(-0.45, 0.05, 0);
  const trayB = new Mesh(G.sphere(0.2, 32), K.toon({ color: 'pink', gloss: 0.6, rim: 1 }));
  trayB.position.set(0.45, 0.05, 0);
  tray.add(trayP, trayB);
  group.add(tray);
  const m = new Matrix4();
  const hide = (o: Orbs | InstancedMesh, i: number): void => {
    if (o instanceof InstancedMesh) {
      m.makeScale(0, 0, 0);
      o.setMatrixAt(i, m);
    } else o.setPosition(i, 0, 0, 0, 0);
  };
  const view: DopantView = {
    group,
    tray,
    trayP,
    trayB,
    ghost: null,
    draw(list, atomPos, t) {
      for (let i = 0; i < MAX_DOPANTS; i++) {
        for (const o of [pNeutral, pIon, bNeutral, bIon, ringsP, ringsB]) hide(o, i);
        const d = list[i];
        if (!d) continue;
        const p = atomPos[d.atom]!;
        const pop = Math.min(d.age / 0.4, 1);
        const s = pop * (1 + 0.1 * (1 - pop));
        const orb = d.kind === 'P' ? (d.ionised ? pIon : pNeutral) : d.ionised ? bIon : bNeutral;
        orb.setPosition(i, p.x, p.y, 0.02, s);
        if (d.ionised) {
          const pulse = 1 + 0.05 * Math.sin(t * 3 + i);
          m.makeScale(pulse, pulse, pulse).setPosition(p.x, p.y, 0.02);
          (d.kind === 'P' ? ringsP : ringsB).setMatrixAt(i, m);
        }
      }
      for (const o of [pNeutral, pIon, bNeutral, bIon]) o.commit();
      ringsP.instanceMatrix.needsUpdate = true;
      ringsB.instanceMatrix.needsUpdate = true;
      const g = view.ghost;
      ghostP.setPosition(0, g?.pos.x ?? 0, g?.pos.y ?? 0, 0.3, g?.kind === 'P' ? 1.1 : 0);
      ghostB.setPosition(0, g?.pos.x ?? 0, g?.pos.y ?? 0, 0.3, g?.kind === 'B' ? 1.1 : 0);
      for (let i = 1; i < MAX_DOPANTS; i++) {
        ghostP.setPosition(i, 0, 0, 0, 0);
        ghostB.setPosition(i, 0, 0, 0, 0);
      }
      ghostP.commit();
      ghostB.commit();
      trayP.position.y = 0.05 + 0.04 * Math.sin(t * 2);
      trayB.position.y = 0.05 + 0.04 * Math.sin(t * 2 + 1.5);
    },
  };
  return view;
}
