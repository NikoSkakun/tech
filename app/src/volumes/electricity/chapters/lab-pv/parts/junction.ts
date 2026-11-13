/**
 * The p-n junction of step 2, seen from inside the cell: a slab of silicon lattice (`steel` atoms, `slate`
 * bonds) with the n-layer on top (`teal` tint), the p-layer below (`pink` tint) and the depletion region
 * between them with the built-in field **E** (`amber` arrows from n to p); silver fingers on top, the rear
 * contact below and an outer circuit with a lamp. Simplified square lattice — the step carries the chip.
 * Units: stage units; the slab is 6.4 wide, 4.4 tall (y), 1.4 deep.
 */
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, type Object3D, SphereGeometry, Vector3 } from 'three';
import { createHalo, createWire, type Wire } from '@/fx';
import { Builder } from '@/kit';
import { K, SEMANTIC, type KGlowMaterial } from '@/style';

export const JUNCTION = { w: 5.2, top: 2.2, bottom: -2.2, band: 0.5, depth: 1.4 } as const;

export interface Junction {
  group: Group;
  anchors: Record<'n' | 'p' | 'depletion' | 'finger' | 'lamp', Object3D>;
  wire: Wire;
  /** `field` 0…1 fades the depletion band and its arrows; `current` 0…1 lights the lamp and the wire. */
  set(field: number, current: number, t: number): void;
}

export function createJunction(): Junction {
  const group = new Group();
  group.name = 'junction';
  const { w: W, top, bottom, band, depth: D } = JUNCTION;
  // lattice: atoms on a square grid, two layers deep, with bonds along x and y
  const nx = 11;
  const ny = 9;
  const px = W / nx;
  const py = (top - bottom) / ny;
  const atoms = new InstancedMesh(new SphereGeometry(0.09, 14, 10), K.toon({ color: 'steel', gloss: 0.4 }), nx * ny * 2);
  const bonds = new InstancedMesh(new BoxGeometry(1, 0.028, 0.028), K.toon({ color: 'slate' }), nx * ny * 4);
  const m = new Matrix4();
  let a = 0;
  let b = 0;
  for (let k = 0; k < 2; k++) {
    const z = (k - 0.5) * 0.7;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const x = (i - (nx - 1) / 2) * px;
        const y = bottom + (j + 0.5) * py;
        atoms.setMatrixAt(a++, m.makeTranslation(x, y, z));
        if (i < nx - 1) bonds.setMatrixAt(b++, m.makeScale(px, 1, 1).setPosition(x + px / 2, y, z));
        if (j < ny - 1) bonds.setMatrixAt(b++, m.makeRotationZ(Math.PI / 2).scale(new Vector3(py, 1, 1)).setPosition(x, y + py / 2, z));
      }
    }
  }
  bonds.count = b;
  group.add(atoms, bonds);

  // doped layers as tinted glass, the depletion band as a glowing amber sheet
  const tint = (color: string, y0: number, y1: number, opacity: number): Mesh<BoxGeometry, ReturnType<typeof K.glass>> => {
    const box = new Mesh(new BoxGeometry(W + 0.2, y1 - y0, D), K.glass({ color, opacity, edgeOpacity: 0.5 }));
    box.position.y = (y0 + y1) / 2;
    return box;
  };
  const nLayer = tint(SEMANTIC.nRegion, band, top, 0.16);
  const pLayer = tint(SEMANTIC.pRegion, bottom, -band, 0.16);
  const depletion = tint(SEMANTIC.fieldE, -band, band, 0.1);
  group.add(nLayer, pLayer, depletion);
  const arrowGeo = new Builder('e-arrow').cone(0.11, 0.24, { seg: 12, at: [0, -0.34, 0], rot: [Math.PI, 0, 0] }).cyl(0.035, 0.42, { seg: 8, at: [0, -0.2, 0] }).geometry('toon');
  const arrowMat: KGlowMaterial = K.glow({ color: SEMANTIC.fieldE, intensity: 1.5, keepHue: true, whiten: 0 });
  const arrows = new InstancedMesh(arrowGeo, arrowMat, 7);
  group.add(arrows);

  // contacts and the outer circuit with a lamp
  const c = new Builder('contacts');
  for (const x of [-1.7, 0, 1.7]) c.box(0.5, 0.16, D + 0.1, { r: 0.04, slot: 'metal', c: 'mist', at: [x, top + 0.02, 0] });
  c.box(W + 0.2, 0.14, D + 0.1, { r: 0.04, slot: 'metal', c: 'steel', at: [0, bottom - 0.16, 0] });
  c.cyl(0.2, 0.3, { seg: 20, slot: 'metal', c: 'steel.light', axis: 'x', at: [0.25, bottom - 1.25, 0] }); // lamp socket
  group.add(c.build().group);
  // the loop leaves the right-hand finger, runs down the side and through the lamp under the cell to the rear contact
  const xr = W / 2 + 0.5;
  const yl = bottom - 1.25;
  const loop = [new Vector3(1.7, top + 0.18, 0), new Vector3(1.7, top + 0.75, 0), new Vector3(xr, top + 0.75, 0), new Vector3(xr, yl, 0), new Vector3(0.7, yl, 0)];
  const back = [new Vector3(-0.3, yl, 0), new Vector3(-1.5, yl, 0), new Vector3(-1.5, bottom - 0.2, 0)];
  const wire = createWire([...loop, ...back], { radius: 0.045, color: 'ink', pulseColor: 'yellow', repeat: 0.9, speed: 2.2, power: 0, detail: 6 });
  const bulb = new Mesh(new SphereGeometry(0.34, 28, 20), K.glow({ color: 'yellow', intensity: 0.3, whiten: 0.4 }));
  bulb.position.set(0.25, yl, 0);
  const halo = createHalo({ color: 'yellow', size: 2.2, intensity: 0 });
  bulb.add(halo);
  group.add(wire, bulb);

  const anchor = (x: number, y: number): Object3D => {
    const o = new Group();
    o.position.set(x, y, D / 2);
    group.add(o);
    return o;
  };
  return {
    group,
    wire,
    anchors: { n: anchor(-W / 2 + 0.3, 1.5), p: anchor(-W / 2 + 0.3, -1.5), depletion: anchor(W / 2 - 0.4, 0), finger: anchor(-1.7, top + 0.15), lamp: bulb },
    set(field, current, t) {
      depletion.visible = arrows.visible = field > 0.02;
      depletion.material.fade = field;
      arrowMat.intensity = 0.4 + 1.2 * field;
      for (let i = 0; i < 7; i++) {
        // arrows drift slowly downward through the band: from the n side to the p side
        const drift = ((t * 0.25 + i * 0.37) % 1) * 0.3;
        arrows.setMatrixAt(i, m.makeScale(field, field, field).setPosition((i - 3) * 0.7, band - 0.05 - drift + 0.3, D / 2 - 0.2));
      }
      arrows.instanceMatrix.needsUpdate = true;
      wire.material.power = current;
      (bulb.material as KGlowMaterial).intensity = 0.3 + 1.9 * current;
      halo.intensity = 0.9 * current;
    },
  };
}
