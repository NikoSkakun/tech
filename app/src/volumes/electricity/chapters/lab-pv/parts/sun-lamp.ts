/**
 * The «сонце-лампа»: a glowing sphere with a halo and a corona, and the photon stream it sends to a target —
 * wavy packets (the `@/fx` photon character) whose number follows the irradiance. Three packet sets give the
 * stream its slight spectral spread around the semantic `yellow`. Positions are in the parent's frame.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createCorona, createHalo, createPhotons, type Photons } from '@/fx';
import { K, type KGlowMaterial } from '@/style';

export interface SunLamp {
  group: Group;
  /** The lamp itself (callout / probe anchor). */
  ball: Mesh;
  /** Move the lamp and aim the photon stream at a disc of radius `spread` around `target` (lying in the plane with `planeNormal`, if given). */
  place(position: Vector3, target: Vector3, spread: number, planeNormal?: Vector3): void;
  /** Brightness 0…1.2 (irradiance / 1000 W/m²); the photon count follows it × `density` (a step may thin the stream). */
  setLevel(level: number, density?: number): void;
  /** Irradiance level last set, 0…1.2. */
  readonly level: number;
}

export interface SunLampOptions {
  radius?: number;
  /** Photons at full sun (nominal at `high`). */
  count?: number;
  /** Packet length in the parent's units. */
  packet?: number;
  speed?: number;
}

export function createSunLamp(ctx: ChapterContext, o: SunLampOptions = {}): SunLamp {
  const radius = o.radius ?? 0.42;
  const group = new Group();
  group.name = 'sun-lamp';
  const glow: KGlowMaterial = K.glow({ color: 'yellow', intensity: 2.1, whiten: 0.6, falloff: 0.6 });
  const ball = new Mesh(new SphereGeometry(radius, 40, 28), glow);
  const halo = createHalo({ color: 'yellow', size: radius * 7, intensity: 0.9, amount: 0.25 });
  const corona = createCorona({ color: 'amber', size: radius * 4.2, intensity: 0.7 });
  ball.add(halo, corona);
  group.add(ball);

  const total = ctx.quality.count(o.count ?? 40, 10);
  const share = [0.6, 0.2, 0.2];
  const sets: Photons[] = [undefined, 470, 640].map((wavelength, k) => {
    const p = createPhotons({
      count: Math.max(2, Math.round(total * share[k]!)),
      ...(wavelength ? { wavelength, keepHue: false } : {}),
      length: o.packet ?? 0.95,
      amplitude: 0.085,
      width: 0.04,
      waves: 3.2 + k,
      travel: 1,
      speed: o.speed ?? 2.6,
      intensity: 1.5,
    });
    group.add(p);
    return p;
  });
  const rng = ctx.random.fork('sun-lamp');
  // fixed pattern on the target disc (r, angle, phase) so re-aiming never reshuffles the stream
  const seeds = sets.map((p) => Array.from({ length: p.capacity }, () => [Math.sqrt(rng.next()), rng.next() * Math.PI * 2, rng.next()] as const));
  const from = new Vector3(0, 4, 0);
  const to = new Vector3();
  const dir = new Vector3();
  const u = new Vector3();
  const v = new Vector3();
  const origin = new Vector3();
  const hit = new Vector3();
  const plane = new Vector3();
  let spreadR = 1;
  let level = 1;
  let brightness = 1;

  const layout = (): void => {
    dir.subVectors(to, from);
    const dist = dir.length() - radius * 1.2;
    dir.normalize();
    // basis of the target disc: in the lit plane when one is given, else perpendicular to the rays
    const n = plane.lengthSq() > 0 ? plane : dir;
    u.set(0, 1, 0).cross(n);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
    u.normalize();
    v.crossVectors(n, u).normalize();
    sets.forEach((p, k) => {
      p.travel = dist;
      seeds[k]!.forEach(([r, a, phase], i) => {
        // parallel rays: every photon lands on its own spot of the target disc and starts `dist` before it
        hit.copy(to).addScaledVector(u, Math.cos(a) * r * spreadR).addScaledVector(v, Math.sin(a) * r * spreadR);
        origin.copy(hit).addScaledVector(dir, -dist);
        const on = i < Math.round(p.capacity * Math.min(1, level));
        p.setPhoton(i, [origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z], phase, on ? 1 : 0);
      });
      p.commit();
    });
  };

  return {
    group,
    ball,
    get level() {
      return brightness;
    },
    place(position, target, spread, planeNormal) {
      if (position.equals(from) && target.equals(to) && spread === spreadR) return;
      if (planeNormal) plane.copy(planeNormal);
      else plane.set(0, 0, 0);
      from.copy(position);
      to.copy(target);
      spreadR = spread;
      ball.position.copy(position);
      layout();
    },
    setLevel(next, density = 1) {
      const before = Math.round(total * Math.min(1, level));
      brightness = Math.max(0, next);
      // `level` is what the photon count follows: irradiance × the step's stream density
      level = brightness * density;
      glow.intensity = 0.5 + 1.7 * Math.min(1.2, brightness);
      halo.intensity = 0.15 + 0.8 * Math.min(1.2, brightness);
      corona.intensity = 0.1 + 0.65 * Math.min(1.2, brightness);
      if (Math.round(total * Math.min(1, level)) !== before) layout();
    },
  };
}
