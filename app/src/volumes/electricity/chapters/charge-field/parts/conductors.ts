/**
 * Models of step 5 (kit `Builder`, metres ≡ scene units here): the polished metal ball, the same ball as a
 * hollow shell with a quarter cut away, the Faraday cage of thin wires, the drop-shaped conductor with a sharp
 * tip, the two electrode bars that set up the uniform field, and the little phone of the cage demo.
 */
import { BoxGeometry, type Group, Mesh } from 'three';
import { Builder, G, vehicle } from '@/kit';
import { K } from '@/style';
import { CONDUCTOR, TABLE } from '../layout';

const R = CONDUCTOR.radius;

export function metalBall(): Group {
  const b = new Builder('metal-ball');
  b.sphere(R, { seg: 44, slot: 'metal', c: ['slate', 'mist'] });
  return b.build().group;
}

/** Hollow shell, the front-right quarter (0…90° of azimuth) removed; cut faces in a darker tone. */
export function cutBall(): Group {
  const section: [number, number][] = [];
  const n = 28;
  for (let i = 0; i <= n; i++)
    section.push([Math.sin((i / n) * Math.PI) * R, -Math.cos((i / n) * Math.PI) * R]);
  for (let i = n; i >= 0; i--)
    section.push([Math.sin((i / n) * Math.PI) * R * 0.84, -Math.cos((i / n) * Math.PI) * R * 0.84]);
  const shell = G.revolve(section, { seg: 44, phiStart: Math.PI / 2, phiLength: Math.PI * 1.5 });
  const b = new Builder('cut-ball');
  b.add(shell.shell, { slot: 'metal', c: ['slate', 'mist'] });
  if (shell.caps) b.add(shell.caps, { slot: 'toon', c: 'slate' });
  return b.build().group;
}

/** Cage of wires: 8 meridians and 5 parallels of radius R. */
export function cage(): Group {
  const b = new Builder('faraday-cage');
  for (let k = 0; k < 8; k++)
    b.ring(R, 0.028, {
      seg: 48,
      tubeSeg: 6,
      slot: 'metal',
      c: 'steel.light',
      axis: 'x',
      rot: [0, (k * Math.PI) / 8, 0],
    });
  for (let k = -2; k <= 2; k++) {
    const lat = (k * Math.PI) / 6;
    b.ring(R * Math.cos(lat), 0.028, {
      seg: 48,
      tubeSeg: 6,
      slot: 'metal',
      c: 'steel.light',
      at: [0, R * Math.sin(lat), 0],
    });
  }
  b.cyl(0.09, 0.2, { seg: 12, slot: 'metal', c: 'steel', at: [0, -R - 0.2, 0] });
  return b.build().group;
}

/** Drop-shaped conductor: a ball that tapers to a needle tip on +X (tip at x = `TIP_X`). */
export const TIP_X = 2.25;
export function teardrop(): Group {
  const profile: [number, number][] = [[0, -R * 0.9]];
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 0.62;
    profile.push([Math.sin(a) * R * 0.9, -Math.cos(a) * R * 0.9]);
  }
  const [r0, x0] = profile[profile.length - 1]!;
  for (let i = 1; i <= 12; i++) {
    const u = i / 12;
    profile.push([r0 * (1 - u) ** 1.6, x0 + (TIP_X - x0) * u]);
  }
  const b = new Builder('teardrop');
  b.lathe(profile, { seg: 40, slot: 'metal', c: ['slate', 'mist'], axis: 'x' });
  return b.build().group;
}

/** Electrode bars at x = ∓plates: `coral` (+) on the left, `blue`-ish `cyan` (−) on the right; E points left → right. */
export function electrodes(): Group {
  const b = new Builder('electrodes');
  for (const side of [-1, 1]) {
    const x = side * CONDUCTOR.plates;
    b.box(0.26, 1.5, CONDUCTOR.halfWidth * 2 + 0.6, {
      r: 0.1,
      slot: 'gloss',
      c: side < 0 ? ['coral.dark', 'coral'] : ['cyan.dark', 'cyan'],
      at: [x, 0.25, 0],
    });
    b.box(0.5, 0.25, CONDUCTOR.halfWidth * 2 + 0.9, { r: 0.08, c: ['bg.plum', 'slate'], at: [x, 0, 0] });
  }
  return b.build().group;
}

export interface Phone {
  group: Group;
  /** 0…1: how many of the four signal bars are lit. */
  signal: number;
  update(): void;
}

export function phone(): Phone {
  const b = new Builder('phone');
  b.box(0.52, 0.92, 0.09, { r: 0.07, slot: 'gloss', c: ['ink', 'slate'], mid: true });
  b.box(0.42, 0.74, 0.02, { r: 0.03, slot: 'glow', c: 'bg.plum', at: [0, 0.02, 0.05], mid: true });
  const group = b.build().group;
  const bars = [0, 1, 2, 3].map((i) => {
    const m = new Mesh(
      new BoxGeometry(0.06, 0.1 + i * 0.09, 0.02),
      K.glow({ color: 'green', keepHue: true, whiten: 0, intensity: 1.6 }),
    );
    m.position.set(-0.13 + i * 0.09, -0.12 + i * 0.045, 0.065);
    group.add(m);
    return m;
  });
  const p: Phone = {
    group,
    signal: 1,
    update() {
      bars.forEach((m, i) => (m.material.intensity = p.signal * 4 > i + 0.5 ? 1.6 : 0.12));
    },
  };
  return p;
}

/** Miniature car on the rim of the table (hotspot «автомобіль»). */
export function miniCar(): Group {
  const car = vehicle('car', 'amber').group;
  car.scale.setScalar(0.34);
  car.position.set(TABLE.radius - 1.7, 0, 3.3);
  car.rotation.y = -0.9;
  return car;
}
