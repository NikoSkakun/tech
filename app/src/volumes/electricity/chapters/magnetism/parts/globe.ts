/**
 * «Глобус-брелок» (step `magnet-field`): a little Earth floating over the table with its dipole field lines
 * (r = L·sin²θ in six meridian planes, axis tilted ≈ 11° from the spin axis). The magnetic south pole sits
 * near the geographic North — the lines enter there. Spins slowly; bobs.
 */
import { Group, Vector3 } from 'three';
import { Builder } from '@/kit';
import { createBLines } from './b-lines';

export interface Globe {
  group: Group;
  update(t: number): void;
}

export function createGlobe(r = 0.32): Globe {
  const g = new Group();
  g.name = 'globe';
  const spin = new Group();
  const b = new Builder('globe');
  b.sphere(r, { seg: 32, slot: 'gloss', c: ['blue.dark', 'sky'] });
  // continents: flattened blobs pressed onto the sphere
  const blobs: [number, number, number][] = [
    [0.5, 0.6, 0.55],
    [0.9, -0.4, 0.5],
    [2.6, 0.3, 0.6],
    [3.4, -0.2, 0.4],
    [4.6, 0.7, 0.45],
    [5.4, -0.6, 0.35],
  ];
  for (const [lon, lat, s] of blobs) {
    const d = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    b.sphere(r * 0.42 * s, { seg: 12, c: 'green', at: [d.x * r * 0.86, d.y * r * 0.86, d.z * r * 0.86], s: [1, 1, 1] });
  }
  b.sphere(r * 0.3, { seg: 12, c: 'white', at: [0, r * 0.86, 0] });
  b.sphere(r * 0.3, { seg: 12, c: 'white', at: [0, -r * 0.86, 0] });
  spin.add(b.build().group);
  // dipole lines: in each meridian plane r = L·sin²θ, for two shells
  const lines = createBLines(6 * 2 * 64, { width: 0.012, intensity: 1.2, dashSpeed: 0.18 });
  const set = [];
  for (let m = 0; m < 6; m++) {
    const phi = (m / 6) * Math.PI * 2;
    for (const L of [2.1, 3.2]) {
      const pts: Vector3[] = [];
      const th0 = Math.asin(Math.sqrt(1.05 / L));
      for (let k = 0; k <= 60; k++) {
        const th = th0 + ((Math.PI - 2 * th0) * k) / 60;
        const rr = r * L * Math.sin(th) ** 2;
        // field runs from the southern hemisphere (magnetic N) to the northern (magnetic S)
        const y = -rr * Math.cos(th);
        const h = rr * Math.sin(th);
        pts.push(new Vector3(h * Math.cos(phi), y, h * Math.sin(phi)));
      }
      set.push({ points: pts });
    }
  }
  lines.set(set);
  const field = new Group();
  field.add(lines.mesh);
  field.rotation.z = 0.19;
  g.add(spin, field);
  return {
    group: g,
    update(t) {
      spin.rotation.y = t * 0.25;
      field.rotation.y = t * 0.25;
      g.position.y = 1.5 + Math.sin(t * 0.9) * 0.05;
    },
  };
}
