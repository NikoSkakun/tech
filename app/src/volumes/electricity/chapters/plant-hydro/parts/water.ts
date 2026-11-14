/**
 * The reservoir surface: one `K.water` ellipse laid flat over the carved basin. Its height is the reservoir
 * level (`setLevel`): the valley walls cut the shoreline, so a lower level exposes the banks. The ellipse ends
 * inside the dam body and under the mountains, so its rim is never seen. The tailwater, river and bay are the
 * island's own sea (`ISLAND.seaLevel`).
 */
import { CircleGeometry, Mesh } from 'three';
import { K } from '@/style';
import { RESERVOIR } from '../layout';

export interface Reservoir {
  mesh: Mesh;
  setLevel(y: number): void;
}

export function buildReservoir(): Reservoir {
  const mesh = new Mesh(
    new CircleGeometry(1, 96),
    K.water({ shallow: 'sky', deep: 'blue', shape: 'disc', scale: 22, glints: 0.7, followLook: true }),
  );
  mesh.name = 'reservoir';
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(RESERVOIR.ax, RESERVOIR.az, 1);
  mesh.position.set(RESERVOIR.cx, RESERVOIR.npr, RESERVOIR.cz);
  mesh.receiveShadow = true;
  return {
    mesh,
    setLevel(y: number) {
      mesh.position.y = y;
    },
  };
}
