/**
 * One electron or one lye ion the reader carries by hand in the micro world (`inside/take`, `trick/wall`): drawn a
 * little larger than its kin so the hand finds it, dragged on the plane z = `PLANE_Z` of the micro frame. A `rule`
 * may hold it back (the separator stops an electron) — then it flashes. Let go, it glides home unless the step keeps it.
 */
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { K } from '@/style';
import type { Micro } from './index';
import { electrons, minusIons, type ParticleSet } from './particles';

export const PLANE_Z = 1.3;

export interface Probe {
  kind: 'electron' | 'ion';
  /** Micro position now. */
  readonly at: Vector3;
  home: Vector3;
  shown: number;
  readonly held: boolean;
  /** Seconds since it was last stopped by the rule (for a flash), Infinity if never. */
  readonly stopped: number;
  /** Return the allowed position for a wanted one (default: anywhere); mark `true` in `blocked` when held back. */
  rule: ((want: Vector3, blocked: { hit: boolean }) => Vector3) | null;
  /** Called when the reader lets it go; return true to keep it where it is (else it glides home). */
  onDrop: ((at: Vector3) => boolean) | null;
  /** Put it at a micro point now (no glide). */
  place(at: Vector3): void;
  enabled: () => boolean;
  update(dt: number, t: number): void;
}

export function createProbe(
  ctx: ChapterContext,
  micro: Micro,
  kind: 'electron' | 'ion',
  name: string,
): Probe {
  const parent = micro.field.group;
  const set: ParticleSet = kind === 'electron' ? electrons(parent, 1, 0.16) : minusIons(parent, 1, 0.3);
  const flash = new Mesh(
    new SphereGeometry(1, 16, 8),
    K.glow({ color: 'cyan', intensity: 0, additive: true }),
  );
  parent.add(flash);
  const hit = new Mesh(
    new SphereGeometry(0.8, 12, 8),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hit.name = name;
  parent.add(hit);
  ctx.qa.probe(name, hit);
  const at = new Vector3();
  const want = new Vector3();
  const world = new Vector3();
  let held = false;
  let stopped = Infinity;
  let keep = false;
  const probe: Probe = {
    kind,
    at,
    home: new Vector3(),
    shown: 0,
    get held() {
      return held;
    },
    get stopped() {
      return stopped;
    },
    rule: null,
    onDrop: null,
    enabled: () => false,
    place(p) {
      at.copy(p);
      keep = false;
    },
    update(dt, t) {
      stopped += dt;
      if (!held && !keep) at.lerp(probe.home, Math.min(1, dt * 5));
      const bob = held ? 0 : 0.06 * Math.sin(t * 2.4);
      set.put(0, at.x, at.y + bob, at.z, probe.shown);
      set.commit();
      hit.position.copy(at);
      hit.visible = probe.shown > 0.5;
      const k = Math.max(0, 1 - stopped / 0.5);
      flash.position.copy(at);
      flash.scale.setScalar(0.4 + 0.8 * (1 - k));
      // additive glow: its contribution is its intensity (the material's `opacity` is fixed at creation)
      (flash.material as ReturnType<typeof K.glow>).intensity = 1.1 * k * probe.shown;
    },
  };
  ctx.input.register(hit, {
    cursor: 'grab',
    enabled: () => probe.enabled() && probe.shown > 0.5,
    dragStart: () => {
      held = true;
      keep = false;
    },
    drag: (e) => {
      micro.toWorld(new Vector3(0, 0, PLANE_Z), world);
      const p = e.planePoint(micro.normal, world);
      if (!p) return;
      micro.toLocal(p, want);
      want.z = PLANE_Z;
      if (probe.rule) {
        const blocked = { hit: false };
        at.copy(probe.rule(want, blocked));
        if (blocked.hit && stopped > 0.35) stopped = 0;
      } else at.copy(want);
    },
    dragEnd: () => {
      held = false;
      keep = probe.onDrop?.(at) ?? false;
    },
  });
  return probe;
}
