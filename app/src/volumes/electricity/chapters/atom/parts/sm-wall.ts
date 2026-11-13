/**
 * StandardModelWall — 17 particle tokens on a gently curved wall: three generations of fermions (rows: u-type
 * quarks, d-type quarks, charged leptons, neutrinos), the gauge bosons g, γ, Z, W and, apart, the Higgs boson.
 * Tokens are character orbs in family colours (quarks amber / violet, leptons cyan, neutrinos a pale ring,
 * gluon lime, photon yellow, W / Z steel with a pink rim, Higgs white with a violet halo) with their symbols;
 * thin frames group quarks, leptons and bosons. Data: `STANDARD_MODEL` from the sim.
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { toOverlay } from '@/engine/api';
import { ORB_STYLES, RibbonLines, createHalo, createOrbs, type Orbs } from '@/fx';
import { STANDARD_MODEL, type ParticleCard } from '@electricity/sim/atom';
import { K, type ColorLike } from '@/style';
import { Text3D } from '@/text';
import { mathMarkup } from '@/ui3d';

export const TOKEN_RADIUS = 0.6;
const COL = 1.75;
const ROW = 1.72;

export interface Token {
  card: ParticleCard;
  group: Group;
  orb: Orbs;
  label: Text3D;
  /** Rest position on the wall. */
  home: Vector3;
}

const SHADE = ['', '.light', '.dark'] as const;
function colorOf(card: ParticleCard): ColorLike {
  const g = SHADE[(card.generation ?? 1) - 1]!;
  if (card.category === 'quark') return `${card.chargeE > 0 ? 'amber' : 'violet'}${g}` as ColorLike;
  if (card.category === 'lepton') return `cyan${g}` as ColorLike;
  return card.id === 'gluon'
    ? 'lime'
    : card.id === 'photon'
      ? 'yellow'
      : card.id === 'higgs'
        ? 'white'
        : 'steel';
}

/** Column / row on the wall (x to the right, y up). */
function place(card: ParticleCard): [number, number] {
  if (card.category === 'quark') return [(card.generation ?? 1) - 1, card.chargeE > 0 ? 0 : 1];
  if (card.category === 'lepton') return [(card.generation ?? 1) - 1, card.chargeE !== 0 ? 2 : 3];
  if (card.category === 'scalar') return [4.35, 1.5];
  return [3.2, ['gluon', 'photon', 'z', 'w'].indexOf(card.id)];
}

export interface SmWall {
  group: Group;
  tokens: Token[];
  token(id: string): Token;
  /** Top-left corners of the family frames, for captions. */
  corners: { quarks: Vector3; leptons: Vector3; bosons: Vector3 };
}

export function createSmWall(): SmWall {
  const group = new Group();
  group.name = 'sm-wall';
  const rim = K.glow({ color: 'pink', intensity: 1.3, keepHue: true, whiten: 0 });
  const rimGeometry = new TorusGeometry(TOKEN_RADIUS * 1.08, 0.045, 8, 48);
  // curved wall: the columns bend toward the viewer at the sides
  const position = (col: number, row: number, out = new Vector3()): Vector3 => {
    const x = (col - 2.1) * COL;
    return out.set(x, (1.5 - row) * ROW, 0.05 * x * x);
  };
  const tokens = STANDARD_MODEL.map((card): Token => {
    const [col, row] = place(card);
    const home = position(col, row);
    const token = new Group();
    token.position.copy(home);
    const neutrino = card.category === 'lepton' && card.chargeE === 0;
    const orb = neutrino
      ? createOrbs({
          kind: { ...ORB_STYLES.hole, color: 'mist', shade: 'mist', glyph: 'none', halo: undefined },
          radius: TOKEN_RADIUS,
        })
      : createOrbs({ kind: 'blob', color: colorOf(card), radius: TOKEN_RADIUS });
    token.add(orb);
    if (card.id === 'w' || card.id === 'z') token.add(new Mesh(rimGeometry, rim));
    if (card.id === 'higgs') token.add(createHalo({ color: 'violet', size: 3.4, intensity: 0.9 }));
    const dark =
      card.id === 'photon' ||
      card.id === 'higgs' ||
      card.id === 'gluon' ||
      (card.category !== 'gauge' && card.generation === 2);
    const label = new Text3D(mathMarkup(card.symbol), {
      font: 'display',
      size: 0.56,
      color: neutrino ? 'mist' : dark ? 'bg.void' : 'white',
      anchorX: 'center',
      anchorY: 'middle',
      billboard: true,
      halo: false,
    });
    label.position.z = neutrino ? 0 : TOKEN_RADIUS * 0.2;
    token.add(label);
    toOverlay(label);
    group.add(token);
    return { card, group: token, orb, label, home };
  });

  // family frames: rounded rectangles around the quarks, the leptons and the gauge bosons
  const frame = (c0: number, c1: number, r0: number, r1: number): Vector3[] => {
    const pts: Vector3[] = [];
    const pad = 0.86;
    const corner = (cc: number, rr: number, sx: number, sy: number, a0: number): void => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        const p = position(cc, rr);
        const x = p.x + sx * (pad - 0.4) + Math.cos(a) * 0.4;
        pts.push(new Vector3(x, p.y + sy * (pad - 0.4) + Math.sin(a) * 0.4, 0.05 * x * x - 0.1));
      }
    };
    corner(c1, r0, 1, 1, 0);
    corner(c0, r0, -1, 1, Math.PI / 2);
    corner(c0, r1, -1, -1, Math.PI);
    corner(c1, r1, 1, -1, Math.PI * 1.5);
    return pts;
  };
  const frames: [Vector3[], ColorLike][] = [
    [frame(0, 2, 0, 1), 'amber'],
    [frame(0, 2, 2, 3), 'cyan'],
    [frame(3.2, 3.2, 0, 3), 'mist'],
  ];
  for (const [points, color] of frames) {
    const line = new RibbonLines({
      capacity: points.length + 2,
      color,
      width: 0.03,
      dashStrength: 0,
      intensity: 0.55,
    });
    line.setLines([{ points, closed: true }]);
    group.add(line);
  }
  const top = (c: number, r: number): Vector3 => position(c, r).add(new Vector3(-0.86, 0.86, 0));
  return {
    group,
    tokens,
    token: (id) => tokens.find((t) => t.card.id === id)!,
    corners: { quarks: top(0, 0), leptons: top(0, 2), bosons: top(3.2, 0) },
  };
}
