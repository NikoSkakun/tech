/**
 * Step 4 side exhibits: the lithium atom (3 p⁺, 4 n⁰, two inner electrons and one valence electron that
 * leaves easily) and a piece of lithium metal floating on oil (density 0,534 g/cm³).
 */
import {
  CylinderGeometry,
  DodecahedronGeometry,
  type Group,
  Mesh,
  TorusGeometry,
  type Object3D,
} from 'three';
import { createOrbs } from '@/fx';
import { K } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

export interface LithiumAtom {
  group: Group;
  /** The valence electron (callout anchor). */
  valence: Object3D;
  update(t: number): void;
}

export function createLithiumAtom(): LithiumAtom {
  const g = group('li-atom');
  const protons = createOrbs({ kind: 'proton', count: 3, radius: 0.14 });
  const neutrons = createOrbs({ kind: 'neutron', count: 4, radius: 0.14 });
  // a compact cluster: protons on a triangle, neutrons around and behind
  [
    [0.13, 0.05, 0.08],
    [-0.12, 0.08, 0.06],
    [0, -0.14, 0.1],
  ].forEach((p, i) => protons.setPosition(i, p[0]!, p[1]!, p[2]!));
  [
    [0, 0.02, -0.12],
    [0.14, -0.12, -0.04],
    [-0.15, -0.1, -0.03],
    [0.02, 0.17, -0.02],
  ].forEach((p, i) => neutrons.setPosition(i, p[0]!, p[1]!, p[2]!));
  protons.commit();
  neutrons.commit();
  const inner = createOrbs({ kind: 'electron', count: 2, radius: 0.075 });
  const valence = createOrbs({ kind: 'electron', count: 1, radius: 0.09 });
  const orbit = (r: number, opacity: number): Mesh => {
    const ring = new Mesh(
      new TorusGeometry(r, 0.008, 6, 96),
      K.glow({ color: 'cyan', intensity: 1.1, opacity, falloff: 0 }),
    );
    ring.rotation.x = Math.PI / 2 - 0.35;
    return ring;
  };
  g.add(protons, neutrons, inner, valence, orbit(0.5, 0.5), orbit(1.05, 0.3));
  return {
    group: g,
    valence,
    update(t) {
      const tilt = 0.35;
      for (let k = 0; k < 2; k++) {
        const a = t * 2.4 + k * Math.PI;
        inner.setPosition(
          k,
          Math.cos(a) * 0.5,
          Math.sin(a) * 0.5 * Math.sin(tilt),
          Math.sin(a) * 0.5 * Math.cos(tilt),
        );
      }
      inner.commit();
      // the lone 2s electron: every few turns it wanders off (Li → Li⁺ + e⁻) and comes back
      const a = t * 1.1;
      const away = Math.max(0, Math.sin(t * 0.45)) ** 6;
      const r = 1.05 + away * 0.9;
      valence.position.set(
        Math.cos(a) * r,
        Math.sin(a) * r * Math.sin(tilt) + away * 0.25,
        Math.sin(a) * r * Math.cos(tilt),
      );
    },
  };
}

/** A glass jar of oil with a silvery chunk of lithium bobbing on the surface. Origin: centre of the base. */
export function createLithiumJar(mats: Mats): { group: Group; chunk: Mesh; update(t: number): void } {
  const g = group('li-jar');
  const jar = new Mesh(new CylinderGeometry(0.5, 0.5, 1.0, 40, 1, true), mats.glass);
  jar.position.y = 0.52;
  jar.renderOrder = 4;
  const oil = new Mesh(
    new CylinderGeometry(0.46, 0.46, 0.62, 40),
    K.glass({ color: 'amber', opacity: 0.42, edgeOpacity: 0.6 }),
  );
  oil.position.y = 0.34;
  oil.renderOrder = 2;
  const chunk = mesh(
    new DodecahedronGeometry(0.17, 0),
    K.metal({ color: 'mist', specular: 0.9, flatShading: true }),
    0.05,
    0.66,
    0,
  );
  g.add(mesh(new CylinderGeometry(0.53, 0.55, 0.05, 40), mats.light, 0, 0.025, 0), oil, chunk, jar);
  g.add(mesh(new CylinderGeometry(0.52, 0.52, 0.08, 40), mats.dark, 0, 1.06, 0));
  return {
    group: g,
    chunk,
    update(t) {
      chunk.position.y = 0.67 + Math.sin(t * 1.3) * 0.02;
      chunk.rotation.set(Math.sin(t * 0.7) * 0.2, t * 0.3, Math.cos(t * 0.9) * 0.15);
    },
  };
}
