/**
 * PhotonEmitter — the "photon gun" of step `ions-photons`: a round toy console on a stand with a ribbed
 * barrel along −X and a glowing lens in the colour of the photon it is about to fire. Origin = centre of the
 * body; the muzzle is at `MUZZLE_X` on the local X axis. `charge` (0…1) brightens the lens (hover / firing).
 */
import { CylinderGeometry, Group, LatheGeometry, Mesh, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { K, type KGlowMaterial } from '@/style';

export const MUZZLE_X = -1.95;

export interface PhotonGun {
  group: Group;
  lens: KGlowMaterial;
  /** Recoil / glow amount 0…1 (tween it on fire). */
  kick: number;
}

export function createPhotonGun(): PhotonGun {
  const group = new Group();
  group.name = 'photon-gun';
  const shell = K.toon({
    gradient: { bottom: 'bg.indigo', top: 'slate', range: [-0.9, 0.9] },
    rim: 1.1,
    gloss: 0.4,
  });
  const metal = K.metal({ color: 'mist' });
  const accent = K.glow({ color: 'cyan', intensity: 1.4, keepHue: true, whiten: 0 });
  const lens = K.glow({ color: 'yellow', intensity: 1.6, keepHue: true });

  const head = new Group(); // body + barrel: recoils along +X
  const body = new Mesh(new SphereGeometry(0.95, 48, 32), shell);
  body.scale.set(1.05, 0.92, 0.92);
  // barrel: lathe profile along the axis (rotated to −X), with cooling ribs and a flared muzzle
  const profile = [
    [0, 0],
    [0.5, 0],
    [0.52, 0.5],
    [0.4, 0.62],
    [0.4, 1.3],
    [0.5, 1.42],
    [0.5, 1.56],
    [0.36, 1.56],
    [0.3, 1.2],
    [0, 1.2],
  ].map(([x, y]) => new Vector2(x, y));
  const barrel = new Mesh(new LatheGeometry(profile, 40), metal);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = -0.4;
  const ribs = [0.72, 0.9, 1.08].map((d) => {
    const rib = new Mesh(new TorusGeometry(0.42, 0.035, 8, 40), accent);
    rib.rotation.y = Math.PI / 2;
    rib.position.x = -0.4 - d;
    return rib;
  });
  const glass = new Mesh(new SphereGeometry(0.3, 24, 16), lens);
  glass.scale.set(0.35, 1, 1);
  glass.position.x = -0.4 - 1.3;
  // interactive affordance: a cyan ring around the body and two status lights
  const band = new Mesh(new TorusGeometry(0.93, 0.04, 10, 64), accent);
  band.rotation.y = Math.PI / 2;
  band.position.x = 0.1;
  const lights = [-0.25, 0.25].map((z) => {
    const light = new Mesh(new SphereGeometry(0.07, 12, 8), lens);
    light.position.set(-0.35, 0.82, z);
    return light;
  });
  head.add(body, barrel, ...ribs, glass, band, ...lights);

  const stand = new Mesh(new CylinderGeometry(0.16, 0.22, 1.5, 20), metal);
  stand.position.y = -1.5;
  const foot = new Mesh(new CylinderGeometry(0.85, 1, 0.22, 40), shell);
  foot.position.y = -2.3;
  const yoke = new Mesh(new TorusGeometry(0.98, 0.07, 10, 40, Math.PI), metal);
  yoke.rotation.z = Math.PI;
  for (const m of [body, barrel, foot]) m.castShadow = true;
  group.add(head, stand, foot, yoke);

  let kick = 0;
  return {
    group,
    lens,
    get kick() {
      return kick;
    },
    set kick(v: number) {
      kick = v;
      head.position.x = 0.28 * v;
      lens.intensity = 1.6 + 2.2 * v;
    },
  };
}
