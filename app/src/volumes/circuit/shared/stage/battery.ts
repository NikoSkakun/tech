/**
 * The one AA battery of the volume: dark `ink` jacket with an `amber` band toward the plus (as in volume 1,
 * where it read at a glance), steel shoulder and nub at «+», flat plate at «−», pole marks on the jacket.
 * Origin = centre of the can, axis along local +x, «+» at +x.
 *
 * `charge` 1 … 0 is what the OUTSIDE shows of the battery's life (VISUAL.md §5.8): the amber band pales to a
 * dull `mist` and the jacket loses its gloss tone — a dead battery must be told from a fresh one without a label.
 */
import { type BufferGeometry, type Group, Mesh, type Object3D, Plane, ShaderMaterial, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { K, type KToonMaterial, col } from '@/style';
import { Text3D } from '@/text';
import { BATTERY } from './layout';
import { type BatteryInside, createBatteryInside } from './battery-inside';

export interface BatteryModel {
  group: Group;
  /** 1 fresh … 0 dead. */
  charge: number;
  /** Whether «1.5 V» is printed on the jacket (off where it would be too small to read — label it in the interface). */
  printShown: boolean;
  /** Where the print sits, for a caption of the interface (`getWorldPosition`). */
  printAnchor: Object3D;
  /** Brightness of the printed «1.5 V» 0…1 (the print is unlit text: it follows the room's light). */
  light: number;
  /** Tips of the poles in the battery's local space (where the clamp's contact and the spring touch). */
  plusTip: Vector3;
  minusTip: Vector3;
  /** The inside: cutaway, life, reaction, pole charges (README «Battery inside»). Ticked by the stage. */
  inside: BatteryInside;
}

/**
 * Printed pole marks: bars `MARK.bar` long and `MARK.thick` thick, measured ON the surface (an arc of `a` radians
 * at radius r is a·r long), so the bar along the axis and the bar around it come out the same size.
 * They float `lift` above the amber band (radius R + 0.004) — at the band's own radius they z-fought with it.
 */
const MARK = { bar: 0.2, thick: 0.05, lift: 0.012 };
const MARK_R = BATTERY.radius + MARK.lift;

/** A strip lying on the can's surface: `len` along the axis, `width` around it, centred at angle `phi`. */
function strip(b: Builder, x: number, len: number, width: number, phi: number, c: string): void {
  const arc = width / MARK_R;
  const g = G.lathe(
    [
      [MARK_R, -len / 2],
      [MARK_R, len / 2],
    ],
    // ~1 segment per 0.01 of arc length: the curved bar reads as one smooth band, not facets
    { seg: Math.max(4, Math.ceil(width / 0.01)), phiStart: phi - arc / 2, phiLength: arc },
  );
  b.add(g, { slot: 'toon', c, at: [x, 0, 0], rot: [0, 0, -Math.PI / 2] });
}

/** «−»: one bar along the axis. */
function minus(b: Builder, x: number, phi: number, c: string): void {
  strip(b, x, MARK.bar, MARK.thick, phi, c);
}

/** «+»: the «−» bar plus a bar around the can, split around the centre so no two pieces overlap. */
function plus(b: Builder, x: number, phi: number, c: string): void {
  const { bar, thick } = MARK;
  minus(b, x, phi, c);
  const arm = (bar - thick) / 2;
  const off = (thick / 2 + arm / 2) / MARK_R;
  strip(b, x, thick, arm, phi + off, c);
  strip(b, x, thick, arm, phi - off, c);
}

/**
 * The outside of the can: jacket, steel shoulder, band ring, pole marks and the amber band — built twice from
 * this one recipe: the battery itself (with the «+» nub and the «−» plate) and the near-half sleeve that slides
 * off when the battery is cut open (`battery-inside.ts`). `clip` = the clipping planes of that build.
 */
function buildOutside(
  name: string,
  clip: Plane[],
  caps: boolean,
): { group: Group; band: Mesh<BufferGeometry, KToonMaterial> } {
  const { length: L, radius: R } = BATTERY;
  const b = new Builder(name, { clippingPlanes: clip });
  const jacket = L * 0.64;
  b.cyl(R, jacket, {
    at: [-L / 2, 0, 0],
    axis: 'x',
    seg: 48,
    slot: 'gloss',
    c: ['ink', 'slate'],
    bevel: 0.035,
  });
  // steel shoulder under the band's far end, the «+» nub and the flat «−» plate
  b.cyl(R * 0.94, 0.05, {
    at: [L / 2 - 0.05, 0, 0],
    axis: 'x',
    seg: 40,
    slot: 'metal',
    c: 'mist',
    bevel: 0.02,
  });
  if (caps) {
    b.cyl(0.105, 0.105, {
      at: [L / 2 - 0.01, 0, 0],
      axis: 'x',
      seg: 24,
      slot: 'metal',
      c: 'mist',
      bevel: 0.025,
    });
    b.cyl(R * 0.8, 0.03, {
      at: [-L / 2 - 0.02, 0, 0],
      axis: 'x',
      seg: 32,
      slot: 'metal',
      c: 'mist',
      bevel: 0.01,
    });
  }
  b.cyl(R + 0.007, 0.045, {
    at: [-L / 2 + jacket - 0.02, 0, 0],
    axis: 'x',
    seg: 48,
    slot: 'metal',
    c: 'mist',
    bevel: 0.012,
  });
  // pole marks, turned toward the reader
  // G.lathe: φ = 0 → +x; laid along x it becomes φ = π/2 → facing the reader (+z), φ = π → facing up
  const phi = Math.PI / 2 + 0.85;
  // «+» in the middle of the band's visible part; «−», a clear gap, then «1.5 V», the group centred on the jacket
  plus(b, L / 2 - 0.35, phi, 'white');
  minus(b, -L / 2 + 0.29, phi, 'mist');

  const model = b.build();
  const band = new Mesh(
    G.cyl(R + 0.004, L - jacket - 0.07, { seg: 48, bevel: 0.03 }).rotateZ(-Math.PI / 2),
    K.toon({ color: 'amber', gloss: 0.75, highlight: 0.6, clippingPlanes: clip }),
  );
  band.position.x = -L / 2 + jacket + 0.02;
  band.castShadow = band.receiveShadow = true;
  band.name = `${name}:band`;
  model.group.add(band);
  return { group: model.group, band };
}

export function createBattery(): BatteryModel {
  const { length: L, radius: R } = BATTERY;
  // the battery keeps its far half while it is cut open; at cut = 0 this plane clips nothing
  const keepFar = new Plane(new Vector3(0, 1, 0), 1e6);
  const keepNear = new Plane();
  const pastMinus = new Plane();
  const outside = buildOutside('battery', [keepFar], true);
  const band = outside.band;
  const sleeve = buildOutside('battery-sleeve', [keepNear, pastMinus], false);
  sleeve.group.visible = false;
  sleeve.group.traverse((o) => (o.castShadow = false));
  // the sleeve's own materials (one build, its own clipping planes): it dissolves as it slides away
  // The sleeve's own materials (one build, its own clipping planes): it fades out by alpha as it slides away. They
  // are blended from the start (opacity 1 looks the same), so fading never switches a material mid-scrub; a
  // dithered `fade` left a visible stipple at mid-cut.
  const sleeveMats = new Set<ShaderMaterial>();
  sleeve.group.traverse((o) => {
    const m = (o as Mesh).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) {
      if (!(x instanceof ShaderMaterial) || !x.uniforms.opacity) continue;
      x.transparent = true;
      sleeveMats.add(x);
    }
  });
  const model = { group: outside.group };
  model.group.add(sleeve.group);

  // «1.5 V» printed on the jacket, on the same line as the pole marks
  const print = new Text3D('1.5 V', {
    font: 'display',
    size: 0.19,
    color: 'mist',
    anchorX: 'center',
    anchorY: 'middle',
    halo: false,
    rich: false,
  });
  // ≈0.48 wide; its left edge ≈0.15 (more than one character) right of the «−» bar's end
  print.position.set(-0.17, Math.sin(0.85) * (R + 0.008), Math.cos(0.85) * (R + 0.008));
  print.rotation.x = -0.85;
  print.name = 'battery:print';
  model.group.add(print);
  const ink = col('mist');
  const printX = print.position.x;
  let light = 1;
  let printFade = 1;
  let printShown = true;
  const paintPrint = (): void => {
    print.color = ink.clone().multiplyScalar((0.12 + 0.6 * light) * printFade);
  };
  const inside = createBatteryInside({
    group: model.group,
    keepFar,
    keepNear,
    pastMinus,
    sleeve: sleeve.group,
    setSleeveFade(k) {
      for (const m of sleeveMats) m.uniforms.opacity!.value = k;
    },
    setPrint(k, shift) {
      printFade = k;
      print.position.x = printX + shift;
      print.visible = printShown && k > 0.01;
      paintPrint();
    },
  });

  const fresh = col('amber');
  const dead = col('mist').lerp(col('slate'), 0.45);
  let charge = 1;
  return {
    group: model.group,
    plusTip: new Vector3(L / 2 + 0.095, 0, 0),
    minusTip: new Vector3(-L / 2 - 0.02, 0, 0),
    printAnchor: print,
    inside,
    get printShown() {
      return printShown;
    },
    set printShown(v: boolean) {
      printShown = v;
      print.visible = v && printFade > 0.01;
    },
    get light() {
      return light;
    },
    set light(v: number) {
      light = Math.min(Math.max(v, 0), 1);
      paintPrint();
    },
    get charge() {
      return charge;
    },
    set charge(v: number) {
      charge = Math.min(Math.max(v, 0), 1);
      // the band keeps its colour for most of the life and pales in the last third
      band.material.color.copy(dead).lerp(fresh, Math.min(charge / 0.35, 1) ** 0.8);
      sleeve.band.material.color.copy(band.material.color);
    },
  };
}
