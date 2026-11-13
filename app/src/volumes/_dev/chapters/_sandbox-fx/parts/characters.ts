/**
 * Stand 1 — the particle characters: heroes in a row, a nucleus cluster, an electron gas and photons of
 * three wavelengths.
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  createElectron,
  createGas,
  createGluons,
  createHole,
  createIon,
  createNeutron,
  createOrbs,
  createPhotons,
  createProton,
  createQuark,
  createTrail,
} from '@/fx';
import { content } from '../content';
import type { Exhibit } from './exhibit';
import { createLabel } from './label';

export function createCharactersExhibit(ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:characters';
  const L = content.labels;
  const y = 2.55;

  const electron = createElectron({ radius: 0.42 });
  electron.position.set(-4.6, y, 0);
  const proton = createProton({ radius: 0.52 });
  proton.position.set(-2.85, y, 0);
  const neutron = createNeutron({ radius: 0.52 });
  neutron.position.set(-1.35, y, 0);
  const ion = createIon({ radius: 0.46 });
  ion.position.set(0.1, y, 0);
  const up = createQuark('up', { radius: 0.3 });
  const down = createQuark('down', { radius: 0.3 });
  const gluon = createGluons({ count: 1, amplitude: 0.13, width: 0.045, restLength: 1.2, turns: 6 });
  const hole = createHole({ radius: 0.38 });
  hole.position.set(4.7, y, 0);
  group.add(electron, proton, neutron, ion, gluon, up, down, hole);

  const label = (text: string, x: number, color: Parameters<typeof createLabel>[1]['color']): void => {
    const l = createLabel(text, { offset: [0, -0.5, 0], color, size: 17, anchor: 'center' });
    l.position.set(x, y - 0.62, 0);
    group.add(l);
  };
  label(L.electron, -4.6, 'cyan');
  label(L.proton, -2.85, 'coral');
  label(L.neutron, -1.35, 'mist');
  label(L.ion, 0.1, 'lime');
  label(L.quarks, 2.45, 'amber');
  label(L.hole, 4.7, 'coral');

  // nucleus: tightly packed protons + neutrons (impostors intersect like real spheres)
  const rng = ctx.random.fork('nucleus');
  const n = 16;
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) pts.push(new Vector3(...rng.onSphere()).multiplyScalar(rng.range(0.1, 0.6)));
  const push = new Vector3();
  const R = 0.27;
  for (let iter = 0; iter < 140; iter++) {
    for (let i = 0; i < n; i++) {
      pts[i]!.multiplyScalar(0.985);
      for (let j = i + 1; j < n; j++) {
        push.subVectors(pts[i]!, pts[j]!);
        const d = push.length() || 1e-3;
        const overlap = R * 1.86 - d;
        if (overlap > 0) {
          push.multiplyScalar((overlap * 0.5) / d);
          pts[i]!.add(push);
          pts[j]!.sub(push);
        }
      }
    }
  }
  const nucleus = new Group();
  nucleus.position.set(0.4, 0.95, 0);
  const protons = createOrbs({ kind: 'proton', count: n / 2, radius: R });
  const neutrons = createOrbs({ kind: 'neutron', count: n / 2, radius: R });
  pts.forEach((p, i) => (i % 2 === 0 ? protons : neutrons).setPosition(i >> 1, p.x, p.y, p.z));
  protons.commit();
  neutrons.commit();
  nucleus.add(protons, neutrons);
  group.add(nucleus);
  const nucleusLabel = createLabel(L.nucleus, { offset: [0, -0.4, 0], color: 'white', size: 17, anchor: 'center' });
  nucleusLabel.position.set(0.4, 0.2, 0);
  group.add(nucleusLabel);

  // electron gas in a box
  const gas = createGas(ctx, { kind: 'electron', count: 90, radius: 0.07, box: [2.6, 1.3, 1.3], drift: [0.35, 0, 0] });
  gas.position.set(3.6, 0.95, 0);
  group.add(gas);
  const gasLabel = createLabel(L.gas, { offset: [0, -0.4, 0], color: 'cyan', size: 17, anchor: 'center' });
  gasLabel.position.set(3.6, 0.2, 0);
  group.add(gasLabel);

  // photons of three wavelengths flying to the right
  const colours = [450, 550, 650];
  const photons = colours.map((nm, i) => {
    const p = createPhotons({ count: 2, wavelength: nm, travel: 4.2, speed: 1.5, length: 1.5, amplitude: 0.12 });
    p.setPhoton(0, [-5.6, 1.3 - i * 0.42, 0], [1, 0, 0], i * 0.21);
    p.setPhoton(1, [-5.6, 1.3 - i * 0.42, 0], [1, 0, 0], i * 0.21 + 0.5);
    p.commit();
    group.add(p);
    return p;
  });
  void photons;
  const photonLabel = createLabel(L.photon, { offset: [0, -0.4, 0], color: 'yellow', size: 17, anchor: 'center' });
  photonLabel.position.set(-3.5, 0.1, 0);
  group.add(photonLabel);

  // a small electron circling the hero proton, with a fading trail
  const satellite = createOrbs({ kind: 'electron', radius: 0.09 });
  group.add(satellite, createTrail(satellite, { duration: 0.9, width: 0.035 }));

  const a = new Vector3();
  const b = new Vector3();
  return {
    group,
    update(_dt, t) {
      // heroes bob gently; quarks orbit each other so the gluon spring stretches and relaxes
      electron.position.y = y + Math.sin(t * 1.7) * 0.06;
      proton.position.y = y + Math.sin(t * 1.3 + 1) * 0.04;
      neutron.position.y = y + Math.sin(t * 1.2 + 2) * 0.04;
      ion.position.y = y + Math.sin(t * 1.5 + 3) * 0.05;
      hole.position.y = y + Math.sin(t * 1.6 + 4) * 0.05;
      const sep = 0.62 + 0.2 * Math.sin(t * 1.4);
      const tilt = 0.35 * Math.sin(t * 0.8);
      a.set(2.45 - sep * Math.cos(tilt), y - sep * Math.sin(tilt), 0);
      b.set(2.45 + sep * Math.cos(tilt), y + sep * Math.sin(tilt), 0);
      up.position.copy(a);
      down.position.copy(b);
      gluon.setEnds(0, [a.x, a.y, a.z], [b.x, b.y, b.z]);
      gluon.commit();
      satellite.position.set(-2.85 + Math.cos(t * 2.2) * 0.85, y + Math.sin(t * 2.2) * 0.32, Math.sin(t * 2.2) * 0.6);
      nucleus.rotation.y = t * 0.25;
      nucleus.rotation.x = Math.sin(t * 0.17) * 0.3;
    },
  };
}
