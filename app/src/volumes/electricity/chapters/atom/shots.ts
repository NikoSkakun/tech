/**
 * Every camera shot of the chapter, in one place. The chapter's unit scale: the subject of a step has a radius
 * of about 6 world units around the origin (`ctx.env.setScale(6)`), whatever its physical size.
 *
 * Each shot declares `fit` — the sphere that must stay in frame on any aspect ratio (DECISIONS §57 d): the
 * step's subject *and* the scene props a learner has to see to follow the step (a card, a balance, a wall),
 * but not set dressing. The director ignores it today; the mobile reframing reads it.
 */
import type { Shot } from '@/engine/api';

export const SHOTS = {
  /** dive-in: wire on its workbench → cut face → grains → lattice → atom, all scaled about the origin. */
  dive: {
    position: [0, 0.9, 16.5],
    target: [0, 0, 0],
    fov: 32,
    orbit: { azimuth: 0.35, polar: 0.2, zoom: [0.8, 1.25] },
    fit: { center: [0, 0, 0], radius: 5.6 },
  },
  /** anatomy: the copper atom, the mass tube on its right, the size analogy lower left. */
  anatomy: {
    position: [0.6, 1.2, 18.5],
    target: [0.6, -0.4, 0],
    frameAspect: 1.3,
    orbit: { azimuth: 0.5, polar: 0.3 },
    fit: { center: [0.9, -0.3, 0], radius: 6.8 },
  },
  /** nucleus: the cluster left of centre, free space on the right to pull the proton past 4,45 fm. */
  nucleus: {
    position: [0.4, 0.9, 17.5],
    target: [0.4, 0.1, 0],
    frameAspect: 1.25,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [0.2, 0.3, 0], radius: 5.8 },
  },
  /** quarks: the glass nucleon and the mass tube on its right. */
  quarks: {
    position: [1.2, 0.8, 19.5],
    target: [1.2, 0, 0],
    frameAspect: 1.3,
    orbit: { azimuth: 0.3, polar: 0.2 },
    fit: { center: [1.2, 0, 0], radius: 6.2 },
  },
  /** electron: the hero electron on the left, the balance on the right. */
  electron: {
    position: [0, 0.9, 17],
    target: [0, -0.5, 0],
    frameAspect: 1.45,
    orbit: { azimuth: 0.35, polar: 0.2 },
    fit: { center: [0, -0.4, 0], radius: 6.6 },
  },
  /** models: hydrogen (Bohr orbits up to n = 3 / the cloud) and the level diagram on the right. */
  models: {
    position: [1.3, 2.4, 19.5],
    target: [1.3, 0, 0],
    frameAspect: 1.45,
    orbit: { azimuth: 0.6, polar: 0.35 },
    fit: { center: [1.3, 0, 0], radius: 7 },
  },
  /** shells: the periodic wall above, the shell atom (or the group-11 trio) below it. */
  shells: {
    position: [0.4, 0.4, 20.5],
    target: [0.4, -0.1, 0],
    frameAspect: 1.45,
    orbit: { azimuth: 0.25, polar: 0.15 },
    fit: { center: [0.4, 0, 0], radius: 8 },
  },
  /** ions-photons: level diagram, hydrogen atom, photon gun, the spectrum strip below. */
  photons: {
    position: [-0.5, 0.4, 21],
    target: [-0.5, -0.9, 0],
    frameAspect: 1.5,
    orbit: { azimuth: 0.25, polar: 0.15 },
    fit: { center: [-0.5, -0.6, 0], radius: 8 },
  },
  /** atom-builder: the atom being built above the three baskets. */
  builder: {
    position: [0.7, 0.8, 21],
    target: [0.7, -1.1, 0],
    frameAspect: 1.5,
    orbit: { azimuth: 0.3, polar: 0.15 },
    fit: { center: [0.7, -0.9, 0], radius: 7 },
  },
  /** standard-model: the wall of 17 tokens and the four interaction channels beside it. */
  'standard-model': {
    position: [1.2, 0.2, 21.5],
    target: [1.2, 0, 0],
    frameAspect: 1.5,
    orbit: { azimuth: 0.3, polar: 0.15 },
    fit: { center: [1.2, 0, 0], radius: 8 },
  },
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;
