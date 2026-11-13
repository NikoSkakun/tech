/**
 * TEMPLATE — chapter scene (lazy chunk). Build objects once, describe every step declaratively with
 * `ctx.stage`, animate in `update`. Nothing here needs manual disposal: everything under `ctx.root`,
 * every tween from `ctx.tweens` and every `ctx.input` registration is released when the chapter is left.
 */
import { Mesh, SphereGeometry } from 'three';
import { defineScene, toOverlay } from '@/engine/api';
import { K, SEMANTIC } from '@/style';
import { Text3D } from '@/text';
import { content } from './content';

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;

  // 1. Build. Colours come from palette tokens / the semantic map, materials from the K family.
  const sphere = new SphereGeometry(0.5, 48, 32);
  const electron = new Mesh(sphere, K.glow({ color: SEMANTIC.electron, intensity: 1.9, falloff: 2 }));
  const proton = new Mesh(sphere, K.toon({ color: SEMANTIC.proton, gloss: 0.6 }));
  proton.castShadow = true;
  electron.position.set(-1.6, 0, 0);
  proton.position.set(1.6, 0, 0);
  root.add(electron, proton);

  // World-anchored labels live on the overlay layer: always sharp, never hidden by geometry.
  const label = (text: string, target: Mesh): Text3D => {
    const t = new Text3D(text, {
      size: 20,
      anchorX: 'center',
      billboard: true,
      screenSpace: true,
      accent: 'cyan',
    });
    t.position.set(0, 0.95, 0);
    target.add(t);
    return toOverlay(t);
  };
  const electronLabel = label(content.labels.electron, electron);
  const protonLabel = label(content.labels.proton, proton);

  // 2. Shots: where the camera rests in each step (the user may orbit around them within limits).
  //    `fit` = what must stay in frame on any screen: phones re-frame from it (docs/MOBILE.md §4 d).
  camera.shots({
    single: { position: [-1.6, 0.6, 5], target: [-1.6, 0, 0], focus: electron, fit: { center: [-1.6, 0, 0], radius: 0.8 } },
    both: { position: [0, 1.2, 8.5], target: [0, 0, 0], fit: { center: [0, 0, 0], radius: 2.3 } },
  });

  // 3. Steps: the complete target state of each one. Whatever a step does not list goes back to its default
  //    (actors hidden, params at their initial value), so any step can be entered from anywhere.
  const pull = stage.param('pull', 0); // 0 = apart, 1 = attracted
  stage.define({
    intro: { show: [electron, stage.actor(electronLabel, { appear: 'fade' })], camera: 'single' },
    pair: {
      show: [electron, proton, electronLabel, stage.actor(protonLabel, { appear: 'fade' })],
      params: { pull: 1 },
      camera: 'both',
      post: { bloomIntensity: 1.3 },
    },
  });

  // 4. Interaction: hover feedback + click. Registrations are removed automatically with the chapter.
  const hover = { glow: 0 };
  ctx.input.register(electron, {
    tooltip: 'Electron — електрон',
    hover: (over) => ctx.tweens.to(hover, { glow: over ? 1 : 0 }, { duration: 0.12 }),
    click: () => void ctx.nav.next(),
  });

  // 5. Per-frame animation on the engine clock (never Date.now / setTimeout).
  return {
    update(_dt, t) {
      const gap = 1.6 - 0.55 * pull.value;
      electron.position.set(-gap, Math.sin(t * 1.6) * 0.08, 0);
      proton.position.set(gap, Math.sin(t * 1.6 + 1) * 0.05, 0);
      electron.material.intensity = 1.9 + hover.glow * 1.2;
    },
  };
});
