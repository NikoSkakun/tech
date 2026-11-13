/**
 * `Capacitor` of step 7: two square metal plates one above the other on insulating posts, the uniform field
 * between them as parallel `amber` lines (density grows with log E), halos of the plate charges («+» top
 * `coral`, «−» bottom `cyan`), and the removable dielectric block whose dumbbell molecules line up with the
 * field while thin layers of bound charge appear on its faces. The gap is drawn enlarged (chip in the step).
 *
 * Lines and the dielectric (battery connected, U fixed): E = U/d inside the block is the same as without it,
 * but the plates carry ε_r times more charge — so ε_r times more lines leave a plate and all but 1/ε_r of
 * them end on the bound charge of the block's face. That is what is drawn: extra short lines in the slits.
 */
import { CapsuleGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { createHalo, createOrbs, RibbonLines, type Orbs } from '@/fx';
import { G } from '@/kit';
import { col, K, SEMANTIC, type ColorToken } from '@/style';
import { CAPACITOR } from '../layout';
import { clamp } from '../chapter';

const SLIT = 0.1; // drawn air slit between a plate and the block
const MOLS = 5; // molecules per side of the block
const ROWS = 3; // rows of field lines, front to back
const COLUMNS = 13; // most columns of field lines along the plate (strongest field)

export interface CapacitorView {
  /** Plate side, m (5…20 cm); gap, m (0,1…5 mm); field, V/m; charge level 0…1 of what the sliders ask for. */
  side: number;
  gap: number;
  field: number;
  level: number;
  /** Relative permittivity of the block (1 = no block) and how far it is pushed in (0…1). */
  permittivity: number;
  blockIn: number;
  blockColor: ColorToken;
}

export interface CapacitorModel {
  group: Group;
  view: CapacitorView;
  /** Scene geometry derived from the view: plate side, y of the facing surfaces. */
  readonly sideUnits: number;
  readonly yBottom: number;
  readonly yTop: number;
  /** Charges drawn on each plate now (one pair per field line). */
  readonly charges: number;
  update(dt: number, t: number): void;
}

/** Drawn gap: 0,1 mm → 0,75 units … 5 mm → 2,4 units (not to scale: 1 mm would be 0,03 units). */
const gapUnits = (gapM: number): number => 0.72 + 330 * gapM;

export function createCapacitor(): CapacitorModel {
  const group = new Group();
  group.name = 'capacitor';
  const metal = K.metal({
    color: 'steel',
    gradient: { bottom: 'bg.plum', top: 'steel', range: [-0.1, 0.1] },
  });
  const plateGeo = G.rbox(1, 0.12, 1, 0.04, 2);
  const top = new Mesh(plateGeo, metal);
  const bottom = new Mesh(plateGeo, metal);
  const post = K.toon({ color: 'ink', gloss: 0.4 });
  const posts = [0, 1, 2, 3].map(() => new Mesh(G.cyl(0.11, 1, { seg: 14, bevel: 0.02 }), post));
  const haloTop = createHalo({ color: SEMANTIC.proton, size: 4, intensity: 0, amount: 0.15 });
  const haloBottom = createHalo({ color: SEMANTIC.electron, size: 4, intensity: 0, amount: 0.15 });
  const lines = new RibbonLines({
    capacity: 600,
    color: SEMANTIC.fieldE,
    width: 0.06,
    intensity: 1.35,
    dashRepeat: 2.4,
    dashSpeed: 0.8,
    dashStrength: 0.75,
    base: 0.4,
    endFade: [0, 0],
    keepHue: true,
  });
  lines.frustumCulled = false;
  // the charges of the plates: half-sunk into the facing surfaces, one pair per field line
  const chargeOrbs = (plusSign: boolean): Orbs =>
    createOrbs({
      kind: 'ion',
      color: plusSign ? SEMANTIC.proton : SEMANTIC.electron,
      glyph: plusSign ? 'plus' : 'minus',
      count: COLUMNS * ROWS * 4,
      radius: 0.13,
    });
  const chargesPlus = chargeOrbs(true);
  const chargesMinus = chargeOrbs(false);
  const glass = K.glass({ color: 'sky', opacity: 0.3, edgeOpacity: 0.85 });
  const block = new Mesh(G.rbox(1, 1, 1, 0.03, 2), glass);
  const plus = createOrbs({
    kind: 'ion',
    color: SEMANTIC.proton,
    glyph: 'none',
    count: MOLS * MOLS,
    radius: 0.07,
  });
  const minus = createOrbs({
    kind: 'ion',
    color: SEMANTIC.electron,
    glyph: 'none',
    count: MOLS * MOLS,
    radius: 0.07,
  });
  const bars = new InstancedMesh(
    new CapsuleGeometry(0.025, 0.16, 3, 6),
    K.toon({ color: 'mist' }),
    MOLS * MOLS,
  );
  bars.frustumCulled = false;
  const boundTop = createHalo({
    color: SEMANTIC.electron,
    size: 3,
    intensity: 0,
    billboard: false,
    amount: 0,
  });
  const boundBottom = createHalo({
    color: SEMANTIC.proton,
    size: 3,
    intensity: 0,
    billboard: false,
    amount: 0,
  });
  boundTop.rotation.x = boundBottom.rotation.x = -Math.PI / 2;
  const blockSet = new Group();
  blockSet.add(block, bars, plus, minus, boundTop, boundBottom);
  group.add(bottom, top, ...posts, haloTop, haloBottom, lines, chargesPlus, chargesMinus, blockSet);
  group.position.y = CAPACITOR.y;

  const view: CapacitorView = {
    side: 0.1,
    gap: 1e-3,
    field: 1e5,
    level: 1,
    permittivity: 1,
    blockIn: 0,
    blockColor: 'sky',
  };
  const m = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const Z = new Vector3(0, 0, 1);
  let key = '';
  let tint: ColorToken | null = null;
  const model: CapacitorModel = {
    group,
    view,
    sideUnits: 3,
    yBottom: CAPACITOR.y,
    yTop: CAPACITOR.y + 1,
    charges: 0,
    update(_dt, t) {
      const s = view.side * CAPACITOR.unitsPerMetre;
      const g = gapUnits(view.gap);
      Object.assign(model, { sideUnits: s, yBottom: CAPACITOR.y + 0.06, yTop: CAPACITOR.y + 0.06 + g });
      bottom.scale.set(s, 1, s);
      top.scale.set(s, 1, s);
      top.position.y = g + 0.12;
      posts.forEach((post3, i) => {
        // two short posts under the lower plate at the front, two tall ones carrying the upper plate at the back
        const back = i < 2;
        const x = (i % 2 ? 1 : -1) * (s / 2 + (back ? 0.02 : -0.3));
        post3.position.set(x, -CAPACITOR.y, back ? -s / 2 - 0.16 : s / 2 - 0.3);
        post3.scale.set(1, back ? CAPACITOR.y + g + 0.12 : CAPACITOR.y - 0.06, 1);
      });
      // Field lines: none at U = 0, then columns that get denser with log E, in ROWS rows front to back — the
      // density reads along the plate. Every line starts on a «+» of the upper plate and ends on a «−» of the
      // lower one, so the plates fill up with charges exactly as the field grows.
      const e = view.field * view.level;
      const columns = e > 0 ? clamp(Math.round(2 + 4.2 * Math.log10(1 + e / 2e4)), 1, COLUMNS) : 0;
      const filled = view.blockIn > 0.6 && view.permittivity > 1.01;
      const extra = filled ? Math.round(Math.min(view.permittivity, 4) - 1) : 0; // lines ending on bound charge
      const next = `${s.toFixed(3)}|${g.toFixed(3)}|${columns}|${extra}`;
      if (next !== key) {
        key = next;
        const out: { points: Vector3[] }[] = [];
        let used = 0;
        const charge = (x: number, z: number): void => {
          if (used >= chargesPlus.capacity) return;
          // sunk so that they bulge only out of the facing surfaces (never through the outer faces)
          chargesPlus.setPosition(used, x, g + 0.03, z);
          chargesMinus.setPosition(used, x, 0.09, z);
          used++;
        };
        for (let i = 0; i < columns * ROWS; i++) {
          const x = (((i % columns) + 0.5) / columns - 0.5) * s * 0.9;
          const z = (0.5 - (Math.floor(i / columns) + 0.5) / ROWS) * s * 0.8;
          out.push({ points: [new Vector3(x, g + 0.05, z), new Vector3(x, 0.07, z)] });
          charge(x, z);
          for (let k = 1; k <= extra; k++) {
            const dx = ((k / (extra + 1)) * s * 0.9) / columns;
            const dz = (k % 2 ? 0.5 : -0.5) * ((s * 0.8) / ROWS) * 0.5;
            out.push({
              points: [new Vector3(x + dx, g + 0.05, z + dz), new Vector3(x + dx, g + 0.05 - SLIT, z + dz)],
            });
            out.push({
              points: [new Vector3(x + dx, 0.07 + SLIT, z + dz), new Vector3(x + dx, 0.07, z + dz)],
            });
            charge(x + dx, z + dz);
          }
        }
        lines.setLines(out);
        chargesPlus.instances = chargesMinus.instances = used;
        Object.assign(model, { charges: used });
        chargesPlus.commit();
        chargesMinus.commit();
      }
      chargesPlus.visible = chargesMinus.visible = columns > 0;
      lines.dashSpeed = 0.4 + 0.25 * Math.log10(1 + e / 2e4);
      // plate charge Q ∝ ε_r·E·A: brightness of the halos on a log scale
      const charge =
        e > 0 ? clamp(0.25 + 0.16 * Math.log10(1 + (e * (filled ? view.permittivity : 1)) / 2e4), 0, 1.1) : 0;
      haloTop.position.y = g + 0.2;
      haloTop.size = haloBottom.size = s * 1.9;
      haloTop.intensity = haloBottom.intensity = charge * (0.5 + 0.05 * Math.sin(t * 2));
      // dielectric block: slides in along +X, its molecules line up with the field (the «+» end down, toward «−»)
      blockSet.visible = view.blockIn > 0.01;
      blockSet.position.set((1 - view.blockIn) * (s + 1.2), 0, 0);
      const h = g - 2 * SLIT;
      block.scale.set(s * 0.94, h, s * 0.94);
      block.position.y = 0.06 + SLIT + h / 2;
      if (tint !== view.blockColor) glass.color.copy(col((tint = view.blockColor)));
      const align = clamp(Math.log10(1 + e / 5e4) / 1.5, 0, 1) * (view.blockIn > 0.9 ? 1 : 0);
      for (let i = 0; i < MOLS * MOLS; i++) {
        p.set(
          (((i % MOLS) + 0.5) / MOLS - 0.5) * s * 0.8,
          block.position.y + (((i * 7) % 5) / 5 - 0.4) * h * 0.55,
          ((Math.floor(i / MOLS) + 0.5) / MOLS - 0.5) * s * 0.8,
        );
        const rest = i * 2.4 + 0.6 * Math.sin(t * 0.7 + i);
        const a = rest + Math.atan2(Math.sin(-Math.PI / 2 - rest), Math.cos(-Math.PI / 2 - rest)) * align;
        const dx = Math.cos(a) * 0.1;
        const dy = Math.sin(a) * 0.1;
        plus.setPosition(i, p.x + dx, p.y + dy, p.z);
        minus.setPosition(i, p.x - dx, p.y - dy, p.z);
        bars.setMatrixAt(i, m.compose(p, q.setFromAxisAngle(Z, a - Math.PI / 2), one));
      }
      plus.commit();
      minus.commit();
      bars.instanceMatrix.needsUpdate = true;
      boundTop.position.y = block.position.y + h / 2 + 0.02;
      boundBottom.position.y = block.position.y - h / 2 - 0.02;
      boundTop.size = boundBottom.size = s * 1.25;
      boundTop.intensity = boundBottom.intensity = 0.9 * align * Math.min(extra / 3 + 0.25, 1);
    },
  };
  return model;
}
