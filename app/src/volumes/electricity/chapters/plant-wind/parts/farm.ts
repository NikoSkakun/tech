/**
 * Onshore farm of step 8: 4 rows × 4 small turbines on the flat field, drawn with the kit's `windFleet`
 * (instanced: one set of draw calls for all sixteen, every rotor spins at its own speed, every nacelle yaws).
 * Their layout is the simulation's layout (`simulateFarm`: rows along east, 5 D inside a row) mapped to toy
 * metres at `FARM.layoutD` per rotor diameter; the turbines themselves are drawn `FARM.enlarged`× larger (map
 * symbols).
 *
 * A `windFleet` keeps the placements it was built with, and the row-spacing slider slides whole rows — so the
 * fleet is built again when the spacing changes (a few milliseconds, once per slider notch; rotor angles and
 * yaw are carried over). Wind direction, steering and rotor speeds only touch the fleet's live `turbines`.
 */
import { Group, Vector3 } from 'three';
import type { FarmResult } from '@electricity/sim/plant-wind';
import { windFleet, type WindFleet } from '@/kit';
import { PLANT_TYPE } from '@/style';
import { FARM, yawInto } from '../layout';
import type { World } from './world';

export interface Farm {
  /** Parent of the fleet (island frame); stays the same object when the fleet is rebuilt. */
  group: Group;
  count: number;
  /** Rotor speed of each turbine, rad/s (set by the farm binding from the wake model). */
  speed: Float32Array;
  /** Lay the turbines out from a simulation result (positions, yaw into the wind ± steering). */
  apply(result: FarmResult, rowSpacingD: number, windFromDeg: number): void;
  /** World x, z of turbine `i`. */
  spot(i: number): { x: number; z: number };
  /** World position of turbine `i`'s hub / of the top of its nacelle (aviation light). */
  hub(i: number, out?: Vector3): Vector3;
  top(i: number, out?: Vector3): Vector3;
  update(dt: number): void;
}

export function buildFarm(world: World): Farm {
  const n = FARM.rows * FARM.perRow;
  const dReal = FARM.layoutD * FARM.realPerToy;
  const nC = ((FARM.perRow - 1) / 2) * FARM.inRowSpacingD * dReal;
  const group = new Group();
  group.name = 'onshore-farm';
  world.island.group.add(group);
  const speed = new Float32Array(n).fill(1);
  const spots = Array.from({ length: n }, () => ({ x: 0, z: 0 }));
  let fleet: WindFleet | null = null;
  let builtFor = NaN;
  const rebuild = (rowSpacingD: number): WindFleet => {
    const old = fleet;
    const next = windFleet(
      // the field is a level pad: every turbine stands at FARM.y
      spots.map((s, i) => ({ at: [s.x, FARM.y, s.z] as [number, number, number], yaw: old?.turbines[i]!.yaw, phase: old?.turbines[i]!.phase })),
      { hubHeight: FARM.hubHeight, rotorDiameter: FARM.rotorDiameter, chunk: 2.2, accent: PLANT_TYPE.wind },
    );
    if (old) {
      group.remove(old.group);
      old.dispose();
    }
    group.add(next.group);
    builtFor = rowSpacingD;
    return (fleet = next);
  };
  return {
    group,
    count: n,
    speed,
    spot: (i) => spots[i]!,
    hub: (i, out = new Vector3()) => (fleet ? fleet.hubOf(i, out) : out.set(spots[i]!.x, FARM.y + FARM.hubHeight, spots[i]!.z)),
    // the lamp sits on the nacelle roof above the tower axis: it does not move when the nacelle yaws
    top: (i, out = new Vector3()) => out.set(spots[i]!.x, FARM.y + FARM.hubHeight + FARM.rotorDiameter * 0.045, spots[i]!.z),
    apply(result, rowSpacingD, windFromDeg) {
      const eC = ((FARM.rows - 1) / 2) * rowSpacingD * dReal;
      result.turbines.forEach((t, i) => {
        spots[i]!.x = FARM.x + (t.eastM - eC) / FARM.realPerToy;
        spots[i]!.z = FARM.z - (t.northM - nC) / FARM.realPerToy; // north = −Z
      });
      const f = fleet && rowSpacingD === builtFor ? fleet : rebuild(rowSpacingD);
      const yaw = yawInto(windFromDeg);
      // a steered turbine turns its rotor 20° off the wind; turning the rotor axis to the right of the flow
      // pushes the wake to the left — the side the model deflects it to (positive cross-wind coordinate)
      result.turbines.forEach((t, i) => (f.turbines[i]!.yaw = yaw - (t.yawDeg * Math.PI) / 180));
    },
    update(dt) {
      if (!fleet) return;
      for (let i = 0; i < n; i++) fleet.turbines[i]!.speed = speed[i]!;
      fleet.update(dt);
    },
  };
}
