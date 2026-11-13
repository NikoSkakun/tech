/**
 * A lamp on a small lamp-holder pedestal (kit `lamp` scaled up) with a halo whose size and brightness follow
 * the power. Origin = centre of the pedestal on the floor; `top` is the bulb's crown.
 */
import { Group, Mesh, Vector3 } from 'three';
import { createHalo, type Glow } from '@/fx';
import { G, lamp } from '@/kit';
import { K, type ColorLike } from '@/style';

export interface Bulb {
  group: Group;
  halo: Glow;
  /** Brightness 0…1 (filament glow + halo). */
  setPower(p: number): void;
  /** Local point of the bulb centre. */
  centre: Vector3;
  /** Local point where the supply wires enter the pedestal. */
  terminal: Vector3;
}

export function createBulb(o: { scale?: number; kind?: 'incandescent' | 'led'; halo?: ColorLike } = {}): Bulb {
  const s = o.scale ?? 11;
  const group = new Group();
  group.name = 'bulb';
  const pedestal = new Mesh(G.cyl(0.28, 0.32, { rTop: 0.22, seg: 32, bevel: 0.05 }), K.toon({ gradient: { bottom: 'ink', top: 'slate', range: [0, 0.32] }, rim: 0.6 }));
  pedestal.castShadow = true;
  const holder = new Mesh(G.cyl(0.16, 0.12, { seg: 24, bevel: 0.03 }), K.metal({ color: 'steel' }));
  holder.position.y = 0.32;
  const l = lamp(o.kind ?? 'incandescent');
  l.group.scale.setScalar(s);
  l.group.position.y = 0.4;
  const centre = new Vector3(0, 0.4 + 0.075 * s, 0);
  const halo = createHalo({ color: o.halo ?? 'yellow', size: 1.6, intensity: 0 });
  halo.position.copy(centre);
  group.add(pedestal, holder, l.group, halo);
  return {
    group,
    halo,
    centre,
    terminal: new Vector3(0, 0.16, 0),
    setPower(p: number) {
      const k = Math.max(0, Math.min(1, p));
      l.setPower(k);
      halo.intensity = 1.25 * k;
      halo.size = 0.6 + 1.4 * k;
    },
  };
}
