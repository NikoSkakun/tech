/**
 * A voltmeter probe of step 4: a needle standing on the landscape (tip at the group origin) with a round
 * coloured head (`red` for A, `ink` for B, as on a real multimeter), an invisible pick sphere and a `green`
 * ping that flashes when both probes sit on the same equipotential line.
 */
import { type Group, Mesh, SphereGeometry } from 'three';
import { createPulseRings } from '@/fx';
import { Builder } from '@/kit';
import { K, type ColorToken } from '@/style';

export interface Needle {
  group: Group;
  handle: Mesh;
  /** Position on the table, metres. */
  x: number;
  z: number;
  hover: number;
  /** 0…1 brightness of the green "same iso-line" ping. */
  flash: number;
  update(): void;
}

export function createNeedle(color: ColorToken, x: number, z: number): Needle {
  const b = new Builder('needle');
  b.cone(0.07, 0.5, { seg: 14, slot: 'metal', c: 'steel.light', at: [0, 0.5, 0], rot: [Math.PI, 0, 0] });
  b.cyl(0.035, 0.75, { seg: 10, slot: 'metal', c: 'steel.light', at: [0, 0.45, 0] });
  b.sphere(0.24, { seg: 22, slot: 'gloss', c: color, at: [0, 1.32, 0] });
  b.ring(0.25, 0.035, { seg: 28, slot: 'metal', c: 'white', at: [0, 1.32, 0] });
  const group = b.build().group;
  group.name = 'voltmeter-needle';
  const handle = new Mesh(new SphereGeometry(0.62, 12, 8), K.flat('cyan'));
  handle.material.colorWrite = false;
  handle.material.depthWrite = false;
  handle.position.y = 1.0;
  const ping = createPulseRings({ color: 'green', size: 1.5, amount: 2, intensity: 0, billboard: false });
  ping.rotation.x = -Math.PI / 2;
  ping.position.y = 0.05;
  group.add(handle, ping);
  const needle: Needle = {
    group,
    handle,
    x,
    z,
    hover: 0,
    flash: 0,
    update() {
      ping.intensity = 1.6 * needle.flash;
      ping.visible = needle.flash > 0.02;
      group.scale.setScalar(1 + 0.12 * needle.hover);
    },
  };
  return needle;
}
