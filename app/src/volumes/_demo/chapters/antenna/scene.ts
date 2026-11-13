/**
 * Demo scene: a copper rod (the antenna) with rings that grow and fade — the crests of the wave it radiates.
 * Step 2 adds a pulsing bright bead: a photon.
 */
import { CylinderGeometry, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { defineScene } from '@/engine/api';
import { K } from '@/style';

const RINGS = 5;
const PERIOD = 4; // seconds for a ring to travel from the rod to the rim
const REACH = 4.6;

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const disc = new Mesh(new CylinderGeometry(5.2, 5.4, 0.18, 72), K.toon({ color: 'bg.indigo', gloss: 0.2 }));
  disc.position.y = -1.3;
  disc.receiveShadow = true;
  const rod = new Mesh(new CylinderGeometry(0.07, 0.07, 2.4, 24), K.toon({ color: 'amber', gloss: 0.8 }));
  rod.castShadow = true;
  const torus = new TorusGeometry(1, 0.018, 10, 96);
  const rings = Array.from({ length: RINGS }, () => {
    const material = K.glow({ color: 'cyan', intensity: 1.4, falloff: 0 });
    material.transparent = true;
    const m = new Mesh(torus, material);
    m.rotation.x = Math.PI / 2;
    return m;
  });
  const photon = new Mesh(new SphereGeometry(0.16, 28, 18), K.glow({ color: 'yellow', intensity: 2.2, falloff: 2 }));
  photon.position.set(0.9, 1.5, 0);
  root.add(disc, rod, photon, ...rings);

  camera.shots({
    wide: { position: [0, 2.6, 9], target: [0, -0.2, 0] },
    photon: { position: [2.4, 2.2, 6.2], target: [0.5, 0.7, 0], focus: photon },
  });
  const glow = stage.param('glow', 1); // brightness of the rings
  stage.define({
    dipole: { show: [disc, rod, ...rings], camera: 'wide' },
    photon: { show: [disc, rod, ...rings, stage.actor(photon, { appear: 'fade' })], params: { glow: 1.6 }, camera: 'photon' },
  });

  return {
    update(_dt, t) {
      rings.forEach((ring, i) => {
        const phase = (t / PERIOD + i / RINGS) % 1; // 0 at the rod … 1 at the rim
        ring.scale.setScalar(0.15 + phase * REACH);
        ring.material.opacity = (1 - phase) * 0.9;
        ring.material.intensity = 1.4 * glow.value * (1 - phase);
      });
      photon.scale.setScalar(1 + 0.18 * Math.sin(t * 3));
    },
  };
});
