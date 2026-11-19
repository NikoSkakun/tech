/**
 * The flashlight (VISUAL.md §5.1): a pocket torch for one AA battery — a cylinder with a wider head, a glass,
 * a cone mirror inside, the yellow slider on top. Only what belongs to the HOUSING is built here: the two
 * halves of the body (split lengthwise), the mirror and the glass. The battery, the spring, the lamp, the
 * slider and the metal strips are the stand's own objects — in the torch they simply sit at the places below.
 *
 * TORCH FRAME: origin on the axis, axis = +x, head at +x, slider on +y; the split plane is z = 0.
 */
import { type Group, Mesh, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { KToonMaterial, col } from '@/style';
import { BULB, type BulbDims } from './bulb';
import { BATTERY } from './layout';
import { sheath, tame } from './materials';
import type { WireId } from './wires';

export interface TorchDims {
  /** Radii of the body and the head; x of the tail, of the flare, of the head's start and of the front. */
  body: number;
  head: number;
  tail: number;
  flare: number;
  headStart: number;
  front: number;
  wall: number;
  /** Places of the stand's parts inside the torch (torch frame). */
  batteryX: number;
  springX: number;
  springLength: number;
  bulbX: number;
  sliderX: number;
  /** x of the glass. */
  glassX: number;
}

/** The flashlight is built around its lamp: the head is just wide and long enough for the globe. */
export function torchDims(bulb: BulbDims = BULB): TorchDims {
  const bulbX = 0.72;
  const front = bulbX + bulb.globeY + bulb.globe + 0.07;
  return {
    body: 0.37,
    head: bulb.globe + 0.16,
    tail: -1.97,
    flare: 0.3,
    headStart: 0.95,
    front,
    wall: 0.055,
    batteryX: -0.47,
    springX: -1.7,
    springLength: 0.26,
    bulbX,
    sliderX: -0.2,
    glassX: front - 0.04,
  };
}
export const TORCH: TorchDims = torchDims();

/** The slider's two contacts sit this far to either side of the top line: the two strips run side by side, apart. */
const CONTACT_Z = 0.078;
/** How far a strip's tip stays turned toward its contact once nothing presses it on (`torchPath`, `eased`). */
const EASED = (20 * Math.PI) / 180;
/** The minus strip lies this far below the axis' level on the housing's wall. */
export const MINUS_Y = -0.06;

/**
 * Local strip paths (torch frame). Each matches one wire piece of the stand, start → end. `eased`: the same strip
 * as it lies once nothing presses its tip onto the lamp — the sharp last bend (the minus strip's in from the wall
 * to the thread, the lamp strip's down to the bottom contact) opened to a slight one, the lengths kept; the
 * unfolding lets the strips ease into this before it draws them out (`unfurl.ts`). `off`: the minus strip this
 * much farther from the axis than the housing's wall held it (its two ends where they are).
 */
export function torchPath(
  id: WireId,
  T: TorchDims = TORCH,
  B: BulbDims = BULB,
  eased = false,
  off = 0,
): Vector3[] {
  const top = T.body - T.wall - 0.012;
  const side = T.body - T.wall - 0.012 + off;
  const plate = T.batteryX + BATTERY.length / 2 + 0.125;
  // (beside the top line the round wall is a little lower)
  const under = top - 0.004;
  // the minus strip's place on the wall, scaled out with `off`, and the length of its tip in to the lamp's thread
  const y = MINUS_Y * (side / (side - off));
  const tipM = Math.hypot(0.04, side - B.threadRadius - 0.01);
  switch (id) {
    // minus strip, one piece: tail contact under the spring → along the near wall, where the reader sees it beside
    // the battery → past the rivet → the lamp's thread (two bends of their own, one polyline). The stand's loop has
    // it on the other side of the battery: the unfolding first swings it under the battery to the far side
    // (`unfold.ts`)
    case 'm':
      return [
        ...G.roundPath(
          [
            new Vector3(T.springX - 0.02, 0, 0),
            new Vector3(T.springX - 0.02, y, side),
            new Vector3(-0.35, y, side),
          ],
          0.12,
          5,
        ),
        ...G.roundPath(
          [
            new Vector3(-0.35, y, side),
            new Vector3(T.bulbX + 0.16, y, side),
            eased
              ? new Vector3(T.bulbX + 0.16 + tipM * Math.cos(EASED), -0.04, side - tipM * Math.sin(EASED))
              : new Vector3(T.bulbX + 0.2, -0.04, B.threadRadius + 0.01),
          ],
          0.08,
          4,
        ).slice(1),
      ];
    // plus strip: from the contact plate on the battery's nub to the slider's first contact — it goes there under
    // the battery and up its far side (`unfold-plus.ts` lays it), so its contact is the slider's far one; from the
    // slider's near contact the lamp strip goes forward → down to the lamp's bottom contact
    case 'p1':
      return [new Vector3(plate, 0, 0), new Vector3(T.sliderX - 0.12, under, -CONTACT_Z)];
    case 'p2':
      return G.roundPath(
        [
          new Vector3(T.sliderX + 0.12, under, CONTACT_Z),
          new Vector3(T.bulbX - 0.05, under, CONTACT_Z),
          eased
            ? new Vector3(T.bulbX - 0.05 + under * Math.cos(EASED), under - under * Math.sin(EASED), 0.02)
            : new Vector3(T.bulbX - 0.03, 0, 0.02),
        ],
        0.1,
        5,
      );
  }
}

export interface Torch {
  /** Near (+z) and far (−z) halves of the housing, the mirror and the glass — each positioned by the unfolding. */
  near: Group;
  far: Group;
  mirror: Group;
  glass: Mesh;
  /** All four, for adding to the board frame. */
  parts: (Group | Mesh)[];
}

function addHalf(b: Builder, name: string, sign: 1 | -1, T: TorchDims): void {
  const { body: rb, head: rh, wall: w } = T;
  const p = b.part(name);
  const phi = sign > 0 ? 0 : Math.PI;
  // closed section, counter-clockwise in (r, x): outer wall up, front lip, inner wall down, tail floor
  const section: G.Pt[] = [
    [0, T.tail],
    [rb - 0.08, T.tail],
    [rb + 0.03, T.tail + 0.09],
    [rb + 0.03, T.tail + 0.26],
    [rb, T.tail + 0.3],
    [rb, T.flare],
    [rh, T.headStart],
    [rh, T.front],
    [rh - w, T.front],
    [rh - w, T.headStart + 0.02],
    [rb - w, T.flare + 0.02],
    [rb - w, T.tail + 0.3],
    [0, T.tail + 0.3],
  ];
  const { shell, caps } = G.revolve(section, { seg: 28, phiStart: phi, phiLength: Math.PI, crease: 40 });
  const lay: [number, number, number] = [0, 0, -Math.PI / 2];
  p.add(shell, { slot: 'gloss', c: 'teal', rot: lay });
  if (caps) p.add(caps, { slot: 'toon', c: 'teal.dark', rot: lay });
  // grip ribs on the body and the steel ring of the head — half rings that travel with their half, cut along
  // the same plane z = 0 as the shell: `G.ring`'s half arc lies on its +z side; the turn of −π/2 about z lays
  // its axis on the torch axis and keeps the arc on +z (the near half), a half turn about x puts it on −z (far)
  for (const x of [-1.2, -0.95, -0.7, -0.45]) {
    p.add(G.ring(rb + 0.005, 0.03, 20, 8, Math.PI), {
      slot: 'gloss',
      c: 'teal.dark',
      at: [x, 0, 0],
      rot: [sign > 0 ? 0 : Math.PI, 0, -Math.PI / 2],
    });
  }
  const bezel: G.Pt[] = [
    [rh - w - 0.02, T.front - 0.02],
    [rh + 0.035, T.front - 0.14],
    [rh + 0.035, T.front + 0.07],
    [rh - w - 0.02, T.front + 0.07],
  ];
  const ring = G.revolve(bezel, { seg: 28, phiStart: phi, phiLength: Math.PI });
  p.add(ring.shell, { slot: 'metal', c: ['steel', 'mist'], rot: lay });
  if (ring.caps) p.add(ring.caps, { slot: 'metal', c: 'steel', rot: lay });
}

export function createTorch(T: TorchDims = TORCH, B: BulbDims = BULB): Torch {
  const b = new Builder('torch');
  addHalf(b, 'near', 1, T);
  addHalf(b, 'far', -1, T);
  // mirror: a cone of polished metal around the lamp, open to the front, with a hole for the lamp's base
  // (its own builder and materials: the polished inside takes the lamp's light at full strength)
  const mirror = new Builder('mirror');
  const x0 = T.bulbX + B.thread - 0.05;
  const x1 = T.front - 0.1;
  const curve: G.Pt[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    curve.push([
      B.threadRadius + 0.05 + (T.head - T.wall - 0.03 - B.threadRadius - 0.05) * s ** 0.36,
      x0 + (x1 - x0) * s,
    ]);
  }
  // closed section, counter-clockwise in (r, x): outer wall up, then the polished inner wall down
  const outer = curve.map(([r, x]) => [r + 0.03, x - 0.012] as G.Pt);
  const cone = G.revolve([...outer, ...curve.slice().reverse()], { seg: 48, crease: 60 });
  mirror.add(cone.shell, { slot: 'metal', c: ['mist', 'white'], rot: [0, 0, -Math.PI / 2] });
  const model = b.build();
  // the housing is the memory of the flashlight, not a hero: it takes the lamp's light at a little over half strength
  for (const m of model.mats.list()) if (m instanceof KToonMaterial) tame(m, 0.48);

  const glassGeometry = G.lathe(
    [
      [0, 0.05],
      [0.3, 0.04],
      [T.head - T.wall - 0.025, 0],
      [T.head - T.wall - 0.025, -0.03],
      [0, -0.03],
    ],
    { seg: 48 },
  );
  glassGeometry.rotateZ(-Math.PI / 2);
  const glass = new Mesh(
    glassGeometry,
    sheath({ color: col('sky').lerp(col('white'), 0.5), opacity: 0.06, edgeOpacity: 0.3, gloss: 0.5 }),
  );
  glass.name = 'torch:glass';
  glass.renderOrder = 3;
  const near = model.part('near');
  const far = model.part('far');
  const mirrorGroup = mirror.build().group;
  return { near, far, mirror: mirrorGroup, glass, parts: [near, far, mirrorGroup, glass] };
}
