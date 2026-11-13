/**
 * The power transformer of step 4 (`tx.share`, so a later step may reuse it): built once in metres and shown at `POWER_SCALE` on the
 * studio disc (a 7 m tank becomes ≈ 3,9 units). `at(name)` turns an exterior anchor into a world-point getter for
 * callouts and hotspots; `point(x, y, z)` does the same for a model-space point in metres.
 */
import { Vector3 } from 'three';
import type { Tx } from '../chapter';
import { createPowerTransformer, type PowerTransformer } from '../parts/power-layers';

export const POWER_SCALE = 0.55;

export interface SharedPower extends PowerTransformer {
  at(name: string): () => Vector3;
  point(x: number, y: number, z: number): () => Vector3;
}

export function sharePower(tx: Tx): SharedPower {
  return tx.share('power', () => {
    const p = createPowerTransformer(tx.ctx);
    p.group.scale.setScalar(POWER_SCALE);
    tx.stageRoot.add(p.group);
    const point = (x: number, y: number, z: number): (() => Vector3) => {
      const out = new Vector3();
      return () => p.group.localToWorld(out.set(x, y, z));
    };
    return Object.assign(p, {
      point,
      at: (name: string): (() => Vector3) => {
        const local = p.anchor(name);
        return point(local.x, local.y, local.z);
      },
    });
  });
}
