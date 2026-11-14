/**
 * Containment of the VVER-1000 unit: prestressed-concrete cylinder with a dome, tendon bands, a buttress rib,
 * an equipment hatch and the low annex on its north side. Built as TWO models — the back half (north, always
 * there) and the front half (south, toward the cameras), so a step can open the building like a doll's house
 * (`stage.actor(front, { appear: 'fade' })`; a separate model owns its own materials, so fading it never fades
 * the back half). Inside: the operating floor and a ring girder for the polar crane.
 */
import { G, Builder, type KitModel } from '@/kit';
import { CONTAINMENT as C } from '../layout';

/** Closed wall section (radius, height) of shell + dome: outer up, inner down. */
function wallSection(): [number, number][] {
  const t = 1.2; // toy wall thickness (real ≈ 1.2 m — this one keeps its real value)
  const out: [number, number][] = [[C.radius, 0], [C.radius, C.wall]];
  const n = 14;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    out.push([Math.max(0.02, C.radius * Math.cos(a)), C.wall + C.dome * Math.sin(a)]);
  }
  for (let i = n; i >= 1; i--) {
    const a = (i / n) * (Math.PI / 2);
    out.push([Math.max(0.02, (C.radius - t) * Math.cos(a)), C.wall + (C.dome - t) * Math.sin(a)]);
  }
  out.push([C.radius - t, C.wall], [C.radius - t, 0]);
  return out;
}

function half(name: string, phiStart: number, front: boolean): KitModel {
  const b = new Builder(name);
  const phi = { phiStart, phiLength: Math.PI, seg: 48 };
  const wall = G.revolve(wallSection(), phi);
  b.add(wall.shell, { slot: 'matte', c: ['steel.light', 'mist'] });
  if (wall.caps) b.add(wall.caps, { slot: 'matte', c: 'slate.light' });
  // tendon bands: thin proud rings every 8 m, and a heavier ring where the dome starts
  for (const y of [8, 16, 24, 32, C.wall - 0.6]) {
    const big = y > C.wall - 1;
    const r = G.revolve([[C.radius - 0.05, y], [C.radius + (big ? 0.7 : 0.35), y], [C.radius + (big ? 0.7 : 0.35), y + (big ? 1.4 : 0.7)], [C.radius - 0.05, y + (big ? 1.4 : 0.7)]], phi);
    b.add(r.shell, { slot: 'matte', c: big ? 'mist' : 'steel.light' });
  }
  // plinth
  const plinth = G.revolve([[C.radius - 0.2, -1], [C.radius + 1.6, -1], [C.radius + 1.6, 2.4], [C.radius - 0.2, 2.4]], phi);
  b.add(plinth.shell, { slot: 'matte', c: 'slate.light' });
  // buttress rib (one per half) and the top cap
  const ribA = phiStart + Math.PI * 0.62;
  // positions below use the lathe's convention: (cos φ, sin φ)
  b.box(1.6, C.wall, 1.4, { r: 0.3, slot: 'matte', c: 'mist', at: [Math.cos(ribA) * (C.radius + 0.5), 0, Math.sin(ribA) * (C.radius + 0.5)], rot: [0, -ribA, 0] });
  if (front) {
    // equipment hatch: a round steel door with a bridge to the ground
    const hA = phiStart + Math.PI * 0.32;
    const hx = Math.cos(hA) * (C.radius + 0.3);
    const hz = Math.sin(hA) * (C.radius + 0.3);
    const ry = Math.PI / 2 - hA;
    b.cyl(3.2, 0.8, { axis: 'z', slot: 'metal', c: 'steel', at: [hx, 9, hz], rot: [0, ry, 0] });
    b.cyl(2.4, 1.0, { axis: 'z', slot: 'metal', c: 'slate', at: [hx, 9, hz], rot: [0, ry, 0] });
    b.box(4.2, 0.6, 9, { r: 0.1, slot: 'matte', c: 'steel', at: [hx + Math.cos(hA) * 4, 5.5, hz + Math.sin(hA) * 4], rot: [0, ry, 0] });
  } else {
    // annex block on the north side (reactor auxiliary building) and the operating floor + crane girder inside
    b.box(58, 14, 30, { r: 0.6, slot: 'matte', c: ['steel.light', 'mist'], at: [0, 0, -C.radius - 14] });
    for (let i = 0; i < 9; i++) b.box(3.2, 1.6, 0.2, { slot: 'window', at: [-24 + i * 6, 9, -C.radius - 29.1] });
    const floor = G.revolve([[0.02, 0.2], [C.radius - 1.1, 0.2], [C.radius - 1.1, 2], [0.02, 2]], { phiStart: 0, phiLength: Math.PI * 2, seg: 48 });
    b.add(floor.shell, { slot: 'matte', c: ['slate', 'steel'] });
    const girder = G.revolve([[C.radius - 2.4, 33], [C.radius - 1.2, 33], [C.radius - 1.2, 34.4], [C.radius - 2.4, 34.4]], phi);
    b.add(girder.shell, { slot: 'metal', c: 'amber.dark' });
  }
  // steel liner on the inside: a darker interior, so the machines read against it
  const liner: [number, number][] = [[C.radius - 1.32, 2], [C.radius - 1.2, 2], [C.radius - 1.2, C.wall], [C.radius - 1.32, C.wall]];
  const ln = G.revolve(liner, phi);
  b.add(ln.shell, { slot: 'metal', c: ['bg.violet', 'slate'] });
  b.anchor('top', 0, C.wall + C.dome, 0);
  return b.build();
}

export interface Containment {
  back: KitModel;
  front: KitModel;
}

export function buildContainment(): Containment {
  // the kit's lathe: x = r·cos φ, z = r·sin φ — the front half (+Z, toward the cameras) is φ ∈ [0, π]
  return { front: half('containment-front', 0, true), back: half('containment-back', Math.PI, false) };
}
