/**
 * The «drive socket» rig of step 2: one synchronous generator (kit `turbogenerator`, cut open) on the right of
 * the coupling at x = 0, and four interchangeable drives that slide into the socket on its left: a steam turbine
 * (HP + LP), a gas turbine (cold-end drive, turned around), a slow water wheel (a horizontal Francis-type runner in
 * a spiral casing) and a three-bladed wind rotor with a gearbox. Shaft axis at y = AXIS, along X.
 */
import { Group } from 'three';
import { Builder, G, gasTurbine, steamTurbine, turbogenerator, type GasTurbine, type KitModel, type SteamTurbine, type Turbogenerator } from '@/kit';

export const AXIS = 3.2;
export type DriveId = 'steam' | 'gas' | 'water' | 'wind';

export interface DriveRig {
  generator: Turbogenerator;
  drives: Record<DriveId, { group: Group; rotor: Group }>;
  steam: SteamTurbine;
  gas: GasTurbine;
}

/** Wrap a model into a holder group that slides along −X into the socket. */
function holder(name: string, model: KitModel, x: number, ry = 0): Group {
  const g = new Group();
  g.name = name;
  model.group.position.x = x;
  model.group.rotation.y = ry;
  g.add(model.group);
  return g;
}

function waterWheel(): KitModel {
  const b = new Builder('water-wheel');
  // spiral casing (a flat volute around the runner) and the draft tube, horizontal axis along X
  const casing = G.revolve([[3.3, -0.9], [4.4, -0.9], [4.6, 0], [4.4, 0.9], [3.3, 0.9]].map(([r, y]) => [r!, y!] as [number, number]), { seg: 48, phiStart: 0.5, phiLength: 4.6 });
  b.add(casing.shell, { slot: 'gloss', c: ['blue.dark', 'sky'], at: [-1.6, AXIS, 0], rot: [0, 0, Math.PI / 2] });
  b.box(1.4, AXIS - 0.6, 3, { r: 0.2, at: [-1.6, 0, 0], c: ['steel.dark', 'steel'], slot: 'matte' });
  const runner = b.part('rotor', { at: [-1.6, AXIS, 0] });
  runner.cyl(3.1, 0.4, { seg: 40, axis: 'x', c: 'mist', slot: 'metal' });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    runner.box(1.3, 0.25, 0.7, { r: 0.08, at: [0, Math.sin(a) * 2.3 - 0.12, Math.cos(a) * 2.3], rot: [a, 0, 0.35], c: 'sky.light', slot: 'metal' });
  }
  runner.cyl(0.35, 1.8, { seg: 20, axis: 'x', at: [0.9, 0, 0], c: 'steel', slot: 'metal' });
  return b.build();
}

function windRotor(): KitModel {
  const b = new Builder('wind-rotor');
  b.box(3.6, 2.6, 2.6, { r: 0.4, at: [-2.6, AXIS - 1.3, 0], c: ['teal.dark', 'teal'], slot: 'gloss' });
  b.box(1.2, AXIS - 1.3, 1.6, { r: 0.15, at: [-2.6, 0, 0], c: ['steel.dark', 'steel'], slot: 'matte' });
  const rotor = b.part('rotor', { at: [-5.2, AXIS, 0] });
  rotor.sphere(0.9, { seg: 24, c: 'white', slot: 'gloss', s: [1.4, 1, 1] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    rotor.frame({ rot: [a, 0, 0] }, () => {
      rotor.box(0.25, 7.5, 0.9, { r: 0.12, at: [0, 0.7, 0], c: ['mist', 'white'], slot: 'gloss', s: [1, 1, 1] });
      rotor.box(0.26, 0.5, 0.92, { r: 0.1, at: [0, 7.0, 0], c: 'coral', slot: 'gloss' });
    });
  }
  return b.build();
}

export function createDriveRig(): DriveRig {
  const generator = turbogenerator({ cut: 2.0 });
  const steam = steamTurbine({ sections: ['hp', 'lp'] });
  const gas = gasTurbine({ axisHeight: AXIS });
  const water = waterWheel();
  const wind = windRotor();
  const drives: DriveRig['drives'] = {
    steam: { group: holder('drive-steam', steam, -steam.length), rotor: steam.part('rotor') },
    gas: { group: holder('drive-gas', gas, 0, Math.PI), rotor: gas.part('rotor') },
    water: { group: holder('drive-water', water, 0), rotor: water.part('rotor') },
    wind: { group: holder('drive-wind', wind, 0), rotor: wind.part('rotor') },
  };
  return { generator, drives, steam, gas };
}
