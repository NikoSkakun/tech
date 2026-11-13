/**
 * CableEnd — where the hero wire comes from: the cut end of an ordinary flat three-core installation cable
 * (3 × 1,5 mm² — the kind that runs inside the walls of every home; chapter document, step 1, page 1).
 *
 * Built in the local space of `copper-wire.ts`: the hero core runs along −Z from the origin, so this model
 * only adds what surrounds it — the ribbed grey sheath the three cores leave, and the two neighbours, line
 * (brown) and protective earth (green-yellow rings, the kit's convention), cut short, fanned out and stripped
 * to a bare copper tip. Proportions follow the hero core (insulated ⌀ 1,52 units ≈ 2,5 mm).
 */
import { Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { SEMANTIC, col } from '@/style';

/** Outer radius of one insulated core (= the hero wire's insulation) and the bare copper inside it. */
const CORE = 0.76;
const COPPER = 0.42;
/** Centre distance of neighbouring cores inside the sheath. */
const PITCH = 1.62;
/** Where the sheath has been cut back to, and where it leaves the picture. */
const MOUTH_Z = -10.6;
const FAR_Z = -26;
/** Length of the green or yellow ring on the earth core. */
const RING = 0.95;

export function createCableEnd(): KitModel {
  const b = new Builder('cable-end');

  // sheath: three merged tubes — the ribbed profile of a flat cable — with a darker lip at the cut
  for (const y of [-PITCH, 0, PITCH]) {
    b.tube([new Vector3(0, y, MOUTH_Z), new Vector3(0, y, FAR_Z)], 1.04, {
      seg: 28,
      slot: 'gloss',
      c: ['steel', 'mist'],
    });
    b.cyl(0.9, 0.06, { axis: 'z', seg: 24, slot: 'matte', c: 'steel', at: [0, y, MOUTH_Z + 0.03], bevel: 0 });
  }

  // the two neighbours: out of the sheath, bent away from the hero core, stripped at the end
  const neighbour = (side: 1 | -1, lean: number, length: number, tint: 'l' | 'pe'): void => {
    const y = side * PITCH;
    const path = G.roundPath(
      [
        new Vector3(0, y, MOUTH_Z - 0.4),
        new Vector3(0, y, MOUTH_Z + 1.3),
        new Vector3(lean * 0.55, y + side * 0.9, MOUTH_Z + 1.3 + length * 0.5),
        new Vector3(lean, y + side * 1.25, MOUTH_Z + 1.3 + length),
      ],
      1.6,
      8,
    );
    const start = path[0]!;
    b.tube(path, CORE, {
      seg: 20,
      slot: 'gloss',
      c:
        tint === 'l'
          ? SEMANTIC.wireL
          : (p, _n, out) =>
              out.copy(
                col(Math.floor(p.distanceTo(start) / RING) % 2 ? SEMANTIC.wirePEStripe : SEMANTIC.wirePE),
              ),
    });
    const end = path[path.length - 1]!;
    const dir = end
      .clone()
      .sub(path[path.length - 2]!)
      .normalize();
    b.tube([end.clone().addScaledVector(dir, -0.05), end.clone().addScaledVector(dir, 1.05)], COPPER, {
      seg: 20,
      slot: 'metal',
      c: ['orange.dark', 'amber'],
    });
    b.anchor(tint, end.x + dir.x, end.y + dir.y, end.z + dir.z);
  };
  neighbour(1, 1.1, 3.9, 'l');
  neighbour(-1, -0.7, 3.1, 'pe');

  return b.build();
}
