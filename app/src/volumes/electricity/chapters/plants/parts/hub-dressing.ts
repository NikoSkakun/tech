/**
 * Dressing of the hub island: trees and grass around the hall, and the output of the machine hall — three phase
 * busbars L1 / L2 / L3 (yellow / green / red) from the generator terminals to a small step-up transformer, and
 * the transformer's line up to the world ring. Kit + fx only.
 */
import { Vector3, type Group } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createBundle, createWire, curveThrough, type Bundle, type Wire } from '@/fx';
import { forest, groundCover, powerTransformer, type Island, type KitModel, type TurboSet } from '@/kit';
import { HALL, RING } from '../layout';

export const TRAFO = { x: 36, z: -16 } as const;

export interface HubDressing {
  alive: KitModel[];
  busbars: Bundle;
  uplink: Wire;
}

export function dressHub(ctx: ChapterContext, root: Group, hub: Island, turbo: TurboSet, turboGroup: Group): HubDressing {
  const rng = ctx.random.fork('hub');
  const avoid: [number, number, number][] = [
    [HALL.x, HALL.z, HALL.length / 2 + 6],
    [HALL.x - 14, HALL.z, 16],
    [HALL.x + 14, HALL.z, 16],
    [TRAFO.x, TRAFO.z, 10],
    [0, 24, 14],
    [0, 38, 16],
    [-12, 40, 10],
    [12, 40, 10],
  ];
  const alive: KitModel[] = [
    forest({ count: ctx.quality.count(34, 18), ground: hub, rng, avoid, clump: 0.6, kinds: ['round', 'oak', 'poplar', 'birch', 'bush'] }),
    groundCover({ kind: 'grass', ground: hub, rng, count: ctx.quality.count(120, 60), avoid }),
    groundCover({ kind: 'flowers', ground: hub, rng, count: ctx.quality.count(60, 30), avoid }),
  ];
  for (const m of alive) hub.group.add(m.group);

  const trafo = powerTransformer({ hv: 330, lv: 20 });
  trafo.group.position.set(TRAFO.x, hub.heightAt(TRAFO.x, TRAFO.z), TRAFO.z);
  trafo.group.rotation.y = -Math.PI / 2;
  root.add(trafo.group);
  root.updateMatrixWorld(true);
  turboGroup.updateMatrixWorld(true);
  const from = ['gen.u', 'gen.v', 'gen.w'].map((n) => turbo.anchorWorld(n).setY(1.4));
  const to = ['lv1', 'lv2', 'lv3'].map((n) => trafo.anchorWorld(n));
  const busbars = createBundle(from, to, { sag: 0.4, radius: 0.22, repeat: 0.25, speed: 6 });
  root.add(busbars);
  const hv = trafo.anchorWorld('hv2');
  const ringAt = new Vector3(hv.x, 0, hv.z).normalize().multiplyScalar(RING.radius).setY(RING.y);
  const uplink = createWire(curveThrough([hv, hv.clone().lerp(ringAt, 0.5).add(new Vector3(0, 6, 0)), ringAt]), {
    radius: 0.36,
    color: 'ink',
    repeat: 0.08,
    speed: 16,
    detail: 0.35,
    castShadow: false,
  });
  root.add(uplink);
  return { alive: [...alive, trafo], busbars, uplink };
}
