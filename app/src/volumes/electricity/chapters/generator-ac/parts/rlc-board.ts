/**
 * The «лабораторна дошка» of step 9: a bench with an AC source (box with a frequency dial), a resistor (`steel`
 * body with colour bands), a coil (`orange` copper on an iron core) and a capacitor (`sky` can), wired in series
 * in a loop. Element materials are exposed so the step can make L and C glow near resonance. Origin = centre of
 * the bench top; elements stand along X.
 */
import { CylinderGeometry, type Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createWire, type Wire } from '@/fx';
import { G } from '@/kit';
import { K } from '@/style';
import { COPPER, group } from '../world';

export const ELEMENT_X = { source: -2.2, R: -0.85, L: 0.5, C: 1.85 } as const;

export interface RlcBoard {
  group: Group;
  /** Element groups (R, L, C) — dimmed by the step when bypassed. */
  parts: { R: Group; L: Group; C: Group; source: Group };
  coilGlow: ReturnType<typeof K.metal>;
  capGlow: ReturnType<typeof K.toon>;
  loop: Wire;
  /** Local top points of the elements (mini scopes and labels hang above them). */
  top: Record<'source' | 'R' | 'L' | 'C', Vector3>;
}

export function createRlcBoard(): RlcBoard {
  const g = group('rlc-board');
  const top = new Mesh(new RoundedBoxGeometry(5.8, 0.16, 2.0, 3, 0.06), K.toon({ gradient: { bottom: 'ink', top: 'bg.violet', range: [-0.08, 0.08] }, rim: 0.5 }));
  top.position.y = -0.08;
  top.receiveShadow = true;
  g.add(top);
  for (const [x, z] of [[-2.6, -0.8], [2.6, -0.8], [-2.6, 0.8], [2.6, 0.8]] as const) {
    const leg = new Mesh(G.cyl(0.07, 0.9, { seg: 12 }), K.metal({ color: 'slate' }));
    leg.position.set(x, -1.06, z);
    g.add(leg);
  }
  // source: a box with a dial and two terminals
  const source = group('source', ELEMENT_X.source, 0, 0);
  const box = new Mesh(new RoundedBoxGeometry(0.9, 0.65, 0.7, 3, 0.08), K.toon({ gradient: { bottom: 'teal.dark', top: 'teal', range: [0, 0.65] }, gloss: 0.4 }));
  box.position.y = 0.33;
  const dial = new Mesh(new CylinderGeometry(0.16, 0.16, 0.06, 24).rotateX(Math.PI / 2), K.toon({ color: 'white' }));
  dial.position.set(0, 0.38, 0.36);
  const tilde = new Mesh(new TorusGeometry(0.06, 0.015, 6, 16, Math.PI), K.toon({ color: 'ink' }));
  tilde.position.set(0, 0.38, 0.4);
  source.add(box, dial, tilde);
  // resistor
  const R = group('R', ELEMENT_X.R, 0, 0);
  const body = new Mesh(G.capsule(0.2, 0.95, 20).rotateZ(Math.PI / 2), K.toon({ color: 'steel', gloss: 0.4 }));
  body.position.y = 0.32;
  R.add(body);
  ['coral', 'violet', 'amber', 'yellow'].forEach((c, i) => {
    const band = new Mesh(new CylinderGeometry(0.205, 0.205, 0.06, 24).rotateZ(Math.PI / 2), K.toon({ color: c as 'coral' }));
    band.position.set(-0.26 + i * 0.15, 0.32, 0);
    R.add(band);
  });
  // coil on an iron core
  const L = group('L', ELEMENT_X.L, 0, 0);
  const coilGlow = K.metal({ color: COPPER, specular: 0.85, emissive: 'orange', emissiveIntensity: 0 });
  const core = new Mesh(new RoundedBoxGeometry(0.3, 0.75, 0.3, 2, 0.05), K.metal({ color: 'slate' }));
  core.position.y = 0.38;
  L.add(core);
  for (let i = 0; i < 9; i++) {
    const turn = new Mesh(new TorusGeometry(0.25, 0.04, 8, 28), coilGlow);
    turn.rotation.x = Math.PI / 2;
    turn.position.y = 0.12 + i * 0.065;
    L.add(turn);
  }
  // capacitor can
  const C = group('C', ELEMENT_X.C, 0, 0);
  const capGlow = K.toon({ color: 'sky', gloss: 0.5, emissive: 'sky', emissiveIntensity: 0 });
  const can = new Mesh(G.cyl(0.28, 0.7, { seg: 32, bevel: 0.05 }), capGlow);
  const lid = new Mesh(G.cyl(0.29, 0.06, { seg: 32 }), K.toon({ color: 'mist' }));
  lid.position.y = 0.7;
  C.add(can, lid);
  for (const e of [source, R, L, C]) for (const m of e.children) m.castShadow = true;
  g.add(source, R, L, C);
  // the series loop: source → R → L → C → back along the rear edge
  const y = 0.18;
  const pts = [
    new Vector3(ELEMENT_X.source + 0.45, y, 0.2),
    new Vector3(ELEMENT_X.R - 0.5, y, 0.2),
    new Vector3(ELEMENT_X.R + 0.5, y, 0.2),
    new Vector3(ELEMENT_X.L - 0.3, y, 0.2),
    new Vector3(ELEMENT_X.L + 0.3, y, 0.2),
    new Vector3(ELEMENT_X.C - 0.3, y, 0.2),
    new Vector3(ELEMENT_X.C + 0.3, y, 0.2),
    new Vector3(ELEMENT_X.C + 0.55, y, 0.2),
    new Vector3(ELEMENT_X.C + 0.55, y, -0.65),
    new Vector3(ELEMENT_X.source, y, -0.65),
    new Vector3(ELEMENT_X.source, y, -0.35),
  ];
  const loop = createWire(G.roundPath(pts, 0.12, 4), { radius: 0.04, color: COPPER, repeat: 1.5, speed: 0.8 });
  g.add(loop);
  return {
    group: g,
    parts: { R, L, C, source },
    coilGlow,
    capGlow,
    loop,
    top: { source: new Vector3(ELEMENT_X.source, 0.7, 0), R: new Vector3(ELEMENT_X.R, 0.55, 0), L: new Vector3(ELEMENT_X.L, 0.75, 0), C: new Vector3(ELEMENT_X.C, 0.8, 0) },
  };
}
