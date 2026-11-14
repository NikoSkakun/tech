/**
 * The studio stand: a floating rounded plinth south of the island (kit `Builder`), the stage for the cutaway
 * rigs of steps 3–6 and 8. A soft rim light strip and a few rocks underneath make it read as a piece of the
 * same world. Rigs are added to `top` (origin = centre of the top surface) and shown per step as actors.
 */
import { Group, Vector3 } from 'three';
import { Builder } from '@/kit';
import { STAND } from '../layout';

export interface Stand {
  group: Group;
  /** Rigs go here: origin at the centre of the stand's top surface. */
  top: Group;
  centre: Vector3;
}

export function buildStand(): Stand {
  const b = new Builder('stand');
  const r = STAND.r;
  b.lathe(
    [
      [0.01, -26],
      [r * 0.35, -24],
      [r * 0.8, -12],
      [r, -3],
      [r, 0],
      [0.01, 0],
    ],
    { seg: 72, c: ['bg.indigo', 'bg.violet'], slot: 'matte' },
  );
  b.cyl(r + 0.6, 0.8, { seg: 72, c: 'blue', at: [0, -1.4, 0] });
  b.cyl(r - 0.4, 0.3, { seg: 72, c: ['slate', 'steel'], slot: 'matte', at: [0, -0.1, 0] });
  // a soft inner disc: the rigs stand on a slightly lighter spot, the rim recedes
  b.cyl(r * 0.62, 0.32, { seg: 72, c: ['steel', 'steel.light'], slot: 'matte', at: [0, 0, 0] });
  for (const [a, rr, h] of [
    [0.4, 9, -30],
    [2.3, 6, -27],
    [4.1, 7, -32],
  ] as const)
    b.sphere(rr, { c: 'slate', slot: 'facet', at: [Math.cos(a) * r * 0.3, h, Math.sin(a) * r * 0.3] });
  const model = b.build();
  const group = new Group();
  group.name = 'stand';
  group.add(model.group);
  const top = new Group();
  top.position.y = 0.2;
  group.add(top);
  group.position.set(STAND.x, STAND.y, STAND.z);
  return { group, top, centre: new Vector3(STAND.x, STAND.y, STAND.z) };
}
