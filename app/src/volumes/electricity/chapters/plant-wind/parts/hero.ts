/**
 * The hero turbine: the kit's `windTurbine` on the west hill, facing the 270° wind. The kit model gives the
 * tower, the yawing nacelle group, the spinning rotor and the pitching blades; the chapter replaces the kit's
 * simple nacelle interior with its own cutaway machine room (`parts/nacelle.ts`).
 */
import { Object3D, Vector3, type Group, type Mesh } from 'three';
import { Builder, windTurbine, type WindTurbine } from '@/kit';
import { HERO, WIND, yawInto } from '../layout';
import { buildNacelle, type Nacelle } from './nacelle';
import type { World } from './world';

export interface Hero {
  turbine: WindTurbine;
  /** Group at the tower base (world position of the turbine). */
  group: Group;
  /** Yawing group at hub height: local +Z points upwind along the rotor axis. */
  nacelle: Group;
  rotor: Group;
  /** World position of the hub centre (rotor axis at the blade plane). */
  hub: Vector3;
  /** World position of the tower base. */
  base: Vector3;
  /** The chapter's own machine room inside the kit's yawing nacelle group. */
  room: Nacelle;
  /** Tip of blade 0 (turns with the rotor). */
  bladeTip: Object3D;
  /** Nacelle scale of the kit model (1 for a 110 m rotor). */
  k: number;
  /** Rotor radius, toy metres. */
  radius: number;
  setRpm(rpm: number): void;
  /** Blade pitch in degrees (0 working … 90 feathered). */
  setPitchDeg(deg: number): void;
  /** Uniform size factor of rotor and blades (step 2: «ротор героя плавно змінює розмір»). */
  setRotorScale(s: number): void;
  /** Tower height factor (step 9: «башта героя анімовано подовжується»). */
  setHeightScale(s: number): void;
}

export function buildHero(world: World): Hero {
  const turbine = windTurbine({ hubHeight: HERO.hubHeight, rotorDiameter: HERO.rotorDiameter, accent: 'teal' });
  const group = turbine.group;
  world.island.place(group, HERO.x, HERO.z);
  turbine.setYaw(yawInto(WIND.fromDeg));
  const nacelle = turbine.part('nacelle');
  const rotor = turbine.part('rotor');
  const k = HERO.rotorDiameter / 2 / 55;
  // swap the kit's simple nacelle (merged meshes + lift-off cover) for the chapter's machine room
  for (const c of nacelle.children) if ((c as Mesh).isMesh) c.visible = false;
  turbine.part('cover').visible = false;
  const room = buildNacelle(k, 0.014 * HERO.hubHeight * 1.5);
  nacelle.add(room.group);
  // pitch drives at the three blade roots (they turn with the hub)
  const pb = new Builder('pitch-drives');
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    pb.frame({ rot: [0, 0, a], s: k }, () => {
      pb.cyl(0.26, 0.8, { seg: 12, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0.85, 1.75, 0.2] });
      pb.cyl(0.36, 0.22, { seg: 14, slot: 'metal', c: 'steel', at: [0.85, 1.6, 0.2] });
      pb.ring(1.05, 0.1, { axis: 'y', seg: 24, tubeSeg: 6, slot: 'metal', c: 'slate', at: [0, 1.82, 0] });
    });
  }
  rotor.add(pb.build().group);
  const base = group.position.clone();
  const hub = new Vector3();
  const tower: Object3D[] = group.children.filter((c) => (c as Mesh).isMesh);
  // KIT_API lists anchors `bladeN.tip`, but the kit registers all three as `tip`: place our own marker
  const bladeTip = new Object3D();
  bladeTip.position.set(0, HERO.rotorDiameter / 2, 0);
  turbine.part('blade0').add(bladeTip);
  const refresh = (): void => {
    group.updateMatrixWorld(true);
    turbine.anchorWorld('hub', hub);
  };
  refresh();
  return {
    turbine,
    group,
    nacelle,
    rotor,
    hub,
    base,
    room,
    bladeTip,
    k,
    radius: HERO.rotorDiameter / 2,
    setRpm: (rpm) => void (turbine.rotorSpeed = (rpm * Math.PI) / 30),
    setPitchDeg: (deg) => turbine.setPitch((deg * Math.PI) / 180),
    setRotorScale: (s) => void rotor.scale.setScalar(s),
    setHeightScale: (s) => {
      // stretch the tower meshes only; the nacelle rides on top
      for (const m of tower) m.scale.y = s;
      const top = HERO.hubHeight - 2.2 * k; // kit: the tower ends 2.2·k below the hub axis
      nacelle.position.y = top * s + 2.2 * k;
      refresh();
    },
  };
}
