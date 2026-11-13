/**
 * Stand 4 — coil and magnet: a copper coil whose magnetic field B is drawn as closed flowing lines, a bar
 * magnet sliding in and out, the flux through the coil's mouth (⊙ / ⊗) and induced current pulses whose
 * brightness and direction follow dΦ/dt.
 */
import { BoxGeometry, Curve, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  barMagnetField,
  createArrowField,
  createFieldLines,
  createFluxSurface,
  createWire,
  gridPoints,
  seedsOnLine,
} from '@/fx';
import { K, SEMANTIC } from '@/style';
import type { Exhibit } from './exhibit';

/** Helix along X: `turns` turns of radius `r` over `length`, with straight leads at both ends. */
class Helix extends Curve<Vector3> {
  constructor(
    private readonly r: number,
    private readonly length: number,
    private readonly turns: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * this.turns * Math.PI * 2;
    return target.set((t - 0.5) * this.length, Math.cos(a) * this.r, Math.sin(a) * this.r);
  }
}

export function createInductionExhibit(_ctx: ChapterContext): Exhibit {
  const group = new Group();
  group.name = 'exhibit:induction';
  group.rotation.y = -0.55;
  const centre = new Vector3(0.8, 2.6, 0);

  const coil = createWire(new Helix(0.95, 2.6, 9), {
    radius: 0.07,
    color: 'orange',
    repeat: 0.5,
    speed: 3,
    detail: 14,
    radialSegments: 10,
    intensity: 2.4,
  });
  coil.position.copy(centre);
  group.add(coil);

  // bar magnet: N coral / S blue (DECISIONS §8), sliding along the coil axis
  const magnet = new Group();
  const north = new Mesh(new BoxGeometry(0.9, 0.5, 0.5), K.toon({ color: 'coral', gloss: 0.5 }));
  const south = new Mesh(new BoxGeometry(0.9, 0.5, 0.5), K.toon({ color: 'blue', gloss: 0.5 }));
  north.position.x = 0.45;
  south.position.x = -0.45;
  north.castShadow = south.castShadow = true;
  magnet.add(north, south);
  group.add(magnet);

  // field of the magnet (two poles); lines are re-integrated as it moves
  const nPole = new Vector3();
  const sPole = new Vector3();
  const field = barMagnetField(nPole, sPole, 1);
  const seeds = (): Vector3[] => [
    ...seedsOnLine(new Vector3(nPole.x + 0.2, nPole.y - 0.9, 0), new Vector3(nPole.x + 0.2, nPole.y + 0.9, 0), 7),
    ...seedsOnLine(new Vector3(nPole.x + 0.2, nPole.y, -0.8), new Vector3(nPole.x + 0.2, nPole.y, 0.8), 4),
  ];
  const place = (x: number): void => {
    magnet.position.set(x, centre.y, 0);
    nPole.set(x + 0.75, centre.y, 0);
    sPole.set(x - 0.75, centre.y, 0);
  };
  place(-3);
  const lines = createFieldLines({
    field,
    seeds: seeds(),
    kind: 'B',
    width: 0.03,
    dashRepeat: 1.4,
    dashSpeed: 0.7,
    trace: { step: 0.07, maxLength: 16, bothWays: true, detectLoop: false, bounds: { center: centre, radius: 4.6 }, stops: [{ position: nPole, radius: 0.12 }, { position: sPole, radius: 0.12 }] },
    capacity: 11 * 480,
  });
  group.add(lines);

  // flux through the coil's mouth and a sparse arrow grid below
  const flux = createFluxSurface({ shape: 'disc', size: [1.7, 1.7], density: 3.2, reference: 0.9 });
  // drawn at the mouth that faces the camera; the flux itself is sampled where the magnet enters
  flux.position.copy(centre).setX(centre.x + 1.5);
  const mouth = centre.clone().setX(centre.x - 1.45);
  flux.rotation.y = Math.PI / 2;
  group.add(flux);
  const grid = gridPoints(new Vector3(0.5, 0.75, 0.4), [8, 0, 2.4], [9, 1, 3]);
  const arrows = createArrowField(field, { points: grid, color: SEMANTIC.fieldB, length: 0.42, magnitudeScale: 0.5 });
  group.add(arrows);

  const b = new Vector3();
  let lastFlux = 0;
  let emf = 0;
  return {
    group,
    update(dt, t) {
      // the magnet glides in, rests, glides out (smooth, periodic: 8 s)
      const x = -3.1 + 2.2 * (0.5 - 0.5 * Math.cos((t / 8) * Math.PI * 2));
      place(x);
      lines.refresh(field, seeds());
      arrows.sample(field);
      // everything here lives in the stand's local frame: the mouth's normal is local +X
      field(mouth, b);
      flux.flux = b.x / 0.9;
      const phi = b.x * flux.area;
      // Faraday: EMF = −dΦ/dt → pulse brightness ∝ |EMF|, direction = its sign (Lenz)
      if (dt > 0) emf += ((lastFlux - phi) / dt - emf) * Math.min(1, dt * 6);
      lastFlux = phi;
      coil.material.power = Math.min(Math.abs(emf) * 1.2, 1);
      coil.material.speed = Math.sign(emf) * 1.5;
    },
  };
}
