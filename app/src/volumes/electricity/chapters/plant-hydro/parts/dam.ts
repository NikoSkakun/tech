/**
 * The concrete gravity dam across the valley (kit `Builder`): a thin crest and a wide base (the triangle that
 * holds the water by its own weight), the spillway section with a lower ogee crest, five piers, four radial
 * gates (parts `gate0…3`, they swing up about their trunnions) and a stepped chute down the downstream face;
 * the intake section with four trash-rack frames on the upstream face over the units; the crest road with
 * railings and lamps, the intake gantry crane and a small control house.
 *
 * Anchors: `crest`, `spillway`, `gate0…3`, `intake0…3` (on the upstream face, at the rack centre),
 * `chute` (foot of the chute), `gallery` (inspection gallery inside the dam).
 */
import { Builder, G, type KitModel } from '@/kit';
import { DAM, POWERHOUSE, SPILLWAY } from '../layout';

export interface Dam extends KitModel {
  /** Radial gates 0 (shut) … 1 (fully raised). */
  setGates(open: number): void;
}

const CONCRETE: [string, string] = ['steel.light', 'mist'];
/** Crest of the spillway (ogee) — below the normal retention level: the gates hold the water above it. */
export const OGEE_Y = DAM.crestY - 9;

/** Gravity profile in the dam's (x, y) plane, counter-clockwise; `top` is the crest height of this section. */
function profile(top: number, stepped: boolean): [number, number][] {
  const { faceX, crestX, toeX, baseY } = DAM;
  const foot = baseY - 6;
  const pts: [number, number][] = [
    [faceX, foot],
    [toeX + 4, foot],
    [toeX + 4, baseY],
  ];
  if (stepped) {
    // a staircase down the downstream face: 4 m treads (energy dissipation)
    const n = 10;
    for (let i = n; i >= 1; i--) {
      const t = i / n;
      const x = crestX + (toeX - crestX) * t;
      const y = top - 4 + (baseY - top + 4) * t;
      pts.push([x, y], [x - (toeX - crestX) / n, y]);
    }
    pts.push([crestX + 2, top - 1], [crestX - 2, top]);
  } else {
    pts.push([crestX, top - 6], [crestX, top]);
  }
  pts.push([faceX, top]);
  return pts;
}

export function buildDam(): Dam {
  const b = new Builder('dam');
  const { crestY, z0, z1, faceX, crestX } = DAM;
  const section = (za: number, zb: number, top: number, stepped: boolean): void => {
    b.add(G.extrude(profile(top, stepped), zb - za, { bevel: 0.6 }), {
      c: CONCRETE,
      slot: 'matte',
      at: [0, 0, (za + zb) / 2],
    });
  };
  section(z0, SPILLWAY.z0, crestY, false);
  section(SPILLWAY.z1, z1, crestY, false);
  section(SPILLWAY.z0, SPILLWAY.z1, OGEE_Y, true);
  // crest road: kerbs, railing posts and lamps (both non-overflow sections)
  for (const [za, zb] of [
    [z0, SPILLWAY.z0 - 1],
    [SPILLWAY.z1 + 1, z1],
  ] as const) {
    b.box(1, 1.1, zb - za, { r: 0.2, c: 'slate', at: [faceX + 0.6, crestY, (za + zb) / 2] });
    b.box(1, 1.1, zb - za, { r: 0.2, c: 'slate', at: [crestX - 0.6, crestY, (za + zb) / 2] });
    for (let z = za + 4; z < zb - 2; z += 18) {
      b.cyl(0.18, 6, { c: 'slate', at: [crestX - 0.6, crestY, z] });
      b.sphere(0.6, { c: 'yellow', slot: 'lamp', at: [crestX - 1.2, crestY + 6, z] });
    }
  }
  // spillway: piers with hoist housings, a bridge on top, radial gates between the piers
  const bay = (SPILLWAY.z1 - SPILLWAY.z0) / SPILLWAY.gates;
  for (let i = 0; i <= SPILLWAY.gates; i++) {
    const z = SPILLWAY.z0 + i * bay;
    b.box(18, crestY + 4 - OGEE_Y + 6, 2.4, {
      r: 0.5,
      c: CONCRETE,
      slot: 'matte',
      at: [faceX + 7, OGEE_Y - 6, z],
    });
    b.box(5, 3.2, 3.2, { r: 0.4, c: 'amber', at: [faceX + 4, crestY + 4, z] });
  }
  b.box(4, 1.2, SPILLWAY.z1 - SPILLWAY.z0 + 2.4, {
    r: 0.3,
    c: 'slate',
    at: [faceX + 12, crestY + 2.8, (SPILLWAY.z0 + SPILLWAY.z1) / 2],
  });
  for (let i = 0; i < SPILLWAY.gates; i++) {
    const zc = SPILLWAY.z0 + (i + 0.5) * bay;
    // trunnion downstream of the gate, at the pier; the skin is an arc of radius 13 m facing the reservoir
    const g = b.part(`gate${i}`, { at: [faceX + 15, OGEE_Y + 7, zc] });
    const skin = G.revolve(
      [
        [12.4, -0.3],
        [13.2, -0.3],
        [13.2, 0.3],
        [12.4, 0.3],
      ],
      { seg: 10, phiStart: Math.PI * 0.86, phiLength: Math.PI * 0.32 },
    ).shell;
    skin.rotateX(Math.PI / 2);
    skin.scale(1, 1, (bay - 2.6) / 0.6);
    g.add(skin, { c: ['steel', 'steel.light'], slot: 'metal' });
    g.beam([0, 0, -(bay - 3) / 2], [-12.5, 3.6, -(bay - 3) / 2], 0.6, { c: 'steel' });
    g.beam([0, 0, (bay - 3) / 2], [-12.5, 3.6, (bay - 3) / 2], 0.6, { c: 'steel' });
    g.cyl(0.9, bay - 2.6, { axis: 'z', c: 'slate', at: [0, 0, -(bay - 2.6) / 2] });
    b.anchor(`gate${i}`, faceX + 2, OGEE_Y + 3, zc);
  }
  // intakes over the units: trash-rack frames on the upstream face, gate slots, and the intake gantry crane
  POWERHOUSE.units.forEach((z, i) => {
    const y = 26;
    b.box(1.2, 16, 12, { r: 0.3, c: 'slate', at: [faceX - 0.6, y - 8, z] });
    for (let k = -5; k <= 5; k += 1.25)
      b.box(0.5, 14, 0.25, { r: 0, c: 'steel', slot: 'metal', at: [faceX - 1.3, y - 7, z + k] });
    for (let h = y - 6; h <= y + 5; h += 3.5)
      b.box(0.5, 0.4, 11, { r: 0, c: 'steel', slot: 'metal', at: [faceX - 1.3, h, z] });
    b.box(3, crestY - y - 8, 9, { r: 0.4, c: 'steel.light', slot: 'matte', at: [faceX + 1.5, y + 8, z] });
    b.anchor(`intake${i}`, faceX - 1.5, y, z);
  });
  const crane = b.part('crane', { at: [faceX + 2, crestY, POWERHOUSE.units[1]] });
  crane.box(1.2, 12, 1.2, { r: 0.2, c: 'yellow', at: [-3, 0, 0] });
  crane.box(1.2, 12, 1.2, { r: 0.2, c: 'yellow', at: [7, 0, 0] });
  crane.box(13, 1.6, 2, { r: 0.3, c: 'yellow', at: [2, 12, 0] });
  crane.box(3, 2.2, 3, { r: 0.4, c: 'orange', at: [0, 13.2, 0] });
  // control house on the crest at the north end
  b.box(10, 6, 8, { r: 0.6, c: 'white', slot: 'gloss', at: [faceX + 5, crestY, z0 + 10] });
  b.box(10.4, 1, 8.4, { r: 0.3, c: 'blue', at: [faceX + 5, crestY + 6, z0 + 10] });
  for (const k of [-3, 0, 3])
    b.box(2, 1.6, 0.2, { r: 0, c: 'sky', slot: 'window', at: [faceX + 5 + k, crestY + 2.6, z0 + 14.05] });
  b.anchor('crest', faceX + 5, crestY, 0);
  b.anchor('spillway', crestX + 14, OGEE_Y - 12, (SPILLWAY.z0 + SPILLWAY.z1) / 2);
  b.anchor('chute', DAM.toeX + 2, DAM.baseY + 1, (SPILLWAY.z0 + SPILLWAY.z1) / 2);
  b.anchor('gallery', faceX + 6, 14, 20);
  const model = b.build();
  const gates = Array.from({ length: SPILLWAY.gates }, (_, i) => model.part(`gate${i}`));
  return Object.assign(model, {
    setGates(open: number) {
      // a radial gate lifts by turning about its trunnion; 0.95 rad clears the flow completely
      for (const g of gates) g.rotation.z = -0.95 * Math.min(1, Math.max(0, open));
    },
  });
}
