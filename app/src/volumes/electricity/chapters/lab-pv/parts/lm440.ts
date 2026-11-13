/**
 * The hero «ЛМ-440»: the kit module's outline rebuilt in separable layers (glass › encapsulant › 108 half-cells
 * with their ribbons › encapsulant › backsheet › frame › junction boxes), because the chapter explodes it,
 * colours every half-cell from the model and lights the bypass diodes. Static parts are a kit `Builder` model;
 * the cells are one `InstancedMesh` with per-instance colour. Metres, kit module frame (see `lm440-layout.ts`).
 */
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, type Object3D } from 'three';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, col, type KGlowMaterial } from '@/style';
import { EXPLODE, HALF_CELLS, LAYER_Y, M, SECTION_COLORS, cellCentre, columnX, diodeSpot } from './lm440-layout';

export interface Lm440 {
  /** Module frame, metres — scale it uniformly. */
  group: Group;
  cells: InstancedMesh;
  /** 0 assembled … 1 exploded (a pure function: random-access safe). */
  setExplode(amount: number): void;
  /** Outline of the three bypass-diode sections (teal / violet / sky). */
  sections: Group;
  /** Diode markers in front of the glass, one material each (intensity = conduction). */
  diodes: { group: Group; glow: KGlowMaterial[] };
  /** Empty objects for callouts / cables: `plus`, `minus`, `jbox`, `frame`, `label`, `glass`. */
  anchors: Record<'plus' | 'minus' | 'jbox' | 'frame' | 'label' | 'glass', Object3D>;
  layers: Record<keyof typeof EXPLODE, Object3D>;
}

const tmp = new Matrix4();

export function createLm440(): Lm440 {
  const group = new Group();
  group.name = 'lm440';
  const alu = col('mist').lerp(col('steel'), 0.3);

  /* frame: four bars around the laminate (as in the kit) */
  const bf = new Builder('lm440-frame');
  for (const s of [-1, 1]) {
    bf.box(M.frame, M.T, M.L, { r: 0.008, slot: 'metal', c: alu, at: [s * (M.W / 2 - M.frame / 2), -M.T, 0] });
    bf.box(M.W - 2 * M.frame, M.T, M.frame, { r: 0.008, slot: 'metal', c: alu, at: [0, -M.T, s * (M.L / 2 - M.frame / 2)] });
  }
  const frame = bf.build().group;

  /* backsheet + junction boxes with MC4 leads */
  const bb = new Builder('lm440-back');
  bb.box(M.iw, 0.004, M.il, { r: 0, slot: 'matte', c: 'white', at: [0, LAYER_Y.back - 0.002, 0] });
  const back = bb.build().group;
  const bj = new Builder('lm440-jbox');
  for (let s = 0; s < 3; s++) {
    const x = (s - 1) * 0.3;
    bj.box(0.1, 0.022, 0.06, { r: 0.006, slot: 'gloss', c: 'ink', at: [x, -M.T - 0.022, 0] });
    bj.box(0.05, 0.004, 0.012, { r: 0, slot: 'gloss', c: 'amber', at: [x, -M.T - 0.026, 0.018] }); // cathode stripe
  }
  for (const s of [-1, 1]) {
    bj.rod([s * 0.3, -M.T - 0.012, 0.03], [s * 0.3, -M.T - 0.012, 0.42], 0.007, { slot: 'gloss', c: 'ink', seg: 6 });
    bj.cyl(0.013, 0.06, { axis: 'z', seg: 8, slot: 'gloss', c: s > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus, at: [s * 0.3, -M.T - 0.012, 0.42] });
  }
  const jbox = bj.build().group;

  /* cells: one instance per half-cell, colour set by the chapter every frame */
  const cells = new InstancedMesh(
    new BoxGeometry(M.cw - 0.006, 0.0012, M.ch - 0.004),
    // no highlight band / gloss spot: on a flat laminate facing the key light they flood every cell at once
    K.toon({ color: 'white', gloss: 0, highlight: 0, rim: 0.35 }),
    HALF_CELLS,
  );
  const base = col('bg.indigo').lerp(col('blue'), 0.28);
  for (let i = 0; i < HALF_CELLS; i++) {
    cells.setMatrixAt(i, tmp.setPosition(cellCentre(i)));
    cells.setColorAt(i, base);
  }
  cells.receiveShadow = true;
  // ribbons: three busbars per column and half, soldered across the cells
  const bars: [number, number, number, number][] = [];
  for (let c = 0; c < 6; c++) {
    for (const k of [-1, 0, 1]) for (const s of [-1, 1]) bars.push([columnX(c) + k * M.cw * 0.3, s * (M.gap + M.half / 2), 0.004, M.half - 0.004]);
  }
  const ribbons = new Mesh(G.quads(bars, 0.0009), K.metal({ color: 'mist', specular: 0.9 }));
  const cellLayer = new Group();
  cellLayer.add(cells, ribbons);

  /* glass and the two encapsulant films (films are visible only while exploded) */
  const sheet = (y: number, thick: number, material: Mesh['material']): Mesh => {
    const m = new Mesh(new BoxGeometry(M.iw, thick, M.il), material);
    m.position.y = y;
    return m;
  };
  const glass = sheet(LAYER_Y.glass, 0.006, K.glass({ color: 'sky', opacity: 0.03, edgeOpacity: 0.3, specular: 0.4 }));
  const eva1 = sheet(LAYER_Y.eva1, 0.003, K.glass({ color: 'lime', opacity: 0.06, edgeOpacity: 0.3 }));
  const eva2 = sheet(LAYER_Y.eva2, 0.003, K.glass({ color: 'lime', opacity: 0.06, edgeOpacity: 0.3 }));

  const layers = { glass, eva1, cells: cellLayer, eva2, back, frame, jbox };
  const rest: Record<string, number> = {};
  for (const [name, o] of Object.entries(layers)) {
    rest[name] = o.position.y;
    group.add(o);
  }
  cellLayer.position.y = 0;

  /* section outlines and diode markers (shown by the steps that talk about them) */
  const bs = new Builder('lm440-sections');
  for (let s = 0; s < 3; s++) {
    const x = (columnX(s * 2) + columnX(s * 2 + 1)) / 2;
    const w = M.cw * 2 - 0.012;
    const l = 2 * (M.gap + M.half) - 0.006;
    for (const e of [-1, 1]) {
      bs.box(0.008, 0.004, l, { r: 0, slot: 'glow', c: SECTION_COLORS[s], at: [x + (e * w) / 2, 0.004, 0] });
      bs.box(w, 0.004, 0.008, { r: 0, slot: 'glow', c: SECTION_COLORS[s], at: [x, 0.004, (e * l) / 2] });
    }
  }
  const sections = bs.build().group;
  const diodeGroup = new Group();
  const glow: KGlowMaterial[] = [];
  const bd = new Builder('lm440-diode');
  bd.cone(0.03, 0.05, { seg: 3, axis: 'x', slot: 'toon', at: [0.025, 0, 0], rot: [0, 0, Math.PI] });
  bd.box(0.008, 0.06, 0.012, { r: 0, mid: true, at: [-0.03, 0, 0] });
  const diodeGeo = bd.geometry('toon');
  for (let s = 0; s < 3; s++) {
    const mat = K.glow({ color: 'amber', intensity: 0.35, keepHue: true, whiten: 0, falloff: 0 });
    const d = new Mesh(diodeGeo, mat);
    d.position.copy(diodeSpot(s));
    d.rotation.x = -Math.PI / 2;
    glow.push(mat);
    diodeGroup.add(d);
  }
  group.add(sections, diodeGroup);

  const anchor = (x: number, y: number, z: number, parent: Object3D = group): Object3D => {
    const o = new Group();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  eva1.visible = eva2.visible = glass.visible = false;
  sections.visible = diodeGroup.visible = false;
  return {
    group,
    cells,
    sections,
    diodes: { group: diodeGroup, glow },
    layers,
    anchors: {
      plus: anchor(0.3, -M.T - 0.012, 0.48, jbox),
      minus: anchor(-0.3, -M.T - 0.012, 0.48, jbox),
      jbox: anchor(0, -M.T - 0.03, 0, jbox),
      frame: anchor(M.W / 2, -M.T / 2, 0.4, frame),
      label: anchor(-0.3, LAYER_Y.back - 0.004, -0.5, back),
      glass: anchor(0.2, 0, -0.3, glass),
    },
    setExplode(amount) {
      for (const [name, o] of Object.entries(layers)) {
        o.position.y = (name === 'cells' ? 0 : rest[name]!) + EXPLODE[name as keyof typeof EXPLODE] * amount;
      }
      // the films and the glass sheet read only when the laminate is apart (flat glass over the cells just washes them out)
      eva1.visible = eva2.visible = glass.visible = amount > 0.02;
    },
  };
}
