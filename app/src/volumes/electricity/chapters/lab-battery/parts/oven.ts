/**
 * Step 11: the «піч безпеки» — a glass oven with an NMC cell and an LFP brick, a stage ladder beside each
 * (SEI → separator → vent → runaway lamps light as the model passes the thresholds), and the fx of each
 * stage: white gas from the vent, then flame, sparks and smoke (violent for NMC, slower with thick white
 * smoke for LFP). In front: a tray with two rows of four cells for the propagation scenario.
 */
import {
  Color,
  CylinderGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ChapterContext } from '@/engine/api';
import {
  applyHeat,
  createFlame,
  createFlash,
  createSmoke,
  createSparks,
  createSteam,
  type Flame,
} from '@/fx';
import type { Chemistry } from '@electricity/sim/lab-battery';
import { Builder } from '@/kit';
import { K, col, heatRamp, type KToonMaterial } from '@/style';
import type { Text3D } from '@/text';
import type { CellView } from '../sim-bindings/thermal-session';
import type { Mats } from '../world';
import { group, mesh, tag } from '../world';
import { heroCell, lfpBrick } from './cells';

export interface OvenView {
  propagation: boolean;
  /** 0…1 glow of the heater coils. */
  heater: number;
  cell: Record<Chemistry, CellView>;
  row: Record<Chemistry, readonly CellView[]>;
  barrier: boolean;
  /** 0…1: how far the nail is driven into the cells. */
  nail: number;
  /** The rig waits for «Старт»: the start button pulses and the ladders run a slow "ready" chase. */
  idle: boolean;
  /** 0…1 pointer over the start button. */
  hover: number;
}

export interface OvenRig {
  group: Group;
  oven: Group;
  tray: Group;
  /** Top of each single cell (vent) and the ladder lamps (callout anchors). */
  vent: Record<Chemistry, Group>;
  ladder: Record<Chemistry, Group>;
  /** The big lime push-button on the console in front of the rig (the step makes it press «Старт»). */
  startButton: Group;
  /** One-shot at runaway onset. */
  ignite(chem: Chemistry): void;
  apply(view: OvenView, dt: number, t: number): void;
}

const X: Record<Chemistry, number> = { NMC: -1.05, LFP: 1.05 };
/** Glow 0…1 of a body at temperature T (dull red from ≈ 120 °C, white-hot near 750 °C). */
const glow = (tC: number): number => Math.min(Math.max((tC - 90) / 560, 0), 1.15);

export function createOvenRig(ctx: ChapterContext, mats: Mats): OvenRig {
  const g = group('oven-rig');
  const oven = group('oven', 0, 0, -0.5);
  oven.add(mesh(new RoundedBoxGeometry(4.6, 0.3, 2.3, 3, 0.08), mats.dark, 0, 0.15, 0));
  oven.add(mesh(new RoundedBoxGeometry(4.6, 0.18, 2.3, 3, 0.07), mats.dark, 0, 2.95, 0));
  const walls = new Mesh(new RoundedBoxGeometry(4.3, 2.5, 2.0, 2, 0.06), mats.glass);
  walls.position.y = 1.6;
  walls.renderOrder = 6;
  const coilMat = K.toon({ color: 'slate', gloss: 0.3 });
  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    const coil = mesh(new TorusGeometry(0.28, 0.035, 8, 32), coilMat, x, 0.36, 0, false);
    coil.rotation.x = Math.PI / 2;
    oven.add(coil);
  }
  for (const [x, z] of [
    [-2.15, -1],
    [2.15, -1],
    [-2.15, 1],
    [2.15, 1],
  ] as const)
    oven.add(mesh(new CylinderGeometry(0.05, 0.05, 2.6, 10), mats.steel, x, 1.6, z));
  oven.add(walls);
  // convection fan under the ceiling: it always turns (idle life) and speeds up with the heater
  const fanB = new Builder('oven-fan');
  fanB.cyl(0.12, 0.1, { at: [0, -0.05, 0], seg: 16, slot: 'metal', c: 'steel' });
  for (let i = 0; i < 5; i++)
    fanB.box(0.46, 0.02, 0.17, {
      at: [0.3 * Math.cos((i / 5) * Math.PI * 2), 0, -0.3 * Math.sin((i / 5) * Math.PI * 2)],
      rot: [0.35, (i / 5) * Math.PI * 2, 0],
      r: 0.008,
      slot: 'metal',
      c: 'mist',
    });
  const fan = fanB.build().group;
  fan.position.set(0, 2.7, 0);
  oven.add(fan, mesh(new CylinderGeometry(0.04, 0.04, 0.16, 10), mats.steel, 0, 2.8, 0, false));

  /* -------------------------------------------------------------------------- the two single cells */
  const nmc = heroCell('violet', '21700', 0.6);
  const lfp = lfpBrick();
  const bodies: Record<Chemistry, { body: Group; mat: KToonMaterial; top: number }> = {
    NMC: { body: nmc.group, mat: nmc.mats.get('gloss') as KToonMaterial, top: 1.5 },
    LFP: { body: lfp.group, mat: lfp.mats.get('gloss') as KToonMaterial, top: 1.32 },
  };
  const nailGeometry = new CylinderGeometry(0.035, 0.008, 0.9, 10);
  const single = {} as Record<
    Chemistry,
    {
      vent: Group;
      steam: ReturnType<typeof createSteam>;
      smoke: ReturnType<typeof createSmoke>;
      flame: Flame;
      flash: ReturnType<typeof createFlash>;
      lamps: ReturnType<typeof K.glow>[];
      temp: Text3D;
      nail: Mesh;
      text: string;
      fire: number;
    }
  >;
  const ladder = {} as OvenRig['ladder'];
  const vent = {} as OvenRig['vent'];
  const sparks = createSparks(ctx, { count: ctx.quality.count(90, 30) });
  oven.add(sparks);
  for (const chem of ['NMC', 'LFP'] as const) {
    const { body, top } = bodies[chem];
    const st = group(`cell:${chem}`, X[chem], 0.42, 0);
    st.add(mesh(new CylinderGeometry(0.62, 0.66, 0.1, 32), mats.light, 0, 0.05, 0));
    body.position.y = 0.1;
    st.add(body);
    const v = group('vent', 0, top + 0.1, 0);
    const steam = createSteam(ctx, { radius: 0.09, height: 1.5, count: ctx.quality.count(26, 10) });
    const smoke =
      chem === 'NMC'
        ? createSmoke(ctx, { radius: 0.2, height: 1.8, count: ctx.quality.count(34, 12) })
        : createSteam(ctx, { radius: 0.3, height: 1.9, count: ctx.quality.count(44, 14), opacity: 0.95 });
    const flame = createFlame({
      height: chem === 'NMC' ? 1.35 : 0.8,
      width: chem === 'NMC' ? 0.75 : 0.5,
      power: 0,
      seed: chem === 'NMC' ? 0 : 2,
    });
    const flash = createFlash({ size: 3, color: 'orange' });
    steam.setEmitting(false, true);
    smoke.setEmitting(false, true);
    v.add(steam, smoke, flame, flash);
    const temp = tag('', 24, 'white', 'mono');
    temp.position.set(0, 1.25, 0);
    v.add(temp);
    const nail = mesh(nailGeometry, mats.steel, 0, 0.9, 0, false);
    v.add(nail);
    st.add(v);
    oven.add(st);
    // stage ladder outside the glass: four lamps bottom → top
    const lad = group(`ladder:${chem}`, X[chem] * 2.35, 0.45, 1.12);
    lad.add(mesh(new RoundedBoxGeometry(0.14, 1.9, 0.1, 2, 0.04), mats.dark, 0, 0.95, 0));
    const lamps = (['amber', 'white', 'sky', 'red'] as const).map((c, i) => {
      const m = K.glow({ color: c, intensity: 0.2, keepHue: true, whiten: 0 });
      lad.add(mesh(new SphereGeometry(0.1, 16, 12), m, 0, 0.3 + i * 0.45, 0.07, false));
      return m;
    });
    oven.add(lad);
    ladder[chem] = lad;
    vent[chem] = v;
    single[chem] = { vent: v, steam, smoke, flame, flash, lamps, temp, nail, text: '', fire: 0 };
  }
  g.add(oven);

  /* --------------------------------------------------------- console with the start push-button */
  const startButton = group('start-button', 2.95, 0, 1.25);
  startButton.rotation.y = -0.35;
  const consoleB = new Builder('start-console');
  consoleB.box(0.62, 0.5, 0.5, { r: 0.07, c: ['bg.indigo', 'slate'] });
  consoleB.frame({ at: [0, 0.5, 0], rot: [0.5, 0, 0] }, () => {
    consoleB.box(0.62, 0.1, 0.6, { at: [0, -0.02, 0], r: 0.04, c: ['slate', 'steel'] });
    consoleB.cyl(0.24, 0.05, { at: [0, 0.08, 0], seg: 36, slot: 'metal', c: 'steel.light', bevel: 0.015 });
  });
  startButton.add(consoleB.build().group);
  const capMat = K.glow({ color: 'lime', intensity: 0.4, keepHue: true, whiten: 0.1, falloff: 0 });
  const cap = group('cap', 0, 0.5, 0);
  cap.rotation.x = 0.5;
  cap.add(mesh(new CylinderGeometry(0.19, 0.2, 0.09, 36), capMat, 0, 0.165, 0, false));
  // the «play» triangle on the cap
  const play = mesh(new CylinderGeometry(0.085, 0.085, 0.012, 3), mats.ink, 0.01, 0.215, 0, false);
  play.rotation.y = -Math.PI / 2;
  cap.add(play);
  startButton.add(cap);
  g.add(startButton);

  /* ---------------------------------------------------------------- propagation tray: 2 rows × 4 */
  const tray = group('tray', 0, 0, 0.2);
  tray.add(mesh(new RoundedBoxGeometry(4.6, 0.14, 2.2, 3, 0.05), mats.dark, 0, 0.07, 0));
  const rowsZ: Record<Chemistry, number> = { NMC: -0.5, LFP: 0.5 };
  const cellX = (j: number): number => (j - 1.5) * 0.95;
  const shapes: Record<Chemistry, InstancedMesh> = {
    NMC: new InstancedMesh(
      new CylinderGeometry(0.24, 0.24, 0.95, 28),
      K.toon({ color: 'white', gloss: 0.5 }),
      4,
    ),
    LFP: new InstancedMesh(
      new RoundedBoxGeometry(0.34, 0.9, 0.62, 2, 0.04),
      K.toon({ color: 'white', gloss: 0.5 }),
      4,
    ),
  };
  const m4 = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const rowFlames = {} as Record<Chemistry, Flame[]>;
  const barriers: Mesh[] = [];
  for (const chem of ['NMC', 'LFP'] as const) {
    for (let j = 0; j < 4; j++)
      shapes[chem].setMatrixAt(j, m4.compose(p.set(cellX(j), 0.14 + 0.47, rowsZ[chem]), q, one));
    shapes[chem].castShadow = true;
    tray.add(shapes[chem]);
    rowFlames[chem] = Array.from({ length: 4 }, (_, j) => {
      const f = createFlame({
        height: chem === 'NMC' ? 1.0 : 0.6,
        width: 0.45,
        power: 0,
        seed: j + (chem === 'NMC' ? 0 : 4),
      });
      f.position.set(cellX(j), 1.1, rowsZ[chem]);
      tray.add(f);
      return f;
    });
    // aerogel pads between neighbours
    for (let j = 0; j < 3; j++) {
      const pad = mesh(
        new RoundedBoxGeometry(0.1, 0.95, 0.8, 2, 0.03),
        mats.white,
        cellX(j) + 0.475,
        0.14 + 0.475,
        rowsZ[chem],
        false,
      );
      barriers.push(pad);
      tray.add(pad);
    }
    const name = tag(chem, 20, chem === 'NMC' ? 'violet' : 'teal');
    name.position.set(-2.0, 0.6, rowsZ[chem]);
    tray.add(name);
  }
  g.add(tray);

  const base: Record<Chemistry, Color> = { NMC: col('violet'), LFP: col('sky').lerp(col('blue'), 0.35) };
  const hot = new Color();
  const c = new Color();
  const show = { oven: 1, tray: 0, pads: 0 };
  return {
    group: g,
    oven,
    tray,
    vent,
    ladder,
    startButton,
    ignite(chem) {
      const s = single[chem];
      s.flash.fire();
      sparks.burst([X[chem], 0.42 + bodies[chem].top + 0.1, 0], chem === 'NMC' ? 46 : 12, [0, 1, 0], 0.9);
    },
    apply(view, dt, t) {
      const k = Math.min(1, dt * 8);
      show.oven += ((view.propagation ? 0 : 1) - show.oven) * k;
      show.tray += ((view.propagation ? 1 : 0) - show.tray) * k;
      show.pads += ((view.barrier ? 1 : 0) - show.pads) * k;
      oven.scale.setScalar(Math.max(show.oven, 1e-3));
      oven.visible = show.oven > 0.01;
      tray.scale.setScalar(Math.max(show.tray, 1e-3));
      tray.visible = show.tray > 0.01;
      barriers.forEach((b) => (b.scale.set(1, Math.max(show.pads, 1e-3), 1), (b.visible = show.pads > 0.01)));
      applyHeat(coilMat, view.heater);
      fan.rotation.y += dt * (0.9 + 9 * view.heater);
      // start button: a slow lime pulse while the rig waits, dim while a run is on, pressed-in look on hover
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
      capMat.intensity = (view.idle ? 0.9 + 1.1 * pulse : 0.25) + 0.8 * view.hover;
      cap.position.y = 0.5 - 0.012 * view.hover;
      for (const chem of ['NMC', 'LFP'] as const) {
        const s = single[chem];
        const v = view.cell[chem];
        applyHeat(bodies[chem].mat, glow(v.tempC) * 0.85);
        // passed stages burn steadily; while the rig waits, a faint "ready" light climbs the ladder
        [v.sei, v.separator, v.vent, v.runaway].forEach((on, i) => {
          const ready = view.idle ? 0.45 * Math.max(0, Math.sin(t * 1.8 - i * 0.9)) ** 6 : 0;
          s.lamps[i]!.intensity = on ? 1.5 + 0.25 * Math.sin(t * 5 + i) : 0.2 + ready;
        });
        s.steam.setEmitting(v.vent && !v.runaway);
        s.smoke.setEmitting(v.runaway);
        // NMC burns violently, LFP more slowly and smokes (§M7 peaks 750 / 450 °C)
        const fire = v.runaway
          ? Math.min(Math.max((v.tempC - 150) / 300, 0.25), 1) * (chem === 'NMC' ? 1 : 0.6)
          : 0;
        s.fire += (fire - s.fire) * Math.min(1, dt * 5);
        s.flame.power = s.fire;
        const text = `${Math.round(v.tempC)} °C`;
        if (text !== s.text) s.temp.text = s.text = text;
        // idle life: the cells turn slowly on their stands, like exhibits
        bodies[chem].body.rotation.y = 0.35 + Math.sin(t * 0.35 + (chem === 'NMC' ? 0 : 1.7)) * 0.5;
        s.nail.visible = view.nail > 0.01;
        s.nail.position.y = 0.95 - 0.8 * view.nail;
        view.row[chem].forEach((cv, j) => {
          shapes[chem].setColorAt(
            j,
            c.copy(base[chem]).lerp(heatRamp(glow(cv.tempC), hot), Math.min(glow(cv.tempC) * 1.4, 1)),
          );
          const f = rowFlames[chem][j]!;
          f.power += ((cv.runaway ? (chem === 'NMC' ? 0.9 : 0.55) : 0) - f.power) * Math.min(1, dt * 5);
        });
        if (shapes[chem].instanceColor) shapes[chem].instanceColor.needsUpdate = true;
      }
    },
  };
}
