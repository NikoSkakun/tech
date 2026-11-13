/**
 * `Charge` of the document: a smooth ball with its sign — `coral` «+», `cyan` «−» (fx character orbs, so the
 * look is the same as every charged particle of the course), a soft halo of the same colour, radius ∝ ∛|q|
 * inside 0,6…1,4 of the base, and the drag handle: a `cyan` ring with four arrows that wakes up on hover.
 */
import { type BufferGeometry, ConeGeometry, Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { damp } from '@/engine/api';
import { createHalo, createOrbs, type Orbs } from '@/fx';
import { G } from '@/kit';
import { col, K, SEMANTIC } from '@/style';
import { CHARGE_R } from '../layout';
import { clamp } from '../chapter';

export interface ChargeBall {
  group: Group;
  /** Invisible pick sphere (impostor orbs are picked through it so that the handle ring counts too). */
  proxy: Mesh;
  /** Charge in the caller's units (only sign and |q|/reference matter here). */
  q: number;
  /** Current ball radius, scene units. */
  radius: number;
  /** 0…1 hover / drag feedback, set by the owner. */
  hover: number;
  /** Upper limit of the drawn radius (two balls that come close shrink instead of intersecting). */
  limit: number;
  /** Pick sphere radius as a multiple of the ball radius (smaller for balls that sit close together). */
  grab: number;
  /** Show the drag handle at all (false for balls that cannot be moved). */
  handle: boolean;
  set(q: number): void;
  update(dt: number, t: number): void;
}

export function createChargeBall(o: { reference?: number; base?: number; phase?: number } = {}): ChargeBall {
  const reference = o.reference ?? 1;
  const base = o.base ?? CHARGE_R;
  const group = new Group();
  group.name = 'charge';
  const plus = createOrbs({ kind: 'ion', color: SEMANTIC.proton, glyph: 'plus', radius: base });
  const minus = createOrbs({ kind: 'ion', color: SEMANTIC.electron, glyph: 'minus', radius: base });
  const zero = createOrbs({ kind: 'neutron', radius: base * 0.6 });
  const halo = createHalo({ color: SEMANTIC.proton, size: base * 5, intensity: 0.7, amount: 0.2 });
  const proxy = new Mesh(new SphereGeometry(1, 12, 8), K.flat('cyan'));
  proxy.material.colorWrite = false;
  proxy.material.depthWrite = false;
  // drag handle: flat ring + four arrows, in the table plane
  const glow = K.glow({ color: 'cyan', whiten: 0, keepHue: true, intensity: 1.5 });
  const pieces: BufferGeometry[] = [new TorusGeometry(1, 0.035, 8, 48).rotateX(Math.PI / 2)];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    pieces.push(
      new ConeGeometry(0.11, 0.24, 12)
        .rotateZ(-Math.PI / 2)
        .rotateY(-a)
        .translate(Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2),
    );
  }
  const ring = new Mesh(G.mergeGeometries(pieces), glow);
  group.add(halo, plus, minus, zero, proxy, ring);

  const shown = { plus: 0, minus: 0, zero: 1, handle: 0 };
  const orbs: [Orbs, keyof typeof shown][] = [
    [plus, 'plus'],
    [minus, 'minus'],
    [zero, 'zero'],
  ];
  const ball: ChargeBall = {
    group,
    proxy,
    q: 0,
    radius: base,
    hover: 0,
    limit: Infinity,
    grab: 1.9,
    handle: true,
    set(q) {
      ball.q = q;
      // radius ∝ ∛|q| within 0,6…1,4 of the base radius (document)
      ball.radius = q === 0 ? base * 0.6 : base * clamp(Math.cbrt(Math.abs(q) / reference), 0.6, 1.4);
      halo.color.copy(col(q < 0 ? SEMANTIC.electron : SEMANTIC.proton));
    },
    update(dt, t) {
      const sign = Math.sign(ball.q);
      // a sign change cross-fades the two spheres in ≈ 0,3 s (document: «перефарбовується (0,3 s)»)
      shown.plus = damp(shown.plus, sign > 0 ? 1 : 0, 12, dt);
      shown.minus = damp(shown.minus, sign < 0 ? 1 : 0, 12, dt);
      shown.zero = damp(shown.zero, sign === 0 ? 1 : 0, 12, dt);
      const breathe = 1 + 0.02 * Math.sin(t * 1.9 + (o.phase ?? 0));
      for (const [orb, key] of orbs) {
        const k = shown[key];
        orb.visible = k > 0.02;
        orb.radius = Math.max(
          Math.min(ball.radius, ball.limit) * k * breathe * (1 + 0.08 * ball.hover),
          1e-3,
        );
      }
      halo.visible = sign !== 0;
      halo.size = ball.radius * (4.6 + 1.2 * ball.hover);
      halo.intensity = 0.55 + 0.5 * ball.hover + 0.08 * Math.sin(t * 2.3 + (o.phase ?? 0));
      proxy.scale.setScalar(Math.max(ball.radius * ball.grab, ball.grab > 1.5 ? 0.5 : 0));
      shown.handle = damp(shown.handle, ball.handle ? 0.25 + 0.75 * ball.hover : 0, 10, dt);
      ring.visible = shown.handle > 0.03;
      ring.scale.setScalar(ball.radius * (1.75 + 0.12 * Math.sin(t * 3)));
      glow.fade = shown.handle;
      ring.rotation.y = t * 0.4;
    },
  };
  ball.set(0);
  return ball;
}
