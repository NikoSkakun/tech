/**
 * Demo scene: a row of beads that move only up and down and together draw a travelling wave
 * `y = A·sin(k·x − ω·t)`. Step 2 doubles the frequency (and halves the wavelength).
 */
import { CylinderGeometry, Mesh, SphereGeometry } from 'three';
import { defineScene } from '@/engine/api';
import { K } from '@/style';

const COUNT = 21;
const SPACING = 0.42;

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const disc = new Mesh(new CylinderGeometry(5.2, 5.4, 0.18, 72), K.toon({ color: 'bg.indigo', gloss: 0.2 }));
  disc.position.y = -1.3;
  disc.receiveShadow = true;
  const bead = new SphereGeometry(0.15, 28, 18);
  const beads = Array.from({ length: COUNT }, (_, i) => {
    // the middle bead is highlighted: it shows that matter stays where it is
    const marked = i === (COUNT - 1) / 2;
    const m = new Mesh(
      bead,
      marked ? K.glow({ color: 'cyan', intensity: 1.8, falloff: 2 }) : K.toon({ color: 'violet', gloss: 0.6 }),
    );
    m.position.x = (i - (COUNT - 1) / 2) * SPACING;
    m.castShadow = true;
    return m;
  });
  root.add(disc, ...beads);

  camera.shots({
    wide: { position: [0, 1.4, 9.5], target: [0, -0.1, 0] },
    close: { position: [1.2, 0.9, 6.4], target: [0.4, -0.1, 0] },
  });
  // wave number multiplier: 1 = the slow long wave of step 1, 2 = twice the frequency, half the wavelength
  const pitch = stage.param('pitch', 1);
  stage.define({
    oscillation: { show: [disc, ...beads], camera: 'wide' },
    spectrum: { show: [disc, ...beads], params: { pitch: 2 }, camera: 'close' },
  });

  return {
    update(_dt, t) {
      const k = 0.9 * pitch.value; // rad per unit length
      const omega = Math.PI * pitch.value; // rad/s → 0,5 Hz at pitch 1
      for (const m of beads) m.position.y = 0.55 * Math.sin(k * m.position.x - omega * t);
    },
  };
});
