/**
 * `SankeyRiver` of step 3: the flow graph of one plant type (`SANKEY[type]`, plants sim M4) laid out as 3D bands.
 * Columns follow the chain (a node sits one column right of its furthest source); band height ∝ share
 * (`UNIT` m per unit of primary energy = 100). Useful bands go right through the «gates» (a slab per node);
 * loss bands peel off downward in pale `red` and each ends in a small pale cloud — waste heat leaving to the air. Colours encode the *form* of energy (document step 3), not the plant
 * type. Electric bands carry `yellow` pulses (`K.energy`).
 */
import { Color, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { K, col, type ColorLike } from '@/style';
import { SANKEY, type SankeyFlow, type SankeyType } from '@electricity/sim/plants';
import { bandGeometry } from './band';

export const UNIT = 0.17;
const DX = 17;
const GAP = 2.2;
const GATE_W = 1.4;
const DEPTH = 1.6;

export type Form = 'chemical' | 'gas' | 'hydrogen' | 'nuclear' | 'potential' | 'kinetic' | 'radiant' | 'thermal' | 'mechanical' | 'electric';

/** Form of energy of every node id used by the sim. */
export const NODE_FORM: Record<string, Form> = {
  chemical: 'chemical', steamHeat: 'thermal', mechanical: 'mechanical', electricGross: 'electric', grid: 'electric',
  gtMechanical: 'mechanical', exhaustHeat: 'thermal', hrsg: 'thermal', stMechanical: 'mechanical',
  nuclear: 'nuclear', potential: 'potential', penstock: 'kinetic', kinetic: 'kinetic', radiant: 'radiant',
  electricDc: 'electric', thermal: 'thermal', chemicalH2: 'hydrogen',
};

/** Colours of the forms (semantic code: fuel ink/slate, gas violet-tinted, nuclear violet, water blue, wind sky…). */
export const FORM_COLOR: Record<Form, ColorLike> = {
  chemical: col('slate').lerp(col('ink'), 0.25), gas: col('slate').lerp(col('violet'), 0.35), hydrogen: 'mist',
  nuclear: 'violet', potential: 'blue', kinetic: 'sky', radiant: col('yellow').lerp(col('white'), 0.35),
  thermal: 'orange', mechanical: 'mist', electric: 'yellow',
};
const LOSS = col('red').lerp(col('white'), 0.35);

export interface SankeyNode { id: string; form: Form; x: number; y: number; h: number; value: number }
export interface SankeyBand { flow: SankeyFlow; mesh: Mesh; mid: Vector3; mat: { emissiveIntensity: number } }
export interface SankeyModel { type: SankeyType; group: Group; nodes: SankeyNode[]; bands: SankeyBand[]; width: number }

const formOf = (type: SankeyType, id: string): Form => (id === 'chemical' && type === 'gasCcgt' ? 'gas' : (NODE_FORM[id] ?? 'thermal'));

export function buildSankey(type: SankeyType): SankeyModel {
  const flows = SANKEY[type];
  const useful = flows.filter((f) => !f.loss);
  const ids = [...new Set(useful.flatMap((f) => [f.from, f.to]))];
  const column = new Map<string, number>(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) for (const f of useful) column.set(f.to, Math.max(column.get(f.to)!, column.get(f.from)! + 1));
  const value = (id: string): number => {
    const out = flows.filter((f) => f.from === id).reduce((s, f) => s + f.value, 0);
    const inn = useful.filter((f) => f.to === id).reduce((s, f) => s + f.value, 0);
    return Math.max(out, inn);
  };
  const cols = Math.max(...column.values());
  const nodes = new Map<string, SankeyNode>();
  for (let c = 0; c <= cols; c++) {
    const here = ids.filter((id) => column.get(id) === c);
    const total = here.reduce((s, id) => s + value(id) * UNIT, 0) + GAP * (here.length - 1);
    let top = total / 2;
    for (const id of here) {
      const h = value(id) * UNIT;
      nodes.set(id, { id, form: formOf(type, id), x: (c - cols / 2) * DX, y: top - h / 2, h, value: value(id) });
      top -= h + GAP;
    }
  }
  const group = new Group();
  group.name = `sankey-${type}`;
  // every loss band drains to one level under the lowest gate, where a small cloud swallows its end
  const floorY = Math.min(...[...nodes.values()].map((n) => n.y - n.h / 2)) - 7;
  const lossEnds: { x: number; h: number }[] = [];
  const outUsed = new Map<string, number>();
  const inUsed = new Map<string, number>();
  const bands: SankeyBand[] = [];
  // useful bands first (they stack from the top of a gate), losses after them (at the bottom)
  for (const f of [...useful, ...flows.filter((x) => x.loss)]) {
    const a = nodes.get(f.from)!;
    const h = f.value * UNIT;
    const ya = a.y + a.h / 2 - (outUsed.get(f.from) ?? 0) - h / 2;
    outUsed.set(f.from, (outUsed.get(f.from) ?? 0) + h);
    let geo;
    if (f.loss) {
      const b = new Vector3(a.x + GATE_W / 2 + 3 + h * 0.9, floorY + 0.5, 0);
      lossEnds.push({ x: b.x, h: h * 0.6 });
      geo = bandGeometry({ a: new Vector3(a.x + GATE_W / 2, ya, 0), b, ha: h, hb: h * 0.6, depth: DEPTH * 0.8, ca: col(FORM_COLOR[a.form]).lerp(LOSS, 0.6), cb: LOSS, shape: 'drop' });
    } else {
      const t = nodes.get(f.to)!;
      const yb = t.y + t.h / 2 - (inUsed.get(f.to) ?? 0) - h / 2;
      inUsed.set(f.to, (inUsed.get(f.to) ?? 0) + h);
      geo = bandGeometry({ a: new Vector3(a.x + GATE_W / 2, ya, 0), b: new Vector3(t.x - GATE_W / 2, yb, 0), ha: h, hb: h, depth: DEPTH, ca: col(FORM_COLOR[a.form]), cb: col(FORM_COLOR[t.form]) });
    }
    const electric = !f.loss && a.form === 'electric';
    const mat = electric
      ? K.energy({ color: 'amber', pulseColor: 'yellow', repeat: 0.25, speed: 2.5, length: 0.4, intensity: 2.4 })
      : K.toon({ vertexColors: true, gloss: 0.35, rim: 0.6, ...(f.loss ? { emissive: 'red', emissiveIntensity: 0 } : {}) });
    const mesh = new Mesh(geo, mat);
    mesh.name = `${f.from}>${f.to}`;
    group.add(mesh);
    geo.computeBoundingBox();
    bands.push({ flow: f, mesh, mid: geo.boundingBox!.getCenter(new Vector3()), mat });
  }
  // gates: one slab per node in the colour of its form
  for (const n of nodes.values()) {
    const gate = new Mesh(bandGeometry({ a: new Vector3(n.x - GATE_W / 2, n.y, 0), b: new Vector3(n.x + GATE_W / 2, n.y, 0), ha: n.h + 0.4, hb: n.h + 0.4, depth: DEPTH + 0.6, ca: new Color(), cb: new Color(), segments: 2 }), K.toon({ color: FORM_COLOR[n.form], gloss: 0.5, rim: 0.9 }));
    gate.name = `gate-${n.id}`;
    group.add(gate);
  }
  if (lossEnds.length) group.add(lossClouds(lossEnds, floorY));
  return { type, group, nodes: [...nodes.values()], bands, width: cols * DX };
}

/** A small cloud of pale, slightly warm puffs at each loss band's end (one instanced draw call): waste heat. */
function lossClouds(ends: readonly { x: number; h: number }[], y: number): InstancedMesh {
  const mesh = new InstancedMesh(new IcosahedronGeometry(1, 2), K.toon({ color: col('white').lerp(LOSS, 0.3), gloss: 0.2, rim: 0.7 }), ends.length * 4);
  const m = new Matrix4();
  const q = new Quaternion();
  ends.forEach((e, j) => {
    const r0 = 1.4 + e.h * 0.45;
    const puffs: [number, number, number, number][] = [[0, -0.2, 0.4, 1], [-0.9, -0.5, -0.2, 0.75], [0.95, -0.45, -0.1, 0.8], [0.3, 0.55, -0.4, 0.62]];
    puffs.forEach(([dx, dy, dz, k], i) => {
      m.compose(new Vector3(e.x + dx * r0, y + dy * r0, dz * r0), q, new Vector3(1.2, 1, 1).multiplyScalar(r0 * k));
      mesh.setMatrixAt(j * 4 + i, m);
    });
  });
  mesh.name = 'loss-clouds';
  return mesh;
}
