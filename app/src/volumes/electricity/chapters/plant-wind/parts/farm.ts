/**
 * Onshore farm of step 8: 4 × 4 small turbines (instanced `Fleet`) on the field. Their layout is the
 * simulation's layout (`simulateFarm`: rows along east, 5 D inside a row) mapped to toy metres at
 * `FARM.layoutD` per rotor diameter; the turbines themselves are drawn `FARM.enlarged`× larger (map symbols).
 */
import type { FarmResult } from '@electricity/sim/plant-wind';
import { FARM, yawInto } from '../layout';
import { Fleet } from './fleet';
import type { World } from './world';

export interface Farm {
  fleet: Fleet;
  /** Rotor speed of each turbine, rad/s (set by the farm binding from the wake model). */
  speed: Float32Array;
  /** Lay the turbines out from a simulation result (positions, yaw into the wind ± steering). */
  apply(result: FarmResult, rowSpacingD: number, windFromDeg: number): void;
  /** World x, z of turbine `i`. */
  spot(i: number): { x: number; z: number };
  update(dt: number): void;
}

export function buildFarm(world: World): Farm {
  const n = FARM.rows * FARM.perRow;
  const fleet = new Fleet({ count: n, hubHeight: FARM.hubHeight, rotorDiameter: FARM.rotorDiameter, chunk: 2.2 });
  world.island.group.add(fleet.group);
  const speed = new Float32Array(n).fill(1);
  const spots = Array.from({ length: n }, () => ({ x: 0, z: 0 }));
  const dReal = FARM.layoutD * FARM.realPerToy;
  return {
    fleet,
    speed,
    spot: (i) => spots[i]!,
    apply(result, rowSpacingD, windFromDeg) {
      const eC = ((FARM.rows - 1) / 2) * rowSpacingD * dReal;
      const nC = ((FARM.perRow - 1) / 2) * FARM.inRowSpacingD * dReal;
      const yaw = yawInto(windFromDeg);
      result.turbines.forEach((t, i) => {
        const x = FARM.x + (t.eastM - eC) / FARM.realPerToy;
        const z = FARM.z - (t.northM - nC) / FARM.realPerToy; // north = −Z
        spots[i]!.x = x;
        spots[i]!.z = z;
        // a steered turbine turns its rotor 20° off the wind; turning the rotor axis to the right of the flow
        // pushes the wake to the left — the side the model deflects it to (positive cross-wind coordinate)
        fleet.place(i, x, world.y(x, z), z, yaw - (t.yawDeg * Math.PI) / 180);
      });
      fleet.commit();
    },
    update(dt) {
      for (let i = 0; i < n; i++) fleet.angle[i] = fleet.angle[i]! + speed[i]! * dt;
      fleet.commit();
    },
  };
}
